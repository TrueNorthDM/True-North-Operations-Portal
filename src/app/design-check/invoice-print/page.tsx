// The invoice PDF's print page with the prototype's INV-2026-0142 (Invoices.dc.html
// 6F-p), so the sheet the PDF route prints can be checked without a database;
// then its record page (owner, 4 November 2026) with made-up people: Jordan
// Lee sent it with the invoice builder, Alex Rivera approved it, Tina Gennette
// marked it paid. ?only=record draws the record alone on Letter, as it follows
// a contractor's own PDF of 3 pages.

import { InvoicePrint } from '@/components/clocky/invoices/InvoicePrint'
import { compareInvoice } from '@/lib/timeclock/contractor-invoice'
import { buildInvoiceRecord, type RecordSource } from '@/lib/timeclock/invoice-record'
import { recordPages } from '@/lib/pdf/invoice-pages'
import { invoiceDetailFrame } from '../clocky-part2/invoice-sample'

const NAMES: Record<string, string> = { jordan: 'Jordan Lee', alex: 'Alex Rivera', tina: 'Tina Gennette' }

/** Jordan Lee's October invoice, from the builder or their own file. */
function sampleRecord(own: boolean) {
  const h = (n: number) => n * 3600
  const src: RecordSource = {
    inv: {
      number: 'INV-2026-061', person_id: 'jordan', submission_id: 61, kind: 'hourly', state: 'paid', source: null,
      period_start: '2026-10-01', period_end: '2026-10-31', created_at: '2026-11-02T14:14:00Z', total: 4096.7,
      paid_on: '2026-11-10', paid_ref: 'WISE-88412', made_by: own ? 'own_file' : 'builder', sent_by: 'jordan',
      sent_at: '2026-11-02T14:14:00Z', sent_from: 'portal',
      confirmed_text: own
        ? 'This is my invoice. I made it and I am sending it to True North for October 2026.'
        : 'This is my invoice. I wrote these lines and I am sending this invoice to True North for October 2026.',
      their_number: '0142', stated_hours: own ? 160.5 : null, stated_total: own ? 4096.7 : null, own_pdf_name: own ? 'Jordan Lee - Invoice 0142.pdf' : null,
    },
    name: 'Jordan Lee',
    sends: [{
      at: '2026-11-02T14:14:00Z', madeBy: own ? 'own_file' : 'builder', sentFrom: 'portal', sentBy: 'jordan', sentEmail: 'jordan.lee@example.com',
      confirmed: '', theirNumber: '0142', statedHours: own ? 160.5 : null, statedTotal: own ? 4096.7 : null, covers: null,
      ownPdfName: own ? 'Jordan Lee - Invoice 0142.pdf' : null, total: 4096.7,
    }],
    events: [
      { step: 'submit', action: 'submit', by_person: 'jordan', at: '2026-11-01T22:02:00Z', note: null },
      { step: 'both', action: 'approve', by_person: 'alex', at: '2026-11-03T15:12:00Z', note: null },
      { step: 'paid', action: 'paid', by_person: 'tina', at: '2026-11-10T19:30:00Z', note: null },
    ],
    lineHours: own ? null : 160.5,
    check: compareInvoice({
      timesheet: [{ client: 'i7 Marketing', seconds: h(96) }, { client: 'COE Group', seconds: h(52.5) }, { client: 'True North Internal', seconds: h(12) }],
      pay: { kind: 'hourly', rate: 25 },
      reimbursements: [{ label: 'RMB-2026-031', amount: 84.2 }],
      invoice: {
        madeBy: own ? 'own_file' : 'builder',
        byClient: own ? [] : [{ client: 'i7 Marketing', seconds: h(96) }, { client: 'COE Group', seconds: h(52.5) }, { client: 'True North Internal', seconds: h(12) }],
        hours: 160.5, total: 4096.7, reimbursements: ['RMB-2026-031'],
      },
    }),
    nameOf: id => (id ? NAMES[id] ?? 'Someone' : 'North Time'),
    zone: 'America/New_York',
  }
  return buildInvoiceRecord(src)
}

export default async function InvoicePrintCheck({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const only = (await searchParams).only === 'record'
  const d = invoiceDetailFrame('6Fp')
  const record = sampleRecord(only)
  // The sample sheet in Jordan Lee's name, so both pages tell one story.
  const doc = { ...d.doc, number: record.number, from: { ...d.doc.from, name: 'Jordan Lee', email: 'jordan.lee@example.com' }, record, foot: { line: record.footLine, page: recordPages(null).first } }
  return only
    ? <InvoicePrint doc={doc} only="record" ownPages={3} paper="letter" />
    : <InvoicePrint doc={doc} />
}
