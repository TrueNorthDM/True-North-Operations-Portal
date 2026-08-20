'use client'

/**
 * My Work: every step assigned to somebody, across every board.
 *
 * Grouped workspace → board → step, because that is how the question is asked.
 * The thing Monday's own dashboards could not do is here by construction: an
 * item where one person owns three steps produces three rows, not one, since a
 * row is a step rather than an item.
 *
 * Clicking a row asks Monday for that item's history, live. No history is
 * stored, so what opens is current by definition.
 */

import { useState, useEffect, useMemo, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { SearchField } from '@/components/ui/SearchField'
import { PullInfo } from '@/components/PullInfo'
import { COMPLETED_MONTHS } from '@/lib/monday/worklist/data'
import type { Worklist, WorkRow } from '@/lib/monday/worklist/data'

interface Prepared { row: WorkRow; due: ReturnType<typeof readDue> | null; hay: string }

interface Option { value: string; label: string }

interface HistoryEvent {
  id: string
  event: string
  at: string | null
  userId: number | null
  column: string | null
  from: string | null
  to: string | null
}

// Design tokens copied from the handoff rather than approximated. The portal's
// own variables already carry most of them (--subtle is #f4f2ec, --muted is
// #8593a4, --foreground #435066, tn-ink #012358, tn-teal #1E7D7F), so those are
// used by name; the two border greys have no token yet and are written out.
// Written inline at each use rather than through constants: Tailwind reads
// arbitrary values out of the class string at build time, so a name here would
// produce a class the compiler never sees.
//   #e4e7ec  panel and header borders
//   #eceff3  the rule between rows
//   #f8f7f3  row hover

/**
 * The twelve columns.
 *
 * Two of the handoff's widths do not fit their own contents at the 1180px it
 * sets, and copying them exactly would copy the bug:
 *
 *   badge 5%   59px for an "UPCOMING" 62px wide, so in the mock itself the
 *              badge paints over the eye beside it. Now 9%.
 *   Monday 3%  35px, which is 11px of usable width after padding, for a 17px
 *              icon under a header word that needs about 55px. Now 7%.
 *
 * The text columns give up the difference, since they wrap and these do not. A
 * design file describes an intent, and the intent is plainly not "clip this".
 */
const GRID = '13% 9% 8% 7% 10% 6% 8% 9% 8% 6% 9% 7%'

// min-w-0 on every cell, so a grid column can never be widened by its content,
// and overflow-hidden so nothing can be drawn outside the column that owns it.
// Without the pair, one long unbreakable word reaches into its neighbour and
// the reader sees two facts on top of each other.
const HEAD_CELL = "px-3 py-[11px] min-w-0 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted"
const CELL = 'px-3 py-2.5 min-w-0 overflow-hidden text-[13px] leading-[1.4] break-words'

/**
 * A badge, exactly as the handoff draws one: 20px line box, no vertical
 * padding, so it sits on the text line beside it.
 */
const chip = 'inline-flex items-center align-top font-[family-name:var(--font-open-sans)] text-[10px] font-extrabold tracking-[.06em] uppercase px-2 leading-5 rounded-[5px]'

/**
 * A status badge in Monday's own colour, white on the label's hex, which is
 * how Monday paints it. Grey only when a step has no status column paired.
 */
function StatusChip({ text, colour }: { text: string; colour: string | null }) {
  if (!colour) return <span className={`${chip} bg-[var(--chip-neutral-bg)] text-muted`}>{text}</span>
  return <span className={`${chip} text-white`} style={{ background: colour }}>{text}</span>
}

/** Counts in the thousands, written the way the handoff writes them. */
const n = (v: number) => v.toLocaleString('en-US')

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

const PRIORITY_CHIP: Record<string, string> = {
  high: 'bg-[rgba(194,65,12,.12)] text-[#c2410c]',
  medium: 'bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]',
  low: 'text-[#9aa7b6]',
}

/** The same eye the Href Link Management list uses for "open this". */
function EyeIcon() {
  return (
    <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function span(from: Date, to: Date): string {
  let y = to.getFullYear() - from.getFullYear()
  let m = to.getMonth() - from.getMonth()
  let d = to.getDate() - from.getDate()
  if (d < 0) {
    m--
    d += new Date(to.getFullYear(), to.getMonth(), 0).getDate()
  }
  if (m < 0) { y--; m += 12 }
  const parts = [y ? `${y}y` : '', m ? `${m}m` : '', d ? `${d}d` : ''].filter(Boolean)
  return parts.length ? parts.join(' ') : 'today'
}

type DueState = 'late' | 'today' | 'upcoming' | 'odd'

function readDue(date: string, suspect = false): { date: string; time: string; state: DueState } {
  const at = new Date(`${date}T00:00:00`)
  // Padded to four digits by hand. Intl prints year 202 as "202", dropping the
  // very digit that shows the value is wrong: "Aug 21, 0202" reads as a typo,
  // "Aug 21, 202" reads as a year nobody recognises.
  const stored = Number(date.slice(0, 4))
  const shown = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    .replace(/\b\d{1,4}$/, String(stored).padStart(4, '0'))
  // Still written the way every other date is written. A year of 0202 reads as
  // a typo at a glance in "Aug 21, 0202"; as a raw 0202-08-21 it reads as a
  // different kind of value, and the point is that it is the same kind with a
  // digit missing.
  if (suspect) return { date: shown, time: '', state: 'odd' }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (at.getTime() < today.getTime()) return { date: shown, time: span(at, today), state: 'late' }
  if (at.getTime() === today.getTime()) return { date: shown, time: '', state: 'today' }
  return { date: shown, time: `in ${span(today, at)}`, state: 'upcoming' }
}

const DUE_BADGE: Record<DueState, { label: string; className: string }> = {
  late: { label: 'Late', className: 'bg-[rgba(194,65,12,.12)] text-[#c2410c]' },
  today: { label: 'Due today', className: 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]' },
  upcoming: { label: 'Upcoming', className: 'bg-[rgba(30,125,127,.12)] text-tn-teal' },
  odd: { label: 'Check date', className: 'bg-[var(--chip-neutral-bg)] text-muted' },
}

const DUE_TIME: Record<DueState, string> = {
  late: 'text-[#c2410c] font-semibold',
  today: 'text-muted',
  upcoming: 'text-tn-teal font-semibold',
  odd: 'text-[var(--faint)]',
}

function when(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

function HistoryPanel({ row, onClose }: { row: WorkRow; onClose: () => void }) {
  const [state, setState] = useState<{
    loading: boolean; error?: string; events?: HistoryEvent[]; names?: Record<number, string>
  }>({ loading: true })

  useEffect(() => {
    let alive = true
    fetch(`/api/monday/item-history?board=${row.boardId}&item=${row.itemId}`)
      .then(r => r.json())
      .then(d => { if (alive) setState(d.error ? { loading: false, error: d.error } : { loading: false, events: d.events, names: d.names }) })
      .catch(e => { if (alive) setState({ loading: false, error: String(e) }) })
    return () => { alive = false }
  }, [row.boardId, row.itemId])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-[rgba(1,35,88,.35)]" onClick={onClose} aria-label="Close" />
      <div className="relative w-full max-w-[560px] h-full bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-[var(--panel-border)] px-6 py-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-muted">{row.boardName}</div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-tn-ink text-[19px] leading-tight m-0 mt-0.5">
              {row.parentItemName ?? row.itemName}
            </h2>
            {row.parentItemName && <div className="text-sm text-muted mt-0.5">{row.itemName}</div>}
          </div>
          {/* No close button: the panel closes by clicking away from it, which
              is the gesture people already use on a drawer. What earns the
              corner is the one action that leaves for somewhere else. */}
          {row.url && (
            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${row.itemName} in Monday`}
              title="Open in Monday"
              className="shrink-0 inline-flex items-center justify-center p-2 rounded-full text-muted hover:text-tn-teal hover:bg-slate-100 transition-colors"
            >
              <EyeIcon />
            </a>
          )}
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <span className={`${chip} bg-[rgba(30,125,127,.1)] text-tn-teal`}>{row.stepName}</span>
            {row.statusText && <StatusChip text={row.statusText} colour={row.statusColor} />}
            {row.dueDate && (() => {
              const d = readDue(row.dueDate, row.dueSuspect)
              return (
                <span className="inline-flex items-center gap-2 text-sm text-muted">
                  {row.dueLabel ?? 'Due'}: {d.date}
                  {d.time && <span className={DUE_TIME[d.state]}>{d.time}</span>}
                  <span className={`${chip} ${DUE_BADGE[d.state].className}`}>{DUE_BADGE[d.state].label}</span>
                </span>
              )
            })()}
            <span className="text-sm text-muted">{row.who}</span>
          </div>

          <h3 className="font-(family-name:--font-display) font-extrabold text-tn-ink text-sm m-0 mb-3">History</h3>

          {state.loading && <div className="text-sm text-muted">Asking Monday…</div>}
          {state.error && (
            <div className="rounded-[10px] border border-[var(--warn-border)] bg-[var(--warn-bg)] p-4 text-sm text-[var(--warn-fg)]">{state.error}</div>
          )}
          {state.events && state.events.length === 0 && (
            <div className="text-sm text-muted">
              Nothing in Monday&apos;s log for this item. Monday keeps activity for a limited window, so an item
              that has not moved in a long time is genuinely empty rather than missing.
            </div>
          )}
          {state.events && state.events.length > 0 && (
            <ol className="m-0 p-0 list-none space-y-3">
              {state.events.map(e => (
                <li key={e.id} className="relative pl-5">
                  <span className="absolute left-0 top-[6px] w-2 h-2 rounded-full bg-tn-teal" />
                  <div className="text-[13px] text-tn-ink">
                    {e.column ? (
                      <>
                        <span className="font-bold">{e.column}</span>
                        {e.from && <span className="text-muted"> from {e.from}</span>}
                        {e.to && <> → <span className="font-semibold">{e.to}</span></>}
                      </>
                    ) : (
                      <span className="text-muted">{e.event.replace(/_/g, ' ')}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {when(e.at)}{e.userId && state.names?.[e.userId] ? ` · ${state.names[e.userId]}` : ''}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * One collapsible block of rows.
 *
 * Three of them, because the rows answer three different questions and mixing
 * them makes each one harder to read: work with nobody behind it needs an
 * admin, open work needs doing, and finished work is only there to be checked
 * against. Each keeps its own open/closed state so the page can start with the
 * one you want.
 */
/**
 * How many rows a block draws before asking.
 *
 * Twelve cells per row, so 1,280 on-going steps is fifteen thousand DOM nodes
 * for one block, and building them is most of the wait when a tab changes.
 * Nobody reads past the first screen anyway; the rest is a click away and the
 * count is always on the header, so nothing is hidden by it.
 */
const FIRST_ROWS = 200

function Block({
  title, note, rows, open, onToggle, onPick, tone = 'default',
}: {
  title: string
  note?: string
  rows: Prepared[]
  open: boolean
  onToggle: () => void
  onPick: (r: WorkRow) => void
  tone?: 'default' | 'quiet'
}) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, FIRST_ROWS)
  return (
    <section className={`rounded-[14px] border ${tone === 'quiet' ? 'border-[var(--warn-border)]' : 'border-[var(--panel-border)]'} bg-white overflow-hidden`}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 px-5 py-[13px] text-left transition-colors ${tone === 'quiet' ? 'bg-[rgba(242,196,10,.09)] hover:bg-[rgba(242,196,10,.16)]' : 'hover:bg-[var(--row-hover)]'}`}
      >
        <span className="shrink-0 text-muted text-[15px] leading-none" aria-hidden="true">{open ? '⌄' : '›'}</span>
        <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{title}</span>
        <span className="text-[12px] font-bold text-muted">{n(rows.length)}</span>
        {note && <span className="text-[12px] text-muted ml-auto text-right">{note}</span>}
      </button>

      {open && rows.length === 0 && (
        <div className="px-5 py-8 text-center text-[13.5px] text-muted border-t border-[var(--row-rule)]">Nothing here.</div>
      )}

      {open && rows.length > 0 && (
        <div>
        <div className="border-t border-[var(--row-rule)] overflow-x-auto">
          <div className="min-w-[1180px]">
            {/* A grid, not a table: the handoff fixes the twelve widths as
                percentages, and a grid honours them without the browser
                measuring the content first. */}
            <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: GRID }}>
              <div className={HEAD_CELL}>Item</div>
              <div className={HEAD_CELL}>Parent item</div>
              <div className={HEAD_CELL}>Board</div>
              <div className={HEAD_CELL}>Workspace</div>
              <div className={HEAD_CELL}>Assignee</div>
              <div className={HEAD_CELL}>Priority</div>
              <div className={HEAD_CELL}>Step</div>
              <div className={HEAD_CELL}>Status</div>
              <div className={`${HEAD_CELL} text-right`}>Due</div>
              <div className={`${HEAD_CELL} text-right`}>Time</div>
              <div className="px-3 py-[11px] min-w-0" />
              <div className={`${HEAD_CELL} text-right`}>Monday</div>
            </div>

            {shown.map(({ row: r, due: d }) => (
              <div
                key={r.id}
                onClick={() => onPick(r)}
                className="grid border-b border-[var(--row-rule)] last:border-b-0 cursor-pointer hover:bg-[var(--row-hover)] transition-colors"
                style={{ gridTemplateColumns: GRID }}
              >
                <div className={`${CELL} font-semibold text-tn-ink`} title={r.itemName}>{r.itemName}</div>
                {/* Only a subitem has one, and the parent is the name a person
                    recognises: "Portuguese" means nothing without its page. */}
                <div className={`${CELL} text-muted`}>{r.parentItemName ?? '-'}</div>
                <div className={`${CELL} text-muted`} title={r.boardName}>{r.boardName}</div>
                <div className={`${CELL} text-muted`}>{r.workspaceName ?? '-'}</div>
                <div className={`${CELL} text-foreground`}>{r.who}</div>
                <div className="px-3 py-2.5 min-w-0 overflow-hidden">
                  <span className={`${chip} ${PRIORITY_CHIP[r.priority]}`}>{r.priority}</span>
                </div>
                <div className={`${CELL} text-muted`}>{r.stepName}</div>
                <div className="px-3 py-2.5 min-w-0 overflow-hidden">
                  {r.statusText
                    ? <StatusChip text={r.statusText} colour={r.statusColor} />
                    : <span className="text-[var(--faint)] text-[13px]">-</span>}
                </div>
                <div className={`${CELL} text-tn-ink text-right whitespace-nowrap`}>
                  {d ? d.date : <span className="text-[var(--faint)]">-</span>}
                </div>
                <div className={`px-3 py-2.5 min-w-0 overflow-hidden text-[12px] text-right ${d ? DUE_TIME[d.state] : ''}`}>
                  {d?.time || (d ? '' : <span className="text-[var(--faint)]">-</span>)}
                </div>
                <div className="px-3 py-2.5 min-w-0 overflow-hidden">
                  {d && <span className={`${chip} ${DUE_BADGE[d.state].className}`}>{DUE_BADGE[d.state].label}</span>}
                </div>
                <div className="px-3 py-2.5 min-w-0 text-right text-muted">
                  {r.url ? (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      aria-label={`Open ${r.itemName} in Monday`}
                      title="Open in Monday"
                      className="inline-flex hover:text-tn-teal transition-colors"
                    >
                      <EyeIcon />
                    </a>
                  ) : <span className="text-[var(--faint)]">-</span>}
                </div>
              </div>
            ))}
          </div>
        </div>


          {!all && rows.length > FIRST_ROWS && (
            <button
              onClick={() => setAll(true)}
              className="w-full px-5 py-[13px] text-[13.5px] font-semibold text-tn-teal hover:bg-subtle transition-colors border-t border-[var(--row-rule)]"
            >
              {`Show the other ${n(rows.length - FIRST_ROWS)}`}
            </button>
          )}
        </div>
      )}
    </section>
  )
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
}

export function WorkList({
  data, people, teams, selfPersonId, isAdmin = false, preview,
}: {
  data: Worklist
  people: Option[]
  teams: Option[]
  selfPersonId: string | null
  isAdmin?: boolean
  preview?: PreviewState
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
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

  const person = params.get('person') ?? selfPersonId ?? ''
  const team = preview?.team ?? params.get('team') ?? ''
  const includeDone = preview?.done ?? params.get('done') === '1'
  const mineFromUrl = !!selfPersonId && person === selfPersonId && !team
  const mine = wanted ?? mineFromUrl

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
    next.set('tab', 'work')
    startTransition(() => router.push(`/my-work?${next.toString()}`))
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
    const due = r.dueDate ? readDue(r.dueDate, r.dueSuspect) : null
    return {
      row: r,
      due,
      hay: [
        r.itemName, r.parentItemName, r.boardName, r.workspaceName, r.who, r.stepName, r.statusText,
        r.dueDate, due?.date, due?.time, due ? DUE_BADGE[due.state].label : null,
      ].filter(Boolean).join(' ').toLowerCase(),
    }
  }), [data.rows])

  const needle = q.trim().toLowerCase()
  const rows = needle ? prepared.filter(p2 => p2.hay.includes(needle)) : prepared

  // Nobody behind the account comes first as a category, because those rows
  // cannot be filtered by team and would otherwise sit unexplained among work
  // that can.
  const unknown = rows.filter(r => !r.row.assigneeKnown)
  const known = rows.filter(r => r.row.assigneeKnown)
  // On-going is the only block sorted by priority. Completed is a record, and
  // Unknown user is a queue for an admin; ordering either by importance would
  // be answering a question nobody asks of them.
  const ongoing = known.filter(r => r.row.statusDone !== true).sort((a, b) =>
    PRIORITY_RANK[a.row.priority] - PRIORITY_RANK[b.row.priority]
    // Within a priority the deadline decides, which keeps the previous order
    // intact inside each band rather than replacing it.
    || (a.due && !a.row.dueSuspect ? 0 : 1) - (b.due && !b.row.dueSuspect ? 0 : 1)
    || (a.row.dueDate ?? '').localeCompare(b.row.dueDate ?? '')
    || a.row.itemName.localeCompare(b.row.itemName))
  const completed = known.filter(r => r.row.statusDone === true)

  return (
    <div className={`space-y-3.5 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <SearchField value={q} onChange={setQ} placeholder="Search items, boards, people…" className="w-full sm:w-[320px]" />

        {/* Mine or everyone's, as one segmented control rather than two tabs:
            it is a single either/or and the handoff draws it that way. */}
        <div className="flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
          {([
            { key: 'mine', label: 'Mine' },
            { key: 'all', label: 'Everyone' },
          ] as const).map(t => {
            const on = t.key === 'mine' ? mine : !mine
            const dead = t.key === 'mine' && !selfPersonId
            return (
              <span key={t.key} className="relative">
                <button
                  disabled={dead}
                  onClick={() => setParam('person', t.key === 'mine' ? (selfPersonId ?? '') : '', t.key === 'mine')}
                  onMouseEnter={() => dead && setTip(true)}
                  onMouseLeave={() => setTip(false)}
                  onFocus={() => dead && setTip(true)}
                  onBlur={() => setTip(false)}
                  className={`font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] transition-colors ${
                    dead ? 'text-[var(--faint)] cursor-not-allowed'
                    : on ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]'
                    : 'text-muted hover:text-tn-ink'
                  }`}
                >
                  {t.label}
                </button>

                {/* Written into the page rather than left to the browser's own
                    tooltip: a disabled control never gets one in most browsers,
                    so the explanation for why it cannot be pressed would be the
                    one thing nobody could read. */}
                {dead && tip && (
                  <span
                    role="tooltip"
                    className="absolute top-[calc(100%+8px)] left-0 z-20 w-80 rounded-[9px] bg-tn-primary px-[11px] py-[9px] text-[12px] leading-[1.5] text-[#dfe8f5] shadow-[0_12px_26px_-14px_rgba(1,35,88,.6)]"
                  >
                    Your login is not linked to anyone in the Directory yet, so there is no “mine” to filter by.
                  </span>
                )}
              </span>
            )
          })}
        </div>

        {!mine && (
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

        <button
          type="button"
          onClick={() => setParam('done', includeDone ? '' : '1')}
          className={`font-[family-name:var(--font-open-sans)] text-[13.5px] font-semibold px-3 py-2 rounded-[10px] border transition-colors ${
            includeDone ? 'border-tn-teal text-tn-teal bg-[rgba(30,125,127,.07)]' : 'border-[var(--panel-border)] text-muted hover:text-tn-ink'
          }`}
        >
          {includeDone ? 'Finished work: all of it' : `Finished work: ${COMPLETED_MONTHS} months`}
        </button>

        <span className="text-[13.5px] text-muted ml-auto">
          {needle
            ? `${n(rows.length)} matching`
            : data.truncated
              ? `${n(data.total)} shown of ${n(data.matching)}`
              : `${n(data.open)} open${data.total !== data.open ? ` · ${n(data.total)} in view` : ''}`}
        </span>
      </div>

      {/* Same footer the API cards use, so "how current is this" reads the
          same everywhere. Fed the oldest board's stamp rather than the newest:
          boards refresh in rotation, so the newest would flatter the page. */}
      <PullInfo
        syncedAt={data.oldestSyncAt}
        utcHours={[1, 5, 9, 13, 17, 21]}
        utcMinute={15}
        label="Work pulled from Monday"
        pastVerb="refreshed"
        className="flex items-center gap-2 text-[12.5px] text-muted border-t border-[var(--panel-border)] pt-3"
      />

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
          {`This team filter cannot see ${data.unlinkedAssignments} ${data.unlinkedAssignments === 1 ? 'assignment' : 'assignments'} on ${data.unlinked} Monday ${data.unlinked === 1 ? 'account' : 'accounts'} that belong to nobody in the Directory.`}
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

      {/* Never under My tasks. Those rows belong to an account nobody is
          behind, so by definition none of them are yours: the block could only
          ever read zero there, which is a row of furniture asking to be
          ignored. */}
      {!mine && (
        <Block
          title="Unknown user"
          note="Work on a Monday account with nobody behind it"
          rows={unknown}
          open={openBlocks.unknown}
          onToggle={() => setOpenBlocks(b => ({ ...b, unknown: !b.unknown }))}
          onPick={setOpenRow}
          tone="quiet"
        />
      )}

      <Block
        title="On-going"
        note="Steps still open"
        rows={ongoing}
        open={openBlocks.ongoing}
        onToggle={() => setOpenBlocks(b => ({ ...b, ongoing: !b.ongoing }))}
        onPick={setOpenRow}
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
      />

      <p className="text-[12px] text-muted leading-[1.65] m-0 mt-3.5">
        {`Completed shows steps finished where the item was last changed in Monday within ${COMPLETED_MONTHS} months, which the filter above can widen to everything. Nothing is deleted: older finished work stays in the database and out of this page, because a work list that opens on nine years of finished steps is not a work list. Monday does not record when a step was completed, so the item's last change is used instead, which keeps a step in view a little longer when the item was touched for some other reason.`}
      </p>

      {openRow && <HistoryPanel row={openRow} onClose={() => setOpenRow(null)} />}
    </div>
  )
}
