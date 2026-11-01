'use client'

/** Invoices on the live pages: the list and one invoice over invoices/actions.ts. */

import { getInvoiceDoc, markInvoicePaid } from '@/app/(app)/clocky-hours/invoices/actions'
import { retryDriveCopy } from '@/app/(app)/admin/settings/clocky-actions'
import type { InvoiceDetail, InvoiceList } from '@/lib/timeclock/invoices-view'
import { InvoiceDetailView } from './InvoiceDetailView'
import { InvoicesList, type StFilter } from './InvoicesList'

export function InvoicesListLive({ data, st, extra }: { data: InvoiceList; st?: StFilter; extra?: React.ReactNode }) {
  return <InvoicesList data={data} api={{ getInvoiceDoc, markInvoicePaid, retryDriveCopy }} initial={st ? { st } : undefined} extra={extra} />
}

export function InvoiceDetailLive({ d, submitted, retry }: { d: InvoiceDetail; submitted: boolean; retry: boolean }) {
  return <InvoiceDetailView d={d} api={{ markInvoicePaid, retryDriveCopy: retry ? retryDriveCopy : undefined }} initial={submitted ? { toast: `${d.doc.period.split(' ')[0]} submitted. Invoice ${d.doc.number} is waiting for approval with it.` } : undefined} />
}
