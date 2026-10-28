'use client'

/**
 * Approvals, Clocky part 2 (Approvals.dc.html, frames AP, AP-3, AP-2, AP-L,
 * AP-D): one queue, five kinds, three tabs, a filter by kind.
 *
 *   Waiting for you   timesheets open their page (Review); time corrections,
 *                     time off, reimbursements and extra hours are decided here
 *                     (Deny asks the reason in their card, Approve is direct;
 *                     the row opens the card)
 *   With others       read only: "With Wendy Cacka", "Yours, with Dave Sharpe"
 *   Decided           the pill and who, when, why
 *
 * Rows sit on one 4-column grid (person, request, note, actions 250px) so the
 * columns line up across rows.
 */

import { useEffect, useRef, useState } from 'react'
import { failText } from '@/lib/ui/action-error'
import { useRouter } from 'next/navigation'
import { BTN_ICON } from '@/lib/ui/buttons'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { formatDuration } from '@/lib/timeclock/rounding'
import type { ApprovalRow, HistoryData } from '@/lib/timeclock/clocky-types'
import type { QueueData, QueueRow, QueueType, Tone } from '@/lib/timeclock/approval-queue'
import type { DecideBody } from '../entries/api'
import type { Result } from '@/lib/timeclock/clocky-types'
import { CorrectionReview } from '../entries/Dialogs'
import { RequestCard, type ItemDecision } from './RequestCard'
import { HistoryDrawer } from '../entries/HistoryDrawer'
import { Toast, type ToastState } from '../entries/ui'

export interface QueueApi {
  getQueue(): Promise<Result<{ data: QueueData }>>
  getEntryHistory(i: { id: number }): Promise<Result<{ data: HistoryData }>>
  decideCorrection(i: DecideBody): Promise<Result<{ entryId?: number; toast: string }>>
  decideTimeOff(i: DecideBody): Promise<Result>
  decideTimeOffCancel(i: DecideBody): Promise<Result<{ toast: string }>>
  decideReimbursement(i: DecideBody): Promise<Result<{ toast: string }>>
  decideReimbursementReport(i: { reportId: number; decisions: ItemDecision[] }): Promise<Result<{ toast: string }>>
  decideExtraHours(i: DecideBody): Promise<Result<{ toast: string }>>
}

type Tab = 'wait' | 'others' | 'done'
type Filter = 'all' | QueueType

/** The kinds as the chips and the pills name them, with the pill colours. */
const TYPES: Record<QueueType, { label: string; bg: string; fg: string }> = {
  ts: { label: 'Timesheet', bg: '#e8effa', fg: '#1e40af' },
  off: { label: 'Time off', bg: '#eef1fb', fg: '#3b4fa8' },
  rmb: { label: 'Reimbursement', bg: '#fbf3e4', fg: '#8a5a12' },
  xh: { label: 'Extra hours', bg: '#f0edfb', fg: '#5847c9' },
  cor: { label: 'Time correction', bg: '#eaf4f4', fg: '#1E7D7F' },
}
const TONES: Record<Tone, { bg: string; fg: string }> = {
  ok: { bg: '#e6f6ee', fg: '#0d7a4f' }, warn: { bg: '#fdf8e7', fg: '#8a6d1a' }, bad: { bg: '#fdeeef', fg: '#c8323d' },
  neu: { bg: '#f1f3f6', fg: '#5b6b82' }, teal: { bg: '#eaf4f4', fg: '#1E7D7F' },
}
const FILTERS: [Filter, string][] = [['all', 'All'], ['ts', 'Timesheet'], ['off', 'Time off'], ['rmb', 'Reimbursement'], ['xh', 'Extra hours'], ['cor', 'Time correction']]
const ROW_GRID = 'grid grid-cols-[minmax(170px,.9fr)_minmax(0,1.5fr)_minmax(0,1.1fr)_250px] gap-x-[22px] gap-y-3 items-center px-[18px] py-4'
const PILL = 'font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1 whitespace-nowrap'
const BTN_WHITE = 'inline-flex items-center gap-[7px] border border-slate-200 rounded-[10px] px-3.5 py-[9px] bg-white font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer'
const EYE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'

