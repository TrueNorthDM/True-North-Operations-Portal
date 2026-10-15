/**
 * The pure half of PageList: the URL state it reads, the filter and sort it
 * runs, and the groups it draws. No React here, so each rule can be tested on
 * its own and the component keeps to wiring and markup.
 */

import { reportDate } from '@/lib/report/clock'
import type { PageListRow } from '@/lib/href-links/data'

// All filter + sort state lives in URL query params, so the view is
// shareable and the browser Back button rewinds filter changes.
export type StatusFilter = 'all' | 'incomplete' | 'done' | 'needs_update' | 'not_relevant'
export type SortKey = 'name' | 'hreflang_status' | 'all_live'
export type SortDir = 'asc' | 'desc'

export const STATUS_LABEL: Record<StatusFilter, string> = {
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
export type GroupKey = 'ready' | 'ongoing' | 'completed' | 'not_relevant'
export const GROUP_ORDER: GroupKey[] = ['ready', 'ongoing', 'completed', 'not_relevant']
export const GROUP_LABEL: Record<GroupKey, string> = {
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
export const isDone = (r: PageListRow) => r.done

/** How many of the site's languages the portal holds a link for. */
export const urlCountOf = (r: PageListRow, languages: string[]) =>
  languages.filter(l => r.langStatus[l]?.hasUrl).length

/**
 * The view the URL describes, with anything unknown falling back to the
 * default. `langParam` comes back raw: the caller memoises the parsed list on
 * it, so the filtered rows are not rebuilt on every render.
 */
export function readView(params: { get(key: string): string | null }) {
  const status: StatusFilter =
    (['incomplete', 'done', 'needs_update', 'not_relevant'] as const).find(
      v => v === params.get('status'),
    ) ?? 'all'
  const langParam = params.get('lang') ?? ''
  const sortKey: SortKey =
    (['hreflang_status', 'all_live'] as const).find(
      v => v === params.get('sort'),
    ) ?? 'name'
  const sortDir: SortDir = params.get('dir') === 'desc' ? 'desc' : 'asc'
  return { status, langParam, sortKey, sortDir }
}

/** The `lang` param as a list, keeping only the site's own languages. */
export function parseLangs(langParam: string, languages: string[]): string[] {
  return langParam.split(',').map(s => s.trim()).filter(s => languages.includes(s))
}

// Empty/null values get deleted (URL stays clean for defaults, no
// `?status=all` clutter).
export function patchQuery(current: string, patch: Record<string, string | null>): string {
  const params = new URLSearchParams(current)
  for (const [k, v] of Object.entries(patch)) {
    if (v == null || v === '') params.delete(k)
    else params.set(k, v)
  }
  return params.toString()
}

/** The URL patch a click on a sortable header makes. */
export function sortPatch(key: SortKey, sortKey: SortKey, sortDir: SortDir): Record<string, string | null> {
  // Cycle: not-sorted → asc → desc → not-sorted (= back to default 'name' asc)
  if (sortKey !== key) return { sort: key, dir: null }
  if (sortDir === 'asc') return { sort: key, dir: 'desc' }
  return { sort: null, dir: null }
}

/** The `lang` list after one checkbox is flipped. */
export function toggledLangs(hasLangs: string[], lang: string): string[] {
  return hasLangs.includes(lang)
    ? hasLangs.filter(l => l !== lang)
    : [...hasLangs, lang]
}

/** What the Has language button says without being opened. */
export function langFilterLabel(hasLangs: string[]): string {
  return hasLangs.length === 0
    ? 'All'
    : hasLangs.length === 1
      ? hasLangs[0].toUpperCase()
      : `${hasLangs.length} selected`
}

// Intl.Collator handles "10 < 11 < 100" instead of string-sort "10 < 100 < 11"
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** The rows the search and filters let through, in the chosen order. */
export function filterAndSort(
  rows: PageListRow[],
  languages: string[],
  view: { search: string; status: StatusFilter; hasLangs: string[]; sortKey: SortKey; sortDir: SortDir },
): PageListRow[] {
  const { search, status, hasLangs, sortKey, sortDir } = view
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
      cmp = urlCountOf(x, languages) - urlCountOf(y, languages)
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
}

/** The filtered rows, split into the four groups. */
export function splitIntoGroups(rows: PageListRow[], languages: string[]): Record<GroupKey, PageListRow[]> {
  const out: Record<GroupKey, PageListRow[]> = {
    ready: [], ongoing: [], completed: [], not_relevant: [],
  }
  for (const r of rows) out[groupOf(r, languages)].push(r)
  return out
}

/** The counts the Status menu shows beside each choice. */
export function statusCounts(rows: PageListRow[]) {
  const done = rows.filter(isDone).length
  return {
    done,
    incomplete: rows.length - done,
    needsUpdate: rows.filter(r => r.needsUpdate).length,
    notRelevant: rows.filter(r => r.notRelevant).length,
  }
}
