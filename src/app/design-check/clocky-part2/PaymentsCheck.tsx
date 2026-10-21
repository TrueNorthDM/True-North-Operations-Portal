'use client'

// 10P-1, 10P-2, 10P-3 (Company Settings.dc.html): a person's Payments tab,
// the real PersonPage with the prototype's people. Each PDF button opens the
// preview of the frame's own documents; nothing downloads.

import { PersonPage } from '@/components/person/PersonPage'
import type { PersonPageData } from '@/lib/directory/person-page-data'
import type { PaymentsData } from '@/lib/timeclock/payments-view'
import type { InvoiceDocView } from '@/lib/timeclock/invoice-doc'
import type { DocSheetData } from '@/lib/timeclock/pay-docs'

export function PaymentsCheck({ data, payments, open, docs = {}, invoices = {} }: { data: PersonPageData; payments: PaymentsData; open: InvoiceDocView | null; docs?: Record<string, DocSheetData>; invoices?: Record<number, InvoiceDocView> }) {
  return (
    <PersonPage
      data={{ ...data, rights: { ...data.rights, payments: true } }}
      tab="payments"
      canRemove={false}
      payments={{
        data: payments,
        api: {
          getInvoiceDoc: async ({ id }) => (invoices[id] ? { ok: true, doc: invoices[id] } : { ok: false, error: 'This frame has no invoice to preview.' }),
          getPayDoc: async ({ kind, id }) => (docs[`${kind}:${id}`] ? { ok: true, doc: docs[`${kind}:${id}`] } : { ok: false, error: 'This frame has no document to preview.' }),
        },
        initial: open ? { kind: 'invoice', doc: open } : undefined,
      }}
    />
  )
}
