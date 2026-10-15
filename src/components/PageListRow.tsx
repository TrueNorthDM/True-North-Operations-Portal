'use client'

/**
 * The body pieces of PageList's table: the header row that opens and closes a
 * group, and one page's row. Both are leaves: what they show comes in as
 * props, and the only thing they send back is the group toggle.
 */

import Link from 'next/link'
import { Tooltip } from './PageListParts'
import { hrefLinksPage } from '@/lib/nav/routes'
import { languageName } from '@/lib/language-display'
import type { PageListRow as Row } from '@/lib/href-links/data'
import type { SiteCode } from '@/lib/href-links/rules'
import { langChipStyle } from '@/components/href-links/lang-chip'
import { GROUP_LABEL, formatDoneDate, isDone, urlCountOf, type GroupKey } from './page-list-model'

export function PageListGroupHeader({ groupKey, count, isOpen, onToggle }: {
  groupKey: GroupKey
  count: number
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <tr className="bg-subtle border-y border-slate-200">
      <th
        colSpan={5}
        scope="colgroup"
        className="px-3 py-2 text-left"
      >
        <button
          type="button"
          onClick={onToggle}
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
            {count}
          </span>
        </button>
      </th>
    </tr>
  )
}

export function PageListRow({ r, languages, siteCode, last, linkClass }: {
  r: Row
  languages: string[]
  siteCode: SiteCode
  /** The last row of its group. */
  last: boolean
  /** The site's accent for the View link. */
  linkClass: string
}) {
  const done = isDone(r)
  // The chips and the "2 of 4" count go by the links the portal
  // holds (hasUrl); "✓ Done" is the one rule, from the server.
  const urlCount = urlCountOf(r, languages)
  return (
    <tr
      // Not-relevant pages fade the whole row so they read
      // as "set aside, not part of the active work" without
      // hiding them entirely.
      // The last row of its group drops its line: the next
      // group's header (or the table's edge) draws one. It
      // compared with the whole list's length, so it never hit.
      className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
        last ? 'border-b-0' : ''
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
            className={`${linkClass} inline-flex items-center justify-center p-1.5 rounded transition-colors hover:bg-slate-100`}
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
}
