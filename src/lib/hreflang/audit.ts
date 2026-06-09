/**
 * hreflang/audit.ts — the Run Link audit data layer.
 *
 * Reconciles two independent sources of truth that the rest of the app keeps
 * separate:
 *
 *   1. THE SYSTEM  — `pages` + `page_urls` + `confirmations`. What the hreflang
 *      webhook captured: which language URLs we received (Run Link) and which
 *      went live (Done).
 *   2. MONDAY (live) — the "Href Link(s)" status column per language item, now
 *      ingested into `monday_snapshot` by the cron (config.ts `hrefLinkCol`).
 *
 * The webhook is APPEND-ONLY: it creates a page + saves a URL the moment Run
 * Link fires, but never retracts when Monday's status is later changed or an
 * item is renamed. That asymmetry is exactly what drifts the two sources apart
 * (e.g. "12 pages in the system at 1-of-2 but only 9 still at Run Link in
 * Monday"). This module cross-references them and labels every page so the
 * discrepancy is self-serve instead of a manual count.
 *
 * Read-only: it reports, it never writes back to Monday or the DB.
 */

import { createClient } from '@/lib/supabase/server'

/** Monday Href Link labels we recognise, in workflow order. Anything else
 *  (blank, a reverted/other label) reads as "off-workflow". */
export type HrefLabel = 'Run Link' | 'Apply Link' | 'Done'
const KNOWN_HREF: ReadonlySet<string> = new Set<HrefLabel>(['Run Link', 'Apply Link', 'Done'])

export type AuditStatus =
  | 'completed' //        all langs live (or not relevant) — done, in sync
  | 'run_in_progress' //  Monday Run Link, system has the URL(s) — normal, building up
  | 'apply_awaiting' //   all URLs in, Monday at Apply Link, awaiting Done — normal, in flight
  | 'stale_desync' //     system has URL(s) but the Monday item is NOT Run/Apply/Done — lingering
  | 'missing_system' //   Monday at Run Link but the system never captured it — webhook missed
  | 'orphan_system' //    system page with no matching Monday item — renamed/deleted in Monday

export interface AuditLang {
  code: string
  hasUrl: boolean //      system holds a URL for this language (Run Link landed)
  confirmed: boolean //   system confirmed it live (Done)
  mondayHref: string | null // current Monday Href Link label; null = no Monday item for this lang
}

export interface AuditRow {
  name: string
  status: AuditStatus
  langs: AuditLang[]
  /** Short human explanation of why this row landed in its status. */
  note: string
}

export interface HreflangAudit {
  site: { code: string; name: string } | null
  languages: string[]
  /** When the cron last wrote the snapshot we read Monday status from. */
  snapshotIngestedAt: string | null
  /** False when the snapshot predates the `hrefLinkCol` ingest — the audit
   *  can't run until the next cron run populates the Href Link column. */
  hasHrefColumn: boolean
  rows: AuditRow[]
  counts: {
    systemOngoing: number //  system pages not completed (the "12")
    mondayRunLink: number //  Monday items currently at Run Link (the "9")
    byStatus: Record<AuditStatus, number>
  }
}

// ── Monday snapshot shapes (subset we read) ─────────────────────────────────
interface SnapColumnValue {
  id: string
  text: string | null
}
interface SnapItem {
  id: string
  name: string
  column_values: SnapColumnValue[]
}
interface MondayColumnIds {
  hrefLinksStatus: string
  language: string
  languageMap: Record<string, string>
}

/**
 * The classification rules — the heart of the audit, kept as one pure function
 * so the policy is in one readable place. Each branch maps a (system × Monday)
 * combination to a status + a note. Tweak the rules here if the workflow's
 * definition of "a problem" changes.
 */
