'use client'

/**
 * A contractor sends their own invoice (leadership, 4 November 2026; mockup
 * "Contractor invoices", screens 1, 2a and 2b, approved the same day): pick the
 * period, then "Upload my own invoice" (their PDF, with the number, hours and
 * total they type) or "Build it here". The builder opens filled from their
 * sent timesheet, one line a client at the rate in their contract, or one line
 * with their fixed amount (owner, 5 November 2026): the rate and the amount
 * are read only, the hours, descriptions and lines are theirs ("Reset to my
 * timesheet" puts the timesheet's lines back). With nothing on file the
 * builder says so and cannot send. Either way they tick "This is my invoice"
 * before sending. The sentence, the rate and the amount are made again on the
 * server; these are what they read.
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Icon, ICON } from '@/components/clocky/entries/ui'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { CHECKBOX, INPUT } from '@/lib/ui/fields'
import { ERROR_BOX } from '@/lib/ui/feedback'
import { CARD, CARD_TITLE, FIELD_LABEL, SECTION_TITLE } from '@/lib/ui/type'
import { usd } from '@/lib/timeclock/invoice-doc'
import { AMOUNT_NOTE, RATE_NOTE, builderProblem, confirmText, fixedLine, lineAmount, linesAtFileRate, linesFromTimesheet, missingOnFile, payOnFile, type BuilderLine, type MadeBy, type PayOnFile } from '@/lib/timeclock/contractor-invoice-rules'
import type { InvoiceToSend } from '@/lib/timeclock/send-invoice-data'
import type { SendInvoiceData } from '@/lib/timeclock/send-invoice-data'
import { reimbursementsFor } from '@/lib/timeclock/send-invoice-reimbursements'

const MAX_PDF = 10 * 1024 * 1024
const TRY = 'Something went wrong. Check the connection and try again.'
/** A builder line as they edit it: only the description and the hours are theirs. */
type Row = { key: number; description: string; client: string | null; hours: string }
const blank = (key: number): Row => ({ key, description: '', client: null, hours: '' })
const n = (s: string): number | null => (s.trim() === '' || !Number.isFinite(Number(s.replace(/,/g, ''))) ? null : Number(s.replace(/,/g, '')))
const hm = (seconds: number) => `${Math.floor(seconds / 3600)}h ${String(Math.round(seconds / 60) % 60).padStart(2, '0')}m`
/** The line as billed: the rate or amount on file, never typed. */
const toLine = (r: Row, pay: PayOnFile): BuilderLine => {
  const typed: BuilderLine = { description: r.description, client: r.client, hours: n(r.hours), rate: null, amount: null }
  const billed = linesAtFileRate([typed], pay)
  return 'error' in billed ? typed : billed.lines[0]
}
/** Row keys: only need to be unique on the page. */
let seq = 0
const next = () => ++seq
const payOf = (p: InvoiceToSend | null, data: SendInvoiceData): PayOnFile => payOnFile(p?.kind ?? 'hourly', data.rate, data.fixedAmount)
/** The lines the builder opens with (owner, 5 November 2026): one empty line, or the fixed amount's one line. */
function startRows(p: InvoiceToSend | null, data: SendInvoiceData): Row[] {
  if (p && p.kind !== 'hourly') return [{ ...blank(next()), description: fixedLine(p.label, data.fixedAmount).description }]
  return [blank(next())]
}
/** "Use my timesheet hours": the sent timesheet, one line a client; the rate on file shows beside each. */
function timesheetRows(p: InvoiceToSend | null, data: SendInvoiceData): Row[] {
  if (!p || p.kind !== 'hourly') return startRows(p, data)
  const made = linesFromTimesheet(p.timesheet, p.label, data.rate)
  return made.length ? made.map(l => ({ key: next(), description: l.description, client: l.client, hours: String(l.hours ?? '') })) : [blank(next())]
}

