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

import { useState, useEffect, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { PullInfo } from '@/components/PullInfo'
import type { Worklist, WorkRow } from '@/lib/monday/worklist/data'

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

/** Due dates read as a deadline, so today and tomorrow are named. */
function dueLabel(date: string): { text: string; tone: 'late' | 'now' | 'soon' | 'later' } {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const days = Math.round((Date.parse(`${date}T00:00:00`) - Date.parse(`${iso}T00:00:00`)) / 86_400_000)
  const shown = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (days < 0) return { text: `${shown} · ${-days}d late`, tone: 'late' }
  if (days === 0) return { text: 'Today', tone: 'now' }
  if (days === 1) return { text: 'Tomorrow', tone: 'now' }
  if (days <= 7) return { text: shown, tone: 'soon' }
  return { text: shown, tone: 'later' }
}

const DUE_TONE: Record<'late' | 'now' | 'soon' | 'later', string> = {
  late: 'text-[#c2410c] font-bold',
  now: 'text-tn-ink font-bold',
  soon: 'text-tn-ink font-semibold',
  later: 'text-muted',
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
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-full text-muted hover:text-tn-ink hover:bg-slate-100" aria-label="Close">×</button>
        </div>

        <div className="px-6 py-5">
          <div className="flex items-center gap-2 flex-wrap mb-5">
            <span className={`${chip} bg-[rgba(30,125,127,.1)] text-tn-teal`}>{row.stepName}</span>
            {row.url && (
              <a
                href={row.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`${chip} bg-[rgba(1,35,88,.06)] text-tn-ink hover:bg-[rgba(1,35,88,.12)]`}
              >
                Open in Monday ↗
              </a>
            )}
            {row.statusText && <StatusChip text={row.statusText} colour={row.statusColor} />}
            {row.dueDate && (
              <span className="text-sm text-muted">
                {row.dueLabel ?? 'Due'}: {new Date(`${row.dueDate}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
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
          {includeDone ? 'Showing finished steps' : 'Open steps only'}
        </button>
        <span className="text-sm text-muted ml-auto">
          {data.truncated
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

      {data.rows.length === 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-white px-6 py-12 text-center text-sm text-muted">
          Nothing open here.
        </div>
      )}

      {data.rows.length > 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-white overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-subtle border-b border-slate-200 text-left">
                <th className={th}>Item</th>
                <th className={th}>Parent item</th>
                <th className={th}>Board</th>
                <th className={th}>Workspace</th>
                <th className={th}>Assignee</th>
                <th className={th}>Step</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Due</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map(r => (
                <tr
                  key={r.id}
                  onClick={() => setOpenRow(r)}
                  className="border-b border-slate-100 last:border-b-0 hover:bg-subtle transition-colors cursor-pointer"
                >
                  <td className="px-4 py-2.5 font-semibold text-tn-ink max-w-[280px]">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        // The row opens the history; the name opens Monday. Two
                        // destinations on one row need the inner one to stop
                        // the outer one, or clicking the link does both.
                        onClick={e => e.stopPropagation()}
                        className="block truncate hover:text-tn-teal hover:underline"
                        title={`${r.itemName} · open in Monday`}
                      >
                        {r.itemName}
                      </a>
                    ) : (
                      <span className="block truncate" title={r.itemName}>{r.itemName}</span>
                    )}
                  </td>
                  {/* Only a subitem has one, and the parent is the name a
                      person recognises: "Portuguese" means nothing without
                      the page it belongs to. */}
                  <td className="px-4 py-2.5 text-muted max-w-[240px]">
                    {r.parentItemName
                      ? <span className="block truncate" title={r.parentItemName}>{r.parentItemName}</span>
                      : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-muted max-w-[200px]">
                    <span className="block truncate" title={r.boardName}>{r.boardName}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted max-w-[170px]">
                    <span className="block truncate">{r.workspaceName ?? '-'}</span>
                  </td>
                  <td className="px-4 py-2.5 text-tn-ink whitespace-nowrap">{r.who}</td>
                  <td className="px-4 py-2.5 text-muted whitespace-nowrap">{r.stepName}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    {r.statusText
                      ? <StatusChip text={r.statusText} colour={r.statusColor} />
                      : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap text-xs">
                    {r.dueDate
                      ? (() => { const d = dueLabel(r.dueDate); return <span className={DUE_TONE[d.tone]}>{d.text}</span> })()
                      : <span className="text-slate-300">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {openRow && <HistoryPanel row={openRow} onClose={() => setOpenRow(null)} />}
    </div>
  )
}
