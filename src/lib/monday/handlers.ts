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
import { siblingItemsToApply } from './apply-links'
import { hrefLinksSite, hrefLinksPage } from '@/lib/nav/routes'
import { checkPageUrl } from '@/lib/href-links/rules'

interface SiteQueryRow {
  id: string
  code: string
  domain: string | null
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
  expectedLabel: string,
): Promise<PreparedEvent | string> {
  // 1. Find which site this board belongs to.
  const { data: site, error: siteErr } = await ctx.supabase
    .from('sites')
    .select('id, code, domain, languages, monday_board_id, monday_column_ids')
    .eq('monday_board_id', boardId)
    .maybeSingle<SiteQueryRow>()
  if (siteErr) return `error:reading the site (${siteErr.message})`
  if (!site) return `skipped:unknown board ${boardId}`
  if (!site.monday_column_ids) return `skipped:no column mapping for ${site.code}`
  const cfg = site.monday_column_ids

  // 2. Fetch the item from Monday with the columns we need, the Href Links
  //    status among them: what Monday says NOW decides, not the delivery
  //    (audit, 10 October 2026). A delivery replayed, forged by someone who
  //    learnt the secret address, or overtaken by a later change acts on
  //    nothing.
  const item = await fetchItem({
    token: ctx.token,
    itemId,
    columnIds: [cfg.language, cfg.pageLink, cfg.hrefLinksStatus],
  })
  if (!item) return `skipped:item ${itemId} not found in Monday`
  if (String(item.board?.id ?? '') !== String(boardId)) return `skipped:item ${itemId} is not on board ${boardId}`
  const statusNow = item.column_values.find(c => c.id === cfg.hrefLinksStatus)?.text?.trim() ?? ''
  if (statusNow !== expectedLabel) return `skipped:label is now "${statusNow}"`

  // 3. Extract Language label and map to BCP-47.
  const langCol = item.column_values.find(c => c.id === cfg.language)
  const langLabel = langCol?.text?.trim() ?? ''
  if (!langLabel) return `skipped:item ${itemId} has no language label`
  const langCode = cfg.languageMap[langLabel]
  if (!langCode) return `skipped:unknown language "${langLabel}" for ${site.code}`
  if (!site.languages.includes(langCode)) {
    return `skipped:language ${langCode} not configured for ${site.code}`
  }

  // 4. Extract Page Link URL (may be empty, that's not necessarily a
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
  expectedLabel = 'Run Link',
): Promise<string> {
  const prepared = await prepareEventContext(boardId, itemId, ctx, expectedLabel)
  if (typeof prepared === 'string') return prepared
  const { site, cfg, pageName, langCode, mondayItemId } = prepared

  if (!prepared.pageUrl) return `skipped:item ${itemId} has empty Page Link`
  // https, on the site's own domain (decided 10 October 2026): anything else
  // would go into the public site's hreflang, a test-site link or worse.
  const checked = checkPageUrl(prepared.pageUrl, site.domain)
  if (!checked.ok) return `skipped:link for ${langCode} refused (${checked.reason})`
  const pageUrl = checked.url

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

  // A different link for a language already confirmed live: WordPress still
  // has the old tags, so the confirmation goes and the page is flagged
  // (decided 10 October 2026).
  const [{ data: oldUrl, error: oldErr }, { data: oldConf, error: confReadErr }] = await Promise.all([
    ctx.supabase.from('page_urls').select('url').eq('page_id', page.id).eq('language_code', langCode).maybeSingle<{ url: string }>(),
    ctx.supabase.from('confirmations').select('confirmed_on_live').eq('page_id', page.id).eq('language_code', langCode).maybeSingle<{ confirmed_on_live: boolean | null }>(),
  ])
  if (oldErr || confReadErr) return `error:reading the page (${(oldErr ?? confReadErr)!.message})`
  const changedLive = !!oldUrl && oldUrl.url !== pageUrl && oldConf?.confirmed_on_live === true

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

  if (changedLive) {
    const [{ error: unconfErr }, { error: flagErr }] = await Promise.all([
      ctx.supabase.from('confirmations').update({ confirmed_on_live: false, confirmed_at: null })
        .eq('page_id', page.id).eq('language_code', langCode),
      ctx.supabase.from('pages').update({ needs_hreflang_update: true }).eq('id', page.id),
    ])
    if (unconfErr || flagErr) return `error:clearing the confirmation (${(unconfErr ?? flagErr)!.message})`
  }
  const note = changedLive ? `ok:link changed for ${langCode}, confirmation removed` : null

  // Completeness check: do we have a URL for every site language?
  const { data: urlRows, error: urlsErr } = await ctx.supabase
    .from('page_urls')
    .select('language_code, monday_item_id')
    .eq('page_id', page.id)
  if (urlsErr) return `error:reading the links (${urlsErr.message})`
  const haveLangs = new Set((urlRows ?? []).map(r => r.language_code))
  const allReady = site.languages.every(l => haveLangs.has(l))
  if (!allReady) {
    const missing = site.languages.filter(l => !haveLangs.has(l)).join(',')
    revalidatePath(hrefLinksSite(site.code))
    revalidatePath(hrefLinksPage(site.code, page.id))
    return note ?? `ok:saved ${langCode} (waiting on: ${missing})`
  }

  // All ready, flip every sibling item to "Apply Link" in Monday. We do
  // this serially and swallow individual failures so one broken item
  // doesn't block the rest. (If siblings ever explode in count, batch via
  // subscriptions.)
  // Active languages only: a paused or discontinued language keeps its
  // page_urls row, and telling Monday to apply its link would undo the pause
  // (audit finding M5-1).
  const siblingIds = siblingItemsToApply(urlRows ?? [], site.languages)
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
  revalidatePath(hrefLinksSite(site.code))
  revalidatePath(hrefLinksPage(site.code, page.id))

  if (failures.length > 0) {
    return `partial:applied to ${siblingIds.length - failures.length}/${siblingIds.length}; failed: ${failures.join(' ')}`
  }
  return note ?? `ok:applied Apply Link to ${siblingIds.length} sibling items`
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
 *  - `confirmations`, what our app considers "verified live" for the
 *    hreflang tag. Drives the "All Live" badge.
 *  - `pages.confirmed_done_at`, stamped the first time ALL languages are
 *    confirmed live (preserved on un-toggle).
 *
 * Note: the Monday/WordPress implementation mirror (monday_status /
 * monday_lang_status) was removed, this handler no longer tracks it.
 */
export async function doneHandler(
  boardId: string,
  itemId: string,
  ctx: HandlerCtx,
  expectedLabel = 'Done',
): Promise<string> {
  const prepared = await prepareEventContext(boardId, itemId, ctx, expectedLabel)
  if (typeof prepared === 'string') return prepared
  const { site, pageName, langCode } = prepared

  // Find the page, Done can't create it (the URL must have been set
  // earlier via Run Link). If missing, log + skip.
  const { data: page, error: pageReadErr } = await ctx.supabase
    .from('pages')
    .select('id, confirmed_done_at')
    .eq('site_id', site.id)
    .eq('name', pageName)
    .maybeSingle<PageQueryRow>()
  if (pageReadErr) return `error:reading the page (${pageReadErr.message})`
  if (!page) return `skipped:page "${pageName}" not in DB`

  // The portal's own rule: no confirmation without a saved link (audit,
  // 10 October 2026). The webhook confirmed one anyway.
  const { data: urlRow, error: urlReadErr } = await ctx.supabase
    .from('page_urls').select('id').eq('page_id', page.id).eq('language_code', langCode).maybeSingle()
  if (urlReadErr) return `error:reading the link (${urlReadErr.message})`
  if (!urlRow) return `skipped:Done for ${langCode} without a saved link`

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
  const { data: confs, error: confsErr } = await ctx.supabase
    .from('confirmations')
    .select('language_code, confirmed_on_live')
    .eq('page_id', page.id)
  if (confsErr) return `error:reading the confirmations (${confsErr.message})`
  const liveSet = new Set(
    (confs ?? []).filter((c: ConfirmationRow) => c.confirmed_on_live).map((c: ConfirmationRow) => c.language_code),
  )
  const allLive = site.languages.every(l => liveSet.has(l))

  // Only touch the page row when this is the first time it's fully live,
  // to stamp confirmed_done_at. Otherwise there's nothing to update.
  if (allLive && !page.confirmed_done_at) {
    // Only where still empty: two Done at once stamp it once.
    const { error: updErr } = await ctx.supabase
      .from('pages')
      .update({ confirmed_done_at: nowIso })
      .eq('id', page.id)
      .is('confirmed_done_at', null)
    if (updErr) return `error:update page (${updErr.message})`
  }

  revalidatePath(hrefLinksSite(site.code))
  revalidatePath(hrefLinksPage(site.code, page.id))

  const stamped = allLive && !page.confirmed_done_at ? ' [stamped All Live]' : ''
  return `ok:confirmed ${langCode} (all-live=${allLive})${stamped}`
}
