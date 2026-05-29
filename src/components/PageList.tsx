'use client'

/**
 * PageList — interactive list view shared by /aaaf and /hfa.
 *
 * The Server Components fetch and shape data, then pass it to this Client
 * Component. Search/filter/sort all live here as local state — no network
 * roundtrips, so it's instant even on 100+ pages.
 */

import { Fragment, useState, useMemo, useEffect, useRef } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { languageStatusPalette } from '@/lib/language-colors'
import type { MondayStatus } from '@/lib/types/database.types'

// All filter + sort state lives in URL query params, so the view is
// shareable and the browser Back button rewinds filter changes.
type StatusFilter = 'all' | 'incomplete' | 'done' | 'needs_update' | 'not_relevant'
type SortKey = 'name' | 'hreflang_status' | 'all_live' | 'monday_status'
type SortDir = 'asc' | 'desc'

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'All pages',
  incomplete: 'Incomplete',
  done: 'Done',
  needs_update: 'Needs update',
  not_relevant: 'Not relevant',
}

const LANG_LABEL: Record<string, string> = {
  en: 'English',
  pt: 'Portuguese',
  es: 'Spanish',
  sw: 'Swahili',
  fr: 'French',
}

// Numeric value for the Monday status so we can sort it sensibly
// (pending < in_progress < done).
const MONDAY_RANK: Record<MondayStatus, number> = {
  pending: 0,
  in_progress: 1,
  done: 2,
}

export interface PageListRow {
  id: string
  name: string
  langStatus: Record<string, { hasUrl: boolean; confirmed: boolean }>
  /** Monday's truth: per-language implemented status (true = Monday says done). */
  mondayLangStatus: Record<string, boolean>
  /** Monday's truth: overall WP implementation status. */
  mondayStatus: MondayStatus
  /** Flagged after a language config change — page may have stale hreflang. */
  needsUpdate?: boolean
  /** Intentional opt-out: counts as done in progress; shown faded in the list. */
  notRelevant?: boolean
  /** ISO timestamp: first date all langs went live. Preserved on un-toggle. */
  confirmedDoneAt?: string | null
}

// Compact "MMM D, YYYY" formatter, UTC so the calendar day matches imported sheet dates.
function formatDoneDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

interface Props {
  rows: PageListRow[]
  languages: string[]                       // ordered, e.g. ['en','pt','es','sw']
  siteCode: 'aaaf' | 'hfa'
  accent: 'aaaf' | 'hfa'
  /**
   * Cluster is still indexed by search (so 'Faith' filters HFA pages) but no
   * longer rendered as a column. It surfaces on the detail page instead.
   */
}

const accentMap = {
  aaaf: {
    ring: 'focus:ring-aaaf-primary',
    text: 'text-aaaf-primary hover:text-aaaf-secondary',
    chip: 'bg-aaaf-soft text-aaaf-secondary',
  },
  hfa: {
    ring: 'focus:ring-hfa-primary',
    text: 'text-hfa-secondary hover:text-hfa-primary-hover',
    chip: 'bg-hfa-soft text-hfa-secondary',
  },
}