function classifyPage(
  name: string,
  langs: AuditLang[],
  sys: { present: boolean; completed: boolean },
): AuditRow {
  const withUrl = langs.filter((l) => l.hasUrl)
  const mondayRun = langs.filter((l) => l.mondayHref === 'Run Link')
  const anyMondayItem = langs.some((l) => l.mondayHref !== null)

  // 1. Done — every language live (or the page was opted out). In sync.
  if (sys.present && sys.completed) {
    return { name, status: 'completed', langs, note: 'Concluída — todos os idiomas live.' }
  }

  // 2. Monday wants it (Run Link) but the system never captured a URL for that
  //    language → the webhook missed it. Actionable: re-fire / check the link.
  const runMissingInSys = mondayRun.filter((l) => !l.hasUrl)
  if (runMissingInSys.length > 0) {
    return {
      name,
      status: 'missing_system',
      langs,
      note: `Run Link no Monday mas sem URL no sistema: ${runMissingInSys.map((l) => l.code.toUpperCase()).join(', ')}.`,
    }
  }

  // 3. System holds a URL but there's no Monday item at all for this page →
  //    the item was renamed or deleted in Monday; the system page is orphaned.
  if (sys.present && withUrl.length > 0 && !anyMondayItem) {
    return { name, status: 'orphan_system', langs, note: 'Página no sistema sem item correspondente no Monday (renomeada/excluída).' }
  }

  // 4. System holds a URL, but the matching Monday item is OFF-workflow (blank /
  //    reverted — not Run/Apply/Done). The lingering case: in the system at
  //    "N of M" yet no longer Run Link in Monday.
  const stale = withUrl.filter(
    (l) => l.mondayHref !== null && !KNOWN_HREF.has(l.mondayHref),
  )
  if (stale.length > 0) {
    return {
      name,
      status: 'stale_desync',
      langs,
      note: `Tem URL no sistema mas o Monday saiu do Run Link: ${stale.map((l) => `${l.code.toUpperCase()}→"${l.mondayHref}"`).join(', ')}.`,
    }
  }

  // 5. All URLs in + Monday flipped to Apply Link, just waiting on the Done
  //    confirmations. Normal in-flight, not a problem.
  if (langs.every((l) => l.hasUrl) && langs.some((l) => l.mondayHref === 'Apply Link')) {
    return { name, status: 'apply_awaiting', langs, note: 'Todas as URLs entraram; Apply Link aplicado, aguardando Done.' }
  }

  // 6. Default: partial URLs, still at Run Link. Normal work in progress.
  return { name, status: 'run_in_progress', langs, note: 'Em andamento — Run Link, aguardando os idiomas restantes.' }
}

