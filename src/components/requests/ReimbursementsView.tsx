'use client'

/**
 * Reimbursements (Clocky part 2, Requests.dc.html):
 *
 *   9B   My reimbursements: each request with where it is (waiting, on an
 *        invoice, on a reimbursement document, paid, denied); an employee's
 *        open document is a card that opens it
 *   9A   New reimbursement: the receipt (required), the date, the category,
 *        the amount and currency, what it was for, the client and whether it
 *        is billable; what happens after, for a contractor or an employee
 */

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN_ICON } from '@/lib/ui/buttons'
import { MON, parsePaidOn } from '@/lib/timeclock/paid-on'
import type { ReimbursementsPage, ReqTone } from '@/lib/timeclock/requests-data'
import { CloseButton, FieldLabel, Icon, LabeledSelect, Modal, MODAL_TITLE, TEXTAREA_PLAIN, Toast, type ToastState } from '@/components/clocky/entries/ui'

export const REQ_TONE: Record<ReqTone, { bg: string; fg: string }> = {
  ok: { bg: '#e6f6ee', fg: '#0d7a4f' }, warn: { bg: '#fdf8e7', fg: '#8a6d1a' }, bad: { bg: '#fdeeef', fg: '#c8323d' },
  neu: { bg: '#f1f3f6', fg: '#5b6b82' }, teal: { bg: '#eaf4f4', fg: '#1E7D7F' }, navy: { bg: '#e8effa', fg: '#1e40af' },
}
const PILL = 'font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1 whitespace-nowrap'
const COLS = 'grid grid-cols-[130px_130px_minmax(220px,1fr)_110px_120px_minmax(220px,1fr)]'
const RECEIPT = 'M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6'
const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] text-tn-ink outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)] tabular-nums lining-nums'
export const CATEGORIES = ['Internet', 'Software', 'Equipment', 'Travel', 'Meals with a client', 'Other']
const CURRENCIES = ['USD', 'KES', 'RWF']

export type SendReimbursement = (form: FormData) => Promise<{ ok: true } | { ok: false; error: string }>

/** The live sender: the form goes to the route that stores the receipt. */
export const sendReimbursement: SendReimbursement = async form => {
  try {
    const res = await fetch(withViewAs('/requests/reimbursements/new'), { method: 'POST', body: form })
    const body = await res.json().catch(() => null) as { ok: boolean; error?: string } | null
    return body?.ok ? { ok: true } : { ok: false, error: body?.error ?? 'Not saved. Try again in a moment.' }
  } catch {
    return { ok: false, error: 'Not saved. Check the connection and try again.' }
  }
}

