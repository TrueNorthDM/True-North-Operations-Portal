'use client'

/**
 * PageList — interactive list view shared by /aaaf and /hfa.
 *
 * The Server Components fetch and shape data, then pass it to this Client
 * Component. Search/filter/sort all live here as local state — no network
 * roundtrips, so it's instant even on 100+ pages.
 */

import { useState, useMemo } from 'react'
import { languageStatusPalette } from '@/lib/language-colors'
import type { MondayStatus } from '@/lib/types/database.types'

export interface PageListRow {
  id: string
  name: string
  cluster?: string | null
  langStatus: Record<string, { hasUrl: boolean; confirmed: boolean }>
  /** Monday's truth: per-language implemented status (true = Monday says done). */
  mondayLangStatus: Record<string, boolean>
  /** Monday's truth: overall WP implementation status. */
  mondayStatus: MondayStatus
  /** Flagged after a language config change — page may have stale hreflang. */
  needsUpdate?: boolean
  /**
   * Pre-rendered hreflang HTML, available only when every language has a URL.
   * Undefined means the Copy button stays disabled — there's nothing to paste yet.
   */
  hreflangHtml?: string
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
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'incomplete' | 'done' | 'needs_update'>('all')

  // Intl.Collator handles "10 < 11 < 100" instead of string-sort "10 < 100 < 11"
  const collator = useMemo(
    () => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }),
    [],
  )

  function isDone(r: PageListRow) {
    return languages.every(l => r.langStatus[l]?.confirmed)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return rows
      .filter(r => {
        if (q) {
          const hay = (r.name + ' ' + (r.cluster ?? '')).toLowerCase()
          if (!hay.includes(q)) return false
        }
        if (filter === 'incomplete') return !isDone(r)
        if (filter === 'done') return isDone(r)
        if (filter === 'needs_update') return r.needsUpdate === true
        return true
      })
      .sort((x, y) => collator.compare(x.name, y.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, filter, collator])

  const doneCount = useMemo(() => rows.filter(isDone).length, [rows])
  const needsUpdateCount = useMemo(() => rows.filter(r => r.needsUpdate).length, [rows])

  return (
    <>
      {/* Toolbar — search + filter chips + counts */}
      <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">⌕</span>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${rows.length} pages — by name or cluster…`}
            className={`w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 ${a.ring}`}
          />
        </div>
        <div className="flex items-center gap-1 text-xs">
          {(['all', 'incomplete', 'done'] as const).map(f => {
            const active = filter === f
            const count =
              f === 'all' ? rows.length :
              f === 'done' ? doneCount :
              rows.length - doneCount
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  active
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f === 'all' ? 'All' : f === 'incomplete' ? 'Incomplete' : 'Done'}
                <span className={`ml-1.5 ${active ? 'opacity-70' : 'opacity-60'}`}>{count}</span>
              </button>
            )
          })}
          {needsUpdateCount > 0 && (
            <button
              onClick={() => setFilter('needs_update')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                filter === 'needs_update'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              ⚠ Needs update
              <span className={`ml-1.5 ${filter === 'needs_update' ? 'opacity-80' : 'opacity-70'}`}>{needsUpdateCount}</span>
            </button>
          )}
        </div>
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
                <th className="px-5 pb-3 font-medium">Status</th>
                <th className="px-5 pb-3 font-medium">All Live</th>
                <th className="px-5 pb-3 font-medium border-l border-slate-200">Langs</th>
                <th className="px-5 pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const done = isDone(r)
                const confirmedCount = languages.filter(l => r.langStatus[l]?.confirmed).length
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${i === filtered.length - 1 ? 'border-0' : ''}`}
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
                        <span className="truncate" title={r.name}>{r.name}</span>
                      </div>
                    </td>

                    {/* HREFLANG (system) — languages */}
                    <td className="px-5 py-4 border-l border-slate-100">
                      <div className="flex gap-1">
                        {languages.map(lang => {
                          const s = r.langStatus[lang] ?? { hasUrl: false, confirmed: false }
                          const { bg, text } = languageStatusPalette(lang, s.confirmed)
                          const title = s.confirmed
                            ? `${lang.toUpperCase()}: confirmed live`
                            : s.hasUrl
                              ? `${lang.toUpperCase()}: URL saved, not yet confirmed`
                              : `${lang.toUpperCase()}: no URL`
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
                            : confirmedCount > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {done ? '✓ Done' : `${confirmedCount} of ${languages.length}`}
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
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

/**
 * Per-row copy button. Disabled (greyed out) until all configured languages
 * have URLs — without a complete set, the hreflang block would be partial.
 */
function CopyHreflangButton({ html, enabled, accentText }: { html?: string; enabled: boolean; accentText: string }) {
  const [copied, setCopied] = useState(false)
  if (!enabled || !html) {
    return (
      <Tooltip label="Enter URLs for all languages first">
        <span
          aria-label="Copy hreflang (disabled — incomplete URLs)"
          className="inline-flex items-center justify-center p-1.5 text-slate-300 cursor-not-allowed"
        >
          <CopyIcon />
        </span>
      </Tooltip>
    )
  }
  return (
    <Tooltip label={copied ? 'Copied!' : 'Copy hreflang tags'}>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(html)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        aria-label="Copy hreflang tags"
        className={`${accentText} inline-flex items-center justify-center p-1.5 rounded transition-colors hover:bg-slate-100`}
      >
        {copied ? <CheckIcon /> : <CopyIcon />}
      </button>
    </Tooltip>
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

function CopyIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M20 6L9 17l-5-5" />
    </svg>
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
