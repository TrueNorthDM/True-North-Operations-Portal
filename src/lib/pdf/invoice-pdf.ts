/**
 * An invoice's PDF with its record page (owner, 4 November 2026): the
 * download, the preview's Download and the Google Drive copy all make it here,
 * so Finance's copy and the file someone downloads are the same.
 *
 *   builder (and the portal's, before November 2026)   the print page's two
 *              A4 pages, the invoice and the record, in one print
 *   own_file   their PDF exactly as they sent it, then the record page printed
 *              alone (on the paper of their file, numbered after its pages)
 *              and put after it with pdf-lib. Their file in storage is only
 *              read: the merged copy is made in memory.
 *
 * Who may have it is decided by the print page the headless browser opens
 * (the caller's cookie, or the Drive copy's one-document pass): a page that
 * answers 404 gives null here. Server only.
 */

import { PDFDocument } from 'pdf-lib'
import { createAdminClient } from '@/lib/supabase/admin'
import { receiptBytes } from '@/lib/timeclock/receipt-files'
import { printSheet, type SheetLayout } from './sheet-pdf'
import { paperOf, recordOnlyQuery, type Paper } from './invoice-pages'

/** Every page the print page draws: the invoice and the record (a long history may run on). */
const layoutFor = (paper: Paper): SheetLayout => ({ width: 620, landscape: false, allPages: true, letter: paper === 'letter' })

/** Their own file, when the invoice is one (made_by own_file); null for the builder's and the portal's. */
async function ownFileOf(invoiceId: number): Promise<string | null> {
  const { data, error } = await createAdminClient().from('invoices').select('made_by, own_pdf_path').eq('id', invoiceId).maybeSingle()
  if (error) throw new Error(`The invoice could not be read: ${error.message}`)
  return data?.made_by === 'own_file' && data.own_pdf_path ? data.own_pdf_path : null
}

/**
 * The invoice's PDF from its print page (`printUrl`, without a query), with
 * `headers` for the headless browser. Null when the print page answers 404.
 * Throws when it cannot be made (their file unreadable, the print failing).
 */
export async function printInvoicePdf(invoiceId: number, printUrl: URL, headers: Record<string, string>): Promise<Uint8Array | null> {
  const own = await ownFileOf(invoiceId)
  if (!own) return (await printSheet(printUrl, headers, layoutFor('a4')))?.pdf ?? null

  const bytes = await receiptBytes(own)
  if (!bytes) throw new Error('Their invoice file could not be read from the portal\'s storage.')
  const theirs = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false }).catch(() => null)
  if (!theirs || !theirs.getPageCount()) throw new Error('Their invoice file could not be opened as a PDF, so the record page could not be added.')
  // A locked file cannot take a page: pdf-lib would write one nobody can open.
  if (theirs.isEncrypted) throw new Error('Their invoice file is locked with a password, so the record page could not be added.')
  const { width, height } = theirs.getPage(0).getSize()
  const paper = paperOf(width, height)
  const target = new URL(printUrl)
  for (const [k, v] of new URLSearchParams(recordOnlyQuery(theirs.getPageCount(), paper))) target.searchParams.set(k, v)
  const done = await printSheet(target, headers, layoutFor(paper))
  if (!done) return null
  const record = await PDFDocument.load(done.pdf)
  for (const p of await theirs.copyPages(record, record.getPageIndices())) theirs.addPage(p)
  return theirs.save()
}
