// The page the invoice PDF route renders headless (Clocky part 2, Invoices.dc.html
// 6F-p): the same InvoiceDoc the preview window shows, on its own, then its
// record page (owner, 4 November 2026). With ?only=record the record alone,
// for an invoice that is their own PDF (lib/pdf/invoice-pdf.ts puts it after
// their file). The route lifts .print-doc out of the app frame before printing it.

import { notFound } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { invoiceViewer, loadInvoiceDetail } from '@/lib/timeclock/invoices-view'
import { printQuery } from '@/lib/pdf/invoice-pages'
import { InvoicePrint } from '@/components/clocky/invoices/InvoicePrint'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoice' }

export default async function InvoicePrintPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  const access = await requireSurface('clocky-invoices')
  if (!/^\d+$/.test(id)) notFound()
  const v = await viewerFor(access)
  const d = await loadInvoiceDetail(invoiceViewer(access, v?.zone ?? 'America/New_York'), Number(id))
  if (!d) notFound()
  const q = printQuery(await searchParams)
  if (q.only && !d.doc.record) notFound()
  return <InvoicePrint doc={d.doc} only={q.only} ownPages={q.ownPages} paper={q.paper} />
}
