// Clocky, Invoices (Clocky part 2, Invoices.dc.html 6E): a contractor's own
// invoices, or every invoice for Super Admins, Admins and Finance. Who gets
// which list is lib/timeclock/invoices-view.ts.

import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { invoiceViewer, loadInvoiceList } from '@/lib/timeclock/invoices-view'
import { InvoicesListLive } from '@/components/clocky/invoices/InvoicesLive'
import { requireNorthTimeOpen } from '@/lib/timeclock/north-time-gate'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoices' }

const STATES = ['all', 'wait', 'appr', 'paid', 'draft'] as const

/** ?state=appr opens on the approved ones: Home's "Invoices to pay" line links here (owner, 25 October 2026). */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  await requireNorthTimeOpen()
  const { state } = await searchParams
  const access = await requireSurface('clocky-invoices')
  const v = await viewerFor(access)
  const data = await loadInvoiceList(invoiceViewer(access, v?.zone ?? 'America/New_York'))
  return <InvoicesListLive data={data} st={STATES.find(x => x === state)} />
}
