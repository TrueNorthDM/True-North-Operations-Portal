'use client'

/**
 * One invoice, Clocky part 2 (Invoices.dc.html 6F): the document on the left,
 * Preview PDF, Mark paid (Finance, approved ones) and the lock on the right,
 * with its History under them.
 */

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { InvoiceDetail } from '@/lib/timeclock/invoices-view'
import { Icon, Toast, type ToastState } from '../entries/ui'
import { InvoiceDoc } from './InvoiceDoc'
import { InvoicePdfModal } from './InvoicePdfModal'
import { InvoiceHistory, MarkPaidDialog, STATE_PILL } from './InvoiceParts'
import type { InvoicesApi } from './InvoicesList'

const EYE = 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'

export function InvoiceDetailView({ d, api, initial }: {
  d: InvoiceDetail
  api: Pick<InvoicesApi, 'markInvoicePaid'>
  /** The design checks open a frame's state. */
  initial?: { pdf?: boolean; pay?: boolean; toast?: string }
}) {
  const router = useRouter()
  const [pdf, setPdf] = useState(!!initial?.pdf)
  const [pay, setPay] = useState(!!initial?.pay && d.canPay)
  const [toast, setToast] = useState<ToastState | null>(initial?.toast ? { text: initial.toast } : null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!initial?.toast) return
    // Said once: a reload does not say it again.
    const u = new URL(window.location.href)
    if (u.searchParams.has('submitted')) { u.searchParams.delete('submitted'); window.history.replaceState(window.history.state, '', u) }
    timer.current = setTimeout(() => setToast(null), 4200)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [initial?.toast])
  const say = (t: ToastState) => {
    if (timer.current) clearTimeout(timer.current)
    setToast(t)
    timer.current = setTimeout(() => setToast(null), 4200)
  }
  const pill = STATE_PILL[d.st]

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] auto-rows-max content-start gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/clocky-hours', { href: '/clocky-hours/invoices', label: 'Invoices' }]} now={d.doc.number} />
        <div className="flex items-center gap-3.5 flex-wrap mt-1.5">
          <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[1.15] text-tn-ink" style={{ letterSpacing: '-.01em' }}>{d.doc.number}</h1>
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.05em] uppercase whitespace-nowrap rounded-full px-[11px] py-[5px]" style={{ background: pill.bg, color: pill.fg }}>{pill.label}</span>
          <span className="text-[13px] text-muted">{d.who} · {d.doc.period}</span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-[18px] items-start">
        <div className="bg-white border border-[var(--panel-border)] rounded-[16px] overflow-hidden flex flex-col min-w-0">
          <InvoiceDoc inv={d.doc} variant="detail" />
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="bg-white border border-[var(--panel-border)] rounded-[16px] p-[18px] flex flex-col gap-2.5">
            <button type="button" onClick={() => setPdf(true)}
              className="inline-flex items-center justify-center gap-2 border border-slate-200 rounded-[10px] px-4 py-[11px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={EYE} /></svg>Preview PDF
            </button>
            {d.canPay && (
              <button type="button" onClick={() => setPay(true)}
                className="inline-flex items-center justify-center gap-2 border-0 rounded-[10px] px-4 py-3 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Mark paid
              </button>
            )}
            {d.locked && (
              <div className="flex gap-2 items-start text-[12.5px] text-[#5b6b82] leading-[1.5]">
                <Icon d="M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4" size={15} className="flex-none mt-0.5" />
                <span>{d.locked}</span>
              </div>
            )}
          </div>
          <InvoiceHistory items={d.history} />
        </div>
      </div>

      {pdf && <InvoicePdfModal invoice={d.doc} onClose={() => setPdf(false)} onDownloaded={name => say({ text: `Downloaded ${name}` })} />}
      {pay && (
        <MarkPaidDialog target={{ id: d.doc.id, ...d.pay, number: d.doc.number }} onClose={() => setPay(false)} save={api.markInvoicePaid}
          onSaved={t => { setPay(false); say({ text: t }); router.refresh() }} />
      )}
      <Toast toast={toast} />
    </div>
  )
}