export function PageList({ rows, languages, siteCode, accent }: Props) {
  const a = accentMap[accent]
  // Search stays as plain state — typing into the URL on every keystroke
  // would spam history. Filter/sort are URL-backed so a filtered view is
  // shareable via link.
  const [search, setSearch] = useState('')

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const status: StatusFilter =
    (['incomplete', 'done', 'needs_update', 'not_relevant'] as const).find(
      v => v === searchParams.get('status'),
    ) ?? 'all'
  const hasLangs = (searchParams.get('lang') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(s => languages.includes(s))
  const sortKey: SortKey =
    (['hreflang_status', 'all_live', 'monday_status'] as const).find(
      v => v === searchParams.get('sort'),
    ) ?? 'name'
  const sortDir: SortDir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc'

  // Single helper used by every dropdown + every sortable header to write
  // back to the URL. Empty/null values get deleted (URL stays clean for
  // defaults — no `?status=all` clutter).
  function updateUrl(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  function toggleSort(key: SortKey) {
    // Cycle: not-sorted → asc → desc → not-sorted (= back to default 'name' asc)
    if (sortKey !== key) {
      updateUrl({ sort: key, dir: null })
      return
    }
    if (sortDir === 'asc') {
      updateUrl({ sort: key, dir: 'desc' })
      return
    }
    updateUrl({ sort: null, dir: null })
  }

  function toggleLang(lang: string) {
    const next = hasLangs.includes(lang)
      ? hasLangs.filter(l => l !== lang)
      : [...hasLangs, lang]
    updateUrl({ lang: next.join(',') })
  }

  // Intl.Collator handles "10 < 11 < 100" instead of string-sort "10 < 100 < 11"
  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }),
    [],
  )

  function isDone(r: PageListRow) {
    // "Not relevant" pages are explicitly opted out — they count as done
    // for progress, filtering, and the "Done" status pill.
    if (r.notRelevant) return true
    return languages.every(l => r.langStatus[l]?.confirmed)
  }

  function urlCount(r: PageListRow) {
    return languages.filter(l => r.langStatus[l]?.hasUrl).length
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const base = rows.filter(r => {
      if (q) {
        const hay = r.name.toLowerCase()
        if (!hay.includes(q)) return false
      }
      if (status === 'incomplete' && isDone(r)) return false
      if (status === 'done' && !isDone(r)) return false
      if (status === 'needs_update' && r.needsUpdate !== true) return false
      if (status === 'not_relevant' && r.notRelevant !== true) return false
      // Has-language filter is OR: row passes if any selected language
      // has a URL saved. Empty selection = no constraint.
      if (hasLangs.length > 0) {
        const anyMatch = hasLangs.some(l => r.langStatus[l]?.hasUrl)
        if (!anyMatch) return false
      }
      return true
    })

    // Sort
    base.sort((x, y) => {
      let cmp = 0
      if (sortKey === 'hreflang_status') {
        cmp = urlCount(x) - urlCount(y)
      } else if (sortKey === 'all_live') {
        // Nulls last in asc, first in desc — so dates always group together
        const tx = x.confirmedDoneAt ? new Date(x.confirmedDoneAt).getTime() : null
        const ty = y.confirmedDoneAt ? new Date(y.confirmedDoneAt).getTime() : null
        if (tx === ty) cmp = 0
        else if (tx === null) cmp = 1
        else if (ty === null) cmp = -1
        else cmp = tx - ty
      } else if (sortKey === 'monday_status') {
        cmp = MONDAY_RANK[x.mondayStatus] - MONDAY_RANK[y.mondayStatus]
      }
      if (cmp === 0) cmp = collator.compare(x.name, y.name) // stable tiebreaker
      else if (sortDir === 'desc') cmp = -cmp
      return cmp
    })
    return base
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, status, hasLangs.join(','), sortKey, sortDir, collator])

  const doneCount = useMemo(() => rows.filter(isDone).length, [rows])
  const incompleteCount = rows.length - doneCount
  const needsUpdateCount = useMemo(() => rows.filter(r => r.needsUpdate).length, [rows])
  const notRelevantCount = useMemo(() => rows.filter(r => r.notRelevant).length, [rows])

  // ── Row groups ────────────────────────────────────────────────────
  // Three buckets based on the user's mental model:
  //   - On-going    : active work — neither completed nor opted out
  //   - Completed   : strict definition — confirmed_done_at is stamped
  //   - Not relevant: explicitly opted out of the workflow
  // The order in the array is the order they render in the table.
  type GroupKey = 'ongoing' | 'completed' | 'not_relevant'
  const GROUP_ORDER: GroupKey[] = ['ongoing', 'completed', 'not_relevant']
  const GROUP_LABEL: Record<GroupKey, string> = {
    ongoing: 'On-going',
    completed: 'Completed',
    not_relevant: 'Not relevant',
  }

  function groupOf(r: PageListRow): GroupKey {
    if (r.notRelevant) return 'not_relevant'
    if (r.confirmedDoneAt) return 'completed'
    return 'ongoing'
  }

  const grouped = useMemo(() => {
    const out: Record<GroupKey, PageListRow[]> = {
      ongoing: [], completed: [], not_relevant: [],
    }
    for (const r of filtered) out[groupOf(r)].push(r)
    return out
  }, [filtered])

  // Collapse state per group, persisted per site in localStorage so HFA
  // and AAAF remember independently. SSR-safe: starts from sensible
  // defaults, then hydrates on mount.
  const COLLAPSE_KEY = `pageList:${siteCode}:groups`
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    ongoing: false,        // active work — open by default
    completed: true,       // reference / archive — closed by default
    not_relevant: true,    // archive — closed by default
  })
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(COLLAPSE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') setCollapsed(c => ({ ...c, ...parsed }))
      }
    } catch { /* localStorage unavailable — keep defaults */ }
  // Only hydrate on mount per site; intentionally ignore COLLAPSE_KEY dep.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteCode])
  function toggleGroup(key: GroupKey) {
    setCollapsed(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try {
        window.localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next))
      } catch { /* ignore quota / private mode */ }
      return next
    })
  }

  return (
    <>
      {/* Toolbar — search + filter dropdowns + counts. */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${rows.length} pages by name…`}
            className={`w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 ${a.ring}`}
          />
        </div>

        {/* Status dropdown — single select. Button shows the active value
            so users don't have to open the menu to remember. */}
        <Popover
          label={
            <>
              <span className="text-slate-500 font-normal">Status:</span>{' '}
              <span className="font-semibold">{STATUS_LABEL[status]}</span>
            </>
          }
          highlight={status !== 'all'}
          accentRing={a.ring}
        >
          {({ close }) => (
            <ul className="py-1 min-w-[180px]">
              {(['all', 'incomplete', 'done'] as const).map(s => (
                <PopoverItem
                  key={s}
                  selected={status === s}
                  onClick={() => { updateUrl({ status: s === 'all' ? null : s }); close() }}
                >
                  <span className="flex-1">{STATUS_LABEL[s]}</span>
                  <span className="text-xs text-slate-400 ml-3">
                    {s === 'all' ? rows.length : s === 'done' ? doneCount : incompleteCount}
                  </span>
                </PopoverItem>
              ))}
              {(needsUpdateCount > 0 || notRelevantCount > 0) && (
                <li className="border-t border-slate-100 my-1" />
              )}
              {needsUpdateCount > 0 && (
                <PopoverItem
                  selected={status === 'needs_update'}
                  onClick={() => { updateUrl({ status: 'needs_update' }); close() }}
                >
                  <span className="flex-1 text-amber-700">⚠ Needs update</span>
                  <span className="text-xs text-amber-600 ml-3">{needsUpdateCount}</span>
                </PopoverItem>
              )}
              {notRelevantCount > 0 && (
                <PopoverItem
                  selected={status === 'not_relevant'}
                  onClick={() => { updateUrl({ status: 'not_relevant' }); close() }}
                >
                  <span className="flex-1 text-slate-600">Not relevant</span>
                  <span className="text-xs text-slate-400 ml-3">{notRelevantCount}</span>
                </PopoverItem>
              )}
            </ul>
          )}
        </Popover>

        {/* Has-language dropdown — multi-select (OR). Button shows current
            count so the toolbar communicates state without opening it. */}
        <Popover
          label={
            <>
              <span className="text-slate-500 font-normal">Has language:</span>{' '}
              <span className="font-semibold">
                {hasLangs.length === 0
                  ? 'All'
                  : hasLangs.length === 1
                    ? hasLangs[0].toUpperCase()
                    : `${hasLangs.length} selected`}
              </span>
            </>
          }
          highlight={hasLangs.length > 0}
          accentRing={a.ring}
        >
          {() => (
            <ul className="py-1 min-w-[200px]">
              {languages.map(lang => {
                const checked = hasLangs.includes(lang)
                return (
                  <li key={lang}>
                    <label className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLang(lang)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <span className="font-mono uppercase text-xs text-slate-500 w-7">{lang}</span>
                      <span className="text-slate-800">{LANG_LABEL[lang] ?? lang}</span>
                    </label>
                  </li>
                )
              })}
              {hasLangs.length > 0 && (
                <>
                  <li className="border-t border-slate-100 my-1" />
                  <li>
                    <button
                      type="button"
                      onClick={() => updateUrl({ lang: null })}
                      className="w-full text-left px-3 py-2 text-xs text-slate-500 hover:bg-slate-50"
                    >
                      Clear selection
                    </button>
                  </li>
                </>
              )}
            </ul>
          )}
        </Popover>

        <div className="text-xs text-slate-500 ml-auto">
          Showing <strong className="text-slate-700">{filtered.length}</strong> of {rows.length}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400 text-sm">
            {rows.length === 0
              ? <>No pages yet — they sync automatically from Monday.com.</>
              : <>No pages match the current search/filter.</>}
          </div>
        ) : (
          <table className="w-full text-sm table-fixed">
            {/* Lock auxiliary column widths so the page name absorbs the rest
                and truncates with ellipsis on overflow. Status pills no longer
                wrap to 2 lines. */}
            <colgroup>
              {/* Page name absorbs all remaining width — keep it first/flex
                  so long names use as much room as possible. The trailing
                  action col is just an eye icon, so w-12 is enough. */}
              <col />
              <col className="w-44" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-44" />
              <col className="w-32" />
              <col className="w-12" />
            </colgroup>
            <thead>
              {/* Two-row header: group labels on top (Hreflang / Monday),
                  individual column headers underneath. Vertical dividers make
                  the two "sources of truth" visually obvious. */}
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th rowSpan={2} className="px-5 pt-3 pb-2 font-semibold text-slate-600 text-xs normal-case tracking-normal align-bottom">Page name</th>
                <th colSpan={3} className="px-5 pt-2 pb-1 font-semibold border-l border-slate-200 text-center">Hreflang (system)</th>
                <th colSpan={2} className="px-5 pt-2 pb-1 font-semibold border-l border-slate-200 text-center">Monday (WordPress)</th>
                <th rowSpan={2} className="px-3 align-bottom" />
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs text-slate-500">
                <th className="px-5 pb-3 font-medium border-l border-slate-200">Langs</th>
                <SortHeader
                  label="Status"
                  active={sortKey === 'hreflang_status'}
                  dir={sortDir}
                  onClick={() => toggleSort('hreflang_status')}
                />
                <SortHeader
                  label="All Live"
                  active={sortKey === 'all_live'}
                  dir={sortDir}
                  onClick={() => toggleSort('all_live')}
                />
                <th className="px-5 pb-3 font-medium border-l border-slate-200">Langs</th>
                <SortHeader
                  label="Status"
                  active={sortKey === 'monday_status'}
                  dir={sortDir}
                  onClick={() => toggleSort('monday_status')}
                />
              </tr>
            </thead>
            <tbody>
              {/* Three section groups (On-going / Completed / Not relevant).
                  Empty groups are skipped entirely so the table doesn't show
                  redundant headers when the filter narrows things down. */}
              {GROUP_ORDER.map(groupKey => {
                const groupRows = grouped[groupKey]
                if (groupRows.length === 0) return null
                const isOpen = !collapsed[groupKey]
                return (
                  <Fragment key={groupKey}>
                    <tr className="bg-slate-50/80 border-y border-slate-200">
                      <th
                        colSpan={7}
                        scope="colgroup"
                        className="px-3 py-2 text-left"
                      >
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupKey)}
                          aria-expanded={isOpen}
                          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                        >
                          <svg
                            width="12" height="12" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor"
                            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            aria-hidden="true"
                            className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          <span>{GROUP_LABEL[groupKey]}</span>
                          <span className="text-slate-400 font-normal normal-case tracking-normal">
                            {groupRows.length}
                          </span>
                        </button>
                      </th>
                    </tr>
                    {isOpen && groupRows.map((r, i) => {
                      const done = isDone(r)
                // HREFLANG (SYSTEM) tracks what THIS system holds — i.e.
                // URLs received from the Monday Run Link webhook. So we
                // color and count by `hasUrl`. The final "✓ Done" pill
                // still uses `confirmed` because that means all langs
                // were marked Done in Monday (live in WordPress).
                const urlCount = languages.filter(l => r.langStatus[l]?.hasUrl).length
                return (
                  <tr
                    key={r.id}
                    // Not-relevant pages fade the whole row so they read
                    // as "set aside, not part of the active work" without
                    // hiding them entirely.
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      i === filtered.length - 1 ? 'border-0' : ''
                    } ${r.notRelevant ? 'opacity-50' : ''}`}
                  >
                    <td className="px-5 py-4 font-medium text-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.needsUpdate && (
                          <span
                            title="Language config changed — this page needs URLs reviewed"
                            className="inline-flex items-center justify-center w-4 h-4 shrink-0 text-amber-600"
                            aria-label="Needs update"
                          >
                            ⚠
                          </span>
                        )}
                        <span
                          className={`truncate ${r.notRelevant ? 'line-through decoration-slate-400' : ''}`}
                          title={r.name}
                        >
                          {r.name}
                        </span>
                        {r.notRelevant && (
                          <span
                            className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-300 shrink-0"
                            aria-label="Marked not relevant"
                          >
                            Not relevant
                          </span>
                        )}
                      </div>
                    </td>

                    {/* HREFLANG (system) — languages */}
                    <td className="px-5 py-4 border-l border-slate-100">
                      <div className="flex gap-1">
                        {languages.map(lang => {
                          const s = r.langStatus[lang] ?? { hasUrl: false, confirmed: false }
                          // Coloured when the system holds the URL for this
                          // language. "Confirmed live" status surfaces in
                          // the MONDAY (WORDPRESS) block on the right.
                          const { bg, text } = languageStatusPalette(lang, s.hasUrl)
                          const title = s.confirmed
                            ? `${lang.toUpperCase()}: URL received, confirmed live`
                            : s.hasUrl
                              ? `${lang.toUpperCase()}: URL received`
                              : `${lang.toUpperCase()}: no URL yet`
                          return (
                            <span
                              key={lang}
                              title={title}
                              className={`inline-flex items-center justify-center w-7 h-6 rounded text-xs font-semibold uppercase ${bg} ${text}`}
                            >
                              {lang}
                            </span>
                          )
                        })}
                      </div>
                    </td>

                    {/* HREFLANG (system) — status */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          done
                            ? 'bg-green-100 text-green-700'
                            : urlCount > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {done ? '✓ Done' : `${urlCount} of ${languages.length}`}
                      </span>
                    </td>

                    {/* HREFLANG (system) — done date */}
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDoneDate(r.confirmedDoneAt) ?? <span className="text-slate-300">—</span>}
                    </td>

                    {/* MONDAY — languages (grey until Monday marks done) */}
                    <td className="px-5 py-4 border-l border-slate-100">
                      <div className="flex gap-1">
                        {languages.map(lang => {
                          const mondayDone = r.mondayLangStatus[lang] === true
                          const { bg, text } = languageStatusPalette(lang, mondayDone)
                          const title = mondayDone
                            ? `${lang.toUpperCase()}: implemented in WordPress (Monday)`
                            : `${lang.toUpperCase()}: pending in Monday`
                          return (
                            <span
                              key={lang}
                              title={title}
                              className={`inline-flex items-center justify-center w-7 h-6 rounded text-xs font-semibold uppercase ${bg} ${text}`}
                            >
                              {lang}
                            </span>
                          )
                        })}
                      </div>
                    </td>

                    {/* MONDAY — implementation status */}
                    <td className="px-5 py-4">
                      <MondayStatusBadge status={r.mondayStatus} />
                    </td>

                    {/* ACTIONS — View only. Copy lives on the detail card. */}
                    <td className="px-3 py-4 text-right">
                      <Tooltip label="View page">
                        <a
                          href={`/${siteCode}/${r.id}`}
                          aria-label={`View ${r.name}`}
                          className={`${a.text} inline-flex items-center justify-center p-1.5 rounded transition-colors hover:bg-slate-100`}
                        >
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </a>
                      </Tooltip>
                    </td>
                  </tr>
                )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

