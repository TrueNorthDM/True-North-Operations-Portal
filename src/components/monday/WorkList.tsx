'use client'

/**
 * My Work: every step assigned to somebody, across every board.
 *
 * The thing Monday's own dashboards could not do is here by construction: an
 * item where one person owns three steps produces three rows, not one, since a
 * row is a step rather than an item.
 *
 * The first two columns are the two ways out of a row: the item in Monday, and
 * its history. Clicking the row itself used to open the history, and Jeannette
 * asked for the opposite in August 2026, wanting Monday to be the direct
 * action. Two labelled icons at the start of the row make both one click away
 * and neither a surprise. The history is still asked of Monday live, so what
 * opens is current by definition.
 *
 * One column heading for the whole list, pinned under the portal's top bar as
 * the page scrolls, instead of a heading inside every block: with Completed
 * open the heading used to scroll away within a screen. The heading and the
 * blocks scroll sideways together. Which columns show is the reader's choice,
 * kept in their browser (columns.ts).
 *
 * A person's list, or a team's, follows that team's priority order when it has
 * one (team-priority.ts): the On-going block is in the team's order, the Team
 * column says each step's place in it, and a line above the list says whose
 * order it is. The people who may change it (team-priority.ts, priorityRights)
 * get a Team priority button beside Mine and Everyone, which opens the editor.
 *
 * Today is New York's day, worked out once on the server and passed in, so
 * "late" and "due today" agree with every other screen whatever the reader's
 * clock says (audit, 10 October 2026).
 */

import { useState, useMemo, useRef, useSyncExternalStore, useTransition, useId, type UIEvent } from 'react'
import Link from 'next/link'
import { withViewAs } from '@/components/ViewAsKeeper'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { SearchField } from '@/components/ui/SearchField'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { PullInfo } from '@/components/PullInfo'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { COMPLETED_MONTHS } from '@/lib/monday/worklist/constants'
import { DUE_BADGE } from './tokens'
import { HistoryPanel } from './HistoryPanel'
import { ColumnsMenu } from './ColumnsMenu'
import { Block, HeadCell } from './WorkBlock'
import { OrderIcon } from './RowLinks'
import { n, readDue, useIsClient, workToday, WORK_ZONE } from './shared'
import { personSelectValue, isMine } from '@/lib/monday/worklist/filters'
import {
  applyListFilters, sortRows, nextSort, readListParams, writeListParams, activeFilterCount,
  DUE_OPTIONS, CHANGE_OPTIONS, NO_FILTERS, NO_STATUS, type ListFilters, type Sort, type SortKey,
} from '@/lib/monday/worklist/list-view'
import {
  COLUMNS, gridFor, readColumnChoice, writeColumnChoice,
  type ColumnKey,
} from '@/lib/monday/worklist/columns'
import type { Worklist, WorkRow } from '@/lib/monday/worklist/data'
import { compareDefault, updatedWhen, type TeamOrderView } from '@/lib/monday/worklist/team-priority'

interface Option { value: string; label: string }

export type { HistoryEvent } from '@/lib/monday/worklist/history'
// The design checks import these from here, where they used to live.
export { HistoryPanel } from './HistoryPanel'
export { OpenInMonday, OpenHistory } from './RowLinks'

// The browser's memory of which columns a person hid. Read through
// useSyncExternalStore rather than an effect: the server renders every column,
// the browser's first render must match it, and the saved choice then arrives
// without a mismatch or a second render written by hand.
const COLUMNS_KEY = 'tn.my-work.hidden-columns'
const COLUMNS_EVENT = 'tn:my-work-columns'
function subscribeColumns(onChange: () => void) {
  window.addEventListener('storage', onChange)
  window.addEventListener(COLUMNS_EVENT, onChange)
  return () => {
    window.removeEventListener('storage', onChange)
    window.removeEventListener(COLUMNS_EVENT, onChange)
  }
}
function storedColumns(): string | null {
  try { return window.localStorage.getItem(COLUMNS_KEY) } catch { return null }
}

/**
 * States forced open for the design check.
 *
 * One optional object rather than four loose props, and named for what it is:
 * every field here exists to render a state the page normally reaches on its
 * own, so a reviewer can see all of them at once. Nothing in the app passes it.
 */
