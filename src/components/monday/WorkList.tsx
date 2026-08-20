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

const th = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted px-4 py-3 whitespace-nowrap'
const chip = 'inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-[5px]'

/**
 * A status chip in Monday's own colour.
 *
 * The hex comes from the board's own settings, so a label that is amber there
 * is amber here. Anything else and the two stop looking like the same fact.
 * White text on the label colour is how Monday paints it too; the grey
 * fallback is for a step with no status column paired to it at all.
 */
function StatusChip({ text, colour }: { text: string; colour: string | null }) {
  if (!colour) return <span className={`${chip} bg-slate-100 text-slate-600`}>{text}</span>
  return <span className={`${chip} text-white`} style={{ background: colour }}>{text}</span>
}

/**
 * How far apart two dates are, in years, months and days.
 *
 * Calendar arithmetic rather than dividing by 86,400,000: "5y 11m 29d" is how
 * a person reads a six-year-old deadline, and "2189d" is a number they have to
 * do arithmetic on before it means anything.
 */
function span(from: Date, to: Date): string {
  let y = to.getFullYear() - from.getFullYear()
  let m = to.getMonth() - from.getMonth()
  let d = to.getDate() - from.getDate()
  if (d < 0) {
    m--
    // Days in the month before `to`, which is the month the shortfall is owed
    // to. Assuming 30 drifts by up to two days.
    d += new Date(to.getFullYear(), to.getMonth(), 0).getDate()
  }
  if (m < 0) { y--; m += 12 }
  const parts = [y ? `${y}y` : '', m ? `${m}m` : '', d ? `${d}d` : ''].filter(Boolean)
  return parts.length ? parts.join(' ') : 'today'
}

type DueState = 'late' | 'today' | 'upcoming' | 'odd'

/** The three things a deadline can be, kept apart so each gets its own column. */
function readDue(date: string, suspect = false): { date: string; time: string; state: DueState } {
  const at = new Date(`${date}T00:00:00`)
  // Year 202 is not a deadline anybody set; saying "1824y late" about it dresses
  // a typo up as urgency. Shown, because somebody should fix it in Monday.
  if (suspect) {
    return { date, time: '', state: 'odd' }
  }
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const shown = at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (at.getTime() < today.getTime()) return { date: shown, time: span(at, today), state: 'late' }
  if (at.getTime() === today.getTime()) return { date: shown, time: '', state: 'today' }
  return { date: shown, time: `in ${span(today, at)}`, state: 'upcoming' }
}

const DUE_BADGE: Record<DueState, { label: string; className: string }> = {
  late: { label: 'Late', className: 'bg-[rgba(194,65,12,.12)] text-[#c2410c]' },
  today: { label: 'Due today', className: 'bg-[rgba(224,138,30,.14)] text-[#b06d0a]' },
  upcoming: { label: 'Upcoming', className: 'bg-[rgba(30,125,127,.12)] text-tn-teal' },
  odd: { label: 'Check date', className: 'bg-slate-100 text-slate-500' },
}

const DUE_TIME: Record<DueState, string> = {
  late: 'text-[#c2410c] font-semibold',
  today: 'text-muted',
  upcoming: 'text-tn-teal font-semibold',
  odd: 'text-slate-400',
}

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

const PRIORITY_CHIP: Record<string, string> = {
  high: 'bg-[rgba(194,65,12,.12)] text-[#c2410c]',
  medium: 'bg-slate-100 text-slate-600',
  low: 'bg-transparent text-slate-400',
}

