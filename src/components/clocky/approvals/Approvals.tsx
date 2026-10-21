'use client'

/**
 * Approvals (design handoff of 16 October 2026, README "Time correction
 * requests and approvals", Time Entries.dc.html frames 3L and 3L2): the time
 * corrections waiting for the viewer's decision, in their scope, and for
 * Super Admins the time off too; "Waiting · n | Decided · n".
 *
 * A waiting row has Deny (opens the review with the reason field) and Approve
 * (direct; when the time now runs into an entry it opens the review with the
 * overlap instead). Clicking a row opens its card, or the entry's history once
 * approved.
 */

import { useEffect, useRef, useState } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Segmented } from '@/components/ui/Segmented'
import { formatDuration } from '@/lib/timeclock/rounding'
import type { ApprovalRow, ApprovalsData, HistoryData } from '@/lib/timeclock/clocky-types'
import type { ApprovalsApi } from '../entries/api'
import { CorrectionReview, TimeOffCard } from '../entries/Dialogs'
import { HistoryDrawer } from '../entries/HistoryDrawer'
import { Icon, ICON, Pill, Toast, type ToastState } from '../entries/ui'

export type ApprovalsModal = { kind: 'review' | 'off'; key: string; deny: boolean }

const first = (name: string) => name.split(' ')[0]
/** "Tue, Oct 13, 2026 · 4:00 PM to 5:00 PM EAT": the day, and the rest. */
const split = (when: string) => { const i = when.indexOf(' · '); return i < 0 ? [when, ''] : [when.slice(0, i), when.slice(i + 3)] }

