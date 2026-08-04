'use server'

// Server Actions for the page detail view and settings.
// These run on the server, are invoked from Client Components, and
// revalidate the affected routes so the UI reflects the new DB state.

import { createClient } from '@/lib/supabase/server'
import { isSecurityAdmin } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { LanguageCode } from '@/lib/types/database.types'

type SiteCode = 'aaaf' | 'hfa'

/**
 * Deletes a page and its URLs + confirmations (FK ON DELETE CASCADE).
 *
 * Important caveat: this only deletes our local copy. The corresponding
 * Monday items still exist. If you ever change their Href Link to "Run
 * Link" again, the webhook will recreate the page from scratch, which is
 * usually what you want (the system stays reactive to Monday) but worth
 * knowing when cleaning up test items.
 *
 * Also writes a `system.page_deleted` event to monday_events so the
 * Recent activity feed on the project page reflects locally-initiated
 * actions, not just inbound Monday webhooks. We reuse that table (instead
 * of a parallel one) because the feed semantics are "what happened on
 * this site, in order", the source of the event matters less than the
 * fact that it happened.
 *
 * Returns ok/error to the caller; the client component handles redirect.
 */
export async function deletePage(input: {
  pageId: string
  siteCode: SiteCode
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  // Look up the page name + site board id BEFORE deleting, so the audit
  // entry can carry meaningful subject info after the row is gone.
  const { data: page } = await supabase
    .from('pages')
    .select('name, site_id, sites(monday_board_id)')
    .eq('id', input.pageId)
    .maybeSingle<{ name: string; site_id: string; sites: { monday_board_id: string | null } | null }>()
  const pageName = page?.name ?? '(unknown)'
  const boardId = page?.sites?.monday_board_id ?? null

  // Capture the actor's email so the feed can show "by X".
  const { data: { user } } = await supabase.auth.getUser()
  const actorEmail = user?.email ?? 'unknown'

  const { error } = await supabase.from('pages').delete().eq('id', input.pageId)
  if (error) return { ok: false, error: error.message }

  // Best-effort audit log. We use the admin client because INSERT on
  // monday_events is blocked by RLS for the authenticated role (writes
  // are server-side only). Failure here is non-fatal, the delete itself
  // already succeeded.
  const admin = createAdminClient()
  await admin.from('monday_events').insert({
    event_type: 'system.page_deleted',
    board_id: boardId,
    monday_item_id: null,
    column_id: null,
    result: `ok:deleted "${pageName}" by ${actorEmail}`,
    processed_at: new Date().toISOString(),
  })

  revalidatePath(`/${input.siteCode}`)
  return { ok: true }
}

/**
 * Updates a site's `languages` array AND flags every page that already has at
 * least one saved URL as `needs_hreflang_update = TRUE`. Empty pages are left
 * alone, they're already "incomplete" by definition.
 *
 * Discontinued languages: when a language is removed, we keep its existing
 * page_urls + confirmations in the DB. The detail UI shows them faded with a
 * "language discontinued" badge, so the user can decide what to do with them
 * later (manual cleanup or revival).
 */
export async function updateSiteLanguages(input: {
  siteCode: SiteCode
  newLanguages: string[]
}): Promise<{ ok: boolean; error?: string; flaggedPagesCount?: number }> {
  const supabase = await createClient()

  // Validate
  if (input.newLanguages.length === 0) {
    return { ok: false, error: 'At least one language is required.' }
  }
  if (!input.newLanguages.includes('en')) {
    return { ok: false, error: 'English (en) is required, it powers x-default.' }
  }
  for (const lang of input.newLanguages) {
    if (!/^[a-z]{2,3}(-[a-z]{2})?$/i.test(lang)) {
      return { ok: false, error: `Invalid language code: "${lang}". Use BCP-47 (e.g. "en", "pt", "fr").` }
    }
  }

  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('id, languages')
    .eq('code', input.siteCode)
    .single()
  if (siteErr || !site) return { ok: false, error: siteErr?.message ?? 'Site not found' }

  const oldLangs = new Set(site.languages as string[])
  const newLangs = new Set(input.newLanguages)
  const added = [...newLangs].filter(l => !oldLangs.has(l))
  const removed = [...oldLangs].filter(l => !newLangs.has(l))
  const noChange = added.length === 0 && removed.length === 0
  if (noChange) return { ok: true, flaggedPagesCount: 0 }

  // Update site languages
  const { error: updateErr } = await supabase
    .from('sites')
    .update({ languages: input.newLanguages as LanguageCode[] })
    .eq('id', site.id)
  if (updateErr) return { ok: false, error: updateErr.message }

  // Flag every page of this site that already has ≥1 URL.
  // This is a 2-step query because PostgREST doesn't allow direct EXISTS subqueries.
  const { data: pagesWithUrls } = await supabase
    .from('page_urls')
    .select('page_id, pages!inner(site_id)')
    .eq('pages.site_id', site.id)
  const pageIds = [...new Set((pagesWithUrls ?? []).map(r => r.page_id))]

  let flaggedPagesCount = 0
  if (pageIds.length > 0) {
    const { error: flagErr, count } = await supabase
      .from('pages')
      .update({ needs_hreflang_update: true }, { count: 'exact' })
      .in('id', pageIds)
    if (flagErr) return { ok: false, error: flagErr.message }
    flaggedPagesCount = count ?? pageIds.length
  }

  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath(`/${input.siteCode}`)
  return { ok: true, flaggedPagesCount }
}

/**
 * Pause or resume a publishing language for a site. Pausing parks the code in
 * `sites.paused_languages` and drops it from `sites.languages`, so it disappears
 * from dashboards and reports while its history (URLs, confirmations) stays put
 * and, unlike a removal, no pages get flagged for an hreflang update. Resuming
 * moves it back. English can't be paused (it anchors x-default).
 */
export async function setLanguagePaused(input: {
  siteCode: SiteCode
  language: string
  paused: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  const lang = input.language.trim().toLowerCase()
  if (lang === 'en') return { ok: false, error: 'English anchors x-default and cannot be paused.' }

  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('id, languages, paused_languages')
    .eq('code', input.siteCode)
    .single()
  if (siteErr || !site) return { ok: false, error: siteErr?.message ?? 'Site not found' }

  const active = new Set((site.languages as string[] | null) ?? [])
  const paused = new Set((site.paused_languages as string[] | null) ?? [])

  if (input.paused) {
    if (!active.has(lang)) return { ok: false, error: `"${lang}" is not an active language.` }
    active.delete(lang)
    paused.add(lang)
  } else {
    if (!paused.has(lang)) return { ok: false, error: `"${lang}" is not paused.` }
    paused.delete(lang)
    active.add(lang)
  }

  const { error: updErr } = await supabase
    .from('sites')
    .update({ languages: [...active] as LanguageCode[], paused_languages: [...paused] as LanguageCode[] })
    .eq('id', site.id)
  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath('/settings')
  revalidatePath('/')
  revalidatePath(`/${input.siteCode}`)
  return { ok: true }
}

/**
 * Clears the needs_hreflang_update flag on a page, called automatically when
 * the user re-saves URLs or toggles confirmation after a config change.
 */
async function clearStaleFlag(supabase: Awaited<ReturnType<typeof createClient>>, pageId: string) {
  await supabase.from('pages').update({ needs_hreflang_update: false }).eq('id', pageId)
}

/**
 * Toggle a page's `not_relevant` flag. When true, the page is treated as
 * intentionally out of scope, it counts toward the project's progress
 * bar as "done" (the team isn't going to ship it, so it shouldn't
 * suppress the percent-complete number).
 */
export async function setPageNotRelevant(input: {
  pageId: string
  siteCode: SiteCode
  value: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('pages')
    .update({ not_relevant: input.value })
    .eq('id', input.pageId)
  if (error) return { ok: false, error: error.message }
  revalidatePath(`/${input.siteCode}/${input.pageId}`)
  revalidatePath(`/${input.siteCode}`)
  return { ok: true }
}

/**
 * Saves the Monday board ID for a given site.
 * Stored on `sites.monday_board_id`. Used by webhook + GraphQL queries to scope
 * Monday API calls to the correct board.
 */
export async function saveMondayBoardId(input: {
  siteCode: SiteCode
  boardId: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const trimmed = input.boardId.trim()
  // Monday board IDs are all-digit. Empty string clears the value.
  if (trimmed !== '' && !/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'Board ID must be digits only (the number in the board URL).' }
  }
  const { error } = await supabase
    .from('sites')
    .update({ monday_board_id: trimmed === '' ? null : trimmed })
    .eq('code', input.siteCode)
  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  return { ok: true }
}


/**
 * Saves the WordPress Dev/Live URLs for a given site. Either can be empty
 * (cleared → NULL). URLs are lightly validated: must parse as http(s).
 */
export async function saveSiteWpUrls(input: {
  siteCode: SiteCode
  devUrl: string
  liveUrl: string
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  function normalize(raw: string): string | null | { error: string } {
    const v = raw.trim()
    if (v === '') return null
    try {
      const u = new URL(v)
      if (u.protocol !== 'http:' && u.protocol !== 'https:') {
        return { error: 'URL must start with http:// or https://' }
      }
      return u.toString()
    } catch {
      return { error: `Not a valid URL: ${v}` }
    }
  }

  const dev = normalize(input.devUrl)
  const live = normalize(input.liveUrl)
  if (dev && typeof dev === 'object') return { ok: false, error: `Dev: ${dev.error}` }
  if (live && typeof live === 'object') return { ok: false, error: `Live: ${live.error}` }

  const { error } = await supabase
    .from('sites')
    .update({
      wp_dev_url: dev as string | null,
      wp_live_url: live as string | null,
    })
    .eq('code', input.siteCode)
  if (error) return { ok: false, error: error.message }

  revalidatePath('/settings')
  revalidatePath(`/${input.siteCode}`)
  return { ok: true }
}

/**
 * Saves the Monday API token to app_settings (singleton row).
 * SECURITY NOTE: with the current anon-key + no-RLS setup, this value is
 * readable by anyone with the public anon key. For production, gate this
 * with RLS + service_role, or migrate to Supabase Vault / env var.
 */
/**
 * Shared write path for every credential on Settings. These sit behind an
 * explicit admin check: RLS on app_settings is not in this repo, so the action
 * cannot rely on the database to refuse a non-admin. Previously there was no
 * check at all here.
 */
async function saveAppSecret(
  column: 'monday_api_token' | 'tsheets_api_token' | 'monday_signing_secret',
  raw: string,
  alsoRevalidate: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  if (!(await isSecurityAdmin())) return { ok: false, error: 'Only admins can change this.' }

  const supabase = await createClient()
  const trimmed = raw.trim()
  const value = trimmed === '' ? null : trimmed
  // Spelled out per column rather than a computed key: Supabase's typed client
  // cannot check a dynamic key, and this is the one place secrets are written.
  const patch =
    column === 'monday_api_token' ? { monday_api_token: value }
      : column === 'tsheets_api_token' ? { tsheets_api_token: value }
        : { monday_signing_secret: value }

  const { error } = await supabase
    .from('app_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('singleton_id', 1)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/settings')
  for (const path of alsoRevalidate) revalidatePath(path)
  return { ok: true }
}

export async function saveMondayApiToken(input: { value: string }) {
  return saveAppSecret('monday_api_token', input.value)
}

/**
 * The webhook signing secret. While the webhook runs in monitor mode this only
 * enables the check's reporting; enforcement is a separate, later switch (see
 * api/monday/webhook), so a wrong value here cannot take the integration down.
 */
export async function saveMondaySigningSecret(input: { value: string }) {
  return saveAppSecret('monday_signing_secret', input.value, ['/admin/automations'])
}

/**
 * Saves the TSheets (QuickBooks Time) API token to app_settings.
 * Same security model as monday_api_token, full value stays server-side,
 * client only sees { exists, last4 }.
 */
export async function saveTsheetsApiToken(input: { value: string }) {
  return saveAppSecret('tsheets_api_token', input.value, ['/tools/time-report'])
}

/**
 * Saves the URLs for a page, one per language.
 *
 * - A non-empty URL is upserted into page_urls (keyed by page_id + language_code).
 * - An empty URL field deletes any existing row for that language.
 *
 * This is the first half of the workflow: enter URLs → generate code → confirm.
 */
export async function savePageUrls(input: {
  pageId: string
  siteCode: SiteCode
  urls: { language_code: string; url: string }[]
}) {
  const supabase = await createClient()

  const toUpsert = input.urls
    .filter(u => u.url.trim() !== '')
    .map(u => ({
      page_id: input.pageId,
      language_code: u.language_code as LanguageCode,
      url: u.url.trim(),
    }))

  const toDelete = input.urls
    .filter(u => u.url.trim() === '')
    .map(u => u.language_code)

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('page_urls')
      .upsert(toUpsert, { onConflict: 'page_id,language_code' })
    if (error) return { ok: false, error: error.message }
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('page_urls')
      .delete()
      .eq('page_id', input.pageId)
      .in('language_code', toDelete as LanguageCode[])
    if (error) return { ok: false, error: error.message }
  }

  // Re-saving URLs counts as "addressing" a pending update flag
  await clearStaleFlag(supabase, input.pageId)

  revalidatePath(`/${input.siteCode}/${input.pageId}`)
  revalidatePath(`/${input.siteCode}`)
  revalidatePath('/')
  return { ok: true }
}

/**
 * Toggles the 'confirmed_on_live' flag for one language of a page,
 * meaning the hreflang tags are verified live on WordPress.
 *
 * AGREED BUSINESS RULES (decided with the user):
 *   1. ENFORCE ORDER: 'confirmed_on_live' may only be set TRUE if a URL row
 *      already exists for this (page, language). You can't confirm tags that
 *      were never generated.
 *   2. TIMESTAMPS: when the flag goes TRUE, stamp confirmed_at with NOW();
 *      when it goes FALSE, clear it back to NULL.
 *
 * The confirmations table is keyed by (page_id, language_code). Use upsert with
 * onConflict: 'page_id,language_code'.
 */
export async function toggleConfirmation(input: {
  pageId: string
  siteCode: SiteCode
  languageCode: string
  field: 'confirmed_on_live'
  value: boolean
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { pageId, languageCode, field, value } = input

  // Rule 1, ENFORCE ORDER: can't confirm live without a saved URL.
  if (field === 'confirmed_on_live' && value === true) {
    const { data: urlRow } = await supabase
      .from('page_urls')
      .select('id')
      .eq('page_id', pageId)
      .eq('language_code', languageCode as LanguageCode)
      .maybeSingle()
    if (!urlRow) return { ok: false, error: 'Enter the URL first.' }
  }

  // Build upsert payload (Rule 2, timestamps).
  const nowIso = new Date().toISOString()
  const payload = {
    page_id: pageId,
    language_code: languageCode as LanguageCode,
    confirmed_on_live: value,
    confirmed_at: value ? nowIso : null,
  }

  const { error } = await supabase
    .from('confirmations')
    .upsert(payload, { onConflict: 'page_id,language_code' })
  if (error) return { ok: false, error: error.message }

  // ──────────────────────────────────────────────────────────────
  // Auto-stamp pages.confirmed_done_at the first time ALL languages
  // become confirmed_on_live=true. We never clear it on un-toggle,
  // the historical "first done" date is preserved (matches the
  // original Google Sheet column behavior).
  if (field === 'confirmed_on_live' && value === true) {
    const { data: site } = await supabase
      .from('sites')
      .select('languages')
      .eq('code', input.siteCode)
      .single()
    const langs = (site?.languages ?? []) as LanguageCode[]

    const { data: confs } = await supabase
      .from('confirmations')
      .select('language_code, confirmed_on_live')
      .eq('page_id', pageId)

    const liveSet = new Set(
      (confs ?? []).filter(c => c.confirmed_on_live).map(c => c.language_code),
    )
    const allDone = langs.length > 0 && langs.every(l => liveSet.has(l))

    if (allDone) {
      const { data: pageRow } = await supabase
        .from('pages')
        .select('confirmed_done_at')
        .eq('id', pageId)
        .single()
      if (pageRow && !pageRow.confirmed_done_at) {
        await supabase
          .from('pages')
          .update({ confirmed_done_at: nowIso })
          .eq('id', pageId)
      }
    }
  }

  revalidatePath(`/${input.siteCode}/${input.pageId}`)
  revalidatePath(`/${input.siteCode}`)
  return { ok: true }
}
