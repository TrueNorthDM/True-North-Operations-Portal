// One invoice (Clocky part 2, Invoices.dc.html 6F): the document, Preview PDF,
// Mark paid for Finance, and its history. Open to the person, Super Admins,
// Admins and Finance (lib/timeclock/invoices-view.ts); never Team Leaders.

import { notFound } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { invoiceViewer, loadInvoiceDetail } from '@/lib/timeclock/invoices-view'
import { InvoiceDetailLive } from '@/components/clocky/invoices/InvoicesLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoices' }

export default async function InvoicePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ submitted?: string }> }) {
  const { id } = await params
  const { submitted } = await searchParams
  const access = await requireSurface('clocky-invoices')
  if (!/^\d+$/.test(id)) notFound()
  const v = await viewerFor(access)
  const d = await loadInvoiceDetail(invoiceViewer(access, v?.zone ?? 'America/New_York'), Number(id))
  // Closed and missing look the same.
  if (!d) notFound()
  // Just submitted from Time entries (6A): the toast says the invoice waits with the hours.
  return <InvoiceDetailLive d={d} submitted={submitted === '1'} />
}
