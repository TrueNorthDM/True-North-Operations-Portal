'use client'

/**
 * Time off (Clocky part 2, Requests.dc.html):
 *
 *   7B   My time off: Pending, Upcoming, Past; Super Admins and Admins also
 *        see Everyone's. A row opens its drawer.
 *   7A   Request time off: the kind, the days on a calendar (weekends and
 *        company holidays not counted), full days or hours a day, what it
 *        counts, the balance, who else is off.
 *   7D   The drawer: what happened by itself after the approval (Rippling,
 *        the team calendar, the time entries), Try again when Rippling refused.
 *   7E   Cancel an approved request still to come: a Super Admin approves it.
 */

import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { useModal } from '@/components/ui/useModal'
import { BTN_ICON } from '@/lib/ui/buttons'
import { dayLabel } from '@/lib/timeclock/format'
import { formatDuration } from '@/lib/timeclock/rounding'
import type { TimeOffPage, TimeOffRow } from '@/lib/timeclock/time-off-data'
import type { OffTone } from '@/lib/timeclock/time-off'
import type { Result } from '@/lib/timeclock/clocky-types'
import { CloseButton, FieldLabel, Icon, LabeledSelect, Modal, MODAL_TITLE, TEXTAREA_PLAIN, TEXTAREA_WARN, Toast, useIsClient, type ToastState } from '@/components/clocky/entries/ui'
import { usePhone } from '@/components/clocky/clock/hooks'
import { PhoneSheet } from './PhoneSheet'

export interface TimeOffApi {
  askTimeOff(i: { jobcodeId: number; start: string; end: string; hoursPerDay: number; note?: string }): Promise<Result<{ toast: string }>>
  cancelTimeOff(i: { id: number }): Promise<Result<{ toast: string }>>
  askCancelTimeOff(i: { id: number; reason: string }): Promise<Result<{ toast: string }>>
  retryTimeOffRippling(i: { id: number }): Promise<Result<{ toast: string }>>
}

