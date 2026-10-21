// Clocky, Invoices (Clocky part 2, Invoices.dc.html 6E): a contractor's own
// invoices, or every invoice for Super Admins, Admins and Finance. Who gets
// which list is lib/timeclock/invoices-view.ts.

import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { invoiceViewer, loadInvoiceList } from '@/lib/timeclock/invoices-view'
import { InvoicesListLive } from '@/components/clocky/invoices/InvoicesLive'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoices' }

export default async function InvoicesPage() {
  const access = await requireSurface('clocky-invoices')
  const v = await viewerFor(access)
  const data = await loadInvoiceList(invoiceViewer(access, v?.zone ?? 'America/New_York'))
  return <InvoicesListLive data={data} />
}