/** The same eye the Href Link Management list uses for "open this". */
function EyeIcon() {
  return (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
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
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-start justify-between gap-4">
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
            <div className="rounded-[10px] border border-amber-300/60 bg-amber-50 p-4 text-sm text-[#8a6d1a]">{state.error}</div>
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
  return (
    <section className={`rounded-[14px] border ${tone === 'quiet' ? 'border-amber-300/60' : 'border-slate-200'} bg-white overflow-hidden`}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${tone === 'quiet' ? 'bg-amber-50 hover:bg-amber-100/60' : 'hover:bg-subtle'}`}
      >
        <span className={`shrink-0 text-muted transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true">›</span>
        <span className="font-(family-name:--font-display) font-extrabold text-tn-ink text-[15px]">{title}</span>
        <span className="text-xs font-bold text-muted">{rows.length}</span>
        {note && <span className="text-xs text-muted ml-auto text-right">{note}</span>}
      </button>

      {open && rows.length === 0 && (
        <div className="px-5 py-8 text-center text-sm text-muted border-t border-slate-100">Nothing here.</div>
      )}

      {open && rows.length > 0 && (
        <div className="border-t border-slate-100 overflow-x-auto">
      <div className="rounded-[14px] border border-slate-200 bg-white overflow-x-auto">
        {/* Fixed layout so a long item name cannot starve the columns after
            it. Text wraps to two lines; the date does not, because a broken
            date is unreadable in a way a broken title is not. */}
        <table className="w-full min-w-[1180px] text-sm table-fixed">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[6%]" />
            <col className="w-[9%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[6%]" />
            <col className="w-[5%]" />
            <col className="w-[3%]" />
          </colgroup>
          <thead>
            <tr className="bg-subtle border-b border-slate-200 text-left">
            <th className={th}>Item</th>
            <th className={th}>Parent item</th>
            <th className={th}>Board</th>
            <th className={th}>Workspace</th>
            <th className={th}>Assignee</th>
            <th className={th}>Priority</th>
            <th className={th}>Step</th>
            <th className={th}>Status</th>
            <th className={`${th} text-right`}>Due</th>
            <th className={`${th} text-right`}>Time</th>
            <th className={th}>&nbsp;</th>
            <th className={`${th} text-right`}>Monday</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ row: r, due: d }) => (
            <tr
              key={r.id}
              onClick={() => onPick(r)}
              className="border-b border-slate-100 last:border-b-0 hover:bg-subtle transition-colors cursor-pointer"
            >
              <td className="px-4 py-2.5 font-semibold text-tn-ink align-top">
                <span className="block line-clamp-2 break-words" title={r.itemName}>{r.itemName}</span>
              </td>
              {/* Only a subitem has one, and the parent is the name a
                  person recognises: "Portuguese" means nothing without
                  the page it belongs to. */}
              <td className="px-4 py-2.5 text-muted align-top">
                {r.parentItemName
                  ? <span className="block line-clamp-2 break-words" title={r.parentItemName}>{r.parentItemName}</span>
                  : <span className="text-slate-300">-</span>}
              </td>
              <td className="px-4 py-2.5 text-muted align-top">
                <span className="block line-clamp-2 break-words" title={r.boardName}>{r.boardName}</span>
              </td>
              <td className="px-4 py-2.5 text-muted align-top">
                <span className="block line-clamp-2 break-words">{r.workspaceName ?? '-'}</span>
              </td>
              <td className="px-4 py-2.5 text-tn-ink align-top">
                <span className="block line-clamp-2 break-words">{r.who}</span>
              </td>
              <td className="px-4 py-2.5 align-top">
                <span className={`${chip} ${PRIORITY_CHIP[r.priority]}`}>{r.priority}</span>
              </td>
              <td className="px-4 py-2.5 text-muted align-top">
                <span className="block line-clamp-2 break-words">{r.stepName}</span>
              </td>
              <td className="px-4 py-2.5 align-top">
                {r.statusText
                  ? <StatusChip text={r.statusText} colour={r.statusColor} />
                  : <span className="text-slate-300">-</span>}
              </td>
              {(() => (
                  <>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-tn-ink align-top">
                    {d ? d.date : <span className="text-slate-300">-</span>}
                  </td>
                  <td className={`px-4 py-2.5 text-right text-xs align-top ${d ? DUE_TIME[d.state] : ''}`}>
                    {d?.time || (d ? '' : <span className="text-slate-300">-</span>)}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    {d && <span className={`${chip} ${DUE_BADGE[d.state].className}`}>{DUE_BADGE[d.state].label}</span>}
                  </td>
                  </>
              ))()}
              <td className="px-4 py-2.5 text-right align-top">
                {r.url ? (
                  <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  // The row opens the history; this opens Monday. The
                  // inner target has to stop the outer one or a click
                  // does both.
                  onClick={e => e.stopPropagation()}
                  aria-label={`Open ${r.itemName} in Monday`}
                  title="Open in Monday"
                  className="inline-flex items-center justify-center p-1.5 rounded text-muted hover:text-tn-teal hover:bg-slate-100 transition-colors"
                  >
                  <EyeIcon />
                  </a>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </td>
            </tr>
            ))}
          </tbody>
        </table>
      </div>
        </div>
      )}
    </section>
  )
}