export function Approvals({ initialData, api, initial }: {
  initialData: ApprovalsData
  api: ApprovalsApi
  /** The design checks open a frame's state. */
  initial?: { tab?: 'wait' | 'done'; modal?: ApprovalsModal | null; drawer?: number | null }
}) {
  const [data, setData] = useState(initialData)
  const [tab, setTab] = useState<'wait' | 'done'>(initial?.tab ?? 'wait')
  const [modal, setModal] = useState<ApprovalsModal | null>(initial?.modal ?? null)
  const [drawer, setDrawer] = useState<number | null>(initial?.drawer ?? null)
  const [history, setHistory] = useState<{ id: number; data: HistoryData | null; error: string | null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  useEffect(() => {
    if (drawer === null) return
    let off = false
    api.getEntryHistory({ id: drawer }).then(r => { if (!off) setHistory(r.ok ? { id: drawer, data: r.data, error: null } : { id: drawer, data: null, error: r.error }) })
    return () => { off = true }
  }, [drawer, api])

  const say = (text: string, error = false) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ text, error })
    timer.current = setTimeout(() => setToast(null), 5000)
  }
  const reload = async () => { const r = await api.getApprovals(); if (r.ok) setData(r.data); else say(r.error, true) }

  const rows = tab === 'wait' ? data.waiting : data.decided
  const byKey = (k: string) => [...data.waiting, ...data.decided].find(r => r.key === k)

  const decide = async (r: ApprovalRow, decision: 'approve' | 'deny', note?: string, fromCard = false) => {
    setBusy(true)
    try {
      if (r.type === 'correction') {
        const res = await api.decideCorrection({ id: r.id, decision, note })
        if (!res.ok) {
          // The time ran into an entry since the list was read: the review says so.
          if (res.overlap) { setModal({ kind: 'review', key: r.key, deny: false }); setData(d => ({ ...d, waiting: d.waiting.map(x => (x.key === r.key ? { ...x, overlap: res.error } : x)) })); return }
          return say(res.error, true)
        }
        setModal(null)
        say(res.toast)
      } else {
        const res = await api.decideTimeOff({ id: r.id, decision, note })
        if (!res.ok) return say(res.error, true)
        setModal(null)
        const who = fromCard ? r.name : first(r.name)
        say(decision === 'approve' ? `Time off approved. ${who} gets a notification.` : `Time off denied. ${who} gets the reason.`)
      }
      void reload()
    } catch {
      // A network error or a deploy mid-request: the buttons must come back.
      say('That did not go through. Check your connection and try again.', true)
    } finally {
      setBusy(false)
    }
  }
  const approve = (r: ApprovalRow) => (r.overlap ? setModal({ kind: 'review', key: r.key, deny: false }) : void decide(r, 'approve'))
  const open = (r: ApprovalRow) => {
    if (r.state === 'approved' && r.entryId !== null) return setDrawer(r.entryId)
    setModal({ kind: r.type === 'time_off' ? 'off' : 'review', key: r.key, deny: false })
  }

  const m = modal ? byKey(modal.key) : undefined
  let card = null
  if (modal && m && modal.kind === 'review') {
    const [date, time] = split(m.when)
    card = <CorrectionReview key={m.key} who={m.name} goesTo={m.goesTo} state={m.state} date={date} time={`${time} (${formatDuration(m.seconds)})`} job={m.job} reason={m.reason}
      overlap={m.state === 'pending' ? m.overlap : null} canDecide={m.canDecide} denyFirst={modal.deny} busy={busy}
      onClose={() => setModal(null)} onApprove={() => void decide(m, 'approve')} onDeny={note => void decide(m, 'deny', note)} />
  } else if (modal && m && modal.kind === 'off') {
    const [dates, type] = split(m.when)
    card = <TimeOffCard key={m.key} who={m.name} state={m.state} type={type} dates={dates} hours={formatDuration(m.seconds)} note={m.reason}
      canDecide={m.canDecide} denyFirst={modal.deny} busy={busy} onClose={() => setModal(null)}
      onApprove={() => void decide(m, 'approve', undefined, true)} onDeny={note => void decide(m, 'deny', note, true)} />
  }
  return (
    <div className="flex flex-col gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/clocky-hours']} now="Approvals" />
        <h1 className="m-0 mt-0.5 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Approvals</h1>
        <p className="m-0 mt-1 text-[13.5px] text-muted">{data.subtitle}</p>
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        <Segmented label="Requests" display="px-3 py-1.5 text-[12.5px] tabular-nums lining-nums" value={tab} onChange={setTab}
          options={[{ key: 'wait', label: `Waiting · ${data.waiting.length}` }, { key: 'done', label: `Decided · ${data.decided.length}` }]} />
        <span className="text-[12.5px] text-muted">{data.note}</span>
      </div>

      {rows.length > 0 ? (
        <div className="flex flex-col gap-px bg-[var(--row-rule)] border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
          {rows.map(r => {
            const isOff = r.type === 'time_off'
            return (
              <div key={r.key} role="button" tabIndex={0} aria-label={`${r.name}, ${isOff ? 'time off' : 'time correction'}: open`} onClick={() => open(r)}
                onKeyDown={e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(r) } }}
                className="flex flex-wrap gap-x-[22px] gap-y-3 items-center px-[18px] py-4 bg-white cursor-pointer hover:bg-[var(--row-hover)] focus-visible:outline-2 focus-visible:outline-tn-teal focus-visible:-outline-offset-2">
                <div className="flex-[1_1_180px] flex items-center gap-[11px] min-w-0">
                  <span className="flex-none w-9 h-9 rounded-full bg-tn-primary text-[#ffffff] text-[12px] font-bold flex items-center justify-center">{r.initials}</span>
                  <div className="min-w-0 flex flex-col gap-[3px]">
                    <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink leading-[1.25]">{r.name}</span>
                    <span className="flex items-center gap-1.5 text-[12px] text-muted">
                      <span className="w-2 h-2 rounded-full" style={{ background: r.team?.color ?? 'var(--faint)' }} />{r.team?.name ?? 'No team'}
                    </span>
                  </div>
                </div>
                <div className="flex-[1.3_1_230px] min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1 whitespace-nowrap"
                      style={isOff ? { background: '#eef1fb', color: '#3b4fa8' } : { background: 'var(--color-tn-teal-soft)', color: 'var(--color-tn-teal)' }}>
                      {isOff ? 'Time off' : 'Time correction'}
                    </span>
                    <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink whitespace-nowrap tabular-nums lining-nums">{formatDuration(r.seconds)}</span>
                  </div>
                  <span className="text-[13px] text-foreground tabular-nums lining-nums">{r.when}</span>
                  {!isOff && <span className="text-[12.5px] text-muted truncate">{r.job}</span>}
                </div>
                <div className="flex-[1.5_1_240px] min-w-0 flex flex-col gap-1">
                  <span className="text-[13px] text-foreground leading-normal [text-wrap:pretty]">{r.reason ? `"${r.reason}"` : ''}</span>
                  <span className="text-[11.5px] text-muted">{r.asked}</span>
                </div>
                <div className="flex-none ml-auto flex items-center justify-end gap-2">
                  {tab === 'wait' ? (
                    <>
                      <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); setModal({ kind: isOff ? 'off' : 'review', key: r.key, deny: true }) }}
                        className="whitespace-nowrap border border-slate-200 rounded-[10px] px-3.5 py-[9px] bg-white text-[#c8323d] font-(family-name:--font-display) font-extrabold text-[12.5px] hover:border-[#c8323d]">Deny</button>
                      <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); approve(r) }}
                        className="inline-flex items-center gap-[7px] whitespace-nowrap border-0 rounded-[10px] px-[15px] py-2.5 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[12.5px] hover:bg-[#0a2f6b]">
                        <Icon d={ICON.check} size={13} color={BTN_ICON.navy} width={3} />Approve
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-end gap-1 max-w-[260px] text-right">
                      <Pill text={r.state === 'approved' ? 'Approved' : 'Denied'} tone={r.state === 'approved' ? 'ok' : 'bad'} size="md" />
                      <span className="text-[11.5px] text-muted leading-[1.4] [text-wrap:pretty]">
                        {r.decided ? `By ${r.decided.by}, ${r.decided.when}${r.decided.note ? `. "${r.decided.note}"` : ''}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-12 flex flex-col items-center gap-2 text-center">
          <Icon d={ICON.check} size={34} color="var(--faint)" width={1.8} />
          <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{tab === 'wait' ? 'Nothing waiting for you' : 'Nothing decided yet'}</div>
          <div className="text-[13px] text-muted">{tab === 'wait' ? 'New requests also arrive in the bell.' : 'Approved and denied requests stay here, with who decided and why.'}</div>
        </div>
      )}

      {card}
      {drawer !== null && (
        <HistoryDrawer history={history?.id === drawer ? history.data : null} error={history?.id === drawer ? history.error : null} onClose={() => setDrawer(null)} />
      )}
      <Toast toast={toast} />
    </div>
  )
}
