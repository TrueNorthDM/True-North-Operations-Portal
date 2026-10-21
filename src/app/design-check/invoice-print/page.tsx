// The invoice PDF's print page with the prototype's INV-2026-0142 (Invoices.dc.html
// 6F-p), so the sheet the PDF route prints can be checked without a database.

import { InvoiceDoc } from '@/components/clocky/invoices/InvoiceDoc'
import { invoiceDetailFrame } from '../clocky-part2/invoice-sample'

export default function InvoicePrintCheck() {
  const d = invoiceDetailFrame('6Fp')
  return (
    <div className="print-doc bg-white w-[620px] [&>div]:min-h-[877px]">
      <InvoiceDoc inv={d.doc} variant="page" />
    </div>
  )
}