const TONE: Record<OffTone, { bg: string; fg: string }> = {
  ok: { bg: '#e6f6ee', fg: '#0d7a4f' }, warn: { bg: '#fdf8e7', fg: '#8a6d1a' }, bad: { bg: '#fdeeef', fg: '#c8323d' }, neu: { bg: '#f1f3f6', fg: '#5b6b82' },
}
const CHECK_ICON = { check: 'M5 12l5 5 9-10', x: 'M6 6l12 12M18 6 6 18', clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2' }
const PILL = 'font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1 whitespace-nowrap'
const BTN_WHITE = 'border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal'
const BTN_NAVY = 'inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-45 disabled:cursor-not-allowed'
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const add = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const range = (a: string, b: string) => (a === b ? dayLabel(a) : `${dayLabel(a)} to ${dayLabel(b)}`)

export function TimeOffView({ data, api, initial }: {
  data: TimeOffPage
  api: TimeOffApi
  /** The design checks open a frame's state. */
  initial?: { modal?: 'ask' | 'cancel'; drawer?: number; tab?: 'mine' | 'all'; form?: Partial<Form> }
}) {
  const router = useRouter()
  const [tab, setTab] = useState<'mine' | 'all'>(initial?.tab ?? 'mine')
  const [drawer, setDrawer] = useState<number | null>(initial?.drawer ?? null)
  const [modal, setModal] = useState<'ask' | 'cancel' | null>(initial?.modal ?? null)
  const [cancelId, setCancelId] = useState<number | null>(initial?.modal === 'cancel' ? initial.drawer ?? null : null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }

  const rows = tab === 'all' && data.canAll ? data.everyone : data.mine
  // Upcoming: the next day off first. Past: the latest first.
  const byStart = (a: TimeOffRow, b: TimeOffRow) => a.start.localeCompare(b.start) || a.id - b.id
  const groups: [string, TimeOffRow[]][] = ([['Pending', rows.filter(r => r.group === 'pending')], ['Upcoming', rows.filter(r => r.group === 'upcoming').sort(byStart)], ['Past', rows.filter(r => r.group === 'past').sort(byStart).reverse()]] as [string, TimeOffRow[]][]).filter(g => g[1].length)
  const open = [...data.mine, ...data.everyone].find(r => r.id === drawer) ?? null
  const cx = [...data.mine, ...data.everyone].find(r => r.id === cancelId) ?? null

  const run = async (p: Promise<Result<{ toast: string }>>, after?: () => void) => {
    setBusy(true)
    const r = await p
    setBusy(false)
    if (!r.ok) { say({ text: r.error, error: true }); return false }
    after?.()
    say({ text: r.toast })
    router.refresh()
    return true
  }

  if (!data.employee && !data.canAll) {
    return (
      <div className="grid gap-4 leading-[normal]">
        <Header onNew={null} />
        <div className="max-w-[640px] bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-[18px] text-[13.5px] leading-[1.55] text-foreground">
          Time off is asked by employees, for Rippling payroll. Contractors are not paid for days off, so there is nothing to ask here.
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <Header onNew={data.employee ? () => { setDrawer(null); setModal('ask') } : null} />

      {data.canAll && (
        <div role="tablist" aria-label="Whose time off" className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 self-start justify-self-start">
          {([['mine', 'Mine'], ['all', 'Everyone']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] ${tab === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
          ))}
        </div>
      )}

      {tab === 'mine' && data.employee && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {data.types.filter(t => t.paid).map(t => (
              <div key={t.id} className="bg-white border border-[var(--panel-border)] rounded-[14px] px-4 py-3.5 flex flex-col gap-1">
                <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{t.label}</span>
                <span className="font-(family-name:--font-display) font-black text-[24px] text-tn-ink tabular-nums lining-nums">–</span>
                <span className="text-[12px] text-muted">From Rippling, once connected</span>
              </div>
            ))}
          </div>
          <div className="text-[12px] text-muted -mt-1.5">Balances come from Rippling once a Super Admin connects it. Company holidays are off for everyone and are not asked for.</div>
        </>
      )}

      {groups.map(([title, list]) => (
        <div key={title} className="flex flex-col gap-2">
          <div className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">{title}</div>
          <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
            {list.map(r => (
              <div key={r.id} role="button" tabIndex={0} onClick={() => setDrawer(r.id)} onKeyDown={e => { if (e.key === 'Enter') setDrawer(r.id) }}
                className="flex flex-wrap items-center gap-x-5 gap-y-2.5 px-[18px] py-3.5 border-b border-[var(--row-rule)] cursor-pointer hover:bg-[#f8f7f3]">
                {tab === 'all' && (
                  <span className="flex-[0_0_170px] flex items-center gap-[9px]">
                    <span className="w-7 h-7 rounded-full bg-tn-primary text-[#ffffff] text-[10.5px] font-bold flex items-center justify-center flex-none">{r.initials}</span>
                    <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink whitespace-nowrap">{r.who}</span>
                  </span>
                )}
                <span className="flex-[0_0_96px]"><span className={`${PILL} bg-[#eef1fb] text-[#3b4fa8]`}>{r.type}</span></span>
                <span className="flex-[1_1_220px] flex flex-col gap-0.5 min-w-0">
                  <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink tabular-nums lining-nums">{r.dates}</span>
                  <span className="text-[12.5px] text-muted tabular-nums lining-nums">{r.count}</span>
                </span>
                <span className="flex-[1_1_250px] flex flex-wrap gap-1.5">
                  {r.checks.map(c => (
                    <span key={c.t} className="inline-flex items-center gap-[5px] text-[11.5px] font-bold rounded-full px-[9px] py-[3px] whitespace-nowrap" style={{ background: TONE[c.tone].bg, color: TONE[c.tone].fg }}>
                      <Icon d={CHECK_ICON[c.icon]} size={11} width={3} />{c.t}
                    </span>
                  ))}
                </span>
                <span className="flex-none ml-auto flex items-center gap-2.5">
                  <span className={PILL} style={{ background: TONE[r.pill.tone].bg, color: TONE[r.pill.tone].fg }}>{r.pill.label}</span>
                  {r.cancel && (
                    <button type="button" disabled={busy} onClick={e => { e.stopPropagation(); if (r.cancel === 'direct') void run(api.cancelTimeOff({ id: r.id })); else { setCancelId(r.id); setModal('cancel') } }}
                      className="border border-slate-200 rounded-[10px] px-3 py-[7px] bg-white text-[#c8323d] font-(family-name:--font-display) font-extrabold text-[12px] cursor-pointer hover:border-[#c8323d]">{r.cancel === 'direct' ? 'Cancel' : 'Cancel…'}</button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-11 text-center text-[13.5px] text-muted">
          {tab === 'all' ? 'Nobody has time off asked or coming up.' : 'No time off asked yet. Request time off to ask for days.'}
        </div>
      )}

      {open && <OffDrawer row={open} me={data.me.personId} busy={busy} onClose={() => setDrawer(null)}
        onRetry={() => void run(api.retryTimeOffRippling({ id: open.id }))}
        onCancel={() => { setCancelId(open.id); setModal('cancel') }} />}
      {modal === 'ask' && <AskForm data={data} initial={initial?.form} busy={busy} onClose={() => setModal(null)}
        onSend={f => void run(api.askTimeOff(f), () => setModal(null))} />}
      {modal === 'cancel' && cx && <CancelDialog row={cx} busy={busy} onClose={() => setModal(null)}
        onAsk={reason => void run(api.askCancelTimeOff({ id: cx.id, reason }), () => setModal(null))} />}
      <Toast toast={toast} />
    </div>
  )
}

function Header({ onNew }: { onNew: (() => void) | null }) {
  return (
    <div>
      <Breadcrumb parents={['/requests']} now="Time off" />
      <div className="flex items-center justify-between gap-3.5 flex-wrap mt-1.5">
        <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[1.15] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Time off</h1>
        {onNew && (
          <button type="button" onClick={onNew} className={`${BTN_NAVY} shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)]`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Request time off
          </button>
        )}
      </div>
      <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">Ask for days off here, and only here. Approved, it goes to Rippling for payroll and to the team calendar by itself.</p>
    </div>
  )
}

// ── 7D: the drawer ──────────────────────────────────────────────────────────

function OffDrawer({ row, me, busy, onClose, onRetry, onCancel }: { row: TimeOffRow; me: string; busy: boolean; onClose: () => void; onRetry: () => void; onCancel: () => void }) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onClose)
  const client = useIsClient()
  if (!client) return null
  const d = row.drawer
  return createPortal(
    <>
      <div className="fixed inset-x-0 bottom-0 top-[63px] z-[60] bg-[rgba(1,35,88,.10)]" onMouseDown={onClose} />
      <div ref={box} role="dialog" aria-modal="true" aria-label="Time off request" className="fixed top-[63px] right-0 bottom-0 w-full max-w-[440px] bg-white border-l border-[var(--panel-border)] shadow-[-24px_0_50px_-24px_rgba(1,35,88,.35)] z-[61] flex flex-col leading-[normal]">
        <div className="px-[18px] pt-[18px] pb-3.5 border-b border-[var(--row-rule)] flex gap-2.5 items-start">
          <div className="flex-1 min-w-0 flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className={`${PILL} bg-[#eef1fb] text-[#3b4fa8]`}>{row.type}</span>
              <span className={PILL} style={{ background: TONE[d.stateTone].bg, color: TONE[d.stateTone].fg }}>{d.stateLabel}</span>
            </div>
            <div className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink leading-[1.3] tabular-nums lining-nums">{d.dates}</div>
            <div className="text-[12.5px] text-muted">{row.who} · {row.count}</div>
          </div>
          <CloseButton onClick={onClose} />
        </div>
        <div className="flex-1 overflow-auto px-[18px] py-4 flex flex-col gap-4">
          {d.note && <div className="text-[13px] text-foreground leading-[1.5] bg-subtle rounded-[10px] px-3 py-2.5">&quot;{d.note}&quot;</div>}
          <div className="flex flex-col gap-2">
            <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">What happened by itself</span>
            {d.steps.map(s => {
              const ok = s.state === 'ok', bad = s.state === 'bad'
              return (
                <div key={s.t} className={`flex gap-2.5 items-start border rounded-[11px] px-3 py-2.5 ${bad ? 'border-[#f3c6ca] bg-[#fdeeef]' : ok ? 'border-[var(--panel-border)] bg-white' : 'border-[var(--row-rule)] bg-[#f8f7f3]'}`}>
                  <span className={`w-[22px] h-[22px] rounded-full text-[#ffffff] flex items-center justify-center flex-none mt-px ${bad ? 'bg-[#c8323d]' : ok ? 'bg-[#1E9E6A]' : 'bg-[#a3aebb]'}`}>
                    <Icon d={bad ? CHECK_ICON.x : ok ? CHECK_ICON.check : CHECK_ICON.clock} size={12} width={3} />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    <span className={`text-[13px] font-bold leading-[1.45] ${bad ? 'text-[#c8323d]' : 'text-tn-ink'}`}>{s.t}</span>
                    <span className="text-[12px] text-muted leading-[1.45]">{s.sub}</span>
                    {s.retry && (
                      <div className="flex mt-1.5">
                        <button type="button" disabled={busy} onClick={onRetry} className="inline-flex items-center gap-[7px] border-0 rounded-[10px] px-3.5 py-[9px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-60">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" /></svg>Try again
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex flex-col gap-1">
            <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted mb-1.5">History</span>
            {d.hist.map((h, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center"><span className="w-2.5 h-2.5 rounded-full mt-1 flex-none" style={{ background: h.dot }} /><span className="flex-1 w-0.5 bg-[var(--row-rule)] my-1" /></div>
                <div className="pb-3 flex flex-col gap-0.5"><span className="text-[13px] text-tn-ink font-semibold leading-[1.45]">{h.t}</span><span className="text-[11.5px] text-muted">{h.when}</span></div>
              </div>
            ))}
          </div>
        </div>
        {row.personId === me && row.cancel === 'ask' && (
          <div className="px-[18px] py-3.5 border-t border-[var(--row-rule)] flex justify-end">
            <button type="button" onClick={onCancel} className="border border-slate-200 rounded-[10px] px-[15px] py-2.5 bg-white text-[#c8323d] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-[#c8323d]">Cancel this time off</button>
          </div>
        )}
      </div>
    </>,
    document.body,
  )
}

// ── 7E: cancel an approved one ──────────────────────────────────────────────

function CancelDialog({ row, busy, onClose, onAsk }: { row: TimeOffRow; busy: boolean; onClose: () => void; onAsk: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const ok = !!reason.trim()
  return (
    <Modal label="Cancel time off" width={470} onClose={onClose} alert gap={12}>
      <h2 className={`${MODAL_TITLE} leading-[1.3]`}>Cancel your time off, {row.dates}?</h2>
      <p className="m-0 text-[13.5px] text-foreground leading-[1.55] [text-wrap:pretty]">It is approved, so a Super Admin approves the cancellation. Then it comes off Rippling and the team calendar, and the {formatDuration(row.seconds)} leave your time entries.</p>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel warn>Reason (required)</FieldLabel>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why you no longer need these days" className={TEXTAREA_WARN} />
      </label>
      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onClose} className={BTN_WHITE}>Keep it</button>
        <button type="button" disabled={!ok || busy} onClick={() => onAsk(reason.trim())}
          className="border-0 rounded-[10px] px-[18px] py-[11px] bg-[#c8323d] text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#b02a34] disabled:opacity-45 disabled:cursor-not-allowed">Ask to cancel</button>
      </div>
    </Modal>
  )
}

// ── 7A: the form ────────────────────────────────────────────────────────────

interface Form { type: number | null; a: string | null; b: string | null; mode: 'full' | 'hours'; hpd: number; note: string; month: string }

function AskForm({ data, initial, busy, onClose, onSend }: {
  data: TimeOffPage
  initial?: Partial<Form>
  busy: boolean
  onClose: () => void
  onSend: (f: { jobcodeId: number; start: string; end: string; hoursPerDay: number; note?: string }) => void
}) {
  const vacation = data.types.find(t => /vacation/i.test(t.label)) ?? data.types[0]
  const [f, setF] = useState<Form>({ type: vacation?.id ?? null, a: null, b: null, mode: 'full', hpd: 8, note: '', month: data.today.slice(0, 7), ...initial })
  const set = (p: Partial<Form>) => setF(x => ({ ...x, ...p }))
  const typeLabel = data.types.find(t => t.id === f.type)?.label ?? 'Time off'
  const end = f.b ?? f.a
  const hol = data.holidays
  const { days, skipped } = useMemo(() => {
    const out: string[] = [], skip: string[] = []
    if (!f.a || !end) return { days: out, skipped: skip }
    for (let d = f.a; d <= end; d = add(d, 1)) { const w = dow(d); if (w === 0 || w === 6) continue; if (hol[d]) skip.push(d); else out.push(d) }
    return { days: out, skipped: skip }
  }, [f.a, end, hol])
  const hpd = f.mode === 'full' ? 8 : f.hpd
  const seconds = days.length * hpd * 3600
  const team = data.me.team
  const overlaps = (o: { start: string; end: string }) => !!f.a && !!end && o.start <= end && o.end >= f.a
  const workIn = (a: string, b: string) => { const out: string[] = []; for (let d = a; d <= b; d = add(d, 1)) { const w = dow(d); if (w > 0 && w < 6 && !hol[d]) out.push(d) } return out }
  const who: { t: string; c: string }[] = []
  if (f.a && end) {
    for (const o of data.offs.filter(o => o.team && o.team === team && overlaps(o))) {
      const ds = workIn(o.start > f.a ? o.start : f.a, o.end < end ? o.end : end)
      if (ds.length) who.push({ t: `${o.who} is off ${ds.length === 1 ? dayLabel(ds[0]) : range(ds[0], ds[ds.length - 1])}`, c: o.color })
    }
    for (const d of skipped) who.push({ t: `${hol[d]}, ${dayLabel(d)}: company holiday`, c: '#d4a017' })
    if (!who.some(w => w.c !== '#d4a017')) {
      const elsewhere = data.offs.filter(o => o.team !== team && overlaps(o)).map(o => {
        const ds = workIn(o.start > f.a! ? o.start : f.a!, o.end < end ? o.end : end)
        return ds.length ? { t: `Also off: ${o.who}${o.team ? ` (${o.team})` : ''}, ${ds.length === 1 ? dayLabel(ds[0]) : range(ds[0], ds[ds.length - 1])}`, c: o.color } : null
      }).filter((x): x is { t: string; c: string } => !!x)
      who.unshift({ t: team ? `Nobody else on the ${team} team is off those days.` : 'Nobody else on your team is off those days.', c: '#cbd2da' }, ...elsewhere)
    }
  }
  const [y, m] = f.month.split('-').map(Number)
  const first = `${f.month}-01`
  const start = add(first, -dow(first))
  const last = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
  const calEnd = add(last, 6 - dow(last))
  const cells: string[] = []
  for (let d = start; d <= calEnd; d = add(d, 1)) cells.push(d)
  const teamOffOn = (d: string) => data.offs.find(o => o.team && o.team === team && d >= o.start && d <= o.end)
  const pick = (d: string) => setF(x => (!x.a || x.b ? { ...x, a: d, b: null } : d < x.a ? { ...x, a: d, b: x.a } : { ...x, b: d }))
  const moveMonth = (n: number) => { const d = new Date(Date.UTC(y, m - 1 + n, 1)); set({ month: d.toISOString().slice(0, 7) }) }
  const ok = !!f.type && !!f.a && days.length > 0 && !busy
  const phone = usePhone()
  const send = () => onSend({ jobcodeId: f.type!, start: f.a!, end: end!, hoursPerDay: hpd, note: f.note.trim() || undefined })

  // The calendar: 36px days in the window, 44px on the phone (Requests.dc.html 7Ap).
  const calendar = (
    <div className={`border border-[var(--panel-border)] rounded-[12px] flex flex-col ${phone ? 'px-2 pt-2 pb-2.5 gap-1.5' : 'px-3 py-2.5 gap-2'}`}>
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} className={`${phone ? 'w-11 h-11 rounded-[10px]' : 'w-[30px] h-[30px] rounded-[8px]'} border-0 bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle`}><Icon d="M15 18l-6-6 6-6" size={phone ? 18 : 16} width={2.2} /></button>
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink whitespace-nowrap">{MON_LONG[m - 1]} {y}</span>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} className={`${phone ? 'w-11 h-11 rounded-[10px]' : 'w-[30px] h-[30px] rounded-[8px]'} border-0 bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle`}><Icon d="M9 6l6 6-6 6" size={phone ? 18 : 16} width={2.2} /></button>
      </div>
      <div className={`grid grid-cols-7 ${phone ? 'gap-px' : 'gap-0.5'}`}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(h => <div key={h} className="text-center font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.06em] uppercase text-[#a3aebb] pt-0.5 pb-1">{h}</div>)}
        {cells.map(d => {
          const inM = d.slice(0, 7) === f.month, past = d < data.today, w = dow(d), wk = w === 0 || w === 6, h = hol[d]
          const sel = !!f.a && d >= f.a && d <= (end ?? f.a), edge = d === f.a || d === end, o = teamOffOn(d)
          const counted = sel && !wk && !h
          const bg = !inM ? 'transparent' : edge ? '#012358' : counted ? '#eaf4f4' : sel ? '#f4f2ec' : 'transparent'
          const fg = !inM ? 'transparent' : edge ? '#ffffff' : past ? '#cbd2da' : wk || h ? '#a3aebb' : '#012358'
          return (
            <button key={d} type="button" disabled={!inM || past} onClick={() => pick(d)} title={h ?? (o ? `${o.who} is off` : undefined)}
              className={`relative border-0 tabular-nums lining-nums disabled:cursor-default cursor-pointer ${phone ? 'h-11 text-[14px]' : 'h-9 text-[13px]'}`}
              style={{ background: bg, color: fg, fontWeight: edge ? 800 : 600, borderRadius: edge ? 9 : sel ? 4 : 9 }}>
              {inM ? Number(d.slice(8)) : ''}
              {inM && (h || o) && !edge && <span className={`absolute left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${phone ? 'bottom-[5px]' : 'bottom-1'}`} style={{ background: h ? '#d4a017' : '#A99BD4' }} />}
            </button>
          )
        })}
      </div>
      {!phone && (
        <div className="flex gap-3.5 flex-wrap text-[11.5px] text-muted">
          <span className="flex items-center gap-[5px]"><span className="w-[5px] h-[5px] rounded-full bg-[#d4a017]" />Company holiday</span>
          <span className="flex items-center gap-[5px]"><span className="w-[5px] h-[5px] rounded-full bg-[#A99BD4]" />Someone on your team is off</span>
        </div>
      )}
    </div>
  )
  const countLine = f.a ? `${days.length} working day${days.length === 1 ? '' : 's'}, ${formatDuration(seconds)}` : 'Pick the days'
  const skipLine = skipped.length > 0 ? `${skipped.map(d => dayLabel(d)).join(' and ')} ${skipped.length === 1 ? 'is a company holiday' : 'are company holidays'}, not counted.` : null
  const balanceLine = `${typeLabel}: the balance shows here once Rippling is connected.`
  const whoList = who.length ? who.map(w => (
    <div key={w.t} className="flex items-center gap-[9px] text-[13px] text-tn-ink leading-[1.45]"><span className="w-2 h-2 rounded-full flex-none" style={{ background: w.c }} /><span>{w.t}</span></div>
  )) : <div className="text-[13px] text-muted">Pick the days to see who else is off.</div>
  const modes = ([['full', 'Full days'], ['hours', 'Hours a day']] as const)
  const hoursSelect = f.mode === 'hours' && (
    <div className={phone ? '' : 'w-[150px]'}>
      <LabeledSelect label="Hours a day" value={`${f.hpd}h`} onChange={v => set({ hpd: parseInt(v, 10) })} options={[1, 2, 3, 4, 5, 6, 7, 8].map(n => ({ value: `${n}h`, label: `${n}h` }))} />
    </div>
  )

  if (phone) {
    return (
      <PhoneSheet crumb="Requests · Time off" title="Request time off" onBack={onClose}
        footer={(
          <button type="button" disabled={!ok} onClick={send} className="w-full h-[50px] flex items-center justify-center gap-[9px] border-0 rounded-[12px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[15px] cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed">
            <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4z" size={15} color={BTN_ICON.navy} width={2.4} />Send request
          </button>
        )}>
        <LabeledSelect label="Type" value={String(f.type ?? '')} onChange={v => set({ type: Number(v) })} options={data.types.map(t => ({ value: String(t.id), label: t.label }))} />
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Dates</FieldLabel>
          {calendar}
        </div>
        <div className="bg-subtle rounded-[12px] px-3.5 py-3 flex flex-col gap-[3px]">
          <span className="font-(family-name:--font-display) font-black text-[18px] text-tn-ink tabular-nums lining-nums">{countLine}</span>
          <span className="text-[12.5px] text-foreground leading-[1.45]">{f.a ? range(f.a, end ?? f.a) : 'Tap a day, then the last day.'}</span>
          {skipLine && <span className="text-[12px] text-muted leading-[1.45]">{skipLine}</span>}
        </div>
        <div className="border border-[var(--panel-border)] bg-white rounded-[12px] px-3.5 py-3 text-[13px] text-foreground font-bold leading-[1.45]">{balanceLine}</div>
        <div className="border border-[var(--panel-border)] rounded-[12px] px-3.5 py-3 flex flex-col gap-[7px]">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">Who else is off</span>
          {whoList}
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Each day</FieldLabel>
          <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5">
            {modes.map(([k, label]) => (
              <button key={k} type="button" aria-pressed={f.mode === k} onClick={() => set({ mode: k })}
                className={`flex-1 h-10 border-0 cursor-pointer rounded-[8px] font-(family-name:--font-display) font-bold text-[13px] ${f.mode === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
            ))}
          </div>
        </div>
        {hoursSelect}
        <label className="flex flex-col gap-[5px]">
          <FieldLabel>Note (optional)</FieldLabel>
          <textarea value={f.note} onChange={e => set({ note: e.target.value })} rows={2} placeholder="Anything your Team Leader should know" className={`${TEXTAREA_PLAIN} text-[14px]`} />
        </label>
      </PhoneSheet>
    )
  }

  return (
    <Modal label="Request time off" width={836} onClose={onClose} gap={16}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={`${MODAL_TITLE} whitespace-nowrap`}>Request time off</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(0,.85fr)] gap-5 items-start">
        <div className="flex flex-col gap-3.5 min-w-0">
          <LabeledSelect label="Type" value={String(f.type ?? '')} onChange={v => set({ type: Number(v) })} options={data.types.map(t => ({ value: String(t.id), label: t.label }))} />
          <div className="flex flex-col gap-1.5">
            <FieldLabel>Dates: one day or a range</FieldLabel>
            {calendar}
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex flex-col gap-1.5">
              <FieldLabel>Each day</FieldLabel>
              <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5">
                {modes.map(([k, label]) => (
                  <button key={k} type="button" aria-pressed={f.mode === k} onClick={() => set({ mode: k })}
                    className={`border-0 cursor-pointer rounded-[8px] px-3 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] ${f.mode === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
                ))}
              </div>
            </div>
            {hoursSelect}
          </div>
          <label className="flex flex-col gap-[5px]">
            <FieldLabel>Note (optional)</FieldLabel>
            <textarea value={f.note} onChange={e => set({ note: e.target.value })} rows={2} placeholder="Anything your Team Leader should know" className={TEXTAREA_PLAIN} />
          </label>
        </div>
        <div className="flex flex-col gap-3 min-w-0">
          <div className="bg-subtle rounded-[12px] px-4 py-3.5 flex flex-col gap-1">
            <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">Counted</span>
            <span className="font-(family-name:--font-display) font-black text-[20px] text-tn-ink tabular-nums lining-nums">{countLine}</span>
            <span className="text-[12.5px] text-foreground leading-[1.5]">{f.a ? range(f.a, end ?? f.a) : 'Click a day, then the last day.'}</span>
            {skipLine && <span className="text-[12px] text-muted leading-[1.5]">{skipLine}</span>}
          </div>
          <div className="border border-[var(--panel-border)] bg-white rounded-[12px] px-4 py-3.5 flex flex-col gap-1.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">Balance in Rippling</span>
            <span className="text-[13.5px] text-foreground font-bold leading-[1.45]">{balanceLine}</span>
          </div>
          <div className="border border-[var(--panel-border)] rounded-[12px] px-4 py-3.5 flex flex-col gap-2">
            <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">Who else is off</span>
            {whoList}
          </div>
          <div className="text-[12.5px] text-[#5b6b82] leading-[1.55] [text-wrap:pretty]">When a Super Admin approves, Rippling gets it for payroll, the team calendar shows &quot;{data.me.name}, out&quot; on those days, and North Time writes it into your time entries. Nobody copies anything.</div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN_WHITE}>Cancel</button>
        <button type="button" disabled={!ok} onClick={send} className={BTN_NAVY}>
          <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4z" size={14} color={BTN_ICON.navy} width={2.4} />Send request
        </button>
      </div>
    </Modal>
  )
}
