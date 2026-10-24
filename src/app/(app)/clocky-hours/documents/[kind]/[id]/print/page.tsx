// The page the document PDF route renders headless (Company Settings.dc.html
// 10P): a payroll summary (kind payroll, a submission id) or a reimbursement
// document (kind rmb). Open to the person, Super Admins, Admins and Finance
// (lib/timeclock/pay-docs.ts); never Team Leaders. A reimbursement
// document's receipts follow it, a page each (9D-p); the PDF maker draws the
// PDF receipts into their boxes.

import { notFound } from 'next/navigation'
import { loadAccess } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { docSurface, loadDoc } from '@/lib/timeclock/pay-docs'
import { DocSheet } from '@/components/clocky/invoices/DocSheet'
import { ReceiptPages } from '@/components/clocky/invoices/ReceiptPages'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Document' }

export default async function DocPrintPage({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<{ _vs?: string }> }) {
  const { kind, id } = await params
  const { _vs: vs } = await searchParams
  // The page that opens it first (Time entries, or Requests for a reimbursement document), then the money rule (pay-docs.ts).
  const access = await loadAccess()
  if ((kind !== 'payroll' && kind !== 'rmb') || !/^\d+$/.test(id) || !access.can(docSurface(kind))) notFound()
  const v = await viewerFor(access)
  const doc = await loadDoc(access, kind, Number(id), v?.zone ?? 'America/New_York')
  if (!doc) notFound()
  // A4 is 620 by 876.9 at the preview's width: the sheet fills it, the footer at the bottom.
  // The receipts load with the same cookies, and the View Stage preview if there is one.
  const src = (r: { id: number }) => `/requests/reimbursements/receipt/${r.id}${vs ? `?_vs=${encodeURIComponent(vs)}` : ''}`
  return (
    <div className="print-doc bg-white w-[620px] [&>div:first-child]:min-h-[876px]">
      <DocSheet doc={doc} />
      <ReceiptPages doc={doc} src={src} print />
    </div>
  )
}
