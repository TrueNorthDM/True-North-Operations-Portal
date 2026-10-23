'use client'

/**
 * The 6C page (Approvals.dc.html, frames 6C to 6D-x): a timesheet and its
 * invoice (or payroll summary) side by side, with the step tracker, three
 * tabs (Summary, Time entries, Combined), the sticky invoice column and the
 * sticky action bar. Return asks the reason in a window; approving over the
 * allowance asks a note. Every number comes ready from the server
 * (lib/timeclock/timesheet-review.ts); this draws it and sends the decision.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { useModal } from '@/components/ui/useModal'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { ReviewTone, TimesheetReview } from '@/lib/timeclock/timesheet-review'
import { InvoiceDoc } from '../invoices/InvoiceDoc'
import { InvoicePdfModal } from '../invoices/InvoicePdfModal'
import { Toast, type ToastState } from '../entries/ui'

type Res = { ok: true; toast: string } | { ok: false; error: string }
export interface ReviewApi {
  approve(note?: string): Promise<Res>
  return(reason: string): Promise<Res>
  reopen(reason: string): Promise<Res>
  retry(): Promise<Res>
}

type Tab = 'sum' | 'entries' | 'both'

const TONE: Record<ReviewTone, { bg: string; fg: string; bd: string }> = {
  ok: { bg: '#e6f6ee', fg: '#0d7a4f', bd: '#bfe5d3' }, warn: { bg: '#fdf8e7', fg: '#8a6d1a', bd: '#f0e2a8' }, bad: { bg: '#fdeeef', fg: '#c8323d', bd: '#f3c6ca' },
  neu: { bg: '#f1f3f6', fg: '#5b6b82', bd: '#e4e7ec' }, teal: { bg: '#eaf4f4', fg: '#1E7D7F', bd: '#cfe5e5' },
}
const STEP = {
  done: { dotBg: '#1E9E6A', dotFg: '#ffffff', bd: '#bfe5d3', sub: '#0d7a4f' },
  now: { dotBg: '#012358', dotFg: '#F2C40A', bd: '#012358', sub: '#435066' },
  bad: { dotBg: '#c8323d', dotFg: '#ffffff', bd: '#f3c6ca', sub: '#c8323d' },
  later: { dotBg: '#eceff3', dotFg: '#8593a4', bd: '#e4e7ec', sub: '#8593a4' },
} as const
const DAY = {
  work: { bg: '#ffffff', bd: '#e4e7ec', fg: '#012358', nfg: '#8593a4' },
  pto: { bg: '#eef1fb', bd: '#d9def5', fg: '#3b4fa8', nfg: '#3b4fa8' },
  skip: { bg: '#fdf8e7', bd: '#f0e2a8', fg: '#8a6d1a', nfg: '#8a6d1a' },
  none: { bg: '#f8f7f3', bd: '#f1efe8', fg: '#cbd2da', nfg: '#a3aebb' },
  empty: { bg: 'transparent', bd: 'transparent', fg: '#cbd2da', nfg: '#cbd2da' },
} as const
const HEADS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const ICONS = { check: 'M5 12l5 5 9-10', undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3', alert: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z', lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', refresh: 'M21 12a9 9 0 1 1-3-6.7M21 4v5h-5' }
const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'
const CARD = 'bg-white border border-[var(--panel-border)] rounded-[16px]'
const PILL = 'font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase whitespace-nowrap rounded-full px-[9px] py-1'
const ENT_COLS = 'grid-cols-[178px_84px_minmax(220px,1.4fr)_140px_170px_100px_104px_minmax(150px,1fr)]'

const Svg = ({ d, size, stroke, sw = 2.2 }: { d: string; size: number; stroke: string; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: 'none' }}><path d={d} /></svg>
)

export function TimesheetReviewPage({ review: r, api, initial }: {
  review: TimesheetReview
  api: ReviewApi
  /** The design checks open a frame's state. */
  initial?: { tab?: Tab; day?: string | null; modal?: 'return' | 'pdf' | null }
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>(initial?.tab ?? 'sum')
  const [day, setDay] = useState<string | null>(initial?.day ?? null)
  const [client, setClient] = useState<string>('all')
  const [modal, setModal] = useState<'return' | 'reopen' | 'pdf' | null>(initial?.modal ?? null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const say = (text: string, error = false) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ text, error })
    timer.current = setTimeout(() => setToast(null), 4200)
  }
  const run = async (call: () => Promise<Res>, after?: () => void) => {
    setBusy(true)
    try {
      const res = await call()
      if (!res.ok) return say(res.error, true)
      after?.()
      say(res.toast)
      router.refresh()
    } catch {
      say('That did not go through. Check your connection and try again.', true)
    } finally {
      setBusy(false)
    }
  }

  const a = r.act
  const noteNeeded = !!a.overWarn && !note.trim()
  const hasTabs = r.kind === 'timesheet'
  const first = r.who.split(' ')[0]
  const cols = r.noTimesheet ? (r.invoice ? 'grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]' : 'grid-cols-[minmax(0,1fr)]')
    : r.invoice || r.payroll ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.06fr)]' : 'grid-cols-[minmax(0,1fr)]'

  // Combined: the chosen day (or the first with time), its neighbours and its entries.
  const dates = r.days.map(d => d.iso)
  const sel = day && dates.includes(day) ? day : dates[0] ?? null
  const idx = sel ? dates.indexOf(sel) : -1
  const selDay = idx >= 0 ? r.days[idx] : null
  const openDay = (iso: string | null) => { if (iso && dates.includes(iso)) { setDay(iso); setTab('both') } }

  const calendar = (combined: boolean) => (
    <div className="grid grid-cols-7 gap-1">
      {HEADS.map(h => <div key={h} className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.06em] uppercase text-[#a3aebb] px-1.5">{h}</div>)}
      {r.calendar.map((c, i) => {
        const k = DAY[c.kind]
        const on = combined && c.iso === sel
        const can = !!c.iso && dates.includes(c.iso)
        return (
          <div key={i} title={c.tip || undefined} onClick={can ? () => (combined ? setDay(c.iso) : openDay(c.iso)) : undefined}
            role={can ? 'button' : undefined} tabIndex={can ? 0 : undefined}
            onKeyDown={can ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (combined) setDay(c.iso); else openDay(c.iso) } } : undefined}
            style={{ background: on ? '#eaf4f4' : k.bg, borderColor: on ? '#1E7D7F' : k.bd, borderWidth: on ? 2 : 1 }}
            className={`h-[42px] box-border rounded-[8px] border-solid px-[7px] py-1 flex flex-col justify-between min-w-0 ${can ? 'cursor-pointer' : 'cursor-default'}`}>
            <span className="text-[10.5px] font-semibold tabular-nums lining-nums" style={{ color: k.nfg }}>{c.n}</span>
            <span className="font-(family-name:--font-display) font-extrabold text-[12px] tabular-nums lining-nums whitespace-nowrap overflow-hidden text-ellipsis" style={{ color: k.fg }}>{c.v}</span>
          </div>
        )
      })}
    </div>
  )
  const clientsList = (label: string) => (
    <div className="flex flex-col gap-2">
      <span className={LABEL}>{label}</span>
      {r.clients.map(c => (
        <div key={c.label} className="flex justify-between items-center gap-2.5 text-[13px] border-b border-[var(--row-rule)] pb-[7px]">
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-tn-ink font-semibold whitespace-nowrap">{c.label}</span>
            <span className="text-[10.5px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap" style={c.billable ? { background: '#e6f6ee', color: '#0d7a4f' } : { background: '#f1f3f6', color: '#5b6b82' }}>{c.billable ? 'Billable' : 'Not billable'}</span>
          </span>
          <span className="font-bold text-tn-ink tabular-nums lining-nums">{c.val}</span>
        </div>
      ))}
    </div>
  )
  const person = (
    <div className="flex items-center gap-3">
      <span className="flex-none w-[42px] h-[42px] rounded-full bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[14px] flex items-center justify-center">{r.initials}</span>
      <div className="min-w-0 flex flex-col gap-[3px]">
        <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{r.who}</span>
        <span className="flex items-baseline gap-1.5 text-[12.5px] text-muted leading-[1.45]">
          <span className="w-2 h-2 rounded-full flex-none -translate-y-px" style={{ background: r.team?.color ?? '#a3aebb' }} />
          <span className="min-w-0 [text-wrap:pretty]">{`${r.team?.name ?? 'No team'} · ${r.cadenceLine}`}</span>
        </span>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/clocky-hours', { href: '/clocky-hours/approvals', label: 'Approvals' }]} now={r.who} />
        <div className="flex items-center gap-3.5 flex-wrap">
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[1.15] text-tn-ink whitespace-nowrap" style={{ letterSpacing: '-.01em' }}>{r.title}</h1>
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.05em] uppercase whitespace-nowrap rounded-full px-[11px] py-[5px]" style={{ background: TONE[r.state.tone].bg, color: TONE[r.state.tone].fg }}>{r.state.label}</span>
          <span className="text-[13px] text-muted tabular-nums lining-nums">{r.submitted}</span>
        </div>
      </div>

      <div className="flex items-stretch gap-2 flex-wrap">
        {r.steps.map(p => (
          <div key={p.label} className="flex-[1_1_260px] flex items-center gap-[11px] bg-white rounded-[12px] px-3.5 py-2.5 min-w-0 border" style={{ borderColor: STEP[p.state].bd }}>
            <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center font-(family-name:--font-display) font-black text-[12px] flex-none" style={{ background: STEP[p.state].dotBg, color: STEP[p.state].dotFg }}>{p.n}</span>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink whitespace-nowrap overflow-hidden text-ellipsis">{p.label}</span>
              <span className="text-[12px] whitespace-nowrap tabular-nums lining-nums" style={{ color: STEP[p.state].sub }}>{p.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {r.result && (
        <div role="status" className="flex gap-[11px] items-center rounded-[12px] border px-4 py-3 text-[13.5px] font-semibold leading-normal tabular-nums lining-nums"
          style={{ background: TONE[r.result.tone].bg, borderColor: TONE[r.result.tone].bd, color: TONE[r.result.tone].fg }}>
          <Svg d={ICONS[r.result.icon]} size={18} stroke="currentColor" sw={2.4} />
          <span className="flex-1 min-w-0 [text-wrap:pretty]">{r.result.text}</span>
          {r.result.retry && (
            <button type="button" disabled={busy} onClick={() => void run(api.retry)}
              className="inline-flex items-center gap-[7px] border-0 rounded-[10px] px-[15px] py-2.5 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-60">
              <Svg d={ICONS.refresh} size={13} stroke={BTN_ICON.navy} sw={2.6} />Try again
            </button>
          )}
          {a.canReopen && (
            <button type="button" disabled={busy} onClick={() => { setReason(''); setModal('reopen') }}
              className="inline-flex items-center gap-[7px] border border-slate-200 rounded-[10px] px-3.5 py-[9px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:border-tn-teal">Reopen</button>
          )}
        </div>
      )}
      {r.readOnly && (
        <div className="flex gap-2.5 items-center rounded-[12px] bg-[#f1f3f6] px-[15px] py-[11px] text-[13px] text-[#5b6b82]"><Svg d={ICONS.lock} size={16} stroke="currentColor" sw={2} />{r.readOnly}</div>
      )}

      {hasTabs && (
        <div className="flex items-center gap-3 flex-wrap">
          <div role="tablist" className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5">
            {([['sum', 'Summary'], ['entries', `Time entries · ${r.entryCount}`], ['both', 'Combined']] as [Tab, string][]).map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`border-0 cursor-pointer rounded-[8px] px-3.5 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] tabular-nums lining-nums ${tab === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
            ))}
          </div>
          <span className="flex-1 min-w-[260px] text-[12.5px] text-muted">{tab === 'sum' ? 'Click a day to see its entries.' : `Every entry as ${first} logged it, in ${first}'s time zone (${r.zoneCity}). Read only here.`}</span>
        </div>
      )}

      {(!hasTabs || tab === 'sum') && (
        <div className={`grid ${cols} gap-[18px] items-start`}>
          {r.noTimesheet ? (
            <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3.5 min-w-0`}>
              <span className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">No timesheet</span>
              {person}
              {r.noTimesheet.map(l => (
                <div key={l} className="flex gap-[9px] text-[13px] text-foreground leading-normal"><span className="flex-none w-[7px] h-[7px] rounded-full bg-tn-teal mt-[7px]" /><span className="[text-wrap:pretty]">{l}</span></div>
              ))}
              <div className="text-[12px] text-tn-teal font-semibold bg-tn-teal-soft rounded-[10px] px-[11px] py-[9px]">Pays as &quot;Fixed monthly, no timesheet&quot; in Rates &amp; Costs.</div>
            </div>
          ) : (
            <div className={`${CARD} px-[22px] py-5 flex flex-col gap-[18px] min-w-0`}>
              <div className="flex items-center justify-between gap-2.5">
                <span className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Timesheet</span>
                <button type="button" onClick={() => setTab('entries')} className="inline-flex items-center gap-1.5 border-0 bg-transparent p-0 cursor-pointer text-[12.5px] font-bold text-tn-teal hover:text-tn-ink">
                  See the time entries<Svg d="M9 6l6 6-6 6" size={13} stroke="currentColor" sw={2.4} />
                </button>
              </div>
              {person}
              <div className="grid grid-cols-3 gap-2.5">
                {r.stats.map(c => (
                  <div key={c.label} className="bg-subtle rounded-[12px] px-[13px] py-[11px] flex flex-col gap-1 min-w-0">
                    <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted">{c.label}</span>
                    <span className="font-(family-name:--font-display) font-black leading-[1.2] tabular-nums lining-nums" style={{ fontSize: c.size, color: c.tone === 'warn' ? '#8a6d1a' : c.tone === 'ok' ? '#0d7a4f' : '#012358' }}>{c.val}</span>
                  </div>
                ))}
              </div>
              {r.allowance && (
                <div className="flex flex-col gap-[9px] border border-[#f0e2a8] bg-[#fdf8e7] rounded-[12px] px-3.5 py-3">
                  <div className="text-[13px] text-tn-ink font-bold leading-[1.45] tabular-nums lining-nums">{r.allowance.line}</div>
                  <div className="flex h-2 rounded-full overflow-hidden bg-[#eceff3]">
                    <span style={{ width: `${r.allowance.w1}%`, background: '#012358' }} /><span style={{ width: `${r.allowance.w2}%`, background: '#1E7D7F' }} /><span style={{ width: `${r.allowance.w3}%`, background: '#c8323d' }} />
                  </div>
                  <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-[11.5px] text-[#5b6b82] tabular-nums lining-nums">
                    <span className="flex items-center gap-1.5"><span className="w-[9px] h-[9px] rounded-[3px] bg-tn-primary" />Allowance {r.allowance.cap}</span>
                    <span className="flex items-center gap-1.5"><span className="w-[9px] h-[9px] rounded-[3px] bg-tn-teal" />Approved in advance {r.allowance.pre}</span>
                    <span className="flex items-center gap-1.5"><span className="w-[9px] h-[9px] rounded-[3px] bg-[#c8323d]" />Not approved {r.allowance.over}</span>
                  </div>
                </div>
              )}
              {clientsList('By client')}
              <div className="flex flex-col gap-2"><span className={LABEL}>By day</span>{calendar(false)}</div>
              <div className="flex flex-col gap-2">
                <span className={LABEL}>Needs attention</span>
                {r.attention.map(x => (
                  <div key={x.text} className="flex gap-[9px] items-start text-[13px] text-foreground leading-normal"><span className="flex-none w-[7px] h-[7px] rounded-full mt-[7px]" style={{ background: x.dot }} /><span className="[text-wrap:pretty]">{x.text}</span></div>
                ))}
                {!r.attention.length && <div className="text-[13px] text-[#0d7a4f] font-semibold">Nothing. Every end time is confirmed.</div>}
              </div>
            </div>
          )}

          {r.invoice && (
            <div className="sticky top-[86px] flex flex-col gap-3.5 min-w-0">
              <div className={`${CARD} overflow-hidden`}>
                <div className="flex items-center justify-between gap-2.5 flex-wrap px-[18px] py-3.5">
                  <span className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Invoice</span>
                  <div className="flex gap-2 items-center">
                    <span className={PILL} style={{ background: TONE[r.invoice.state.tone].bg, color: TONE[r.invoice.state.tone].fg }}>{r.invoice.state.label}</span>
                    <button type="button" onClick={() => setModal('pdf')} className="inline-flex items-center gap-[7px] border border-slate-200 rounded-[10px] px-[13px] py-2 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:border-tn-teal">
                      <Svg d={ICONS.eye} size={14} stroke={BTN_ICON.white} />Preview PDF
                    </button>
                  </div>
                </div>
                <InvoiceDoc inv={r.invoice} variant="card" />
              </div>
              {r.previous && (
                <div className={`${CARD} px-[18px] py-4 flex flex-col gap-[9px]`}>
                  <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{r.previous.title}</span>
                  {r.previous.rows.map(x => (
                    <div key={x.per} className="grid grid-cols-[minmax(0,1fr)_84px_96px_110px] gap-2 text-[12.5px] pb-[7px] border-b border-[var(--row-rule)] tabular-nums lining-nums">
                      <span className="text-tn-ink" style={{ fontWeight: x.current ? 800 : 600 }}>{x.per}</span><span className="text-right">{x.hrs}</span>
                      <span className="text-right text-tn-ink font-bold">{x.amt}</span><span className="text-right font-semibold" style={{ color: TONE[x.stTone].fg }}>{x.st}</span>
                    </div>
                  ))}
                  <div className="text-[12px] text-[#5b6b82] bg-subtle rounded-[9px] px-[11px] py-2 tabular-nums lining-nums">{r.previous.diff}</div>
                </div>
              )}
              <div className={`${CARD} px-[18px] py-4 flex flex-col gap-[9px]`}>
                <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">History</span>
                {r.history.map(h => (
                  <div key={h.text + h.when} className="flex gap-2.5 text-[12.5px] text-tn-ink tabular-nums lining-nums">
                    <span className="w-[9px] h-[9px] rounded-full mt-1 flex-none" style={{ background: h.dot }} /><span className="flex-1 min-w-0">{h.text}</span><span className="text-muted whitespace-nowrap">{h.when}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {r.payroll && (
            <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3.5 min-w-0`}>
              <div className="flex items-center justify-between gap-2.5">
                <span className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Payroll summary</span>
                <span className={PILL} style={{ background: TONE[r.payroll.st.tone].bg, color: TONE[r.payroll.st.tone].fg }}>{r.payroll.st.label}</span>
              </div>
              <div className="border border-[var(--row-rule)] rounded-[12px] px-6 py-[22px] flex flex-col gap-4">
                <div className="flex justify-between gap-4 items-start">
                  <div><div className="font-(family-name:--font-display) font-black text-[22px] text-tn-ink">{r.who}</div><div className="text-[12.5px] text-muted mt-[3px]">{r.payroll.line}</div></div>
                  <div className="text-right text-[12.5px] leading-[1.6]"><div className="text-muted">Pay period</div><div className="text-tn-ink font-bold">{r.payroll.period}</div></div>
                </div>
                <div className="flex flex-col">
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_130px] gap-2 py-2 border-b border-[var(--panel-border)] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted"><span>Day</span><span className="text-right">Worked</span><span className="text-right">Time off</span></div>
                  {r.payroll.rows.map(x => (
                    <div key={x.day} className="grid grid-cols-[minmax(0,1fr)_90px_130px] gap-2 py-[7px] border-b border-[var(--row-rule)] text-[12.5px] tabular-nums lining-nums">
                      <span className="text-tn-ink font-semibold">{x.day}</span><span className="text-right" style={{ color: x.worked ? '#435066' : '#cbd2da' }}>{x.w}</span>
                      <span className="text-right" style={{ color: x.pto ? '#3b4fa8' : '#cbd2da', fontWeight: x.pto ? 700 : 400 }}>{x.o}</span>
                    </div>
                  ))}
                  <div className="grid grid-cols-[minmax(0,1fr)_90px_130px] gap-2 pt-[11px] font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink tabular-nums lining-nums">
                    <span>{r.payroll.total}</span><span className="text-right">{r.payroll.worked}</span><span className="text-right">{r.payroll.off}</span>
                  </div>
                </div>
                <div className="flex gap-2.5 items-start rounded-[11px] px-[13px] py-[11px] text-[12.5px] leading-normal font-semibold" style={{ background: TONE[r.payroll.rip.tone].bg, color: TONE[r.payroll.rip.tone].fg }}>
                  <Svg d={ICONS[r.payroll.rip.icon]} size={16} stroke="currentColor" /><span>{r.payroll.rip.text}</span>
                </div>
                <div className="text-[12px] text-muted leading-[1.55]">No invoice for employees. Rippling gets the approved hours and the PTO, by day, for payroll.</div>
              </div>
            </div>
          )}
        </div>
      )}

      {hasTabs && tab === 'entries' && (
        <div className={`${CARD} overflow-hidden`}>
          <div className="flex items-center gap-x-3.5 gap-y-2.5 flex-wrap px-[18px] py-3.5 border-b border-[var(--panel-border)]">
            <span className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink whitespace-nowrap">Time entries</span>
            <span className="text-[12.5px] text-muted whitespace-nowrap tabular-nums lining-nums">{`${r.entryCount} entries · ${r.totalText}`}</span>
            <div className="ml-auto flex gap-1.5 flex-wrap">
              {[{ client: 'all', color: '#cbd2da', count: r.entryCount, label: 'All' }, ...r.entryClients.map(x => ({ ...x, label: x.client }))].map(x => {
                const on = client === x.client
                return (
                  <button key={x.client} type="button" aria-pressed={on} onClick={() => setClient(x.client)}
                    className={`inline-flex items-center gap-1.5 border rounded-full px-[11px] py-1.5 font-(family-name:--font-display) font-bold text-[12px] cursor-pointer ${on ? 'bg-tn-primary border-tn-primary text-[#ffffff]' : 'bg-white border-slate-200 text-foreground'}`}>
                    <span className="w-2 h-2 rounded-[2px]" style={{ background: x.color }} />{x.label}<span className="text-[11px] opacity-80 tabular-nums lining-nums">{x.count}</span>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="overflow-auto">
            <div className="min-w-[1080px]">
              <div className={`grid ${ENT_COLS} bg-subtle border-b border-[var(--panel-border)]`}>
                {['Time', 'Duration', 'Job', '3 Activity', '1 Company · 2 Project', 'i7 Code', '4 Billable', 'Notes'].map(h => <div key={h} className="px-3 py-[9px] font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted whitespace-nowrap">{h}</div>)}
              </div>
              {r.days.map(g => {
                const rows = g.rows.filter(x => (x.gap ? client === 'all' : client === 'all' || x.client === client))
                if (!rows.some(x => !x.gap)) return null
                return (
                  <div key={g.iso}>
                    <div className="flex justify-between items-center px-3.5 py-2 bg-[#faf9f5] border-b border-[var(--row-rule)] font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink tabular-nums lining-nums"><span>{g.day}</span><span>{client === 'all' ? g.total : ''}</span></div>
                    {rows.map((x, i) => x.gap ? (
                      <div key={i} className="pl-[26px] pr-3.5 py-[5px] border-b border-[#f1f3f6] text-[11.5px] text-[#a3aebb] tabular-nums lining-nums">{x.gap}</div>
                    ) : (
                      <div key={i} className={`grid ${ENT_COLS} items-start border-b border-[var(--row-rule)] text-[13px] tabular-nums lining-nums hover:bg-[var(--row-hover)]`}>
                        <div className="px-3 py-[9px] flex items-center gap-2 whitespace-nowrap"><span className="w-1 h-[18px] rounded-[3px] flex-none" style={{ background: x.color }} /><span className="text-tn-ink font-semibold">{x.time}</span></div>
                        <div className="px-3 py-[9px] text-tn-ink font-(family-name:--font-display) font-extrabold whitespace-nowrap">{x.dur}</div>
                        <div className="px-3 py-[9px] flex flex-col gap-1 min-w-0"><span className="text-tn-ink font-semibold">{x.job}</span>{x.flag && <span className="self-start text-[11px] font-bold rounded-full px-2 py-0.5" style={{ background: TONE[x.flag.tone].bg, color: TONE[x.flag.tone].fg }}>{x.flag.text}</span>}</div>
                        <div className="px-3 py-[9px] text-foreground">{x.act}</div>
                        <div className="px-3 py-[9px] text-foreground">{x.cp}</div>
                        <div className="px-3 py-[9px] text-foreground font-mono text-[12px]">{x.code}</div>
                        <div className="px-3 py-[9px]"><span className="text-[10.5px] font-bold rounded-full px-2 py-[3px] whitespace-nowrap" style={x.billable ? { background: '#e6f6ee', color: '#0d7a4f' } : { background: '#f1f3f6', color: '#5b6b82' }}>{x.billable ? 'Billable' : 'Not billable'}</span></div>
                        <div className="px-3 py-[9px] text-[#5b6b82] text-[12.5px] leading-[1.45]">{x.note}</div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
          {!r.days.length && <div className="px-[18px] py-[30px] text-center text-[13px] text-muted">No entries match.</div>}
        </div>
      )}

      {hasTabs && tab === 'both' && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(440px,1fr))] gap-[18px] items-start">
          <div className={`${CARD} px-5 py-[18px] flex flex-col gap-3.5 min-w-0`}>
            <div className="flex justify-between items-baseline gap-2.5"><span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink whitespace-nowrap">By day</span><span className="text-[12px] text-muted whitespace-nowrap">Click a day to see its entries</span></div>
            {calendar(true)}
            {clientsList('By client, the whole period')}
          </div>
          <div className={`${CARD} px-5 py-[18px] flex flex-col gap-1.5 min-w-0`}>
            <div className="flex justify-between items-center gap-2.5">
              <div className="flex items-center gap-1.5">
                <button type="button" aria-label="Previous day" disabled={idx <= 0} onClick={() => idx > 0 && setDay(dates[idx - 1])} className="w-[30px] h-[30px] border-0 rounded-[8px] bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle disabled:opacity-40 disabled:cursor-default"><Svg d="M15 18l-6-6 6-6" size={16} stroke="currentColor" /></button>
                <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink whitespace-nowrap">{selDay?.day ?? ''}</span>
                <button type="button" aria-label="Next day" disabled={idx < 0 || idx >= dates.length - 1} onClick={() => idx < dates.length - 1 && setDay(dates[idx + 1])} className="w-[30px] h-[30px] border-0 rounded-[8px] bg-transparent cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle disabled:opacity-40 disabled:cursor-default"><Svg d="M9 6l6 6-6 6" size={16} stroke="currentColor" /></button>
              </div>
              <span className="font-(family-name:--font-display) font-black text-[18px] text-tn-ink whitespace-nowrap tabular-nums lining-nums">{selDay?.total ?? ''}</span>
            </div>
            <span className="text-[12px] text-muted">{`${selDay?.rows.filter(x => !x.gap).length ?? 0} entries · ${r.zoneCity} time`}</span>
            {selDay?.rows.map((x, i) => x.gap ? (
              <div key={i} className="py-1.5 pl-4 text-[11.5px] text-[#a3aebb] border-b border-dashed border-[var(--row-rule)] tabular-nums lining-nums">{x.gap}</div>
            ) : (
              <div key={i} className="flex gap-3 py-[11px] border-b border-[var(--row-rule)]">
                <span className="w-1 rounded-[4px] flex-none" style={{ background: x.color }} />
                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                  <div className="flex justify-between gap-2.5 tabular-nums lining-nums"><span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink whitespace-nowrap">{x.time}</span><span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink whitespace-nowrap">{x.dur}</span></div>
                  <span className="text-[13px] text-tn-ink font-semibold">{x.job}</span>
                  <span className="text-[12px] text-[#5b6b82]">{x.meta}</span>
                  {x.note && <span className="text-[12.5px] text-foreground">&quot;{x.note}&quot;</span>}
                  <div className="flex gap-1.5 flex-wrap mt-0.5">
                    <span className="text-[10.5px] font-bold rounded-full px-2 py-[3px]" style={x.billable ? { background: '#e6f6ee', color: '#0d7a4f' } : { background: '#f1f3f6', color: '#5b6b82' }}>{x.billable ? 'Billable' : 'Not billable'}</span>
                    {x.flag && <span className="text-[10.5px] font-bold rounded-full px-2 py-[3px] whitespace-nowrap" style={{ background: TONE[x.flag.tone].bg, color: TONE[x.flag.tone].fg }}>{x.flag.text}</span>}
                  </div>
                </div>
              </div>
            ))}
            {!selDay && <div className="py-6 text-[13px] text-muted">No time this day.</div>}
          </div>
        </div>
      )}

      {a.kind && (
        <div className="sticky bottom-0 z-[5] mt-1 -mx-6 -mb-8 px-6 pt-3.5 pb-[18px] bg-background border-t border-[var(--panel-border)] shadow-[0_-12px_24px_-18px_rgba(1,35,88,.35)] flex flex-col gap-2.5">
          {a.overInfo && (
            <div className="flex gap-2.5 items-center rounded-[11px] bg-white border border-[var(--panel-border)] px-3.5 py-2.5 text-[13px] text-[#5b6b82] tabular-nums lining-nums"><Svg d={ICONS.alert} size={16} stroke="#8a6d1a" sw={2} />{a.overInfo}</div>
          )}
          {a.overWarn && (
            <>
              <div role="alert" className="flex gap-2.5 items-center rounded-[11px] bg-[#fdf8e7] border border-[#f0e2a8] px-3.5 py-[11px] text-[13.5px] text-[#8a6d1a] font-bold tabular-nums lining-nums"><Svg d={ICONS.alert} size={17} stroke="currentColor" sw={2} />{a.overWarn}</div>
              <label className="flex flex-col gap-[5px]">
                <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#8a6d1a]">Note to approve (required)</span>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Why these hours are fine to pay"
                  className="w-full box-border resize-y px-3 py-2.5 border border-[#e9d48a] bg-[#fffdf6] rounded-[10px] text-[13px] text-tn-ink outline-none focus:border-tn-teal" />
              </label>
            </>
          )}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="flex-1 min-w-[240px] text-[12.5px] text-muted leading-[1.45] [text-wrap:pretty]">{a.barNote}</span>
            <button type="button" disabled={busy} onClick={() => { setReason(''); setModal('return') }}
              className="inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal disabled:opacity-60">
              <Svg d={ICONS.undo} size={15} stroke={BTN_ICON.white} />Return
            </button>
            <button type="button" disabled={busy || noteNeeded} onClick={() => void run(() => api.approve(note.trim() || undefined))}
              className="inline-flex items-center gap-2 border-0 rounded-[10px] px-5 py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13.5px] cursor-pointer shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)] hover:bg-[#0a2f6b] disabled:opacity-45 disabled:cursor-not-allowed">
              <Svg d={ICONS.check} size={14} stroke={BTN_ICON.navy} sw={3} />{a.label}
            </button>
          </div>
        </div>
      )}

      {(modal === 'return' || modal === 'reopen') && (
        <ReasonDialog
          title={modal === 'return' ? a.returnTitle : `Reopen ${r.title.split(', ').slice(1).join(', ')}?`}
          text={modal === 'return' ? a.returnText : `The timesheet unlocks${r.invoice ? ` and ${r.invoice.number} goes back to Draft` : ''}. ${first} sees your reason, fixes the hours and submits again.`}
          action={modal === 'return' ? (r.kind === 'invoice' || !r.isContractor || a.kind === 'hours' ? 'Return' : 'Return both') : 'Reopen'}
          warn={modal === 'reopen' ? a.reopenWarn : null}
          reason={reason} setReason={setReason} busy={busy} onClose={() => setModal(null)}
          onConfirm={() => void run(() => (modal === 'return' ? api.return(reason.trim()) : api.reopen(reason.trim())), () => setModal(null))} />
      )}
      {modal === 'pdf' && r.invoice && <InvoicePdfModal invoice={r.invoice} onClose={() => setModal(null)} onDownloaded={name => say(`Downloaded ${name}`)} />}
      <Toast toast={toast} />
    </div>
  )
}

function ReasonDialog({ title, text, action, warn = null, reason, setReason, busy, onClose, onConfirm }: {
  title: string; text: string; action: string; warn?: string | null; reason: string; setReason: (s: string) => void; busy: boolean; onClose: () => void; onConfirm: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onClose)
  const ok = !!reason.trim() && !busy
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} className="fixed inset-0 z-[80] bg-[rgba(1,35,88,.32)] flex items-center justify-center p-7">
      <div ref={box} role="dialog" aria-modal="true" aria-label={title} className="w-full max-w-[500px] bg-white rounded-[16px] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)] p-[22px] flex flex-col gap-3 leading-[normal]">
        <div className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">{title}</div>
        <div className="text-[13.5px] text-foreground leading-[1.55] [text-wrap:pretty]">{text}</div>
        {warn && (
          <div role="alert" className="flex gap-2.5 items-start rounded-[11px] bg-[#fdf8e7] border border-[#f0e2a8] px-3.5 py-[11px] text-[13px] text-[#8a6d1a] font-bold leading-[1.5]"><span className="flex-none mt-px flex"><Svg d={ICONS.alert} size={17} stroke="currentColor" sw={2} /></span>{warn}</div>
        )}
        <label className="flex flex-col gap-[5px]">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#8a6d1a]">Reason (required)</span>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="What needs fixing before it comes back"
            className="w-full box-border resize-y px-3 py-2.5 border border-[#e9d48a] bg-[#fdf8e7] rounded-[10px] text-[13px] text-tn-ink outline-none focus:border-tn-teal" />
        </label>
        <div className="flex justify-end gap-2 mt-1">
          <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Cancel</button>
          <button type="button" disabled={!ok} onClick={onConfirm}
            className="border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-45 disabled:cursor-not-allowed">{action}</button>
        </div>
      </div>
    </div>
  )
}
