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

interface SiteQueryRow {
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
  site: SiteQueryRow
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
    .maybeSingle<SiteQueryRow>()
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

interface PageQueryRow {
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
    .single<PageQueryRow>()
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

/**
 * Done handler. Step 12 of the workflow.
 *
 * Updates the HREFLANG SYSTEM side only:
 *
 *  - `confirmations` — what our app considers "verified live" for the
 *    hreflang tag. Drives the "All Live" badge.
 *  - `pages.confirmed_done_at` — stamped the first time ALL languages are
 *    confirmed live (preserved on un-toggle).
 *
 * Note: the Monday/WordPress implementation mirror (monday_status /
 * monday_lang_status) was removed — this handler no longer tracks it.
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
    .select('id, confirmed_done_at')
    .eq('site_id', site.id)
    .eq('name', pageName)
    .maybeSingle<PageQueryRow>()
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

  // ── Completeness check + auto-stamp confirmed_done_at ────────────────
  const { data: confs } = await ctx.supabase
    .from('confirmations')
    .select('language_code, confirmed_on_live')
    .eq('page_id', page.id)
  const liveSet = new Set(
    (confs ?? []).filter((c: ConfirmationRow) => c.confirmed_on_live).map((c: ConfirmationRow) => c.language_code),
  )
  const allLive = site.languages.every(l => liveSet.has(l))

  // Only touch the page row when this is the first time it's fully live,
  // to stamp confirmed_done_at. Otherwise there's nothing to update.
  if (allLive && !page.confirmed_done_at) {
    const { error: updErr } = await ctx.supabase
      .from('pages')
      .update({ confirmed_done_at: nowIso })
      .eq('id', page.id)
    if (updErr) return `error:update page (${updErr.message})`
  }

  revalidatePath(`/${site.code}`)
  revalidatePath(`/${site.code}/${page.id}`)

  const stamped = allLive && !page.confirmed_done_at ? ' [stamped All Live]' : ''
  return `ok:confirmed ${langCode} (all-live=${allLive})${stamped}`
}
