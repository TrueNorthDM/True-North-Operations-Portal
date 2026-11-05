'use client'

/**
 * One invoice, Clocky part 2 (Invoices.dc.html 6F): the document on the left,
 * Preview PDF, Mark paid (Finance, approved ones) and the lock on the right,
 * then who made it (owner, 4 November 2026: the contractor makes and sends
 * their own invoice), with its History under them, every version sent included.
 */

import { STATUS_ICON } from '@/lib/ui/status-icons'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import type { InvoiceDetail } from '@/lib/timeclock/invoices-view'
import { Icon, Toast, type ToastState } from '../entries/ui'
import { InvoiceDoc } from './InvoiceDoc'
import { InvoicePdfModal } from './InvoicePdfModal'
import { InvoiceHistory, MarkPaidDialog, STATE_PILL } from './InvoiceParts'
import type { InvoicesApi } from './InvoicesList'
import { PAGE_TITLE, CARD, FIELD_LABEL } from '@/lib/ui/type'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Pill } from '@/components/ui/Pill'
import { DriveBox } from './DriveParts'
import { WhoMadeIt } from './WhoMadeIt'

const EYE = STATUS_ICON.info

export function InvoiceDetailView({ d, api, initial }: {
  d: InvoiceDetail
  api: Pick<InvoicesApi, 'markInvoicePaid' | 'retryDriveCopy'>
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
          <h1 className={PAGE_TITLE}>{d.doc.number}</h1>
          <Pill tone={pill.tone} text={pill.label} />
          <span className="text-[13px] text-muted">{d.who} · {d.doc.period}</span>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_360px] gap-[18px] items-start">
        <div className={`${CARD} overflow-hidden flex flex-col min-w-0`}>
          <InvoiceDoc inv={d.doc} variant="detail" />
        </div>
        <div className="flex flex-col gap-3.5">
          <div className={`${CARD} p-[18px] flex flex-col gap-2.5`}>
            <button type="button" onClick={() => setPdf(true)}
              className={`${BTN.white} justify-center`}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={EYE} /></svg>Preview PDF
            </button>
            {d.canPay && (
              <button type="button" onClick={() => setPay(true)}
                className={`${BTN.navy} justify-center`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Mark paid
              </button>
            )}
            {d.locked && (
              <div className="flex gap-2 items-start text-[12.5px] text-[#5b6b82] leading-[1.5]">
                <Icon d={STATUS_ICON.locked} size={15} className="flex-none mt-0.5" />
                <span>{d.locked}</span>
              </div>
            )}
          </div>
          {/* How it came in (the invoice form, migration 147), and their own PDF to open. */}
          {d.cameFrom && (
            <div className={`${CARD} p-[18px] flex flex-col gap-1.5`}>
              <span className={FIELD_LABEL}>Came from</span>
              <span className="text-[13.5px] text-tn-ink font-semibold">{d.cameFrom}</span>
              {d.ownPdf && <a href={withViewAs(d.ownPdf.href)} target="_blank" rel="noreferrer" className={`${BTN.link} break-all`}>Their own invoice: {d.ownPdf.name}</a>}
            </div>
          )}
          {d.doc.record && <WhoMadeIt who={d.doc.record.who} ownPdf={d.doc.record.madeBy === 'own_file' && !d.cameFrom ? d.ownPdf : null} />}
          {d.drive && <DriveBox data={d.drive} retry={api.retryDriveCopy} say={t => { say(t); if (!t.error) router.refresh() }} />}
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