export function WorkList({
  data, people, teams, selfPersonId, isAdmin = false,
}: {
  data: Worklist
  people: Option[]
  teams: Option[]
  selfPersonId: string | null
  isAdmin?: boolean
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [openRow, setOpenRow] = useState<WorkRow | null>(null)
  // Search is client-side and deliberately not a URL parameter: person and team
  // decide which rows are fetched, and typing would re-query the database on
  // every keystroke to narrow rows the browser already has.
  const [q, setQ] = useState('')
  // Unknown user starts closed: it is an admin's queue, not the reader's work,
  // and it should not be the first thing between somebody and their list.
  const [openBlocks, setOpenBlocks] = useState({ unknown: false, ongoing: true, completed: false })

  const person = params.get('person') ?? selfPersonId ?? ''
  const team = params.get('team') ?? ''
  const includeDone = params.get('done') === '1'

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value); else next.delete(key)
    // Person and team are two ways of asking the same question, so choosing one
    // clears the other rather than quietly intersecting them.
    if (key === 'person' && value) next.delete('team')
    if (key === 'team' && value) next.delete('person')
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
    <div className="space-y-5">
      {/* Mine or everybody's, as a tab rather than a filter value. It is the
          first decision somebody makes on this page and it deserves to look
          like one; the person selector stays for looking at a colleague. */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {([
          { key: 'mine', label: 'My tasks' },
          { key: 'all', label: 'Everything' },
        ] as const).map(t => {
          const active = t.key === 'mine' ? person === selfPersonId && !team : person === '' || !!team
          // Without a person behind the login there is no "mine" to show. The
          // tab says so instead of looking clickable and doing nothing, which
          // is the worst of both: no result and no reason.
          const dead = t.key === 'mine' && !selfPersonId
          return (
            <button
              key={t.key}
              disabled={dead}
              title={dead ? 'Your login is not linked to anyone in the Directory yet, so there is no "mine" to filter by.' : undefined}
              onClick={() => setParam('person', t.key === 'mine' ? (selfPersonId ?? '') : '')}
              aria-current={active ? 'page' : undefined}
              className={`px-4 py-2.5 text-sm font-semibold -mb-px border-b-2 transition-colors ${
                dead ? 'border-transparent text-slate-300 cursor-not-allowed'
                : active ? 'border-tn-teal text-tn-ink'
                : 'border-transparent text-muted hover:text-tn-ink hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <SearchField
          value={q}
          onChange={setQ}
          placeholder="Search items, boards, people…"
          className="w-full sm:w-[320px]"
        />
        <Select
          value={person}
          onChange={v => setParam('person', v)}
          options={[{ value: '', label: 'Anyone' }, ...people]}
          ariaLabel="Person"
          searchable
        />
        <Select
          value={team}
          onChange={v => setParam('team', v)}
          options={[{ value: '', label: 'All teams' }, ...teams]}
          ariaLabel="Team"
        />
        <button
          type="button"
          onClick={() => setParam('done', includeDone ? '' : '1')}
          className={`text-sm font-semibold px-3 py-2 rounded-[10px] border transition-colors ${
            includeDone ? 'border-tn-teal text-tn-teal bg-[rgba(30,125,127,.06)]' : 'border-slate-200 text-muted hover:text-tn-ink'
          }`}
        >
          {includeDone ? `Finished work: all of it` : `Finished work: ${COMPLETED_MONTHS} months`}
        </button>
        <span className="text-sm text-muted ml-auto">
          {needle
            ? `${rows.length} matching`
            : data.truncated
              ? `${data.open} shown of ${data.matching}`
              : `${data.open} open${data.total !== data.open ? ` · ${data.total} in view` : ''}`}
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
        <div className="rounded-[10px] border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-[#8a6d1a]">
          {`This team filter cannot see ${data.unlinkedAssignments} ${data.unlinkedAssignments === 1 ? 'assignment' : 'assignments'} on ${data.unlinked} Monday ${data.unlinked === 1 ? 'account' : 'accounts'} that belong to nobody in the Directory.`}
          {isAdmin && (
            <>
              {' '}
              <a href="/admin/monday-links" className="font-bold underline hover:no-underline">Resolve them</a>.
            </>
          )}
        </div>
      )}

      {/* Everything, unfiltered, is 53,000 rows and fifty round trips. Nobody
          reads that; somebody looking at all of it is surveying, and a survey
          is served by the first few thousand plus an honest count. Naming the
          cap is what keeps it from reading as "this is all there is". */}
      {data.truncated && (
        <div className="rounded-[10px] border border-slate-200 bg-subtle px-4 py-3 text-sm text-muted">
          {`Showing the first ${data.total} of ${data.matching} steps. Pick a person or a team to see all of theirs.`}
        </div>
      )}

      <Block
        title="Unknown user"
        note="Work on a Monday account with nobody behind it"
        rows={unknown}
        open={openBlocks.unknown}
        onToggle={() => setOpenBlocks(b => ({ ...b, unknown: !b.unknown }))}
        onPick={setOpenRow}
        tone="quiet"
      />

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

      <p className="text-xs text-muted leading-relaxed m-0">
        {`Completed shows steps finished where the item was last changed in Monday within ${COMPLETED_MONTHS} months, which the filter above can widen to everything. Nothing is deleted: older finished work stays in the database and out of this page, because a work list that opens on nine years of finished steps is not a work list. Monday does not record when a step was completed, so the item's last change is used instead, which keeps a step in view a little longer when the item was touched for some other reason.`}
      </p>

      {openRow && <HistoryPanel row={openRow} onClose={() => setOpenRow(null)} />}
    </div>
  )
}