/**
 * Lightweight CSS-only tooltip. Appears instantly on hover (no 2s delay like
 * the native `title` attribute) and matches the app's visual language. Uses
 * `group-hover` + absolute positioning — no JS, no library.
 */
function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded-md bg-slate-800 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
      >
        {label}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-slate-800" aria-hidden="true" />
      </span>
    </span>
  )
}

function MondayStatusBadge({ status }: { status: MondayStatus }) {
  const map = {
    pending: { label: 'Pending', cls: 'bg-slate-100 text-slate-500' },
    in_progress: { label: 'In progress', cls: 'bg-yellow-100 text-yellow-700' },
    done: { label: '✓ Live', cls: 'bg-green-100 text-green-700' },
  } as const
  const { label, cls } = map[status]
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${cls}`}>
      {label}
    </span>
  )
}

/**
 * Generic popover used by the filter dropdowns.
 *
 * Why a custom component vs. native <select>? <select> doesn't support
 * multi-checkbox layouts and is impossible to style consistently across
 * browsers. The trade-off is we own the click-outside + escape-key
 * dismissal manually; the implementation below is the smallest correct
 * version that doesn't pull in a library.
 */
function Popover({
  label,
  highlight,
  accentRing,
  children,
}: {
  label: React.ReactNode
  highlight: boolean
  accentRing: string
  children: (api: { close: () => void }) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border transition-colors focus:outline-none focus:ring-2 ${accentRing} ${
          highlight
            ? 'bg-slate-800 text-white border-slate-800'
            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
        }`}
      >
        <span>{label}</span>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 right-0 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
        >
          {children({ close: () => setOpen(false) })}
        </div>
      )}
    </div>
  )
}