export function ReimbursementsView({ data, send, initial }: { data: ReimbursementsPage; send: SendReimbursement; initial?: { form?: boolean; draft?: Partial<Draft> } }) {
  const router = useRouter()
  const [form, setForm] = useState(!!initial?.form)
  const [toast, setToast] = useState<ToastState | null>(null)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }
  const sub = data.contractor
    ? 'Ask for money you spent for work, with the receipt. Approved, it goes on your next invoice by itself.'
    : 'Ask for money you spent for work, with the receipt. Approved, Finance pays it with a reimbursement document.'

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/requests']} now="Reimbursements" />
        <div className="flex items-center justify-between gap-3.5 flex-wrap mt-1.5">
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[1.15] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Reimbursements</h1>
          <button type="button" onClick={() => setForm(true)} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] shadow-[0_6px_16px_-8px_rgba(1,35,88,.55)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>New request
          </button>
        </div>
        <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">{sub}</p>
      </div>

      {data.doc && (
        <button type="button" onClick={() => router.push(withViewAs(`/requests/reimbursements/${data.doc!.id}`))}
          className="text-left flex items-center gap-3.5 bg-white border border-[var(--panel-border)] rounded-[14px] px-[18px] py-3.5 cursor-pointer hover:border-tn-teal">
          <span className="w-[38px] h-[38px] rounded-[11px] bg-tn-teal-soft text-tn-teal flex items-center justify-center flex-none"><Icon d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" size={18} /></span>
          <span className="flex-1 flex flex-col gap-0.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Reimbursement document {data.doc.number}</span>
            <span className="text-[12.5px] text-muted">Approved items waiting for Finance to pay. Opens the document and its PDF.</span>
          </span>
          <Icon d="M9 6l6 6-6 6" size={16} color="#a3aebb" />
        </button>
      )}

      {data.rows.length > 0 ? (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-auto">
          <div className="min-w-[880px]">
            <div className={`${COLS} bg-subtle border-b border-[var(--panel-border)]`}>
              {['Date', 'Category', 'What it was for', 'Amount', 'State', 'Where it is'].map((h, i) => (
                <div key={h} className={`px-3.5 py-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted ${i === 3 ? 'text-right' : ''}`}>{h}</div>
              ))}
            </div>
            {data.rows.map(r => (
              <div key={r.id} className={`${COLS} items-center border-b border-[var(--row-rule)] text-[13px] tabular-nums lining-nums hover:bg-[#f8f7f3]`}>
                <div className="px-3.5 py-3 text-tn-ink font-semibold whitespace-nowrap">{r.date}</div>
                <div className="px-3.5 py-3 text-foreground">{r.category}</div>
                <div className="px-3.5 py-3 flex items-center gap-2 min-w-0">
                  <span className="text-tn-ink font-semibold">{r.what}</span>
                  {r.hasReceipt && (
                    <a href={withViewAs(`/requests/reimbursements/receipt/${r.id}`)} target="_blank" rel="noreferrer" title="Receipt attached" aria-label="Open the receipt" className="inline-flex text-tn-teal">
                      <Icon d={RECEIPT} size={13} width={2.2} />
                    </a>
                  )}
                </div>
                <div className="px-3.5 py-3 text-right font-(family-name:--font-display) font-extrabold text-tn-ink">{r.amount}</div>
                <div className="px-3.5 py-3"><span className={PILL} style={{ background: REQ_TONE[r.st.tone].bg, color: REQ_TONE[r.st.tone].fg }}>{r.st.label}</span></div>
                <div className="px-3.5 py-3 text-[#5b6b82] text-[12.5px] leading-[1.45] [text-wrap:pretty]">{r.info}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-11 text-center text-[13.5px] text-muted">No reimbursement requests yet. Decisions on other people&apos;s requests are in Approvals.</div>
      )}

      {form && <NewReimbursement data={data} draft={initial?.draft} send={send} onClose={() => setForm(false)}
        onSent={() => { setForm(false); say({ text: data.contractor ? 'Sent. Approved, it goes on your next invoice by itself.' : 'Sent. Approved, Finance pays it with a reimbursement document.' }); router.refresh() }} />}
      <Toast toast={toast} />
    </div>
  )
}

interface Draft { file: File | null; fileLabel: string; date: string; category: string; amount: string; currency: string; what: string; client: string; billable: 'yes' | 'no' }

const today = () => { const d = new Date(); return `${MON[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}` }
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

function NewReimbursement({ data, draft, send, onClose, onSent }: { data: ReimbursementsPage; draft?: Partial<Draft>; send: SendReimbursement; onClose: () => void; onSent: () => void }) {
  const [d, setD] = useState<Draft>({ file: null, fileLabel: '', date: today(), category: 'Internet', amount: '', currency: 'USD', what: '', client: 'None', billable: 'no', ...draft })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const set = (p: Partial<Draft>) => setD(x => ({ ...x, ...p }))
  const amountOk = Number(d.amount.replace(/,/g, '')) > 0
  const hasFile = !!d.file || !!d.fileLabel
  const ok = hasFile && amountOk && !!d.what.trim()
  const pickFile = (f: File | undefined | null) => { if (f) set({ file: f, fileLabel: `${f.type === 'application/pdf' ? 'PDF' : 'Photo'}, ${size(f.size)}` }) }

  const submit = async () => {
    if (!ok || !d.file) return
    const day = parsePaidOn(d.date)
    if (!day) { setError('Write the date of the expense, like Oct 31, 2026.'); return }
    const f = new FormData()
    f.set('receipt', d.file)
    f.set('date', day)
    f.set('category', d.category)
    f.set('amount', d.amount)
    f.set('currency', d.currency)
    f.set('purpose', d.what.trim())
    f.set('client', d.client)
    f.set('billable', d.billable)
    setBusy(true)
    setError(null)
    const r = await send(f)
    setBusy(false)
    if (r.ok) onSent()
    else setError(r.error)
  }

  return (
    <Modal label="New reimbursement" width={776} onClose={onClose} gap={16}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE}>New reimbursement</h2>
        <CloseButton onClick={onClose} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] gap-5 items-start">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Receipt (required)</FieldLabel>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/heic,image/heif,image/webp,application/pdf" className="hidden" onChange={e => pickFile(e.target.files?.[0])} />
          {!hasFile ? (
            <button type="button" onClick={() => input.current?.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); pickFile(e.dataTransfer.files?.[0]) }}
              className={`h-[280px] rounded-[12px] bg-[#f8f7f3] border-[1.5px] border-dashed flex flex-col items-center justify-center gap-2.5 cursor-pointer p-4 hover:border-tn-teal ${drag ? 'border-tn-teal' : 'border-[#cbd2da]'}`}>
              <Icon d="M12 16V4M7 9l5-5 5 5M5 20h14" size={30} color={BTN_ICON.white} width={1.8} />
              <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">Drop a photo or PDF here</span>
              <span className="text-[12.5px] text-tn-teal font-bold">or choose a file</span>
            </button>
          ) : (
            <div className="h-[280px] rounded-[12px] bg-subtle border border-[var(--panel-border)] flex flex-col items-center justify-center gap-2 p-4 box-border text-center">
              <Icon d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3" size={32} color="#8593a4" width={1.6} />
              <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink break-all">{d.file?.name ?? 'receipt'}</span>
              <span className="text-[12px] text-muted">{d.fileLabel}</span>
              <button type="button" onClick={() => { set({ file: null, fileLabel: '' }); if (input.current) input.current.value = '' }} className="border-0 bg-transparent cursor-pointer text-[12.5px] font-bold text-[#c8323d]">Remove</button>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3.5 min-w-0">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-[5px]"><FieldLabel>Date of the expense</FieldLabel><input value={d.date} onChange={e => set({ date: e.target.value })} className={INPUT} /></label>
            <LabeledSelect label="Category" value={d.category} onChange={v => set({ category: v })} options={CATEGORIES.map(c => ({ value: c, label: c }))} />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_130px] gap-3">
            <label className="flex flex-col gap-[5px]"><FieldLabel>Amount</FieldLabel><input value={d.amount} onChange={e => set({ amount: e.target.value })} placeholder="0.00" inputMode="decimal" className={INPUT} /></label>
            <LabeledSelect label="Currency" value={d.currency} onChange={v => set({ currency: v })} options={CURRENCIES.map(c => ({ value: c, label: c }))} />
          </div>
          {d.currency !== 'USD' && <div className="text-[12px] text-[#8a6d1a] bg-[var(--warn-bg)] rounded-[9px] px-[11px] py-2 -mt-1.5">Invoices are in USD. Finance converts at the rate of the expense date.</div>}
          <label className="flex flex-col gap-[5px]"><FieldLabel>What it was for</FieldLabel><textarea value={d.what} onChange={e => set({ what: e.target.value })} rows={2} placeholder="e.g. Home internet for October" className={TEXTAREA_PLAIN} /></label>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-end">
            <LabeledSelect label="Client or project (optional)" value={d.client} search onChange={v => set({ client: v, billable: v === 'None' ? 'no' : d.billable })} options={['None', ...data.clients].map(c => ({ value: c, label: c }))} />
            <div className="flex flex-col gap-1.5" style={{ opacity: d.client === 'None' ? 0.45 : 1 }}>
              <FieldLabel>Billable to the client</FieldLabel>
              <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5">
                {([['yes', 'Yes'], ['no', 'No']] as const).map(([k, label]) => (
                  <button key={k} type="button" disabled={d.client === 'None'} aria-pressed={d.billable === k} onClick={() => set({ billable: k })}
                    className={`border-0 rounded-[8px] px-3.5 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] disabled:cursor-default cursor-pointer ${d.billable === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="text-[12.5px] text-tn-teal font-semibold leading-[1.5] bg-tn-teal-soft rounded-[10px] px-3 py-2.5">
            {data.contractor ? 'Approved, it goes on your next invoice by itself. If that invoice is already approved, it goes on the one after.' : 'Approved, the portal puts it on a reimbursement document and Finance pays you, outside Rippling payroll.'}
          </div>
        </div>
      </div>
      {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
      <div className="flex justify-end gap-2 items-center">
        {!ok && <span className="mr-auto text-[12.5px] text-muted">Add the receipt, the amount and what it was for.</span>}
        <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Cancel</button>
        <button type="button" disabled={!ok || busy} onClick={() => void submit()} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-45 disabled:cursor-not-allowed">
          <Icon d="M22 2 11 13M22 2l-7 20-4-9-9-4z" size={14} color={BTN_ICON.navy} width={2.4} />{busy ? 'Sending…' : 'Send request'}
        </button>
      </div>
    </Modal>
  )
}