/** "Tue, Oct 13, 2026 · 4:00 PM to 5:00 PM": the day, and the rest. */
const split = (when: string) => { const i = when.indexOf(' · '); return i < 0 ? [when, ''] : [when.slice(0, i), when.slice(i + 3)] }

export function ApprovalsList({ initialData, api, initial }: {
  initialData: QueueData
  api: QueueApi
  /** The design checks open a frame's state. */
  initial?: { tab?: Tab; filter?: Filter; request?: string }
}) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<Tab>(initial?.tab ?? 'wait')
  const [filter, setFilter] = useState<Filter>(initial?.filter ?? 'all')
  const [card, setCard] = useState<{ row: ApprovalRow; deny: boolean } | null>(null)
  const [req, setReq] = useState<{ row: QueueRow; deny: boolean } | null>(initial?.request ? { row: [...initialData.wait, ...initialData.others, ...initialData.done].find(r => r.key === initial.request)!, deny: false } : null)
  const [drawer, setDrawer] = useState<number | null>(null)
  const [history, setHistory] = useState<{ id: number; data: HistoryData | null; error: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (drawer === null) return
    let off = false
    api.getEntryHistory({ id: drawer }).then(
      r => { if (!off) setHistory(r.ok ? { id: drawer, data: r.data, error: null } : { id: drawer, data: null, error: r.error }) },
      () => { if (!off) setHistory({ id: drawer, data: null, error: 'The history could not be read. Try again in a moment.' }) },
    )
    return () => { off = true }
  }, [drawer, api])

  const say = (text: string, error = false) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ text, error })
    timer.current = setTimeout(() => setToast(null), 4200)
  }
  const reload = async () => {
    try { const r = await api.getQueue(); if (r.ok) setData(r.data); else say(r.error, true) } catch { say('The list could not be read again. Reload the page.', true) }
  }

  // Time corrections and time off: decided here, as in part 1.
  const decide = async (r: ApprovalRow, decision: 'approve' | 'deny', note?: string) => {
    setBusy(true)
    try {
      if (r.type === 'correction') {
        const res = await api.decideCorrection({ id: r.id, decision, note })
        if (!res.ok) {
          if (res.overlap) { setCard({ row: { ...r, overlap: res.error }, deny: false }); return }
          return say(res.error, true)
        }
        setCard(null)
        say(res.toast)
      } else {
        const res = await api.decideTimeOff({ id: r.id, decision, note })
        if (!res.ok) return say(res.error, true)
        setCard(null)
        say(decision === 'approve' ? `Time off approved. ${r.name.split(' ')[0]} gets a notification.` : `Time off denied. ${r.name.split(' ')[0]} gets the reason.`)
      }
      void reload()
      router.refresh()
    } catch (e) {
      say(failText(e), true)
    } finally {
      setBusy(false)
    }
  }

  // Time off, reimbursements and extra hours: decided on their card (7C, 9C, 10D).
  const decideRequest = async (r: QueueRow, decision: 'approve' | 'deny', note?: string, items?: ItemDecision[]) => {
    const k = r.request?.kind
    if (!k) return
    setBusy(true)
    try {
      const body = { id: r.id, decision, note }
      // Several receipts: each one's decision, or all of them one way (the row's Approve, the card's Deny all).
      const res = k === 'rmb-report'
        ? await api.decideReimbursementReport({ reportId: r.id, decisions: items ?? (r.request?.items ?? []).filter(i => i.state === 'pending').map(i => ({ id: i.id, decision, note })) })
        : k === 'off' ? await api.decideTimeOff(body) : k === 'off-cancel' ? await api.decideTimeOffCancel(body) : k === 'rmb' ? await api.decideReimbursement(body) : await api.decideExtraHours(body)
      if (!res.ok) return say(res.error, true)
      setReq(null)
      const first = r.name.split(' ')[0]
      say('toast' in res && typeof res.toast === 'string' ? res.toast : decision === 'approve' ? `Time off approved. ${first} gets a notification.` : `Time off denied. ${first} gets the reason.`)
      void reload()
      router.refresh()
    } catch (e) {
      say(failText(e), true)
    } finally {
      setBusy(false)
    }
  }

  const list = tab === 'wait' ? data.wait : tab === 'others' ? data.others : data.done
  const shown = list.filter(r => filter === 'all' || r.type === filter)
  const count = (k: Filter) => list.filter(r => k === 'all' || r.type === k).length

  const open = (r: QueueRow) => {
    if (r.request && !(r.done && r.href)) return setReq({ row: r, deny: false })
    if (r.href) return router.push(withViewAs(r.href))
    if (r.card) {
      if (r.card.type === 'correction' && r.card.state === 'approved' && r.card.entryId !== null) return setDrawer(r.card.entryId)
      setCard({ row: r.card, deny: false })
    }
  }
  const openable = (r: QueueRow) => !!r.href || !!r.card || !!r.request

  let dialog = null
  if (card) {
    const m = card.row
    const canDecide = m.canDecide && tab === 'wait'
    {
      const [date, time] = split(m.when)
      dialog = <CorrectionReview key={m.key} who={m.name} goesTo={m.goesTo} state={m.state} date={date} time={`${time} (${formatDuration(m.seconds)})`} job={m.job} reason={m.reason}
        overlap={m.state === 'pending' ? m.overlap : null} canDecide={canDecide} denyFirst={card.deny} busy={busy}
        onClose={() => setCard(null)} onApprove={() => void decide(m, 'approve')} onDeny={note => void decide(m, 'deny', note)} />
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/clocky-hours']} now="Approvals" />
        <h1 className="m-0 mt-1.5 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Approvals</h1>
        <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">{data.subtitle}</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div role="tablist" aria-label="Approvals" className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5">
          {([['wait', `Waiting for you · ${data.wait.length}`], ['others', `With others · ${data.others.length}`], ['done', `Decided · ${data.done.length}`]] as [Tab, string][]).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setFilter('all') }}
              className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] tabular-nums lining-nums ${tab === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map(([k, label]) => {
            const on = filter === k
            return (
              <button key={k} type="button" aria-pressed={on} onClick={() => setFilter(k)}
                className={`inline-flex items-center gap-1.5 border rounded-full px-[11px] py-1.5 font-(family-name:--font-display) font-bold text-[12px] cursor-pointer ${on ? 'bg-tn-primary border-tn-primary text-[#ffffff]' : 'bg-white border-slate-200 text-foreground'}`}>
                {label}<span className="text-[11px] tabular-nums lining-nums opacity-80">{count(k)}</span>
              </button>
            )
          })}
        </div>
      </div>

      {shown.length > 0 ? (
        <>
          <div className="flex flex-col gap-px bg-[var(--row-rule)] border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
            {shown.map(r => {
              const T = TYPES[r.type]
              const canOpen = openable(r)
              return (
                <div key={r.key} role={canOpen ? 'button' : undefined} tabIndex={canOpen ? 0 : undefined} aria-label={canOpen ? `${r.name}, ${T.label.toLowerCase()}: open` : undefined}
                  onClick={canOpen ? () => open(r) : undefined}
                  onKeyDown={canOpen ? e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(r) } } : undefined}
                  className={`${ROW_GRID} bg-white hover:bg-[var(--row-hover)] ${canOpen ? 'cursor-pointer focus-visible:outline-2 focus-visible:outline-tn-teal focus-visible:-outline-offset-2' : ''}`}>
                  <div className="flex items-center gap-[11px] min-w-0">
                    <span className="flex-none w-9 h-9 rounded-full bg-tn-primary text-[#ffffff] text-[12px] font-bold flex items-center justify-center">{r.initials}</span>
                    <div className="min-w-0 flex flex-col gap-[3px]">
                      <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink leading-[1.25] whitespace-nowrap">{r.name}</span>
                      <span className="flex items-center gap-1.5 text-[12px] text-muted"><span className="w-2 h-2 rounded-full" style={{ background: r.team?.color ?? 'var(--faint)' }} />{r.team?.name ?? 'No team'}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex flex-col gap-[5px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={PILL} style={{ background: T.bg, color: T.fg }}>{T.label}</span>
                      <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink tabular-nums lining-nums">{r.main}</span>
                    </div>
                    <span className="text-[13px] text-foreground tabular-nums lining-nums">{r.sub}</span>
                    {r.flag && (
                      <span className="self-start inline-flex items-center gap-1.5 text-[12px] font-bold rounded-full px-2.5 py-[3px]" style={{ background: TONES[r.flag.tone].bg, color: TONES[r.flag.tone].fg }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: TONES[r.flag.tone].fg }} />{r.flag.text}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex flex-col gap-1">
                    {r.why && <span className="text-[13px] text-foreground leading-normal [text-wrap:pretty]">{r.why}</span>}
                    <span className="text-[11.5px] text-muted">{r.asked}</span>
                  </div>
                  <div className="min-w-0 flex items-center justify-end gap-2">
                    {tab === 'wait' && r.request?.canDecide && (
                      <>
                        <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); setReq({ row: r, deny: true }) }}
                          className={`${BTN_WHITE} text-[#c8323d] hover:border-[#c8323d]`}>{r.request.denyLabel}</button>
                        <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); void decideRequest(r, 'approve') }}
                          className="inline-flex items-center gap-[7px] border-0 rounded-[10px] px-[15px] py-2.5 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:bg-[#0a2f6b]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>{r.request.approveLabel}
                        </button>
                      </>
                    )}
                    {tab === 'wait' && r.type !== 'ts' && r.card && (
                      <>
                        <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); setCard({ row: r.card!, deny: true }) }}
                          className={`${BTN_WHITE} text-[#c8323d] hover:border-[#c8323d]`}>Deny</button>
                        <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); if (r.card!.overlap) setCard({ row: r.card!, deny: false }); else void decide(r.card!, 'approve') }}
                          className="inline-flex items-center gap-[7px] border-0 rounded-[10px] px-[15px] py-2.5 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:bg-[#0a2f6b]">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Approve
                        </button>
                      </>
                    )}
                    {(tab === 'wait' || tab === 'others') && r.type === 'ts' && r.href && (
                      <button type="button" onClick={e => { e.stopPropagation(); open(r) }} className={`${BTN_WHITE} text-tn-ink hover:border-tn-teal`}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={EYE} /></svg>
                        {tab === 'wait' ? 'Review' : 'Open'}
                      </button>
                    )}
                    {tab === 'others' && !(r.type === 'ts' && r.href) && (
                      <span className="text-[12px] text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-full px-[11px] py-[5px] whitespace-nowrap">{r.own ? `Yours, with ${r.ownerName}` : `With ${r.ownerName}`}</span>
                    )}
                    {tab === 'done' && r.done && (
                      <div className="flex flex-col items-end gap-1 max-w-full text-right">
                        <span className={PILL} style={{ background: TONES[r.done.tone].bg, color: TONES[r.done.tone].fg }}>{r.done.label}</span>
                        <span className="text-[11.5px] text-muted leading-[1.4] [text-wrap:pretty]">{r.done.by}</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="m-0 text-[12px] text-muted leading-normal">{data.note}</p>
        </>
      ) : (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-12 flex flex-col items-center gap-2 text-center">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#cbd2da" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
          <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{tab === 'wait' ? 'Nothing waiting for you' : tab === 'others' ? 'Nothing with anyone else' : 'Nothing decided yet'}</div>
          <div className="text-[13px] text-muted">New requests also arrive in the bell.</div>
        </div>
      )}

      {dialog}
      {req?.row.request && (
        <RequestCard key={req.row.key} card={req.row.request} who={req.row.name} initials={req.row.initials} team={req.row.team} asked={req.row.asked}
          busy={busy} denyFirst={req.deny} onClose={() => setReq(null)}
          onApprove={() => void decideRequest(req.row, 'approve')} onDeny={note => void decideRequest(req.row, 'deny', note)}
          onDecideItems={items => void decideRequest(req.row, 'approve', undefined, items)} />
      )}
      {drawer !== null && (
        <HistoryDrawer history={history?.id === drawer ? history.data : null} error={history?.id === drawer ? history.error : null} onClose={() => setDrawer(null)} />
      )}
      <Toast toast={toast} />
    </div>
  )
}