function PopoverItem({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <li>
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={onClick}
        className={`w-full text-left flex items-center px-3 py-2 text-sm hover:bg-slate-50 ${
          selected ? 'bg-slate-50 text-slate-900' : 'text-slate-700'
        }`}
      >
        <span className={`w-4 mr-2 ${selected ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true">✓</span>
        {children}
      </button>
    </li>
  )
}

/**
 * Sortable column header. Click cycles asc → desc → off.
 * The asc/desc arrow appears only on the active column; inactive
 * columns keep an outlined "↕" hint to communicate sortability.
 */
function SortHeader({
  label,
  active,
  dir,
  onClick,
  className = '',
}: {
  label: string
  active: boolean
  dir: SortDir
  onClick: () => void
  className?: string
}) {
  const ariaSort = !active ? 'none' : dir === 'asc' ? 'ascending' : 'descending'
  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      className={`px-5 pb-3 font-medium ${className}`}
    >
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 group hover:text-slate-700 transition-colors ${
          active ? 'text-slate-700' : 'text-slate-500'
        }`}
      >
        {label}
        <span aria-hidden="true" className="text-[10px] leading-none">
          {active ? (dir === 'asc' ? '↑' : '↓') : <span className="opacity-40 group-hover:opacity-70">↕</span>}
        </span>
      </button>
    </th>
  )
}
