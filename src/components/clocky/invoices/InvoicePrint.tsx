/**
 * The invoice's print sheet, the one its PDF is printed from (the download,
 * the preview's Download and the Google Drive copy; Invoices.dc.html 6F-p):
 * the invoice, then its record page (owner, 4 November 2026).
 *
 *   whole         the builder's sheet (or the portal's, before November 2026)
 *                 as page 1 and the record as page 2, both A4
 *   record only   for an invoice that is their own PDF: the record alone, on
 *                 the paper of their file, numbered after its pages; the PDF
 *                 maker puts it after their file (lib/pdf/invoice-pdf.ts)
 *
 * The PDF maker lifts .print-doc out of the page before printing it. A4 at
 * the sheet's 620px is 876.9px tall and US Letter 802.4px: each page is drawn
 * a hair shorter so none runs onto a blank one. No hooks: rendered on the server.
 */

import type { InvoiceDocView } from '@/lib/timeclock/invoice-doc'
import { InvoiceDoc } from './InvoiceDoc'
import { InvoiceRecordSheet } from './InvoiceRecordSheet'
import { recordPages, type Paper } from '@/lib/pdf/invoice-pages'

const HEIGHT: Record<Paper, string> = { a4: 'min-h-[876px]', letter: 'min-h-[802px]' }

export function InvoicePrint({ doc, only, ownPages = null, paper = 'a4' }: {
  doc: InvoiceDocView
  /** Their own file is page 1: print the record alone. */
  only?: 'record'
  /** The pages of their file, for "Page N of N". */
  ownPages?: number | null
  paper?: Paper
}) {
  const r = doc.record
  if (only === 'record') {
    return (
      <div className="print-doc bg-white w-[620px]">
        {r && <InvoiceRecordSheet r={r} page={recordPages(ownPages).record} className={HEIGHT[paper]} />}
      </div>
    )
  }
  return (
    <div className="print-doc bg-white w-[620px]">
      <div className={`${HEIGHT.a4} flex flex-col [&>div]:flex-1 ${r ? 'break-after-page' : ''}`}>
        <InvoiceDoc inv={doc} variant="page" />
      </div>
      {r && <InvoiceRecordSheet r={r} page={recordPages(null).record} className={HEIGHT.a4} />}
    </div>
  )
}
