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

import { withViewAs } from '@/components/ViewAsKeeper'
import { Fragment, useState, useMemo, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { SortHeader } from './PageListParts'
import { PageListToolbar } from './PageListToolbar'
import { PageListGroupHeader, PageListRow } from './PageListRow'
import type { PageListRow as Row } from '@/lib/href-links/data'
import type { SiteCode } from '@/lib/href-links/rules'
import {
  GROUP_ORDER, filterAndSort, parseLangs, splitIntoGroups, patchQuery, readView,
  sortPatch, statusCounts, toggledLangs, type GroupKey, type SortKey,
} from './page-list-model'

// The pure rules live in ./page-list-model; these two are re-exported so
// importers keep reaching them here.
export { groupOf, formatDoneDate } from './page-list-model'

interface Props {
  rows: Row[]
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

  const { status, langParam, sortKey, sortDir } = readView(searchParams)
  const hasLangs = useMemo(
    () => parseLangs(langParam, languages),
    [langParam, languages],
  )

  // Single helper used by every dropdown + every sortable header to write
  // back to the URL.
  function updateUrl(patch: Record<string, string | null>) {
    const qs = patchQuery(searchParams.toString(), patch)
    router.replace(withViewAs(qs ? `${pathname}?${qs}` : pathname), { scroll: false })
  }

  function toggleSort(key: SortKey) {
    updateUrl(sortPatch(key, sortKey, sortDir))
  }

  function toggleLang(lang: string) {
    updateUrl({ lang: toggledLangs(hasLangs, lang).join(',') })
  }

  const filtered = useMemo(
    () => filterAndSort(rows, languages, { search, status, hasLangs, sortKey, sortDir }),
    [rows, languages, search, status, hasLangs, sortKey, sortDir],
  )

  const counts = useMemo(() => statusCounts(rows), [rows])

  const grouped = useMemo(() => splitIntoGroups(filtered, languages), [filtered, languages])

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
      <PageListToolbar
        search={search}
        onSearch={setSearch}
        onPatch={updateUrl}
        onToggleLang={toggleLang}
        status={status}
        hasLangs={hasLangs}
        languages={languages}
        total={rows.length}
        shown={filtered.length}
        counts={counts}
        ring={a.ring}
      />

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
                    <PageListGroupHeader
                      groupKey={groupKey}
                      count={groupRows.length}
                      isOpen={isOpen}
                      onToggle={() => toggleGroup(groupKey)}
                    />
                    {isOpen && groupRows.map((r, i) => (
                      <PageListRow
                        key={r.id}
                        r={r}
                        languages={languages}
                        siteCode={siteCode}
                        last={i === groupRows.length - 1}
                        linkClass={a.text}
                      />
                    ))}
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

// UI primitives (Tooltip, Popover, PopoverItem, SortHeader) live in ./PageListParts;
// the toolbar in ./PageListToolbar, the group header and row in ./PageListRow.