export interface PreviewState {
  /** Start with a search already typed. */
  query?: string
  /** Behave as though this team were chosen, which the URL normally decides. */
  team?: string
  /** Hold the "Mine is unavailable" tooltip open. */
  tip?: boolean
  /** Start with every block collapsed. */
  closed?: boolean
  /** Behave as though the finished-work filter were widened to everything. */
  done?: boolean
  /** Start with Completed open. */
  openCompleted?: boolean
  /** Start with these filters chosen, which the URL normally decides. */
  filters?: Partial<ListFilters>
  /** Start sorted by a column. */
  sort?: Sort
  /** Show only these columns, whatever the browser remembers. */
  columns?: ColumnKey[]
}

export function WorkList({
  data, people, teams, selfPersonId, isAdmin = false, preview, stickyTop, teamOrder = null, canSetPriority = false, canSeeEveryone = true, today: givenToday,
}: {
  data: Worklist
  people: Option[]
  teams: Option[]
  selfPersonId: string | null
  isAdmin?: boolean
  preview?: PreviewState
  /** The team order this list follows, when it follows one. Rows then carry teamRank. */
  teamOrder?: TeamOrderView | null
  /** "See everyone's list" (mw-everyone). Off: no Everyone, no person or team pickers. */
  canSeeEveryone?: boolean
  /** A team leader or an admin: shows Team priority beside Mine and Everyone. */
  canSetPriority?: boolean
  /** Today in New York, YYYY-MM-DD, from the server. A design check leaves it out. */
  today?: string
  /**
   * Where the column heading pins as the page scrolls: under the portal's top
   * bar (--chrome-top, left out here). The design check has no top bar and passes 0.
   */
  stickyTop?: number
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [fallbackToday] = useState(() => workToday())
  const today = givenToday ?? fallbackToday
  const tipId = useId()
  // Which tab the person just chose, held until the URL catches up. The data
  // still comes from the server, but the click should not wait for it: a tab
  // that stays inert for a second reads as broken, and the user clicks again.
  const [wanted, setWanted] = useState<boolean | null>(null)
  const [openRow, setOpenRow] = useState<WorkRow | null>(null)
  // Search is client-side and deliberately not a URL parameter: person and team
  // decide which rows are fetched, and typing would re-query the database on
  // every keystroke to narrow rows the browser already has.
  const [q, setQ] = useState(preview?.query ?? '')
  // Unknown user starts closed: it is an admin's queue, not the reader's work,
  // and it should not be the first thing between somebody and their list.
  const [openBlocks, setOpenBlocks] = useState(
    {
      unknown: false,
      ongoing: !preview?.closed,
      completed: preview?.openCompleted ?? false,
    })
  const [tip, setTip] = useState(preview?.tip ?? false)
  // Filters and sort are the reader's own narrowing of rows already loaded, so
  // they answer at once and are written to the address bar without asking the
  // server anything: window.history keeps the URL shareable and Next's router
  // in step without a round trip.
  const [filters, setFilters] = useState<ListFilters>(() => ({ ...readListParams(params).filters, ...preview?.filters }))
  const [sort, setSort] = useState<Sort | null>(() => preview?.sort ?? readListParams(params).sort)
  const remember = (f: ListFilters, so: Sort | null) => {
    if (preview) return
    const next = writeListParams(new URLSearchParams(window.location.search), f, so)
    const qs = next.toString()
    window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`)
  }
  const updateFilters = (patch: Partial<ListFilters>) => {
    const f = { ...filters, ...patch }
    setFilters(f)
    remember(f, sort)
  }
  const clearFilters = () => {
    setFilters(NO_FILTERS)
    remember(NO_FILTERS, sort)
  }
  const onSort = (k: SortKey) => {
    const so = nextSort(sort, k)
    setSort(so)
    remember(filters, so)
  }
  const clearSort = () => {
    setSort(null)
    remember(filters, null)
  }

  // Which columns show. Kept in this browser, not the URL: it is how a person
  // likes the page, not part of what they are asking it, and a link somebody
  // sends should not rearrange the reader's table.
  const stored = useSyncExternalStore(subscribeColumns, storedColumns, () => null)
  const [chosen, setChosen] = useState<ColumnKey[] | null>(null)
  const visible = preview?.columns ?? chosen ?? readColumnChoice(stored)
  const setVisible = (next: ColumnKey[]) => {
    setChosen(next)
    try {
      window.localStorage.setItem(COLUMNS_KEY, writeColumnChoice(next))
      window.dispatchEvent(new Event(COLUMNS_EVENT))
    } catch {
      // Storage blocked (a private window, a browser setting): the choice
      // still applies, it just is not remembered next time.
    }
  }
  // The Team column only exists while the list follows a team's order; with no
  // order there is no place to show, whatever the reader chose.
  const offered = teamOrder ? COLUMNS : COLUMNS.filter(c => c.key !== 'team')
  const grid = gridFor(teamOrder ? visible : visible.filter(k => k !== 'team'))
  const isClient = useIsClient()
  // Links, not pushes: ViewAsKeeper carries a View Stage preview along on a
  // link, and a push of its own beside it navigated twice (audit, 10 October 2026).
  const priorityHref = `/my-work?tab=work&view=priority${teamOrder?.canEdit ? `&pteam=${teamOrder.teamId}` : ''}`

  // The heading sits outside the scrolling area so it can pin to the top of the
  // page; it follows the table sideways by copying its scroll position.
  const headScroll = useRef<HTMLDivElement>(null)
  const followBody = (e: UIEvent<HTMLDivElement>) => {
    if (headScroll.current) headScroll.current.scrollLeft = e.currentTarget.scrollLeft
  }

  const team = preview?.team ?? params.get('team') ?? ''
  const person = personSelectValue(params.get('person'), team, selfPersonId)
  const includeDone = preview?.done ?? params.get('done') === '1'
  const mineFromUrl = isMine(person, team, selfPersonId)
  // Without the Everyone view the server shows their own list whatever the address says.
  const mine = !canSeeEveryone || (wanted ?? mineFromUrl)

  /**
   * `want` carries the tab the click chose, so the highlight can move before
   * the server answers. Every other control passes nothing, which clears it:
   * the local answer expires the moment somebody asks a different question,
   * without an effect watching for it.
   */
  const setParam = (key: string, value: string, want: boolean | null = null) => {
    setWanted(want)
    const next = new URLSearchParams(params.toString())
    // An empty person is NOT the absence of one. Absent means "the signed-in
    // person" and empty means "anybody", which is the whole basis of the two
    // tabs. Deleting the key when the value is empty collapsed the two, so
    // Everything wrote no parameter, the server read that as "me", and the
    // click did nothing.
    //
    // The distinction was written down a few commits ago and then erased by
    // this one line: the comment said they were different and the code made
    // them the same.
    if (value || key === 'person') next.set(key, value)
    else next.delete(key)
    // Person and team are two ways of asking the same question, so choosing one
    // clears the other rather than quietly intersecting them.
    if (key === 'person' && value) next.delete('team')
    if (key === 'team' && value) next.delete('person')
    // Everything means everything: a team left selected would keep narrowing
    // the list while the tab claimed otherwise.
    if (key === 'person' && !value) next.delete('team')
    // And a chosen team writes an EMPTY person rather than deleting it.
    // Deleting it means "the signed-in person", so picking Writers used to
    // filter to Writers and Arnaldo at once.
    if (key === 'team' && value) next.set('person', '')
    next.set('tab', 'work')
    // The narrowing the reader chose rides along: changing whose work is shown
    // should not quietly undo the filters on it.
    const withList = writeListParams(next, filters, sort)
    startTransition(() => router.push(withViewAs(`/my-work?${withList.toString()}`)))
  }

  /**
   * Every row with its deadline already read, and everything the row SHOWS
   * flattened into one string to search.
   *
   * Searching the fields alone missed the date: "2020" is on the screen, in
   * the Due column, and finding nothing made the page look broken rather than
   * narrow. So the haystack is built from what was rendered, both the stored
   * form (2020-08-21) and the printed one (Aug 21, 2020), plus the elapsed
   * time and the badge, because "late" and "upcoming" are words on the page
   * too and somebody will type them.
   */
  const prepared = useMemo(() => data.rows.map(r => {
    const due = r.dueDate ? readDue(r.dueDate, r.dueSuspect, today) : null
    return {
      row: r,
      due,
      hay: [
        r.itemName, r.language, r.parentItemName, r.boardName, r.workspaceName, r.who, r.stepName, r.statusText,
        r.dueDate, due?.date, due?.time, due ? DUE_BADGE[due.state].label : null,
      ].filter(Boolean).join(' ').toLowerCase(),
    }
  }), [data.rows, today])

  const needle = q.trim().toLowerCase()
  const searched = needle ? prepared.filter(p2 => p2.hay.includes(needle)) : prepared
  const rows = applyListFilters(searched, filters, undefined, today)
  const filtering = activeFilterCount(filters)

  // What the filters can offer is what is on the page, each with how many rows
  // it would keep, so a choice never leads to an empty list by surprise.
  const statusOptions = useMemo(() => {
    const counts = new Map<string, number>()
    for (const { row } of prepared) {
      const k = row.statusText || NO_STATUS
      counts.set(k, (counts.get(k) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: `${value === NO_STATUS ? 'No status' : value} (${n(count)})` }))
  }, [prepared])
  const boardOptions = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>()
    for (const { row } of prepared) {
      const k = String(row.boardId)
      counts.set(k, { name: row.boardName, count: (counts.get(k)?.count ?? 0) + 1 })
    }
    return [...counts.entries()]
      .sort((a, b) => a[1].name.localeCompare(b[1].name))
      .map(([value, b]) => ({ value, label: `${b.name} (${n(b.count)})` }))
  }, [prepared])

  // Nobody behind the account comes first as a category, because those rows
  // cannot be filtered by team and would otherwise sit unexplained among work
  // that can.
  const unknown = rows.filter(r => !r.row.assigneeKnown)
  const known = rows.filter(r => r.row.assigneeKnown)
  // On-going is the only block sorted by priority. Completed is a record, and
  // Unknown user is a queue for an admin; ordering either by importance would
  // be answering a question nobody asks of them.
  // A column the reader chose to sort by wins over every block's own order.
  const openRows = known.filter(r => r.row.statusDone !== true)
  // The team's order when the list follows one; otherwise the default order
  // (board priority, then deadline), which is also what fills in every place a
  // team leader has not set, so the two can never disagree.
  // An order a leader set: each row says whether it was placed by hand or
  // follows True North, and in the team's own order the block is cut into
  // bands where that changes (order-bands.ts). Sorted by another column, the
  // bands would mean nothing, so only the marks stay.
  const ordered = !!teamOrder && (teamOrder.placed > 0 || teamOrder.levels)
  const ongoing = sort ? sortRows(openRows, sort) : openRows.sort((a, b) =>
    (a.row.teamRank ?? Number.POSITIVE_INFINITY) - (b.row.teamRank ?? Number.POSITIVE_INFINITY)
    || compareDefault(a.row, b.row))
  const completed = sort ? sortRows(known.filter(r => r.row.statusDone === true), sort) : known.filter(r => r.row.statusDone === true)
  const unknownRows = sort ? sortRows(unknown, sort) : unknown
  const filterSelect = (on: boolean) =>
    `gap-2 px-3 py-[9px] rounded-[10px] border bg-white font-(family-name:--font-display) font-semibold text-[13px] ${on ? 'border-tn-teal text-tn-teal' : 'border-[var(--panel-border)] text-muted'}`

  return (
    <div className={`space-y-3.5 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      {/* One row for every control, so the table starts higher up the page. The
          search box takes whatever width the row has left and gives it back
          as the screen narrows; below its minimum the row wraps. */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <SearchField value={q} onChange={setQ} placeholder="Search items, boards, people…" className="flex-1 min-w-[220px]" />

        {/* Mine or everyone's: one either/or, so one radio group (audit,
            10 October 2026). Team priority sits beside it, not in it: it opens
            another page rather than answering "whose work". */}
        <div className="flex items-center gap-2 flex-wrap">
          {!selfPersonId && (
            <span className="relative">
              {/* aria-disabled, not disabled: a disabled button cannot take
                  focus, so the explanation for why it cannot be pressed would
                  be the one thing a keyboard could never reach. */}
              <button
                type="button"
                aria-disabled="true"
                aria-describedby={tipId}
                onMouseEnter={() => setTip(true)}
                onMouseLeave={() => setTip(false)}
                onFocus={() => setTip(true)}
                onBlur={() => setTip(false)}
                className="font-(family-name:--font-display) font-extrabold text-[12.5px] px-2.5 py-[5px] rounded-[7px] border border-dashed border-[var(--panel-border)] text-[var(--faint)] cursor-not-allowed"
              >
                Mine
              </button>
              {/* Written into the page rather than left to the browser's own
                  tooltip, and always there for a screen reader. */}
              <span
                id={tipId}
                role="tooltip"
                className={tip
                  ? 'absolute top-[calc(100%+8px)] left-0 z-20 w-80 rounded-[9px] bg-tn-primary px-[11px] py-[9px] text-[12px] leading-[1.5] text-[#dfe8f5] shadow-[0_12px_26px_-14px_rgba(1,35,88,.6)]'
                  : 'sr-only'}
              >
                Your login is not linked to anyone in the Directory yet, so there is no “mine” to filter by.
              </span>
            </span>
          )}
          {(selfPersonId || canSeeEveryone) && (
            <Segmented<'mine' | 'all'>
              label="Whose work"
              value={mine && selfPersonId ? 'mine' : 'all'}
              onChange={k => setParam('person', k === 'mine' ? (selfPersonId ?? '') : '', k === 'mine')}
              options={[
                ...(selfPersonId ? [{ key: 'mine' as const, label: 'Mine' }] : []),
                ...(canSeeEveryone ? [{ key: 'all' as const, label: 'Everyone' }] : []),
              ]}
            />
          )}
          {canSetPriority && (
            <Link
              href={priorityHref}
              prefetch={false}
              className="inline-flex items-center gap-2 px-3 py-[7px] rounded-[10px] border border-[var(--panel-border)] bg-white font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink transition-colors hover:border-tn-teal"
            >
              <OrderIcon />
              Team priority
            </Link>
          )}
        </div>

        {!mine && canSeeEveryone && (
          <>
            <Select
              value={person}
              onChange={v => setParam('person', v)}
              options={[{ value: '', label: 'Anyone' }, ...people]}
              ariaLabel="Person"
              className="gap-2 px-3 py-[9px] rounded-[10px] border border-[var(--panel-border)] bg-white font-(family-name:--font-display) font-semibold text-[13px] text-muted"
              searchable
            />
            <Select
              value={team}
              onChange={v => setParam('team', v)}
              options={[{ value: '', label: 'All teams' }, ...teams]}
              ariaLabel="Team"
              className="gap-2 px-3 py-[9px] rounded-[10px] border border-[var(--panel-border)] bg-white font-(family-name:--font-display) font-semibold text-[13px] text-muted"
            />
          </>
        )}

        {/* A switch named for what it does; the words beside it say how far
            back the list reaches now. A label, so the words click it too. */}
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <Switch on={includeDone} onChange={v => setParam('done', v ? '1' : '')} label="Show all finished work" />
          <span aria-hidden="true" className={`font-[family-name:var(--font-open-sans)] text-[13.5px] font-semibold ${includeDone ? 'text-tn-teal' : 'text-muted'}`}>
            {includeDone ? 'Finished work: all of it' : `Finished work: ${COMPLETED_MONTHS} months`}
          </span>
        </label>

        {/* Narrowing what is on the page. Every chosen filter is drawn in teal and
            the count on Clear says how many rows they leave out, so a short
            list never reads as a finished one. */}
        <Select
          value={filters.status}
          onChange={v => updateFilters({ status: v })}
          options={[{ value: '', label: 'Any status' }, ...statusOptions]}
          ariaLabel="Status"
          className={filterSelect(!!filters.status)}
          searchable
        />
        <Select
          value={filters.board}
          onChange={v => updateFilters({ board: v })}
          options={[{ value: '', label: 'Any board' }, ...boardOptions]}
          ariaLabel="Board"
          className={filterSelect(!!filters.board)}
          searchable
        />
        <Select
          value={filters.due}
          onChange={v => updateFilters({ due: v as ListFilters['due'] })}
          options={DUE_OPTIONS}
          ariaLabel="Due date"
          className={filterSelect(!!filters.due)}
        />
        <Select
          value={filters.change}
          onChange={v => updateFilters({ change: v as ListFilters['change'] })}
          options={CHANGE_OPTIONS}
          ariaLabel="Last change in Monday"
          className={filterSelect(!!filters.change)}
        />
        {filtering > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-[13px] font-semibold text-tn-teal hover:underline"
          >
            {`Clear filters · ${n(searched.length - rows.length)} hidden`}
          </button>
        )}
        <ColumnsMenu visible={visible} onChange={setVisible} offered={offered} />
      </div>

      {/* Same footer the API cards use, so "how current is this" reads the
          same everywhere. Fed the oldest board's stamp rather than the newest:
          boards refresh in rotation, so the newest would flatter the page. The
          count sits on this line now that the controls fill the row above. */}
      <div className="flex items-center gap-3 flex-wrap border-t border-[var(--panel-border)] pt-3">
        <PullInfo
          syncedAt={data.oldestSyncAt}
          utcHours={[1, 5, 9, 13, 17, 21]}
          utcMinute={15}
          label="Work pulled from Monday"
          pastVerb="refreshed"
          className="flex items-center gap-2 text-[12.5px] text-muted"
        />
        <span className="text-[13px] text-muted ml-auto">
          {needle || filtering
            ? `${n(rows.length)} of ${n(prepared.length)} shown`
            : data.truncated
              ? `${n(data.total)} shown of ${n(data.matching)}`
              : `${n(data.open)} open${data.total !== data.open ? ` · ${n(data.total)} in view` : ''}`}
        </span>
      </div>

      {/* Whose order the list is in. Said once, above the list: who set it and
          when, and for the people who can change it, the way in. A member of a
          team nobody has ordered sees nothing here, because their list is in
          the order it always was. */}
      {teamOrder && (teamOrder.placed > 0 || teamOrder.levels || teamOrder.canEdit || teamOrder.choices.length > 1) && (
        <div className="flex items-center gap-x-3 gap-y-2 flex-wrap rounded-[12px] border border-[rgba(30,125,127,.28)] bg-[rgba(30,125,127,.06)] px-4 py-2.5 min-h-[46px]">
          <OrderIcon />
          <span className="text-[13px] text-tn-ink">
            {teamOrder.placed > 0 || teamOrder.levels ? (
              <>
                <span className="font-semibold">{`Ordered by the ${teamOrder.teamName} team's priority`}</span>
                <span className="text-muted">
                  {`, set by ${teamOrder.updatedBySelf ? 'you' : teamOrder.updatedBy ?? 'a team leader'}`}
                  {isClient && teamOrder.updatedAt ? ` · updated ${updatedWhen(teamOrder.updatedAt, new Date(), WORK_ZONE)}` : ''}
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold">{`The ${teamOrder.teamName} team has no priority order yet`}</span>
                <span className="text-muted">, so the list follows True North&apos;s order: board priority, then deadline</span>
              </>
            )}
          </span>
          {teamOrder.choices.length > 1 && (
            <Select
              value={teamOrder.teamId}
              onChange={v => setParam('pteam', v)}
              options={teamOrder.choices.map(c => ({ value: c.id, label: `${c.name} order` }))}
              ariaLabel="Which team's order the list follows"
              className="gap-2 px-2.5 py-[5px] rounded-[8px] border border-[rgba(30,125,127,.35)] bg-white font-(family-name:--font-display) font-semibold text-[12.5px] text-tn-teal"
            />
          )}
          {sort && (
            <button type="button" onClick={clearSort} className="text-[13px] font-semibold text-tn-teal hover:underline">
              Back to the team order
            </button>
          )}
          <span className="ml-auto">
            {teamOrder.canEdit ? (
              // The portal's navy button, as the editor's Save and close is, so
              // the way in and the way out read as one pair.
              <Link href={`/my-work?tab=work&view=priority&pteam=${teamOrder.teamId}`} prefetch={false} className={BTN.navy}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
                <span className="text-[#ffffff]">{teamOrder.placed > 0 || teamOrder.levels ? 'Edit order' : 'Set the order'}</span>
              </Link>
            ) : (
              <span className="text-[12px] text-muted">Only the team&apos;s leaders, admins and people given access can change it</span>
            )}
          </span>
        </div>
      )}

      {/* Only where it changes the answer.
          A missing account → person link matters for exactly one thing: the
          team filter runs through it, so work on an unlinked account is
          invisible while a team is selected. With no team chosen the list is
          complete and the same message would be describing a problem that is
          not on screen, aimed at somebody who cannot fix it: fixing it is an
          admin job on another page. A standing yellow banner nobody can act on
          is how a warning gets tuned out before the day it matters. */}
      {team && data.unlinked > 0 && (
        <div className="rounded-[10px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-3.5 text-[13.5px] leading-[1.6] text-[var(--warn-fg)]">
          {`This team filter cannot see ${n(data.unlinkedAssignments)} ${data.unlinkedAssignments === 1 ? 'assignment' : 'assignments'} on ${n(data.unlinked)} Monday ${data.unlinked === 1 ? 'account' : 'accounts'} that belong to nobody in the Directory.`}
          {isAdmin && (
            <>
              {' '}
              <a href="/admin/monday-links" className="font-bold text-[var(--warn-fg)] underline hover:no-underline">Resolve them</a>.
            </>
          )}
        </div>
      )}

      {/* Everything, unfiltered, is 53,000 rows and fifty round trips. Nobody
          reads that; somebody looking at all of it is surveying, and a survey
          is served by the first few thousand plus an honest count. Naming the
          cap is what keeps it from reading as "this is all there is". */}
      {data.truncated && (
        <div className="rounded-[10px] border border-[var(--panel-border)] bg-subtle px-4 py-3.5 text-[13.5px] text-muted leading-[1.6]">
          {`Showing the first ${n(data.total)} of ${n(data.matching)} steps. Pick a person or a team to see all of theirs.`}
        </div>
      )}

      <div>
        {/* The one column heading. Sticky to the page, so it stays in view the
            whole way down a long Completed block; its own overflow is hidden and
            its scroll position follows the table below, so sideways the two
            move as one. Two pixels narrower than the table's minimum because
            the blocks' borders take those two pixels from their rows. */}
        <div
          ref={headScroll}
          className="sticky z-10 overflow-hidden rounded-[12px] border border-[var(--panel-border)] bg-subtle shadow-[0_8px_16px_-14px_rgba(1,35,88,.45)]"
          // Under the portal's chrome (top bar, and the staging strip there):
          // the default follows --chrome-top; a design check passes its own.
          style={{ top: stickyTop ?? 'var(--chrome-top)' }}
        >
          <div className="grid" style={{ gridTemplateColumns: grid.template, minWidth: grid.minWidth - 2 }}>
            {grid.columns.map(c => <HeadCell key={c.key} col={c} sort={sort} onSort={onSort} />)}
          </div>
        </div>

        <div className="overflow-x-auto mt-2.5" onScroll={followBody}>
          <div className="space-y-3" style={{ minWidth: grid.minWidth }}>
            {/* Never under Mine. Those rows belong to an account nobody is
                behind, so by definition none of them are yours: the block could
                only ever read zero there, which is a row of furniture asking to
                be ignored. */}
            {!mine && (
              <Block
                title="Unknown user"
                note="Work on a Monday account with nobody behind it"
                rows={unknownRows}
                open={openBlocks.unknown}
                onToggle={() => setOpenBlocks(b => ({ ...b, unknown: !b.unknown }))}
                onPick={setOpenRow}
                columns={grid.columns}
                template={grid.template}
                tone="quiet"
              />
            )}

            <Block
              title="On-going"
              note={teamOrder && !sort ? "Steps still open, in the team's order" : 'Steps still open'}
              rows={ongoing}
              open={openBlocks.ongoing}
              onToggle={() => setOpenBlocks(b => ({ ...b, ongoing: !b.ongoing }))}
              onPick={setOpenRow}
              columns={grid.columns}
              template={grid.template}
              marks={ordered}
              bands={ordered && !sort ? {
                leader: teamOrder!.updatedBySelf ? 'you' : teamOrder!.updatedBy ?? 'a team leader',
                levels: teamOrder!.levels,
                title: mine ? 'Your list' : 'This list',
                offset: stickyTop == null ? 'calc(var(--chrome-top) + 52px)' : stickyTop + 52,
              } : null}
            />

            <Block
              title="Completed"
              note={includeDone
                ? 'Finished, all of it'
                : `Finished, item touched in the last ${COMPLETED_MONTHS} months`}
              rows={completed}
              open={openBlocks.completed}
              onToggle={() => setOpenBlocks(b => ({ ...b, completed: !b.completed }))}
              onPick={setOpenRow}
              columns={grid.columns}
              template={grid.template}
            />
          </div>
        </div>
      </div>

      <p className="text-[12px] text-muted leading-[1.65] m-0 mt-3.5">
        {`Completed shows steps finished where the item was last changed in Monday within ${COMPLETED_MONTHS} months, which the filter above can widen to everything. Nothing is deleted: older finished work stays in the database and out of this page, because a work list that opens on nine years of finished steps is not a work list. Monday does not record when a step was completed, so the item's last change is used instead, which keeps a step in view a little longer when the item was touched for some other reason.`}
      </p>

      {openRow && <HistoryPanel row={openRow} onClose={() => setOpenRow(null)} today={today} />}
    </div>
  )
}
