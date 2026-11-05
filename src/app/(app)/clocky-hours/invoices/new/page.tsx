// Invoices > Send your invoice (leadership, 4 November 2026; mockup "Contractor
// invoices" 1, 2a and 2b): a contractor makes and sends their own invoice, for
// each sent timesheet (or month, with no timesheet) still waiting for one.
// ?start=yyyy-mm-dd opens on that period (from Home and the toast after Submit).

import { notFound } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { requireNorthTimeOpen } from '@/lib/timeclock/north-time-gate'
import { loadInvoicesToSend } from '@/lib/timeclock/send-invoice-data'
import { SendMyInvoice } from '@/components/clocky/invoices/SendMyInvoice'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PAGE_TITLE } from '@/lib/ui/type'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Send your invoice' }

export default async function SendInvoicePage({ searchParams }: { searchParams: Promise<{ start?: string }> }) {
  await requireNorthTimeOpen()
  const access = await requireSurface('clocky-invoices')
  if (!access.personId) notFound()
  const { start } = await searchParams
  const data = await loadInvoicesToSend(access.personId)
  if (!data) notFound()
  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb parents={['/clocky-hours', { href: '/clocky-hours/invoices', label: 'Invoices' }]} now="Send your invoice" />
        <h1 className={PAGE_TITLE}>Send your invoice</h1>
      </div>
      <SendMyInvoice data={data} start={start ?? null} />
    </div>
  )
}
