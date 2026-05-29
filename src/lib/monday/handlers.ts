/**
 * Monday webhook event handlers.
 *
 * Two handlers today:
 *
 *   - runLinkHandler  → triggered when "Href Link(s)" goes to "Run Link"
 *                       on a single language item. Pulls that item's URL,
 *                       saves it, and if all languages now have URLs,
 *                       flips every sibling item to "Apply Link".
 *
 *   - doneHandler     → triggered when "Href Link(s)" goes to "Done" on a
 *                       single language item. Marks that language as
 *                       confirmed_on_live in our DB; if all languages are
 *                       now confirmed, stamps confirmed_done_at.
 *
 * Both share the same setup: identify the site by board, load column
 * mapping, read the item from Monday, map the Language label to a BCP-47
 * code. Refactored into `prepareEventContext` to keep handlers focused
 * on their business logic.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { fetchItem, setStatusLabel } from './client'

interface SiteRow {
  id: string
  code: string
  languages: string[]
  monday_board_id: string | null
  monday_column_ids: MondayColumnConfig | null
}

export interface MondayColumnConfig {
  hrefLinksStatus: string
  language: string
  pageLink: string
  /** Monday label → our BCP-47 code, e.g. { "English": "en", "Swahili": "sw" } */
  languageMap: Record<string, string>
}

interface HandlerCtx {
  token: string
  supabase: SupabaseClient
}

interface PreparedEvent {
  site: SiteRow
  cfg: MondayColumnConfig
  pageName: string
  langCode: string
  pageUrl: string | null
  mondayItemId: string
}

/**
 * Shared setup: identify the site by boardId, fetch the item from Monday,
 * extract name/language/URL. Returns null with a reason string if we can't
 * proceed (which gets logged to monday_events.result).
 */
async function prepareEventContext(
  boardId: string,
  itemId: string,
  ctx: HandlerCtx,
): Promise<PreparedEvent | string> {
  // 1. Find which site this board belongs to.
  const { data: site } = await ctx.supabase
    .from('sites')
    .select('id, code, languages, monday_board_id, monday_column_ids')
    .eq('monday_board_id', boardId)
    .maybeSingle<SiteRow>()
  if (!site) return `skipped:unknown board ${boardId}`
  if (!site.monday_column_ids) return `skipped:no column mapping for ${site.code}`
  const cfg = site.monday_column_ids

  // 2. Fetch the item from Monday with the columns we need.
  const item = await fetchItem({
    token: ctx.token,
    itemId,
    columnIds: [cfg.language, cfg.pageLink],
  })
  if (!item) return `skipped:item ${itemId} not found in Monday`

  // 3. Extract Language label and map to BCP-47.
  const langCol = item.column_values.find(c => c.id === cfg.language)
  const langLabel = langCol?.text?.trim() ?? ''
  if (!langLabel) return `skipped:item ${itemId} has no language label`
  const langCode = cfg.languageMap[langLabel]
  if (!langCode) return `skipped:unknown language "${langLabel}" for ${site.code}`
  if (!site.languages.includes(langCode)) {
    return `skipped:language ${langCode} not configured for ${site.code}`
  }

  // 4. Extract Page Link URL (may be empty — that's not necessarily a
  //    blocker for the Done handler, only for Run Link).
  const linkCol = item.column_values.find(c => c.id === cfg.pageLink)
  const pageUrl = linkCol?.text?.trim() || null

  return {
    site,
    cfg,
    pageName: item.name.trim(),
    langCode,
    pageUrl,
    mondayItemId: item.id,
  }
}

interface PageRow {
  id: string
  confirmed_done_at: string | null
}

/**
 * Run Link handler. Steps 3–6 of the workflow.
 *
 * Idempotent: re-running with the same Monday data produces the same DB
 * state. Safe under webhook retries.
 */
export async function runLinkHandler(
  boardId: string,
  itemId: string,
  ctx: HandlerCtx,
): Promise<string> {
  const prepared = await prepareEventContext(boardId, itemId, ctx)
  if (typeof prepared === 'string') return prepared
  const { site, cfg, pageName, langCode, pageUrl, mondayItemId } = prepared

  if (!pageUrl) return `skipped:item ${itemId} has empty Page Link`

  // Upsert page by (site_id, name). Name is the agreed-upon grouping key
  // for sibling items across languages.
  const { data: page, error: pageErr } = await ctx.supabase
    .from('pages')
    .upsert(
      { site_id: site.id, name: pageName },
      { onConflict: 'site_id,name', ignoreDuplicates: false },
    )
    .select('id, confirmed_done_at')
    .single<PageRow>()
  if (pageErr || !page) return `error:upsert page (${pageErr?.message ?? 'no row'})`

  // Upsert page_urls for this language. Tracks the source Monday item id
  // so we can write Apply Link back to each sibling later.
  const { error: urlErr } = await ctx.supabase
    .from('page_urls')
    .upsert(
      {
        page_id: page.id,
        language_code: langCode,
        url: pageUrl,
        monday_item_id: mondayItemId,
      },
      { onConflict: 'page_id,language_code', ignoreDuplicates: false },
    )
  if (urlErr) return `error:upsert page_url (${urlErr.message})`

  // Completeness check: do we have a URL for every site language?
  const { data: urlRows } = await ctx.supabase
    .from('page_urls')
    .select('language_code, monday_item_id')
    .eq('page_id', page.id)
  const haveLangs = new Set((urlRows ?? []).map(r => r.language_code))
  const allReady = site.languages.every(l => haveLangs.has(l))
  if (!allReady) {
    const missing = site.languages.filter(l => !haveLangs.has(l)).join(',')
    revalidatePath(`/${site.code}`)
    revalidatePath(`/${site.code}/${page.id}`)
    return `ok:saved ${langCode} (waiting on: ${missing})`
  }

  // All ready — flip every sibling item to "Apply Link" in Monday. We do
  // this serially and swallow individual failures so one broken item
  // doesn't block the rest. (Vercel free-tier function time budget is
  // tight; if siblings ever explode in count, batch via subscriptions.)
  const siblingIds = (urlRows ?? [])
    .map(r => r.monday_item_id)
    .filter((id): id is string => !!id)
  const targetBoardId = site.monday_board_id ?? boardId
  const failures: string[] = []
  for (const sib of siblingIds) {
    try {
      await setStatusLabel({
        token: ctx.token,
        boardId: targetBoardId,
        itemId: sib,
        columnId: cfg.hrefLinksStatus,
        label: 'Apply Link',
      })
    } catch (e) {
      failures.push(`${sib}:${(e as Error).message}`)
    }
  }

  // Bust the Server Component cache for the project list + the page detail
  // so the UI shows the new URL/lang without a manual refresh.
  revalidatePath(`/${site.code}`)
  revalidatePath(`/${site.code}/${page.id}`)

  if (failures.length > 0) {
    return `partial:applied to ${siblingIds.length - failures.length}/${siblingIds.length}; failed: ${failures.join(' ')}`
  }
  return `ok:applied Apply Link to ${siblingIds.length} sibling items`
}

