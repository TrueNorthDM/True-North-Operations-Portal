'use client'

/**
 * PageList: the page list of one Href Links site (each site's list page).
 *
 * The server reads and shapes the rows (lib/href-links/data.ts), including
 * whether each page is done by the one rule (rules.ts); this list only
 * searches, filters, sorts and groups them, with no request of its own.
 *
 * Done is row.done everywhere here: the status pill, the Done / Incomplete
 * filter and the Completed group. The Completed group used to go by the done
 * date instead, so a page that lost a language sat under Completed while its
 * pill said "3 of 4" (audit, 10 October 2026). The done date is only shown,
 * as the day the page first got done.
 */

import Link from 'next/link'
import { withViewAs } from '@/components/ViewAsKeeper'
import { SearchField } from '@/components/ui/SearchField'
import { Fragment, useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { Tooltip, Popover, PopoverItem, SortHeader } from './PageListParts'
import { hrefLinksPage } from '@/lib/nav/routes'
import { languageName } from '@/lib/language-display'
import { reportDate } from '@/lib/report/clock'
import type { PageListRow } from '@/lib/href-links/data'
import type { SiteCode } from '@/lib/href-links/rules'
import { langChipStyle } from '@/components/href-links/lang-chip'

// All filter + sort state lives in URL query params, so the view is
// shareable and the browser Back button rewinds filter changes.
type StatusFilter = 'all' | 'incomplete' | 'done' | 'needs_update' | 'not_relevant'
type SortKey = 'name' | 'hreflang_status' | 'all_live'
type SortDir = 'asc' | 'desc'

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'All pages',
  incomplete: 'Incomplete',
  done: 'Done',
  needs_update: 'Needs update',
  not_relevant: 'Not relevant',
}

/** "Oct 9, 2026" on the New York day (audit, 10 October 2026: it was the UTC day). */
export function formatDoneDate(iso: string | null | undefined): string | null {
  return iso ? reportDate(iso) : null
}

// Row groups, in the order the list shows them:
//   - Ready        : every language has a link, not done yet
//   - On-going     : the rest of the work in progress
//   - Completed    : done by the one rule (row.done), Not relevant aside
//   - Not relevant : set aside on purpose
// Module-level (pure) so the grouping useMemo can depend on `groupOf` safely.
type GroupKey = 'ready' | 'ongoing' | 'completed' | 'not_relevant'
const GROUP_ORDER: GroupKey[] = ['ready', 'ongoing', 'completed', 'not_relevant']
const GROUP_LABEL: Record<GroupKey, string> = {
  ready: 'Ready to be worked on',
  ongoing: 'On-going',
  completed: 'Completed',
  not_relevant: 'Not relevant',
}
// `languages` is passed in (not closed over) so this stays pure and safe to
// call from a useMemo. A page is "ready" once every language has a link but it
// is not done yet: what is left is pasting the tags and confirming each live.
export function groupOf(r: PageListRow, languages: string[]): GroupKey {
  if (r.notRelevant) return 'not_relevant'
  if (r.done) return 'completed'
  if (languages.length > 0 && languages.every(l => r.langStatus[l]?.hasUrl)) return 'ready'
  return 'ongoing'
}

/** Done comes from the server, by the one rule (Not relevant counts as done). */
const isDone = (r: PageListRow) => r.done

interface Props {
  rows: PageListRow[]
  /** The site's current languages, in order, e.g. ['en','pt','es','sw']. */
  languages: string[]
  siteCode: SiteCode
  accent: SiteCode
}

const accentMap = {
  aaaf: {
    ring: 'focus:ring-aaaf-primary',
    text: 'text-aaaf-primary hover:text-aaaf-secondary',
    chip: 'bg-aaaf-soft text-aaaf-secondary',
  },
  hfa: {
    ring: 'focus:ring-hfa-primary',
    text: 'text-hfa-primary hover:text-hfa-primary-hover',
    chip: 'bg-hfa-soft text-hfa-secondary',
  },
}

