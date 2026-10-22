'use client'

/**
 * Invoices, Clocky part 2 (Invoices.dc.html 6E):
 *
 *   My invoices   a contractor's own, a PDF button per row
 *   Invoices      Super Admins, Admins and Finance: the totals strip, the
 *                 filters (state, person, period), Export CSV, and the Paid
 *                 column saying where each one is; Finance alone gets Mark paid
 *   none          an employee: the line saying why there is nothing here
 *
 * A row opens its invoice (6F). PDF opens the preview window first, as every
 * PDF in the portal does; Mark paid opens the 6G dialog.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { InvoiceList, InvoiceListRow, InvoiceStateKey } from '@/lib/timeclock/invoices-view'
import type { InvoiceDocView } from '@/lib/timeclock/invoice-doc'
import type { Result } from '@/lib/timeclock/clocky-types'
import { LabeledSelect, Toast, type ToastState } from '../entries/ui'
import { InvoicePdfModal } from './InvoicePdfModal'
import { MarkPaidDialog, STATE_PILL, type PayTarget } from './InvoiceParts'

export interface InvoicesApi {
  getInvoiceDoc(i: { id: number }): Promise<Result<{ doc: InvoiceDocView }>>
  markInvoicePaid(i: { id: number; paidOn: string; ref?: string; note?: string }): Promise<Result<{ toast: string }>>
}

type StFilter = 'all' | 'wait' | 'appr' | 'paid' | 'draft'
const SEG: [StFilter, string][] = [['all', 'All'], ['wait', 'Waiting'], ['appr', 'Approved'], ['paid', 'Paid'], ['draft', 'Draft']]
const ALL_PERIODS = 'All periods'
const EVERYONE = 'Everyone'
const HEAD = 'px-3.5 py-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted whitespace-nowrap'
const EYE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
const DOWN = 'M12 3v12M7 10l5 5 5-5M5 21h14'

/** "Waiting" counts what the strip counts: waiting for the hours or for the invoice approver. */
const matches = (st: InvoiceStateKey, f: StFilter) => f === 'all' || st === f || (f === 'wait' && st === 'hrs')

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

