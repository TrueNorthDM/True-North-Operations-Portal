'use client'

/** Invoices on the live pages: the list and one invoice over invoices/actions.ts. */

import { getInvoiceDoc, markInvoicePaid } from '@/app/(app)/clocky-hours/invoices/actions'
import type { InvoiceDetail, InvoiceList } from '@/lib/timeclock/invoices-view'
import { InvoiceDetailView } from './InvoiceDetailView'
import { InvoicesList } from './InvoicesList'

export function InvoicesListLive({ data }: { data: InvoiceList }) {
  return <InvoicesList data={data} api={{ getInvoiceDoc, markInvoicePaid }} />
}

export function InvoiceDetailLive({ d, submitted }: { d: InvoiceDetail; submitted: boolean }) {
  return <InvoiceDetailView d={d} api={{ markInvoicePaid }} initial={submitted ? { toast: `${d.doc.period.split(' ')[0]} submitted. Invoice ${d.doc.number} is waiting for approval with it.` } : undefined} />
}
