// The page the invoice PDF route renders headless (Clocky part 2, Invoices.dc.html
// 6F-p): the same InvoiceDoc the preview window shows, on its own. The route
// lifts .print-doc out of the app frame before printing it.

import { notFound } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { invoiceViewer, loadInvoiceDetail } from '@/lib/timeclock/invoices-view'
import { InvoiceDoc } from '@/components/clocky/invoices/InvoiceDoc'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoice' }

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const access = await requireSurface('clocky-invoices')
  if (!/^\d+$/.test(id)) notFound()
  const v = await viewerFor(access)
  const d = await loadInvoiceDetail(invoiceViewer(access, v?.zone ?? 'America/New_York'), Number(id))
  if (!d) notFound()
  // A4 is 620 by 877 at the preview's width: the sheet fills it, the footer at the bottom.
  return (
    <div className="print-doc bg-white w-[620px] [&>div]:min-h-[877px]">
      <InvoiceDoc inv={d.doc} variant="page" />
    </div>
  )
}