interface ConfirmationRow {
  language_code: string
  confirmed_on_live: boolean
}

interface PageWithMondayRow extends PageRow {
  monday_lang_status: Record<string, boolean> | null
}

/**
 * Done handler. Step 12 of the workflow.
 *
 * Updates two parallel sets of data:
 *
 *  - `confirmations` (HREFLANG SYSTEM side). What our app considers
 *    "verified live" for the hreflang tag. Drives the "All Live" badge
 *    and date stamp.
 *
 *  - `pages.monday_lang_status` + `pages.monday_status` (MONDAY/WP side).
 *    Mirror of Monday's truth — what Monday says is implemented. Drives
 *    the MONDAY (WORDPRESS) column block in the list.
 *
 * They're both updated on the same event because in the new workflow
 * "Monday Done" IS the source of truth — there's no longer a separate
 * SEO 2 manual confirmation step. If you ever want to decouple them
 * (e.g. require human verification before HREFLANG side flips), split
 * this into two handlers.
 */
export async function doneHandler(
  boardId: string,
  itemId: string,
  ctx: HandlerCtx,
): Promise<string> {
  const prepared = await prepareEventContext(boardId, itemId, ctx)
  if (typeof prepared === 'string') return prepared
  const { site, pageName, langCode } = prepared

  // Find the page — Done can't create it (the URL must have been set
  // earlier via Run Link). If missing, log + skip.
  const { data: page } = await ctx.supabase
    .from('pages')
    .select('id, confirmed_done_at, monday_lang_status')
    .eq('site_id', site.id)
    .eq('name', pageName)
    .maybeSingle<PageWithMondayRow>()
  if (!page) return `skipped:page "${pageName}" not in DB`

  const nowIso = new Date().toISOString()

  // ── HREFLANG side: confirmations table ──────────────────────────────
  const { error: confErr } = await ctx.supabase
    .from('confirmations')
    .upsert(
      {
        page_id: page.id,
        language_code: langCode,
        confirmed_on_live: true,
        confirmed_at: nowIso,
      },
      { onConflict: 'page_id,language_code', ignoreDuplicates: false },
    )
  if (confErr) return `error:upsert confirmation (${confErr.message})`

  // ── MONDAY (WP) side: mirror the per-language done flag on pages ────
  const existingMondayLang = page.monday_lang_status ?? {}
  const updatedMondayLang = { ...existingMondayLang, [langCode]: true }
  // Recompute overall Monday status. 'done' once all configured langs
  // are true; 'in_progress' if at least one but not all; 'pending' if
  // none (we should never re-enter pending here, but the logic is safe).
  const langs = site.languages
  const trueCount = langs.filter(l => updatedMondayLang[l] === true).length
  const overall: 'pending' | 'in_progress' | 'done' =
    trueCount === langs.length ? 'done'
      : trueCount === 0          ? 'pending'
      :                            'in_progress'

  // ── HREFLANG side: completeness check + auto-stamp confirmed_done_at ─
  const { data: confs } = await ctx.supabase
    .from('confirmations')
    .select('language_code, confirmed_on_live')
    .eq('page_id', page.id)
  const liveSet = new Set(
    (confs ?? []).filter((c: ConfirmationRow) => c.confirmed_on_live).map((c: ConfirmationRow) => c.language_code),
  )
  const allLive = site.languages.every(l => liveSet.has(l))

  // One UPDATE to set monday_lang_status + monday_status, and optionally
  // confirmed_done_at if this is the first time the page is fully live.
  // Single statement = atomic; safer than two updates if a retry interleaves.
  const pageUpdate: Record<string, unknown> = {
    monday_lang_status: updatedMondayLang,
    monday_status: overall,
  }
  if (allLive && !page.confirmed_done_at) {
    pageUpdate.confirmed_done_at = nowIso
  }
  const { error: updErr } = await ctx.supabase
    .from('pages')
    .update(pageUpdate)
    .eq('id', page.id)
  if (updErr) return `error:update page (${updErr.message})`

  revalidatePath(`/${site.code}`)
  revalidatePath(`/${site.code}/${page.id}`)

  const stamped = allLive && !page.confirmed_done_at ? ' [stamped All Live]' : ''
  return `ok:confirmed ${langCode} (monday=${overall}, all-live=${allLive})${stamped}`
}