export function PageList({ rows, languages, siteCode, accent }: Props) {
  const a = accentMap[accent]
  // Search stays as plain state, typing into the URL on every keystroke
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
  const langParam = searchParams.get('lang') ?? ''
  const hasLangs = useMemo(
    () => langParam.split(',').map(s => s.trim()).filter(s => languages.includes(s)),
    [langParam, languages],
  )
  const sortKey: SortKey =
    (['hreflang_status', 'all_live'] as const).find(
      v => v === searchParams.get('sort'),
    ) ?? 'name'
  const sortDir: SortDir = searchParams.get('dir') === 'desc' ? 'desc' : 'asc'

  // Single helper used by every dropdown + every sortable header to write
  // back to the URL. Empty/null values get deleted (URL stays clean for
  // defaults, no `?status=all` clutter).
  function updateUrl(patch: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') params.delete(k)
      else params.set(k, v)
    }
    const qs = params.toString()
    router.replace(withViewAs(qs ? `${pathname}?${qs}` : pathname), { scroll: false })
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

  const urlCount = useCallback(
    (r: PageListRow) => languages.filter(l => r.langStatus[l]?.hasUrl).length,
    [languages],
  )

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
        // Nulls last in asc, first in desc, so dates always group together
        const tx = x.confirmedDoneAt ? new Date(x.confirmedDoneAt).getTime() : null
        const ty = y.confirmedDoneAt ? new Date(y.confirmedDoneAt).getTime() : null
        if (tx === ty) cmp = 0
        else if (tx === null) cmp = 1
        else if (ty === null) cmp = -1
        else cmp = tx - ty
      }
      if (cmp === 0) cmp = collator.compare(x.name, y.name) // stable tiebreaker
      else if (sortDir === 'desc') cmp = -cmp
      return cmp
    })
    return base
  }, [rows, search, status, hasLangs, sortKey, sortDir, collator, urlCount])

  const doneCount = useMemo(() => rows.filter(isDone).length, [rows])
  const incompleteCount = rows.length - doneCount
  const needsUpdateCount = useMemo(() => rows.filter(r => r.needsUpdate).length, [rows])
  const notRelevantCount = useMemo(() => rows.filter(r => r.notRelevant).length, [rows])

  const grouped = useMemo(() => {
    const out: Record<GroupKey, PageListRow[]> = {
      ready: [], ongoing: [], completed: [], not_relevant: [],
    }
    for (const r of filtered) out[groupOf(r, languages)].push(r)
    return out
  }, [filtered, languages])

  // Collapse state per group, persisted per site in localStorage so HFA
  // and AAAF remember independently. SSR-safe: starts from sensible
  // defaults, then hydrates on mount.
  const COLLAPSE_KEY = `pageList:${siteCode}:groups`
  const [collapsed, setCollapsed] = useState<Record<GroupKey, boolean>>({
    ready: false,          // next up to work on, open by default
    ongoing: false,        // active work, open by default
    completed: true,       // reference / archive, closed by default
    not_relevant: true,    // archive, closed by default
  })
  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(COLLAPSE_KEY) : null
      if (raw) {
        const parsed = JSON.parse(raw)
        // Intentional one-shot hydration from localStorage on mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (parsed && typeof parsed === 'object') setCollapsed(c => ({ ...c, ...parsed }))
      }
    } catch { /* localStorage unavailable, keep defaults */ }
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
      {/* Toolbar: search + filter dropdowns + counts. */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder={`Search ${rows.length} pages by name…`}
          className="flex-1 min-w-[240px]"
          focus={`focus:ring-2 ${a.ring}`}
        />

        {/* Status dropdown, single select. Button shows the active value
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
                <li aria-hidden="true" className="border-t border-slate-100 my-1" />
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

        {/* Has-language dropdown, multi-select (OR). Button shows current
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
                      <span className="text-slate-800">{languageName(lang)}</span>
                    </label>
                  </li>
                )
              })}
              {hasLangs.length > 0 && (
                <>
                  <li aria-hidden="true" className="border-t border-slate-100 my-1" />
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

        <div className="text-xs text-muted ml-auto">
          Showing <strong className="text-foreground">{filtered.length}</strong> of {rows.length}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-5 py-12 text-center text-slate-400 text-sm">
            {rows.length === 0
              ? <>No pages yet, they sync automatically from Monday.com.</>
              : <>No pages match the current search/filter.</>}
          </div>
        ) : (
          <table className="w-full text-sm table-fixed">
            {/* Lock auxiliary column widths so the page name absorbs the rest
                and truncates with ellipsis on overflow. Status pills no longer
                wrap to 2 lines. */}
            <colgroup>
              {/* Page name absorbs all remaining width, keep it first/flex
                  so long names use as much room as possible. The trailing
                  action col is just an eye icon, so w-12 is enough. */}
              <col />
              <col className="w-44" />
              <col className="w-32" />
              <col className="w-28" />
              <col className="w-12" />
            </colgroup>
            <thead>
              {/* Single-row header (matches the handoff): Raleway 800, navy ink,
                  warm bg. Status + All Live stay sortable via SortHeader. */}
              <tr className="border-b border-slate-200 bg-subtle text-left">
                <th className="px-5 py-3 font-(family-name:--font-display) font-extrabold text-[11px] text-tn-ink">Page name</th>
                <th className="px-5 py-3 font-(family-name:--font-display) font-extrabold text-[11px] text-tn-ink border-l border-slate-200">Langs</th>
                <SortHeader
                  label="Status"
                  active={sortKey === 'hreflang_status'}
                  dir={sortDir}
                  onClick={() => toggleSort('hreflang_status')}
                />
                <SortHeader
                  label="First done"
                  active={sortKey === 'all_live'}
                  dir={sortDir}
                  onClick={() => toggleSort('all_live')}
                />
                <th className="px-3" />
              </tr>
            </thead>
            <tbody>
              {/* Section groups (Ready / On-going / Completed / Not relevant).
                  Empty groups are skipped entirely so the table doesn't show
                  redundant headers when the filter narrows things down. */}
              {GROUP_ORDER.map(groupKey => {
                const groupRows = grouped[groupKey]
                if (groupRows.length === 0) return null
                const isOpen = !collapsed[groupKey]
                return (
                  <Fragment key={groupKey}>
                    <tr className="bg-subtle border-y border-slate-200">
                      <th
                        colSpan={5}
                        scope="colgroup"
                        className="px-3 py-2 text-left"
                      >
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupKey)}
                          aria-expanded={isOpen}
                          className={`inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[11px] uppercase tracking-wide transition-colors ${
                            groupKey === 'ready' ? 'text-tn-teal hover:brightness-90' : 'text-foreground hover:text-tn-ink'
                          }`}
                        >
                          <svg
                            width="11" height="11" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor"
                            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                            aria-hidden="true"
                            className={`transition-transform ${isOpen ? 'rotate-90' : ''}`}
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                          {groupKey === 'ready' && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-tn-teal" aria-hidden="true" />
                          )}
                          <span>{GROUP_LABEL[groupKey]}</span>
                          <span className="text-muted font-semibold normal-case tracking-normal">
                            {groupRows.length}
                          </span>
                        </button>
                      </th>
                    </tr>
                    {isOpen && groupRows.map((r, i) => {
                      const done = isDone(r)
                // The chips and the "2 of 4" count go by the links the portal
                // holds (hasUrl); "✓ Done" is the one rule, from the server.
                const urlCount = languages.filter(l => r.langStatus[l]?.hasUrl).length
                return (
                  <tr
                    key={r.id}
                    // Not-relevant pages fade the whole row so they read
                    // as "set aside, not part of the active work" without
                    // hiding them entirely.
                    // The last row of its group drops its line: the next
                    // group's header (or the table's edge) draws one. It
                    // compared with the whole list's length, so it never hit.
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      i === groupRows.length - 1 ? 'border-b-0' : ''
                    } ${r.notRelevant ? 'opacity-50' : ''}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 min-w-0">
                        {r.needsUpdate && (
                          <svg
                            width="14" height="14" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            strokeLinecap="round" strokeLinejoin="round"
                            className="shrink-0 text-amber-700"
                            aria-label="Needs update"
                          >
                            <title>Needs update: a language was added or a live link changed, so the tags need pasting again</title>
                            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <path d="M12 9v4M12 17h.01" />
                          </svg>
                        )}
                        <span
                          className={`truncate font-semibold text-tn-ink ${r.notRelevant ? 'line-through decoration-slate-400' : ''}`}
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

                    {/* HREFLANG (system), languages */}
                    <td className="px-5 py-4 border-l border-slate-100">
                      <div className="flex gap-1">
                        {languages.map(lang => {
                          const s = r.langStatus[lang] ?? { hasUrl: false, confirmed: false }
                          // Flag colour when the portal holds the link for this
                          // language; a muted track when it does not.
                          const title = s.confirmed
                            ? `${languageName(lang)}: link saved, confirmed live`
                            : s.hasUrl
                              ? `${languageName(lang)}: link saved`
                              : `${languageName(lang)}: no link yet`
                          return (
                            <span
                              key={lang}
                              title={title}
                              aria-label={title}
                              className={`inline-flex items-center justify-center w-[26px] h-[22px] rounded-[5px] text-[11px] font-bold uppercase ${s.hasUrl ? '' : 'bg-slate-100 text-slate-400'}`}
                              style={s.hasUrl ? langChipStyle(lang) : undefined}
                            >
                              {lang}
                            </span>
                          )
                        })}
                      </div>
                    </td>

                    {/* HREFLANG (system), status */}
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center text-[11.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${
                          done || urlCount > 0 ? '' : 'bg-slate-100 text-slate-500'
                        }`}
                        style={
                          done
                            ? { backgroundColor: '#1E9E6A1f', color: '#1E9E6A' }
                            : urlCount > 0
                              ? { backgroundColor: '#E0940E1f', color: '#c67f0c' }
                              : undefined
                        }
                      >
                        {done ? '✓ Done' : `${urlCount} of ${languages.length}`}
                      </span>
                    </td>

                    {/* The day the page first got done: history only. A page
                        that lost a language since keeps its date here. */}
                    <td className="px-5 py-4 text-xs text-slate-500 whitespace-nowrap" title={r.confirmedDoneAt ? 'The day it first got done' : undefined}>
                      {formatDoneDate(r.confirmedDoneAt) ?? <span className="text-slate-300">-</span>}
                    </td>

                    {/* ACTIONS: View only. Copy lives on the detail card. */}
                    <td className="px-3 py-4 text-right">
                      <Tooltip label="View page">
                        <Link
                          href={hrefLinksPage(siteCode, r.id)}
                          aria-label={`View ${r.name}`}
                          className={`${a.text} inline-flex items-center justify-center p-1.5 rounded transition-colors hover:bg-slate-100`}
                        >
                          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </Link>
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

// UI primitives (Tooltip, Popover, PopoverItem, SortHeader) live in ./PageListParts.
