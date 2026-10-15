'use client'

/**
 * The toolbar above PageList: search, the Status and Has language dropdowns,
 * and the "Showing x of y" count. It owns no state: the search text and every
 * filter come in from PageList, and each change goes back out through
 * `onSearch` / `onPatch`.
 */

import { SearchField } from '@/components/ui/SearchField'
import { Popover, PopoverItem } from './PageListParts'
import { languageName } from '@/lib/language-display'
import { STATUS_LABEL, langFilterLabel, type StatusFilter } from './page-list-model'

export function PageListToolbar({
  search, onSearch, onPatch, onToggleLang,
  status, hasLangs, languages, total, shown, counts, ring,
}: {
  search: string
  onSearch: (v: string) => void
  /** Writes back to the URL; empty/null values are dropped from it. */
  onPatch: (patch: Record<string, string | null>) => void
  onToggleLang: (lang: string) => void
  status: StatusFilter
  hasLangs: string[]
  languages: string[]
  total: number
  shown: number
  counts: { done: number; incomplete: number; needsUpdate: number; notRelevant: number }
  /** The site's focus ring class. */
  ring: string
}) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 p-4 flex flex-wrap items-center gap-3">
      <SearchField
        value={search}
        onChange={onSearch}
        placeholder={`Search ${total} pages by name…`}
        className="flex-1 min-w-[240px]"
        focus={`focus:ring-2 ${ring}`}
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
        accentRing={ring}
      >
        {({ close }) => (
          <ul className="py-1 min-w-[180px]">
            {(['all', 'incomplete', 'done'] as const).map(s => (
              <PopoverItem
                key={s}
                selected={status === s}
                onClick={() => { onPatch({ status: s === 'all' ? null : s }); close() }}
              >
                <span className="flex-1">{STATUS_LABEL[s]}</span>
                <span className="text-xs text-slate-400 ml-3">
                  {s === 'all' ? total : s === 'done' ? counts.done : counts.incomplete}
                </span>
              </PopoverItem>
            ))}
            {(counts.needsUpdate > 0 || counts.notRelevant > 0) && (
              <li aria-hidden="true" className="border-t border-slate-100 my-1" />
            )}
            {counts.needsUpdate > 0 && (
              <PopoverItem
                selected={status === 'needs_update'}
                onClick={() => { onPatch({ status: 'needs_update' }); close() }}
              >
                <span className="flex-1 text-amber-700">⚠ Needs update</span>
                <span className="text-xs text-amber-600 ml-3">{counts.needsUpdate}</span>
              </PopoverItem>
            )}
            {counts.notRelevant > 0 && (
              <PopoverItem
                selected={status === 'not_relevant'}
                onClick={() => { onPatch({ status: 'not_relevant' }); close() }}
              >
                <span className="flex-1 text-slate-600">Not relevant</span>
                <span className="text-xs text-slate-400 ml-3">{counts.notRelevant}</span>
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
              {langFilterLabel(hasLangs)}
            </span>
          </>
        }
        highlight={hasLangs.length > 0}
        accentRing={ring}
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
                      onChange={() => onToggleLang(lang)}
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
                    onClick={() => onPatch({ lang: null })}
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
        Showing <strong className="text-foreground">{shown}</strong> of {total}
      </div>
    </div>
  )
}