export function InvoicesList({ data, api, initial }: {
  data: InvoiceList
  api: InvoicesApi
  /** The design checks open a frame's state. */
  initial?: { pay?: number; pdf?: InvoiceDocView }
}) {
  const router = useRouter()
  const mine = data.mode === 'mine'
  const [st, setSt] = useState<StFilter>('all')
  const [person, setPerson] = useState(EVERYONE)
  const [period, setPeriod] = useState(data.defaultPeriod)
  const [pdf, setPdf] = useState<InvoiceDocView | null>(initial?.pdf ?? null)
  const [pay, setPay] = useState<PayTarget | null>(() => {
    const r = initial?.pay ? data.rows.find(x => x.id === initial.pay) : null
    return r ? payTarget(r) : null
  })
  const [busy, setBusy] = useState<number | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const say = (t: ToastState) => {
    if (timer.current) clearTimeout(timer.current)
    setToast(t)
    timer.current = setTimeout(() => setToast(null), 4200)
  }

  const shown = mine ? data.rows : data.rows.filter(r =>
    (period === ALL_PERIODS || r.period === period) && (person === EVERYONE || r.who === person) && matches(r.st, st))
  const sum = (rows: InvoiceListRow[]) => rows.reduce((n, r) => n + r.amount, 0)
  const wait = data.rows.filter(r => r.st === 'wait' || r.st === 'hrs')
  const appr = data.rows.filter(r => r.st === 'appr')
  const paidIn = data.rows.filter(r => r.st === 'paid' && r.paidOn?.startsWith(data.paidMonth.ym))
  const strip: { k: StFilter; label: string; val: string; sub: string; fg: string; period: string }[] = [
    { k: 'wait', label: 'Waiting for approval', val: String(wait.length), sub: money(sum(wait)), fg: '#8a6d1a', period: data.defaultPeriod },
    { k: 'appr', label: 'Approved, not paid', val: String(appr.length), sub: money(sum(appr)), fg: '#1E7D7F', period: data.defaultPeriod },
    { k: 'paid', label: `Paid in ${data.paidMonth.label}`, val: money(sum(paidIn)), sub: `${paidIn.length} invoice${paidIn.length === 1 ? '' : 's'}`, fg: '#0d7a4f', period: data.paidPeriod },
  ]

  const openPdf = async (r: InvoiceListRow) => {
    setBusy(r.id)
    const res = await api.getInvoiceDoc({ id: r.id })
    setBusy(null)
    if (res.ok) setPdf(res.doc)
    else say({ text: res.error, error: true })
  }

  const exportCsv = () => {
    const head = ['Number', 'Person', 'Team', 'Period', 'Pays as', 'Total', 'State', 'Paid']
    const lines = [head, ...shown.map(r => [r.number, r.who, r.team, r.period, r.pays, r.amount.toFixed(2), STATE_PILL[r.st].label, r.where])]
    const name = `invoices-${period.toLowerCase().replace(/\s+/g, '-')}.csv`
    const url = URL.createObjectURL(new Blob([lines.map(l => l.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }))
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    say({ text: `Exported ${shown.length} invoice${shown.length === 1 ? '' : 's'} to ${name}` })
  }

  const cols = mine
    ? 'grid-cols-[150px_160px_130px_140px_190px_minmax(160px,1fr)_60px]'
    : 'grid-cols-[150px_minmax(200px,1.3fr)_140px_130px_120px_180px_minmax(150px,1fr)_120px]'
  const heads: [string, boolean?][] = mine
    ? [['Number'], ['Period'], ['Pays as'], ['Total', true], ['State'], ['Paid'], ['']]
    : [['Number'], ['Person'], ['Period'], ['Pays as'], ['Total', true], ['State'], ['Paid'], ['']]
  const title = mine || data.mode === 'none' ? 'My invoices' : 'Invoices'
  const sub = mine ? 'One invoice a month, made when you submit your timesheet. You never type hours or the rate; Finance pays and marks it paid.'
    : data.mode === 'none' ? ''
      : data.finance ? 'Every contractor invoice. You are Finance: you mark approved invoices paid, after paying them outside Rippling.'
        : 'Every contractor invoice. Made when a timesheet is submitted, approved with the hours (one or two steps), paid by Finance outside Rippling.'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/clocky-hours']} now="Invoices" />
        <h1 className="m-0 mt-1.5 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink" style={{ letterSpacing: '-.01em' }}>{title}</h1>
        {sub && <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">{sub}</p>}
      </div>

      {data.mode === 'none' && (
        <div className="max-w-[640px] bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-[18px] text-[13.5px] leading-[1.55] text-foreground">
          Employees get no invoice. Your approved hours and PTO go to Rippling for payroll, so Invoices is not in your North Time menu.
        </div>
      )}

      {data.mode === 'all' && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {strip.map(c => (
              <button key={c.k} type="button" onClick={() => { setSt(c.k); setPeriod(c.period) }} aria-pressed={st === c.k}
                className={`text-left bg-white border rounded-[14px] px-[18px] py-[15px] flex flex-col gap-[5px] cursor-pointer hover:border-tn-teal ${st === c.k ? 'border-tn-teal' : 'border-[var(--panel-border)]'}`}>
                <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{c.label}</span>
                <span className="flex items-baseline gap-2.5">
                  <span className="font-(family-name:--font-display) font-black text-[26px] tabular-nums lining-nums" style={{ color: c.fg }}>{c.val}</span>
                  <span className="text-[13px] text-foreground font-semibold tabular-nums lining-nums">{c.sub}</span>
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2.5 items-end">
            <div role="group" aria-label="State" className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 self-end">
              {SEG.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={st === k} onClick={() => setSt(k)}
                  className={`border-0 cursor-pointer rounded-[8px] px-3 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] ${st === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
              ))}
            </div>
            <div className="w-[220px]">
              <LabeledSelect label="Person" value={person} onChange={setPerson} search
                options={[EVERYONE, ...data.people].map(p => ({ value: p, label: p }))} />
            </div>
            <div className="w-[190px]">
              <LabeledSelect label="Period" value={period} onChange={setPeriod}
                options={[...data.periods, ALL_PERIODS].map(p => ({ value: p, label: p }))} />
            </div>
            <button type="button" onClick={exportCsv}
              className="ml-auto inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-[15px] py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={DOWN} /></svg>Export CSV
            </button>
          </div>
        </>
      )}

      {data.mode !== 'none' && shown.length > 0 && (
        <>
          <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-auto">
            <div className="min-w-[860px]">
              <div className={`grid ${cols} bg-subtle border-b border-[var(--panel-border)]`}>
                {heads.map(([label, right], i) => <div key={i} className={`${HEAD} ${right ? 'text-right' : ''}`}>{label}</div>)}
              </div>
              {shown.map(r => (
                <div key={r.id} role="link" tabIndex={0} aria-label={`Open ${r.number}`}
                  onClick={() => router.push(withViewAs(`/clocky-hours/invoices/${r.id}`))}
                  onKeyDown={e => { if (e.key === 'Enter') router.push(withViewAs(`/clocky-hours/invoices/${r.id}`)) }}
                  className={`grid ${cols} items-center border-b border-[var(--row-rule)] text-[13px] cursor-pointer tabular-nums lining-nums hover:bg-[#f8f7f3]`}>
                  <div className="px-3.5 py-[11px] font-(family-name:--font-display) font-extrabold text-tn-ink whitespace-nowrap">{r.number}</div>
                  {!mine && (
                    <div className="px-3.5 py-[9px] flex items-center gap-[9px] min-w-0">
                      <span className="w-7 h-7 rounded-full bg-tn-primary text-[#ffffff] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10.5px] flex-none">{r.initials}</span>
                      <span className="flex flex-col min-w-0">
                        <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink whitespace-nowrap">{r.who}</span>
                        <span className="flex items-center gap-[5px] text-[11.5px] text-muted"><span className="w-[7px] h-[7px] rounded-full" style={{ background: r.teamColor }} />{r.team}</span>
                      </span>
                    </div>
                  )}
                  <div className="px-3.5 py-[11px] text-foreground whitespace-nowrap">{r.period}</div>
                  <div className="px-3.5 py-[11px] text-[#5b6b82] whitespace-nowrap">{r.pays}</div>
                  <div className="px-3.5 py-[11px] text-right font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink whitespace-nowrap">{r.total}</div>
                  <div className="px-3.5 py-[11px]">
                    <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase whitespace-nowrap rounded-full px-[9px] py-1" style={{ background: STATE_PILL[r.st].bg, color: STATE_PILL[r.st].fg }}>{STATE_PILL[r.st].label}</span>
                  </div>
                  <div className="px-3.5 py-[11px] text-foreground whitespace-nowrap overflow-hidden text-ellipsis">{r.where}</div>
                  <div className="px-3.5 py-2 flex justify-end">
                    {r.canPay ? (
                      <button type="button" onClick={e => { e.stopPropagation(); setPay(payTarget(r)) }}
                        className="inline-flex items-center gap-[7px] border border-slate-200 rounded-[10px] px-3 py-[7px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:border-tn-teal">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Mark paid
                      </button>
                    ) : (
                      <button type="button" disabled={busy === r.id} onClick={e => { e.stopPropagation(); void openPdf(r) }} aria-label={`Preview ${r.number}.pdf`}
                        className="inline-flex items-center gap-1.5 border border-slate-200 rounded-[9px] px-[11px] py-1.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12px] cursor-pointer hover:border-tn-teal disabled:opacity-60">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={EYE} /></svg>PDF
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="text-[12px] text-muted leading-[1.5]">
            {data.finance ? 'Mark paid only after the money left. Paid once: the action goes away after that.' : "Only Finance marks invoices paid. Totals use each person's rate from Rates & Costs."}
          </div>
        </>
      )}

      {data.mode !== 'none' && shown.length === 0 && (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-11 text-center text-[13.5px] text-muted">
          {data.rows.length ? 'No invoices match these filters.' : mine ? 'No invoices yet. The first one is made when you submit your timesheet.' : 'No invoices yet. They are made when contractors submit their timesheets.'}
        </div>
      )}

      {pdf && <InvoicePdfModal invoice={pdf} onClose={() => setPdf(null)} onDownloaded={name => say({ text: `Downloaded ${name}` })} />}
      {pay && (
        <MarkPaidDialog target={pay} onClose={() => setPay(null)} save={api.markInvoicePaid}
          onSaved={t => { setPay(null); say({ text: t }); router.refresh() }} />
      )}
      <Toast toast={toast} />
    </div>
  )
}

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function payTarget(r: InvoiceListRow): PayTarget {
  return { id: r.id, number: r.number, who: r.who, line: `${r.period} · ${r.where.replace(/^Approved/, 'approved')}`, total: r.total }
}
