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

const chip = 'inline-flex items-center text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-[5px]'

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
            {row.statusText && (
              <span className={`${chip} ${row.statusDone ? 'bg-[#059f6b1f] text-[#059f6b]' : 'bg-slate-100 text-slate-600'}`}>
                {row.statusText}
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
  data, people, teams, selfPersonId,
}: {
  data: Worklist
  people: Option[]
  teams: Option[]
  selfPersonId: string | null
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  const [openRow, setOpenRow] = useState<WorkRow | null>(null)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

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

  const toggle = (id: number) => {
    const next = new Set(collapsed)
    if (next.has(id)) next.delete(id); else next.add(id)
    setCollapsed(next)
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
          {data.open} open{data.total !== data.open ? ` · ${data.total} in view` : ''}
        </span>
      </div>

      {data.unlinked > 0 && (
        <div className="rounded-[10px] border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-[#8a6d1a]">
          {data.unlinked} Monday {data.unlinked === 1 ? 'account is' : 'accounts are'} not linked to anyone in the
          Directory. Their work shows here but cannot be filtered by team.
        </div>
      )}

      {data.groups.length === 0 && (
        <div className="rounded-[14px] border border-slate-200 bg-white px-6 py-12 text-center text-sm text-muted">
          Nothing open here.
        </div>
      )}

      {data.groups.map(g => (
        <section key={g.workspaceName} className="space-y-2">
          <h2 className="font-(family-name:--font-display) font-extrabold text-tn-ink text-[15px] m-0">
            {g.workspaceName}
            <span className="ml-2 text-xs font-bold text-muted">{g.open} open</span>
          </h2>

          {g.boards.map(b => (
            <div key={b.boardId} className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
              <button
                onClick={() => toggle(b.boardId)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-subtle transition-colors"
              >
                <span className="font-bold text-tn-ink text-sm">{b.boardName}</span>
                <span className="text-xs text-muted">{b.rows.length}</span>
              </button>

              {!collapsed.has(b.boardId) && (
                <ul className="m-0 p-0 list-none border-t border-slate-100">
                  {b.rows.map(r => (
                    <li key={r.id}>
                      <button
                        onClick={() => setOpenRow(r)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-3 border-b border-slate-100 last:border-b-0 hover:bg-subtle transition-colors"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13.5px] font-semibold text-tn-ink truncate">
                            {r.parentItemName ?? r.itemName}
                          </span>
                          <span className="block text-xs text-muted truncate">
                            {r.parentItemName ? `${r.itemName} · ` : ''}{r.stepName}
                            {r.groupTitle ? ` · ${r.groupTitle}` : ''}
                          </span>
                        </span>
                        {r.statusText && (
                          <span className={`${chip} shrink-0 ${r.statusDone ? 'bg-[#059f6b1f] text-[#059f6b]' : 'bg-slate-100 text-slate-600'}`}>
                            {r.statusText}
                          </span>
                        )}
                        <span className="shrink-0 text-xs text-muted w-[120px] truncate text-right">{r.who}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}

      {openRow && <HistoryPanel row={openRow} onClose={() => setOpenRow(null)} />}
    </div>
  )
}
