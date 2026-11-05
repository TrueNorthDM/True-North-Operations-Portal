// The print page the Drive copy renders headless (owner, 31 October 2026): an
// invoice or a reimbursement document, drawn exactly as its own print page
// draws it, for the scheduled copy that has no one signed in. It opens only
// with the server's signed pass for this kind and this id, sent in a request
// header and good for two minutes (lib/drive/print-token.ts); anything else
// is a 404, the same as a document that is not there. The pass is checked
// here, before anything is read; the normal print pages never take it.
//
// Under /api/cron so the proxy lets it through without a session (no cookie
// to read); the root layout only wraps it, and the PDF maker lifts the
// .print-doc out of the page before printing it. The receipts' photos come in
// the page itself, so no receipt address needs the pass.

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { checkPass, PRINT_HEADER } from '@/lib/drive/print-token'
import { loadInvoiceDetail } from '@/lib/timeclock/invoices-view'
import { loadRmbDoc } from '@/lib/timeclock/pay-docs'
import { receiptBytes } from '@/lib/timeclock/receipt-files'
import { receiptShow } from '@/lib/timeclock/receipt-pages'
import { db } from '@/lib/timeclock/clocky-context'
import { mimeOfExt, extOf } from '@/lib/drive/file-names'
import { InvoicePrint } from '@/components/clocky/invoices/InvoicePrint'
import { printQuery } from '@/lib/pdf/invoice-pages'
import { DocSheet } from '@/components/clocky/invoices/DocSheet'
import { ReceiptPages } from '@/components/clocky/invoices/ReceiptPages'
import { ReviewDoc } from '@/components/review/ReviewDoc'
import { loadReviewView } from '@/lib/review/view'
import { loadRoster, reviewToday } from '@/lib/review/data'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Document', robots: { index: false, follow: false } }

/** The copy reads as Finance's records do: every document, in New York's days. */
// The server itself (the signed two-minute pass): it prints any document for Finance's Drive copy.
const SERVER = { personId: null, can: () => true, zone: 'America/New_York' }

export default async function DrivePrintPage({ params, searchParams }: { params: Promise<{ kind: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { kind, id } = await params
  if ((kind !== 'invoice' && kind !== 'rmb' && kind !== 'review') || !/^\d+$/.test(id)) notFound()
  if (!checkPass((await headers()).get(PRINT_HEADER), kind, Number(id))) notFound()

  if (kind === 'review') {
    // The approved annual review (lib/review/service.ts), read as the server: the pass is the check.
    const v = await loadReviewView(Number(id), 'server', await loadRoster())
    if (!v || v.step !== 'approved') notFound()
    return <ReviewDoc v={v} today={reviewToday()} />
  }

  if (kind === 'invoice') {
    // The record page always goes with Finance's copy (owner, 4 November 2026): without it the copy waits and tries again.
    const d = await loadInvoiceDetail(SERVER, Number(id))
    if (!d?.doc.record) notFound()
    const q = printQuery(await searchParams)
    return <InvoicePrint doc={d.doc} only={q.only} ownPages={q.ownPages} paper={q.paper} />
  }

  const doc = await loadRmbDoc(SERVER, Number(id), SERVER.zone)
  if (!doc) notFound()
  // The photos as data, so the page needs no other address; a PDF receipt is drawn into its box by the PDF maker.
  const { data: items } = await db().from('reimbursements').select('id, receipt_path').eq('document_id', Number(id))
  const photos = new Map<number, string>()
  await Promise.all((items ?? []).map(async i => {
    if (!i.receipt_path || receiptShow(i.receipt_path) !== 'image') return
    const bytes = await receiptBytes(i.receipt_path)
    if (bytes) photos.set(i.id, `data:${mimeOfExt(extOf(i.receipt_path))};base64,${Buffer.from(bytes).toString('base64')}`)
  }))
  return (
    <div className="print-doc bg-white w-[620px] [&>div:first-child]:min-h-[876px]">
      <DocSheet doc={doc} />
      <ReceiptPages doc={doc} src={r => photos.get(r.id) ?? 'data:,'} print />
    </div>
  )
}