export async function getHreflangAudit(siteCode: 'aaaf' | 'hfa'): Promise<HreflangAudit> {
  const supabase = await createClient()

  const { data: site } = await supabase
    .from('sites')
    .select('id, code, name, languages, monday_board_id, monday_column_ids')
    .eq('code', siteCode)
    .single()

  const empty: HreflangAudit = {
    site: site ? { code: site.code as string, name: site.name as string } : null,
    languages: [],
    snapshotIngestedAt: null,
    hasHrefColumn: false,
    rows: [],
    counts: { systemOngoing: 0, mondayRunLink: 0, byStatus: blankCounts() },
  }
  if (!site) return empty

  const languages = (site.languages as string[]) ?? []
  const cfg = site.monday_column_ids as MondayColumnIds | null

  // ── System side: pages + urls + confirmations ─────────────────────────────
  const { data: pages } = await supabase
    .from('pages')
    .select('id, name, confirmed_done_at, not_relevant, page_urls(language_code), confirmations(language_code, confirmed_on_live)')
    .eq('site_id', site.id as string)

  type SysPage = {
    hasUrl: Set<string>
    confirmed: Set<string>
    completed: boolean
  }
  const sysByName = new Map<string, SysPage>()
  for (const p of pages ?? []) {
    const urls = (p.page_urls as { language_code: string }[]).map((u) => u.language_code)
    const confirmed = (p.confirmations as { language_code: string; confirmed_on_live: boolean }[])
      .filter((c) => c.confirmed_on_live)
      .map((c) => c.language_code)
    const completed = (p.not_relevant as boolean) === true || p.confirmed_done_at != null
    sysByName.set((p.name as string).trim(), {
      hasUrl: new Set(urls),
      confirmed: new Set(confirmed),
      completed,
    })
  }

  // ── Monday side: snapshot items → per-page per-lang Href Link label ────────
  // monday_snapshot isn't in the generated types (written by the cron via
  // service role); pass the row shape explicitly, same pattern as handlers.ts.
  const { data: snapRow } = await supabase
    .from('monday_snapshot')
    .select('data, ingested_at')
    .eq('board_id', (site.monday_board_id as string) ?? '')
    .maybeSingle<{ data: { items?: SnapItem[] } | null; ingested_at: string | null }>()

  const snapshotIngestedAt = snapRow?.ingested_at ?? null
  const items: SnapItem[] = snapRow?.data?.items ?? []

  // The Href Link column is only present in column_values once the cron has run
  // WITH the new `hrefLinkCol`. If no item carries it, the snapshot is stale.
  const hasHrefColumn =
    !!cfg && items.some((it) => it.column_values?.some((cv) => cv.id === cfg.hrefLinksStatus))

  // page name → { langCode → Href Link label }
  const mondayByName = new Map<string, Map<string, string>>()
  if (cfg) {
    for (const it of items) {
      const langLabel = it.column_values?.find((cv) => cv.id === cfg.language)?.text?.trim() ?? ''
      const code = cfg.languageMap[langLabel]
      if (!code || !languages.includes(code)) continue
      const href = it.column_values?.find((cv) => cv.id === cfg.hrefLinksStatus)?.text?.trim() || ''
      const name = it.name.trim()
      if (!mondayByName.has(name)) mondayByName.set(name, new Map())
      mondayByName.get(name)!.set(code, href)
    }
  }

  // ── Reconcile: walk the union of system + Monday page names ────────────────
  const allNames = new Set<string>([...sysByName.keys(), ...mondayByName.keys()])
  const rows: AuditRow[] = []
  for (const name of allNames) {
    const sys = sysByName.get(name)
    const mon = mondayByName.get(name)
    // A page absent from the system is only actionable when Monday currently
    // has it at "Run Link" (the system should have captured it but didn't).
    // Monday-only pages that are blank / already Apply Link / Done are
    // pre-existing or handled elsewhere — skip them so the audit stays focused
    // on the system's pages plus genuine misses, not the whole board.
    if (!sys) {
      const labels = mon ? [...mon.values()] : []
      if (!labels.some((v) => v === 'Run Link')) continue
    }

    const langs: AuditLang[] = languages.map((code) => ({
      code,
      hasUrl: sys?.hasUrl.has(code) ?? false,
      confirmed: sys?.confirmed.has(code) ?? false,
      mondayHref: mon?.has(code) ? mon.get(code)! || null : null,
    }))

    rows.push(
      classifyPage(name, langs, {
        present: !!sys,
        completed: sys?.completed ?? false,
      }),
    )
  }

  // ── Counts + ordering ──────────────────────────────────────────────────────
  const byStatus = blankCounts()
  for (const r of rows) byStatus[r.status]++

  const systemOngoing = [...sysByName.values()].filter((s) => !s.completed).length
  let mondayRunLink = 0
  for (const langMap of mondayByName.values()) {
    if ([...langMap.values()].some((v) => v === 'Run Link')) mondayRunLink++
  }

  // Surface problems first (stale/orphan/missing), then in-flight, then done.
  const ORDER: Record<AuditStatus, number> = {
    stale_desync: 0,
    orphan_system: 1,
    missing_system: 2,
    apply_awaiting: 3,
    run_in_progress: 4,
    completed: 5,
  }
  rows.sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name))

  return {
    site: { code: site.code as string, name: site.name as string },
    languages,
    snapshotIngestedAt,
    hasHrefColumn,
    rows,
    counts: { systemOngoing, mondayRunLink, byStatus },
  }
}

function blankCounts(): Record<AuditStatus, number> {
  return {
    completed: 0,
    run_in_progress: 0,
    apply_awaiting: 0,
    stale_desync: 0,
    missing_system: 0,
    orphan_system: 0,
  }
}
