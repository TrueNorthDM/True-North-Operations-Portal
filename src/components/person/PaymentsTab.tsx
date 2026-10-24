'use client'

/**
 * The Payments tab of a person's page (Clocky part 2, Company Settings.dc.html
 * 10P-1, 10P-2, 10P-3): three cards, then two tables (invoices and
 * reimbursements for a contractor; pay periods and reimbursement documents for
 * an employee). Each row's PDF opens the preview window first.
 */

import { useState } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { PaymentsData, PaymentsRow, PayTone } from '@/lib/timeclock/payments-view'
import type { DocKind, DocSheetData } from '@/lib/timeclock/pay-docs'
import type { InvoiceDocView } from '@/lib/timeclock/invoice-doc'
import type { Result } from '@/lib/timeclock/clocky-types'
import { DocPdfModal, InvoicePdfModal } from '@/components/clocky/invoices/InvoicePdfModal'
import { Toast, type ToastState } from '@/components/clocky/entries/ui'

export interface PaymentsApi {
  getInvoiceDoc(i: { id: number }): Promise<Result<{ doc: InvoiceDocView }>>
  getPayDoc(i: { kind: DocKind; id: number }): Promise<Result<{ doc: DocSheetData }>>
}

/** Company Settings.dc.html T: the pills' colours. */
const TONE: Record<PayTone, { bg: string; fg: string }> = {
  ok: { bg: '#e6f6ee', fg: '#0d7a4f' }, warn: { bg: '#fdf8e7', fg: '#8a6d1a' }, bad: { bg: '#fdeeef', fg: '#c8323d' },
  neu: { bg: '#f1f3f6', fg: '#5b6b82' }, teal: { bg: '#eaf4f4', fg: '#1E7D7F' }, navy: { bg: '#e8effa', fg: '#1e40af' },
}
const COLS = 'grid grid-cols-[minmax(160px,1.2fr)_minmax(110px,.8fr)_90px_100px_190px_minmax(150px,1.2fr)_80px]'
const EYE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'

type Open = { kind: 'invoice'; doc: InvoiceDocView } | { kind: DocKind; id: number; doc: DocSheetData }

export function PaymentsTab({ data, api, initial }: { data: PaymentsData; api: PaymentsApi; initial?: Open }) {
  const [open, setOpen] = useState<Open | null>(initial ?? null)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }

  const pdf = async (r: PaymentsRow) => {
    if (!r.doc) return
    setBusy(r.key)
    const d = r.doc
    try {
      const res = d.kind === 'invoice' ? await api.getInvoiceDoc({ id: d.id }) : await api.getPayDoc({ kind: d.kind, id: d.id })
      if (!res.ok) return say({ text: res.error, error: true })
      setOpen(d.kind === 'invoice' ? { kind: 'invoice', doc: res.doc as InvoiceDocView } : { kind: d.kind, id: d.id, doc: res.doc as DocSheetData })
    } catch {
      say({ text: 'That did not go through. Check your connection and try again.', error: true })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {data.cards.map(c => (
          <div key={c.label} className="bg-white border border-[var(--panel-border)] rounded-[14px] px-[18px] py-[15px] flex flex-col gap-[5px] min-w-0">
            <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{c.label}</span>
            <span className="font-(family-name:--font-display) font-black text-[24px] whitespace-nowrap tabular-nums lining-nums" style={{ color: c.fg }}>{c.val}</span>
            <span className="text-[12.5px] text-muted tabular-nums lining-nums">{c.sub}</span>
          </div>
        ))}
      </div>
      {data.tables.map(t => (
        <div key={t.title} className="bg-white border border-[var(--panel-border)] rounded-[16px] overflow-hidden">
          <div className="flex items-baseline gap-2.5 px-[18px] py-3.5 border-b border-[var(--panel-border)] flex-wrap">
            <span className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink whitespace-nowrap">{t.title}</span>
            <span className="flex-[1_1_300px] text-[12.5px] text-muted">{t.sub}</span>
          </div>
          <div className="overflow-x-auto">
            <div>
              <div className={`${COLS} bg-subtle border-b border-[var(--panel-border)]`}>
                {t.heads.map((h, i) => <div key={i} className={`px-3.5 py-[9px] font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted whitespace-nowrap ${h.right ? 'text-right' : ''}`}>{h.label}</div>)}
              </div>
              {t.rows.map(r => (
                <div key={r.key} className={`${COLS} items-center border-b border-[var(--row-rule)] text-[13px] tabular-nums lining-nums hover:bg-[#f8f7f3]`}>
                  <div className="px-3.5 py-[11px] font-(family-name:--font-display) font-extrabold text-tn-ink min-w-0 truncate" title={r.c1}>{r.c1}</div>
                  <div className="px-3.5 py-[11px] text-foreground whitespace-nowrap">{r.c2}</div>
                  <div className="px-3.5 py-[11px] text-foreground whitespace-nowrap">{r.c3}</div>
                  <div className="px-3.5 py-[11px] text-right font-(family-name:--font-display) font-extrabold text-tn-ink whitespace-nowrap">{r.c4}</div>
                  <div className="px-3.5 py-[11px]">
                    <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase whitespace-nowrap rounded-full px-[9px] py-1" style={{ background: TONE[r.st.tone].bg, color: TONE[r.st.tone].fg }}>{r.st.label}</span>
                  </div>
                  <div className="px-3.5 py-[11px] text-foreground text-[12.5px] leading-[1.45]">{r.c5}</div>
                  <div className="px-3.5 py-2 flex justify-end">
                    {r.doc && (
                      <button type="button" disabled={busy === r.key} onClick={() => void pdf(r)} aria-label={`Preview the PDF of ${r.c1}`}
                        className="inline-flex items-center gap-1.5 border border-slate-200 rounded-[9px] px-[11px] py-1.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12px] cursor-pointer hover:border-tn-teal disabled:opacity-60">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={EYE} /></svg>PDF
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!t.rows.length && <div className="px-[18px] py-6 text-[13px] text-muted">{t.empty}</div>}
            </div>
          </div>
        </div>
      ))}
      <div className="text-[12px] text-muted leading-[1.5]">{data.note}</div>
      {open?.kind === 'invoice' && <InvoicePdfModal invoice={open.doc} onClose={() => setOpen(null)} onDownloaded={name => say({ text: `Downloaded ${name}` })} />}
      {open && open.kind !== 'invoice' && <DocPdfModal kind={open.kind} id={open.id} doc={open.doc} onClose={() => setOpen(null)} onDownloaded={name => say({ text: `Downloaded ${name}` })} />}
      <Toast toast={toast} />
    </div>
  )
}
