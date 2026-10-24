'use client'

/**
 * A reimbursement document (Clocky part 2, Requests.dc.html 9D): an
 * employee's approved items, each with its receipt, for Finance to pay outside
 * Rippling payroll. Preview PDF opens the preview first (9D-p); Mark paid is
 * Finance's, once.
 */

import { Fragment, useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { RmbDocPage } from '@/lib/timeclock/requests-data'
import type { DocSheetData } from '@/lib/timeclock/pay-docs'
import type { Result } from '@/lib/timeclock/clocky-types'
import { DocPdfModal } from '@/components/clocky/invoices/InvoicePdfModal'
import { InvoiceHistory, MarkPaidDialog } from '@/components/clocky/invoices/InvoiceParts'
import { Icon, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { REQ_TONE } from './ReimbursementsView'

export interface RmbDocApi {
  getPayDoc(i: { kind: 'rmb'; id: number }): Promise<Result<{ doc: DocSheetData }>>
  markRmbPaid(i: { id: number; paidOn: string; ref?: string; note?: string }): Promise<Result<{ toast: string }>>
}

const EYE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
const COLS = 'grid grid-cols-[100px_110px_minmax(0,1fr)_90px_100px] gap-2.5'

export function RmbDocView({ d, api, initial }: { d: RmbDocPage; api: RmbDocApi; initial?: { pdf?: DocSheetData; pay?: boolean; /** The design check: no receipt files behind it. */ sample?: boolean } }) {
  const router = useRouter()
  const [pdf, setPdf] = useState<DocSheetData | null>(initial?.pdf ?? null)
  const [pay, setPay] = useState(!!initial?.pay && d.canPay)
  const [toast, setToast] = useState<ToastState | null>(null)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }
  const openPdf = async () => {
    try {
      const r = await api.getPayDoc({ kind: 'rmb', id: d.id })
      if (r.ok) setPdf(r.doc)
      else say({ text: r.error, error: true })
    } catch {
      say({ text: 'That did not go through. Check your connection and try again.', error: true })
    }
  }
  const tone = REQ_TONE[d.st.tone]

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/requests', { href: '/requests/reimbursements', label: 'Reimbursements' }]} now={d.number} />
        <div className="flex items-center gap-3.5 flex-wrap mt-1.5">
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[1.15] text-tn-ink" style={{ letterSpacing: '-.01em' }}>{d.number}</h1>
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.05em] uppercase whitespace-nowrap rounded-full px-[11px] py-[5px]" style={{ background: tone.bg, color: tone.fg }}>{d.st.label}</span>
        </div>
        <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">{d.who} · {d.items.length} approved item{d.items.length === 1 ? '' : 's'} · made by the portal for Finance to pay.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-[18px] items-start">
        <div className="bg-white border border-[var(--panel-border)] rounded-[16px] px-4 py-5 md:px-[34px] md:py-[30px] flex flex-col gap-[22px] min-w-0">
          {/* On a phone the paper stacks: the date under the title, Pay to over From, each item as a short block. */}
          <div className="flex flex-col md:flex-row md:justify-between items-start gap-3 md:gap-4">
            <div>
              <div className="font-(family-name:--font-display) font-black text-[28px] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Reimbursement</div>
              <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-teal mt-0.5">{d.number}</div>
            </div>
            <div className="grid grid-cols-[auto_auto] gap-x-4 gap-y-[5px] text-[13px] md:text-right tabular-nums lining-nums">
              <span className="text-muted">Date</span><span className="text-tn-ink font-semibold">{d.date}</span>
              <span className="text-muted">Items</span><span className="text-tn-ink font-semibold">{d.items.length}</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-[13px] leading-[1.6] text-foreground">
            <div><div className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted mb-1">Pay to</div><div className="text-tn-ink font-bold text-[14px]">{d.who}</div><div>{d.team} · US Employee</div><div>Paid by Finance, outside Rippling payroll</div></div>
            <div><div className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted mb-1">From</div><div className="text-tn-ink font-bold text-[14px]">{d.billing.name}</div><div>{d.billing.line1}</div><div>{d.billing.line2}</div></div>
          </div>
          <div className="flex flex-col">
            <div className={`hidden md:grid ${COLS} py-[9px] border-b border-[var(--panel-border)] font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted`}><span>Date</span><span>Category</span><span>What it was for</span><span>Receipt</span><span className="text-right">Amount</span></div>
            {d.items.map(i => (
              <Fragment key={i.id}>
              <div className="md:hidden flex flex-col gap-1 py-3 border-b border-[var(--row-rule)] text-[13px] tabular-nums lining-nums">
                <div className="flex items-baseline justify-between gap-3"><span className="text-tn-ink font-semibold">{i.what}</span><span className="text-tn-ink font-bold whitespace-nowrap">{i.amount}</span></div>
                <span className="text-[12px] text-muted">{i.date} · {i.category}</span>
                <a href={withViewAs(`/requests/reimbursements/receipt/${i.id}`)} target="_blank" rel="noreferrer" className="self-start inline-flex items-start gap-1 text-[12px] font-bold text-tn-teal min-w-0"><Icon d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6" size={12} width={2.2} className="flex-none mt-px" /><span className="[overflow-wrap:anywhere] leading-[1.35]">{i.file}</span></a>
              </div>
              <div className={`hidden md:grid ${COLS} py-[11px] border-b border-[var(--row-rule)] text-[13px] items-center tabular-nums lining-nums text-foreground`}>
                <span className="text-tn-ink font-semibold">{i.date}</span><span>{i.category}</span><span className="text-tn-ink font-semibold">{i.what}</span>
                <a href={withViewAs(`/requests/reimbursements/receipt/${i.id}`)} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[12px] font-bold text-tn-teal min-w-0"><Icon d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6" size={12} width={2.2} className="flex-none mt-px" /><span className="[overflow-wrap:anywhere] leading-[1.35]">{i.file}</span></a>
                <span className="text-right text-tn-ink font-bold">{i.amount}</span>
              </div>
              </Fragment>
            ))}
            <div className="flex justify-between items-baseline pt-4"><span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Total</span><span className="font-(family-name:--font-display) font-black text-[28px] text-tn-ink tabular-nums lining-nums">{d.total}</span></div>
          </div>
          <div className="text-[12.5px] text-muted leading-[1.55]">Every item was approved by a Super Admin and has its receipt. Each item is paid once: once this document is paid, its items show Paid in {d.first}&apos;s Reimbursements.</div>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="bg-white border border-[var(--panel-border)] rounded-[16px] p-[18px] flex flex-col gap-2.5">
            <button type="button" onClick={() => void openPdf()} className="inline-flex items-center justify-center gap-2 border border-slate-200 rounded-[10px] px-4 py-[11px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">
              <Icon d={EYE} size={15} color={BTN_ICON.white} width={2.2} />Preview PDF
            </button>
            {d.canPay && (
              <button type="button" onClick={() => setPay(true)} className="inline-flex items-center justify-center gap-2 border-0 rounded-[10px] px-4 py-3 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b]">
                <Icon d="M5 12l5 5 9-10" size={14} color={BTN_ICON.navy} width={3} />Mark paid
              </button>
            )}
            <div className="text-[12px] text-muted leading-[1.5]">{d.payNote}</div>
          </div>
          <InvoiceHistory items={d.history} />
        </div>
      </div>

      {pdf && <DocPdfModal kind="rmb" id={d.id} doc={pdf} files={!initial?.sample} onClose={() => setPdf(null)} onDownloaded={name => say({ text: `Downloaded ${name}` })} />}
      {pay && <MarkPaidDialog target={{ id: d.id, number: d.number, ...d.pay }} onClose={() => setPay(false)} save={api.markRmbPaid}
        refPlaceholder="e.g. ACH-20261103" notePlaceholder="" note={null}
        onSaved={t => { setPay(false); say({ text: t }); router.refresh() }} />}
      <Toast toast={toast} />
    </div>
  )
}
