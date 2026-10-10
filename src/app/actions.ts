'use server'

// Server Actions for Settings: sites and languages, and the API credentials.
// The Href Links page actions moved to app/(app)/seo/href-links/actions.ts
// (audit, 10 October 2026).
//
// The site tables are the server's own (migration 107): every write here goes
// through the privileged client after its access check.

import { createClient } from '@/lib/supabase/server'
import { pagesWithUrls } from '@/lib/site-pages'
import { allowedTo } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateWebhookSecret } from '@/lib/monday/webhook-secret'
import { revalidatePath } from 'next/cache'
import type { LanguageCode } from '@/lib/types/database.types'
import { ROUTES, hrefLinksSite } from '@/lib/nav/routes'

/** The detail goes to the server log; the person gets a sentence (audit, 10 October 2026). */
function notSaved(error: { message: string }): { ok: false; error: string } {
  console.error('[site settings]', error.message)
  return { ok: false, error: 'Not saved. Try again in a moment.' }
}

type SiteCode = 'aaaf' | 'hfa'

// ── Site configuration ──────────────────────────────────────────────────────
// The four actions below back the Sites & languages card on Settings, which is
// an admin-only surface. Three of them had no server-side check at all, and the
// fourth was miscounted as gated during the audit (the sweep read the following
// non-exported function's guard as its own).
//
// Page gating alone was not enough: a server action is reachable by its id out
// of the client bundle, which is a public static asset, so "the page redirects
// you" is not the same as "the action refuses you". Changing a site's Monday
// board id from here would silently break the Href Links sync.

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
  if (!(await allowedTo('cs-sites'))) return { ok: false, error: 'Only admins can change site configuration.' }

  const supabase = createAdminClient()

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
  if (siteErr) return notSaved(siteErr)
  if (!site) return { ok: false, error: 'Site not found' }

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
  if (updateErr) return notSaved(updateErr)

  // Flag every page of this site that already has at least one URL.
  let pageIds: string[]
  try {
    pageIds = [...await pagesWithUrls(supabase, site.id)]
  } catch (e) {
    // The languages are saved; say the flagging did not happen rather than
    // answer ok with nothing flagged (audit, 10 October 2026).
    console.error('[site languages]', (e as Error).message)
    return { ok: false, error: 'The languages were saved, but the pages could not be flagged for a new hreflang. Save again to retry.' }
  }

  let flaggedPagesCount = 0
  if (pageIds.length > 0) {
    const { error: flagErr, count } = await supabase
      .from('pages')
      .update({ needs_hreflang_update: true }, { count: 'exact' })
      .in('id', pageIds)
    if (flagErr) return notSaved(flagErr)
    flaggedPagesCount = count ?? pageIds.length
  }

  revalidatePath('/admin/settings')
  revalidatePath('/')
  revalidatePath(hrefLinksSite(input.siteCode))
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
  if (!(await allowedTo('cs-sites'))) return { ok: false, error: 'Only admins can change site configuration.' }

  const supabase = createAdminClient()

  const lang = input.language.trim().toLowerCase()
  if (lang === 'en') return { ok: false, error: 'English anchors x-default and cannot be paused.' }

  const { data: site, error: siteErr } = await supabase
    .from('sites')
    .select('id, languages, paused_languages')
    .eq('code', input.siteCode)
    .single()
  if (siteErr) return notSaved(siteErr)
  if (!site) return { ok: false, error: 'Site not found' }

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
  if (updErr) return notSaved(updErr)

  revalidatePath('/admin/settings')
  revalidatePath('/')
  revalidatePath(hrefLinksSite(input.siteCode))
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
  if (!(await allowedTo('cs-sites'))) return { ok: false, error: 'Only admins can change site configuration.' }

  const supabase = createAdminClient()
  const trimmed = input.boardId.trim()
  // Monday board IDs are all-digit. Empty string clears the value.
  if (trimmed !== '' && !/^\d+$/.test(trimmed)) {
    return { ok: false, error: 'Board ID must be digits only (the number in the board URL).' }
  }
  const { error } = await supabase
    .from('sites')
    .update({ monday_board_id: trimmed === '' ? null : trimmed })
    .eq('code', input.siteCode)
  if (error) return notSaved(error)
  revalidatePath('/admin/settings')
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
  if (!(await allowedTo('cs-sites'))) return { ok: false, error: 'Only admins can change site configuration.' }

  const supabase = createAdminClient()

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
  if (error) return notSaved(error)

  revalidatePath('/admin/settings')
  revalidatePath(hrefLinksSite(input.siteCode))
  return { ok: true }
}

/**
 * Saves the Monday API token to app_settings (singleton row).
 * SECURITY NOTE: with the current anon-key + no-RLS setup, this value is
 * readable by anyone with the public anon key. For production, gate this
 * with RLS + service_role, or migrate to Supabase Vault / env var.
 */
/**
 * Shared write path for every credential on Settings. Migration 052 made
 * app_settings admin-only at the database level, so this check is now the
 * second lock rather than the only one, and it exists to turn a silent RLS
 * rejection into a message the UI can show. Before today there was no check
 * here at all and no RLS either.
 */
async function saveAppSecret(
  column: 'monday_api_token' | 'tsheets_api_token',
  raw: string,
  alsoRevalidate: string[] = [],
): Promise<{ ok: boolean; error?: string }> {
  if (!(await allowedTo('cs-apis'))) return { ok: false, error: 'Only admins can change this.' }

  const supabase = await createClient()
  const trimmed = raw.trim()
  const value = trimmed === '' ? null : trimmed
  // Spelled out per column rather than a computed key: Supabase's typed client
  // cannot check a dynamic key, and this is the one place secrets are written.
  const patch =
    column === 'monday_api_token' ? { monday_api_token: value } : { tsheets_api_token: value }

  const { error } = await supabase
    .from('app_settings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('singleton_id', 1)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/settings')
  for (const path of alsoRevalidate) revalidatePath(path)
  return { ok: true }
}

export async function saveMondayApiToken(input: { value: string }) {
  return saveAppSecret('monday_api_token', input.value)
}

/**
 * Generates a fresh Monday webhook secret and returns it, so Settings can show
 * the full URL to paste into Monday.
 *
 * Regenerating invalidates the old URL immediately, which breaks the Href Links
 * sync until the webhooks on the Monday side are recreated. The UI warns about
 * that; nothing here can soften it, because two live secrets at once would
 * defeat the point.
 */
export async function regenerateMondayWebhookSecret(): Promise<{ ok: boolean; secret?: string; error?: string }> {
  if (!(await allowedTo('cs-apis'))) return { ok: false, error: 'Only admins can change this.' }

  const secret = generateWebhookSecret()
  const supabase = await createClient()
  const { error } = await supabase
    .from('app_settings')
    .update({ monday_webhook_secret: secret, updated_at: new Date().toISOString() })
    .eq('singleton_id', 1)

  if (error) return { ok: false, error: error.message }
  revalidatePath('/admin/settings')
  revalidatePath('/admin/automations')
  return { ok: true, secret }
}

/**
 * Saves the TSheets (QuickBooks Time) API token to app_settings.
 * Same security model as monday_api_token, full value stays server-side,
 * client only sees { exists, last4 }.
 */
export async function saveTsheetsApiToken(input: { value: string }) {
  return saveAppSecret('tsheets_api_token', input.value, [ROUTES.i7])
}
