'use client'

/**
 * Clocked in TSheets after switching (owner, 27 October 2026): the entries the
 * import set aside, in two tabs (To decide, Decided), and for each undecided
 * one Count it or Discard it, one at a time or several selected at once. The
 * server decides (admin/settings/skipped-actions.ts); this only asks and shows
 * what it answered. Without the right to decide, the list is read only.
 */

import { useMemo, useState } from 'react'
import { failText } from '@/lib/ui/action-error'
import { useRouter } from 'next/navigation'
import type { SkippedEntry } from '@/lib/timeclock/waves-data'
import type { Decided } from '@/app/(app)/admin/settings/skipped-actions'
import { decidedText, REASON_FOR_ALLOWANCE, splitDecided, type DecideInput } from '@/lib/timeclock/skipped-decisions'
import { dateLabel, timeLabel } from '@/lib/timeclock/format'
import { FieldLabel, Modal, MODAL_TITLE, TEXTAREA_PLAIN, Toast, BTN_MODAL_WHITE, BTN_MODAL_NAVY, type ToastState } from '@/components/clocky/entries/ui'

const hours = (s: number) => { const m = Math.round(s / 60); return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` }
const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'
const COLS = 'lg:grid-cols-[34px_minmax(0,1fr)_110px_120px_80px_minmax(0,1.6fr)_190px]'
const ACT = 'inline-flex items-center border border-slate-200 rounded-[9px] px-3 py-[7px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12px] cursor-pointer hover:border-tn-teal disabled:opacity-50 disabled:cursor-default'
const BOX = 'w-4 h-4 accent-[#1E7D7F] cursor-pointer'

/**
 * The window open, if any: confirm a count, give the reason for counting past
 * the allowance (required, after the allowance line), or confirm a discard
 * (reason optional).
 */
type Ask =
  | { mode: 'count'; ids: number[] }
  | { mode: 'over'; ids: number[]; lines: { id: number; text: string }[] }
  | { mode: 'discard'; ids: number[] }
  | null

const n = (k: number) => `${k} ${k === 1 ? 'entry' : 'entries'}`

export function SkippedList({ entries, zone, abbr, canDecide, decide }: {
  entries: SkippedEntry[]
  zone: string
  abbr: string
  canDecide: boolean
  decide: (i: DecideInput) => Promise<Decided>
}) {
  const router = useRouter()
  const { todo, decided } = useMemo(() => splitDecided(entries), [entries])
  const [tab, setTab] = useState<'todo' | 'decided'>('todo')
  const [picked, setPicked] = useState<number[]>([])
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [ask, setAsk] = useState<Ask>(null)
  const [reason, setReason] = useState('')
  /** What the server said about an entry it did not decide, shown on its row. */
  const [notes, setNotes] = useState<Record<number, string>>({})
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 5200) }

  const list = tab === 'todo' ? todo : decided
  const byId = useMemo(() => new Map(entries.map(e => [e.externalId, e])), [entries])
  const live = picked.filter(id => todo.some(e => e.externalId === id))
  const total = todo.filter(e => !e.deletedInTsheets).reduce((s, e) => s + e.seconds, 0)
  const open = (a: Ask) => { setAsk(a); setReason('') }

  async function run(input: DecideInput) {
    setBusy(true)
    try {
      const r = await decide(input)
      if (!r.ok) { say({ text: r.error, error: true }); return }
      const needs = r.results.filter(x => x.outcome === 'needs-reason')
      const told = r.results.filter(x => x.outcome === 'refused' || x.outcome === 'already')
      setNotes(prev => {
        const next = { ...prev }
        for (const x of r.results) delete next[x.id]
        for (const x of told) next[x.id] = x.text
        return next
      })
      if (needs.length) open({ mode: 'over', ids: needs.map(x => x.id), lines: needs.map(x => ({ id: x.id, text: x.text })) })
      else setAsk(null)
      say({ text: r.toast || 'Nothing changed.', error: !r.results.some(x => x.outcome === 'done') && !needs.length })
      // What is still to decide stays selected; what was decided leaves the selection.
      const gone = new Set(r.results.filter(x => x.outcome === 'done' || x.outcome === 'already').map(x => x.id))
      setPicked(p => p.filter(id => !gone.has(id)))
      if (r.results.some(x => x.outcome === 'done' || x.outcome === 'already')) router.refresh()
    } catch (e) {
      say({ text: failText(e), error: true })
    } finally {
      setBusy(false)
    }
  }

  const toggle = (id: number) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]))
  const allOn = todo.length > 0 && todo.every(e => picked.includes(e.externalId))
  const choosing = canDecide && tab === 'todo'
  const line = (id: number) => { const e = byId.get(id); return e ? `${e.name}, ${dateLabel(e.date)}, ${hours(e.seconds)}` : `TSheets #${id}` }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex gap-2" role="tablist" aria-label="Entries set aside">
        {([['todo', 'To decide', todo.length], ['decided', 'Decided', decided.length]] as const).map(([k, label, count]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2 font-(family-name:--font-display) font-extrabold text-[13px] border cursor-pointer ${tab === k ? 'bg-tn-teal-soft text-tn-teal border-transparent' : 'bg-white text-foreground border-slate-200 hover:border-tn-teal'}`}>
            {label}
            <span className={`rounded-full px-[7px] py-px text-[11px] tabular-nums lining-nums ${k === 'todo' && count > 0 ? 'bg-[#F2C40A] text-tn-ink' : 'bg-subtle text-muted'}`}>{count}</span>
          </button>
        ))}
      </div>

      {list.length === 0
        ? <p className="text-[14px] text-muted m-0">{tab === 'todo' ? 'Nothing to decide. When someone clocks in TSheets on or after their North Time start date, the entry shows here.' : 'Nothing decided yet.'}</p>
        : (
          <div className="bg-white border border-[var(--panel-border)] rounded-[16px] overflow-hidden">
            <div className="px-[18px] py-3.5 border-b border-[var(--panel-border)] text-[13px] text-foreground flex flex-wrap items-center gap-x-4 gap-y-2">
              <span>
                <b className="text-tn-ink">{list.length}</b> {list.length === 1 ? 'entry' : 'entries'}
                {tab === 'todo' && <>, <b className="text-tn-ink tabular-nums lining-nums">{hours(total)}</b> still in TSheets</>}.
              </span>
              {choosing && live.length > 0 && (
                <span className="flex flex-wrap items-center gap-2 ml-auto">
                  <b className="text-tn-ink">{live.length} selected</b>
                  <button type="button" disabled={busy} className={ACT} onClick={() => open({ mode: 'count', ids: live })}>Count them</button>
                  <button type="button" disabled={busy} className={ACT} onClick={() => open({ mode: 'discard', ids: live })}>Discard them</button>
                  <button type="button" disabled={busy} className={ACT} onClick={() => setPicked([])}>Clear</button>
                </span>
              )}
            </div>
            <div className={`hidden lg:grid ${COLS} bg-subtle border-b border-[var(--panel-border)] ${LABEL}`}>
              <div className="pl-[18px] py-[9px] flex items-center">
                {choosing && <input type="checkbox" className={BOX} aria-label="Select every entry to decide" checked={allOn} onChange={() => setPicked(allOn ? [] : todo.map(e => e.externalId))} />}
              </div>
              <div className="px-3 py-[9px]">Person</div><div className="px-3 py-[9px]">Day</div><div className="px-3 py-[9px]">Time</div><div className="px-3 py-[9px]">Hours</div><div className="px-3 py-[9px]">Job, fields and notes</div>
              <div className="px-3 py-[9px]">{tab === 'todo' ? 'Decide' : 'Decision'}</div>
            </div>
            {list.map(e => (
              <div key={e.externalId} className={`grid grid-cols-1 ${COLS} border-b border-[var(--row-rule)] last:border-b-0 text-[13px] max-lg:px-[18px] max-lg:py-3 max-lg:gap-1`} style={{ opacity: e.deletedInTsheets && tab === 'todo' ? 0.6 : 1 }}>
                <div className="lg:pl-[18px] lg:py-2.5 flex items-start">
                  {choosing && <input type="checkbox" className={BOX} aria-label={`Select ${e.name}, ${dateLabel(e.date)}`} checked={picked.includes(e.externalId)} onChange={() => toggle(e.externalId)} />}
                </div>
                <div className="lg:px-3 lg:py-2.5 flex flex-col gap-0.5">
                  <span className="text-tn-ink font-bold">{e.name}</span>
                  <span className="text-[12px] text-muted">Started on North Time {dateLabel(e.startsOn)}</span>
                </div>
                <div className="lg:px-3 lg:py-2.5 tabular-nums lining-nums">{dateLabel(e.date)}</div>
                <div className="lg:px-3 lg:py-2.5 tabular-nums lining-nums">{e.startedAt ? `${timeLabel(e.startedAt, zone)} to ${e.endedAt ? timeLabel(e.endedAt, zone) : 'now'}` : e.kind === 'manual' ? 'Added by hand' : '-'}</div>
                <div className="lg:px-3 lg:py-2.5 tabular-nums lining-nums font-bold text-tn-ink">{hours(e.seconds)}</div>
                <div className="lg:px-3 lg:py-2.5 flex flex-col gap-0.5 min-w-0">
                  <span className="text-tn-ink break-words">{e.jobPath ?? 'Job not in the catalogue'}</span>
                  {e.fields.length > 0 && <span className="text-[12px] text-foreground break-words">{e.fields.map(f => `${f.label}: ${f.value}`).join(' · ')}</span>}
                  {e.notes && <span className="text-[12px] text-muted break-words">{e.notes}</span>}
                  <span className="text-[12px] text-muted">
                    TSheets #{e.externalId} (times in {abbr})
                    {e.alreadyInEntries ? ' · also in Time entries (imported before the date was set)' : ''}
                    {e.deletedInTsheets ? ' · deleted in TSheets since' : ''}
                  </span>
                </div>
                <div className="lg:px-3 lg:py-2.5 flex flex-col gap-1.5 items-start max-lg:pt-1.5">
                  {tab === 'todo'
                    ? (canDecide
                      ? (
                        <>
                          <span className="flex flex-wrap gap-1.5">
                            <button type="button" disabled={busy || e.deletedInTsheets} title={e.deletedInTsheets ? 'Deleted in TSheets since: discard it instead.' : undefined}
                              className={ACT} onClick={() => open({ mode: 'count', ids: [e.externalId] })}>Count it</button>
                            <button type="button" disabled={busy} className={ACT} onClick={() => open({ mode: 'discard', ids: [e.externalId] })}>Discard it</button>
                          </span>
                          {notes[e.externalId] && <span role="note" className="text-[12px] text-[#92400E] leading-[1.45] break-words">{notes[e.externalId]}</span>}
                        </>
                      )
                      : <span className="text-[12px] text-muted">Waiting for a Super Admin or Admin.</span>)
                    : (
                      <>
                        <span className="text-tn-ink font-bold">{decidedText(e.decision, e.decidedByName, e.decidedAt ? dateLabel(e.decidedAt.slice(0, 10)) : '')}</span>
                        {e.decisionReason && <span className="text-[12px] text-muted break-words">{e.decisionReason}</span>}
                      </>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}

      {ask && (
        <Modal label={ask.mode === 'over' ? 'Count past the allowance' : ask.mode === 'count' ? 'Count entries' : 'Discard entries'} width={480} onClose={() => setAsk(null)}>
          <h2 className={MODAL_TITLE}>
            {ask.mode === 'over'
              ? (ask.ids.length === 1 ? 'This goes past the allowance' : `${n(ask.ids.length)} go past the allowance`)
              : ask.mode === 'count'
                ? (ask.ids.length === 1 ? 'Count this entry?' : `Count ${n(ask.ids.length)}?`)
                : (ask.ids.length === 1 ? 'Discard this entry?' : `Discard ${n(ask.ids.length)}?`)}
          </h2>
          {ask.mode === 'over' && (
            <div className="flex flex-col gap-2 text-[13px] text-foreground leading-[1.55]">
              {ask.lines.map(l => <p key={l.id} className="m-0"><b className="text-tn-ink">{line(l.id)}.</b> {l.text}</p>)}
              <p className="m-0 text-muted">The whole entry is counted, never cut to fit. {REASON_FOR_ALLOWANCE}</p>
            </div>
          )}
          {ask.mode === 'count' && (
            <div className="flex flex-col gap-1.5 text-[13px] text-foreground leading-[1.55]">
              {ask.ids.length <= 4 && ask.ids.map(id => <p key={id} className="m-0"><b className="text-tn-ink">{line(id)}</b></p>)}
              <p className="m-0">{ask.ids.length === 1 ? 'It becomes a Time entry' : 'Each becomes a Time entry'} for its person, open, with the job and fields it has in TSheets. It stays here under Decided, with your name.</p>
            </div>
          )}
          {ask.mode === 'discard' && (
            <div className="flex flex-col gap-1.5 text-[13px] text-foreground leading-[1.55]">
              {ask.ids.length <= 4 && ask.ids.map(id => <p key={id} className="m-0"><b className="text-tn-ink">{line(id)}</b></p>)}
              <p className="m-0">No Time entry is made. {ask.ids.length === 1 ? 'It stays' : 'They stay'} here under Decided, with your name.</p>
            </div>
          )}
          {ask.mode !== 'count' && (
            <label className="flex flex-col gap-[5px]">
              <FieldLabel>{ask.mode === 'over' ? 'Reason (required)' : 'Reason (optional)'}</FieldLabel>
              <textarea value={reason} onChange={ev => setReason(ev.target.value)} rows={3} maxLength={500} className={TEXTAREA_PLAIN} />
            </label>
          )}
          <div className="flex justify-end gap-2 flex-wrap">
            <button type="button" className={BTN_MODAL_WHITE} onClick={() => setAsk(null)}>Cancel</button>
            <button type="button" className={`${BTN_MODAL_NAVY} disabled:opacity-50`} disabled={busy || (ask.mode === 'over' && !reason.trim())}
              onClick={() => void run(ask.mode === 'over'
                ? { ids: ask.ids, choice: 'count', reason: reason.trim(), pastAllowance: true }
                : ask.mode === 'count'
                  ? { ids: ask.ids, choice: 'count' }
                  : { ids: ask.ids, choice: 'discard', reason: reason.trim() || null })}>
              {ask.mode === 'over' ? 'Count with this reason' : ask.mode === 'count' ? (ask.ids.length === 1 ? 'Count it' : 'Count them') : (ask.ids.length === 1 ? 'Discard it' : 'Discard them')}
            </button>
          </div>
        </Modal>
      )}
      <Toast toast={toast} />
    </div>
  )
}