export function SendMyInvoice({ data, start: initial }: { data: SendInvoiceData; start: string | null }) {
  const router = useRouter()
  const [start, setStart] = useState(data.toSend.find(p => p.start === initial)?.start ?? data.toSend[0]?.start ?? '')
  const period = data.toSend.find(p => p.start === start) ?? null
  const [mode, setMode] = useState<MadeBy | null>(null)
  const [rows, setRows] = useState<Row[]>(() => startRows(period, data))
  const [theirNumber, setTheirNumber] = useState('')
  const [hours, setHours] = useState('')
  const [total, setTotal] = useState('')
  const [covers, setCovers] = useState('')
  const [pdf, setPdf] = useState<File | null>(null)
  // The ones still on an invoice sent back start ticked: they were on it before.
  const [rmb, setRmb] = useState<number[]>(() => (period?.returned?.reimbursements ?? []).map(r => r.id))
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pdfInput = useRef<HTMLInputElement>(null)

  const fixed = period?.kind !== 'hourly'
  const pay = payOf(period, data)
  const missing = missingOnFile(pay)
  const lines = rows.map(r => toLine(r, pay))
  const offered = period ? reimbursementsFor(data, period) : data.reimbursements
  const rTotal = offered.filter(r => rmb.includes(r.id)).reduce((s, r) => s + r.amount, 0)
  const builtTotal = Math.round((lines.reduce((s, l) => s + (lineAmount(l) ?? 0), 0) + rTotal) * 100) / 100
  const builtHours = lines.reduce((s, l) => s + (l.hours ?? 0), 0)

  if (!period) {
    return (
      <div className={`${CARD} p-6`}>
        <h2 className={CARD_TITLE}>No invoice to send right now</h2>
        <p className="m-0 mt-1 text-[13.5px] text-muted">Send your timesheet first; then your invoice for it is asked for here. Invoices you sent are in the list.</p>
      </div>
    )
  }

  const pickPdf = (f: File | undefined | null) => {
    setError(null)
    if (!f) return
    if (f.type !== 'application/pdf' || f.size > MAX_PDF) { setError('Your invoice must be a PDF of up to 10 MB.'); return }
    setPdf(f)
  }
  const setRow = (key: number, p: Partial<Row>) => setRows(xs => xs.map(r => (r.key === key ? { ...r, ...p } : r)))
  const fillFromTimesheet = () => setRows(timesheetRows(period, data))

  const problem = mode === 'builder' ? (missing ?? builderProblem(lines))
    : mode === 'own_file' ? (!pdf ? 'Choose the PDF of your invoice.' : !(n(total) ?? 0) ? 'Write the total on your invoice.' : !fixed && !(n(hours) ?? 0) ? 'Write the hours on your invoice.' : null)
      : 'Choose how you send your invoice.'
  const ready = !problem && confirmed && !busy

  async function send() {
    if (!ready || !mode) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.set('data', JSON.stringify({
        start, madeBy: mode, confirmed, reimbursementIds: rmb,
        ...(mode === 'own_file' ? { theirNumber, statedHours: n(hours), statedTotal: n(total), covers } : { lines: lines.map(l => ({ description: l.description, client: l.client, hours: l.hours })) }),
      }))
      if (mode === 'own_file' && pdf) fd.set('own_pdf', pdf)
      const res = await fetch('/api/clocky/send-invoice', { method: 'POST', body: fd })
      const r = await res.json().catch(() => null) as { ok: boolean; id?: number; error?: string } | null
      if (!r?.ok || !r.id) { setError(r?.error ?? TRY); setBusy(false); return }
      router.push(withViewAs(`/clocky-hours/invoices/${r.id}`))
      router.refresh()
    } catch {
      setError(TRY); setBusy(false)
    }
  }

  const choice = (key: MadeBy, title: string, sub: string, icon: string) => (
    <button type="button" aria-pressed={mode === key} onClick={() => { setMode(key); setConfirmed(false); setError(null) }}
      className={`text-left rounded-[14px] p-5 flex flex-col gap-2 cursor-pointer transition-colors ${mode === key ? 'border-2 border-tn-teal bg-tn-teal-soft' : 'border-[1.5px] border-[var(--panel-border)] bg-white hover:border-tn-teal'}`}>
      <span className="w-11 h-11 rounded-[12px] bg-tn-teal-soft flex items-center justify-center"><Icon d={icon} size={21} color="#1E7D7F" width={2} /></span>
      <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">{title}</span>
      <span className="text-[13px] text-foreground leading-[1.45]">{sub}</span>
    </button>
  )

  return (
    <div className="flex flex-col gap-5">
      {data.toSend.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Which period">
          {data.toSend.map(p => (
            <button key={p.start} type="button" aria-pressed={p.start === start} onClick={() => { setStart(p.start); setRows(startRows(p, data)); setRmb((p.returned?.reimbursements ?? []).map(r => r.id)); setConfirmed(false) }}
              className={p.start === start ? BTN.smallNavy : BTN.smallWhite}>{p.label}</button>
          ))}
        </div>
      )}

      {period.returned && (
        <div className="rounded-[12px] bg-[#fdf8e7] px-4 py-3 text-[13.5px] text-[#6b5414]">
          <b>Your invoice {period.returned.number} was sent back.</b>{period.returned.reason ? ` "${period.returned.reason}"` : ''} Fix it and send it again: it keeps its number.
        </div>
      )}

      <div className={`${CARD} p-6 flex flex-col gap-5`}>
        <div>
          <h2 className={SECTION_TITLE}>Send your invoice for {period.label}</h2>
          <p className="m-0 mt-1 text-[13.5px] text-foreground leading-[1.5]">Your invoice is yours: you make it and you send it. True North checks it against your {period.kind === 'fixed_no_timesheet' ? 'amount on file' : 'approved hours'} and pays what it says once they match.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {choice('own_file', 'Upload my own invoice', 'The invoice you made in your own tool, as a PDF. You type its total and hours so it can be checked.', 'M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3')}
          {choice('builder', 'Build it here', fixed ? 'One line with your amount on file, and any reimbursement. The portal makes the PDF.' : 'Your lines come from your sent timesheet, at the rate in your contract. Check the hours, add any reimbursement, and the portal makes the PDF.', 'M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 8h6M9 12h6M9 16h3')}
        </div>
      </div>

      {mode && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
          <div className={`${CARD} p-6 flex flex-col gap-4`}>
            {mode === 'own_file' ? (
              <>
                <input ref={pdfInput} type="file" accept="application/pdf" className="hidden" onChange={e => { pickPdf(e.target.files?.[0]); e.target.value = '' }} />
                {pdf ? (
                  <div className="flex items-center justify-between gap-3 rounded-[12px] border-[1.5px] border-dashed border-[#b3bcc8] bg-subtle px-4 py-3">
                    <span className="min-w-0"><b className="block text-[14px] text-tn-ink truncate">{pdf.name}</b><span className="text-[12.5px] text-muted">{Math.round(pdf.size / 1024)} KB · PDF only, up to 10 MB</span></span>
                    <button type="button" onClick={() => pdfInput.current?.click()} className={BTN.smallWhite}>Choose another</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => pdfInput.current?.click()} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickPdf(e.dataTransfer.files?.[0]) }}
                    className="rounded-[12px] border-[1.5px] border-dashed border-[#cdd5e0] bg-white px-4 py-5 text-center text-[13.5px] text-muted cursor-pointer hover:border-tn-teal">
                    <b className="text-tn-teal">Choose your PDF</b> or drop it here
                  </button>
                )}
                <div className={`grid grid-cols-1 ${fixed ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-3`}>
                  <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Your invoice number</span><input value={theirNumber} onChange={e => setTheirNumber(e.target.value)} maxLength={60} className={INPUT} /></label>
                  {!fixed && <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Hours on it</span><input value={hours} onChange={e => setHours(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${INPUT} tabular-nums`} /></label>}
                  <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>Total (USD)</span><input value={total} onChange={e => setTotal(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${INPUT} tabular-nums`} /></label>
                </div>
                {fixed && <label className="flex flex-col gap-1.5"><span className={FIELD_LABEL}>What it covers (optional)</span><input value={covers} onChange={e => setCovers(e.target.value)} maxLength={500} className={INPUT} /></label>}
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h3 className={CARD_TITLE}>Your lines</h3>
                  {!fixed && period.timesheet.length > 0 && (
                    <button type="button" onClick={fillFromTimesheet} className={BTN.smallWhite}><Icon d={ICON.plus} size={13} color={BTN_ICON.white} width={2.6} />Use my timesheet hours</button>
                  )}
                </div>
                {missing && <div role="alert" className="rounded-[12px] bg-[#fdf8e7] px-4 py-3 text-[13.5px] text-[#6b5414]">{missing}</div>}
                {fixed ? (
                  <>
                    <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_130px] gap-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted">
                      <span>What it covers</span><span className="text-right">Amount</span>
                    </div>
                    {rows.slice(0, 1).map(r => (
                      <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,2fr)_130px] gap-2.5 items-center">
                        <input aria-label="What it covers" value={r.description} onChange={e => setRow(r.key, { description: e.target.value })} maxLength={200}
                          placeholder={`Fixed monthly amount, ${period.label}`} className={INPUT} />
                        <span className="text-right font-bold text-tn-ink tabular-nums">{pay.kind === 'fixed' && pay.amount != null ? usd(pay.amount) : '-'}</span>
                      </div>
                    ))}
                    <p className="m-0 text-[12.5px] text-muted">{AMOUNT_NOTE}</p>
                  </>
                ) : (
                  <>
                    <div className="hidden sm:grid grid-cols-[minmax(0,2fr)_90px_90px_110px_28px] gap-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted">
                      <span>What it covers</span><span className="text-right">Hours</span><span className="text-right">Rate</span><span className="text-right">Amount</span><span />
                    </div>
                    {rows.map((r, i) => {
                      const amt = lineAmount(toLine(r, pay))
                      return (
                        <div key={r.key} className="grid grid-cols-[minmax(0,1fr)_28px] sm:grid-cols-[minmax(0,2fr)_90px_90px_110px_28px] gap-2.5 items-center">
                          <input aria-label={`Line ${i + 1}, what it covers`} value={r.description} onChange={e => setRow(r.key, { description: e.target.value })} maxLength={200}
                            placeholder={`Client, ${period.label}`} className={`${INPUT} col-span-1`} />
                          <button type="button" aria-label={`Remove line ${i + 1}`} onClick={() => setRows(xs => (xs.length > 1 ? xs.filter(x => x.key !== r.key) : [blank(next())]))}
                            className="sm:order-last border-0 bg-transparent text-muted text-[18px] cursor-pointer hover:text-[#c8323d]">×</button>
                          <input aria-label={`Line ${i + 1}, hours`} value={r.hours} onChange={e => setRow(r.key, { hours: e.target.value })} inputMode="decimal" placeholder="Hours" className={`${INPUT} text-right tabular-nums`} />
                          <span aria-label={`Line ${i + 1}, rate`} className="text-right text-tn-ink tabular-nums">{pay.kind === 'hourly' && pay.rate != null ? usd(pay.rate) : '-'}</span>
                          <span className="text-right font-bold text-tn-ink tabular-nums">{amt == null ? '-' : usd(amt)}</span>
                        </div>
                      )
                    })}
                    <button type="button" onClick={() => setRows(xs => [...xs, blank(next())])} className={`${BTN.smallWhite} self-start`}>
                      <Icon d={ICON.plus} size={13} color={BTN_ICON.white} width={2.6} />Add a line
                    </button>
                    <p className="m-0 text-[12.5px] text-muted">{RATE_NOTE}</p>
                  </>
                )}
              </>
            )}

            {offered.length > 0 && (
              <div className="flex flex-col gap-2 pt-3 border-t border-[var(--row-rule)]">
                <span className={FIELD_LABEL}>Reimbursements {mode === 'own_file' ? 'on it' : 'to add'}</span>
                <p className="m-0 text-[12.5px] text-muted">{mode === 'own_file' ? 'Your approved reimbursements waiting for an invoice. Tick the ones your invoice includes.' : 'Your approved reimbursements waiting for an invoice.'}</p>
                {offered.map(r => (
                  <label key={r.id} className="flex items-center gap-2.5 text-[13.5px]">
                    <input type="checkbox" className={CHECKBOX} checked={rmb.includes(r.id)} onChange={e => setRmb(xs => (e.target.checked ? [...xs, r.id] : xs.filter(x => x !== r.id)))} />
                    <span className="flex-1">{r.label}{r.purpose && !r.label.includes(r.purpose) ? `, ${r.purpose}` : ''}</span>
                    <b className="text-tn-ink tabular-nums">{usd(r.amount)}</b>
                  </label>
                ))}
              </div>
            )}

            {mode === 'builder' && (
              <div className="flex justify-between items-baseline pt-3 border-t border-[var(--row-rule)]">
                <b className="text-tn-ink">Total{builtHours ? `, ${builtHours.toFixed(2)} hours` : ''}</b>
                <b className="font-(family-name:--font-display) font-extrabold text-[20px] text-tn-ink tabular-nums">{usd(builtTotal)}</b>
              </div>
            )}

            <label className="flex gap-2.5 items-start rounded-[12px] bg-tn-teal-soft px-4 py-3 text-[13.5px] text-[#12474a] cursor-pointer">
              <input type="checkbox" className={`${CHECKBOX} mt-0.5`} checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />
              <span><b>This is my invoice.</b> {confirmText(mode, period.label).replace(/^This is my invoice\. /, '')}</span>
            </label>
            {error && <div role="alert" className={ERROR_BOX}>{error}</div>}
            {!error && problem && mode && <span className="text-[12.5px] text-muted">{problem}</span>}
            <div className="flex justify-end">
              <button type="button" disabled={!ready} onClick={() => void send()} className={`${BTN.navy} disabled:opacity-45 disabled:cursor-not-allowed`}>{busy ? 'Sending…' : 'Send invoice'}</button>
            </div>
          </div>

          {period.timesheet.length > 0 && (
            <aside className={`${CARD} p-5 flex flex-col gap-2.5`}>
              <span className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.12em] uppercase text-tn-teal">For reference</span>
              <b className="text-tn-ink text-[14.5px]">Your sent timesheet, {period.label}</b>
              {period.timesheet.map(c => (
                <div key={c.client} className="flex justify-between text-[13.5px]"><span>{c.client}</span><span className="tabular-nums">{hm(c.seconds)}</span></div>
              ))}
              <div className="flex justify-between text-[13.5px] border-t border-[var(--row-rule)] pt-2"><b className="text-tn-ink">Total</b><b className="text-tn-ink tabular-nums">{hm(period.timesheet.reduce((s, c) => s + c.seconds, 0))}</b></div>
              {(data.rate != null || data.fixedAmount != null) && (
                <p className="m-0 text-[12.5px] text-muted">On file for you: {period.kind === 'hourly' ? `${data.rate != null ? usd(data.rate) : 'no rate'} an hour` : `${data.fixedAmount != null ? usd(data.fixedAmount) : 'no amount'} a month`}. Invoices that match are approved faster.</p>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  )
}
