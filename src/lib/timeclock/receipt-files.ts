/**
 * The receipt files behind a reimbursement document's pages (9D-p, see
 * receipt-pages.ts): how many pages a PDF receipt has, and the finished PDF
 * with each PDF receipt drawn into the box its pages leave for it. Photos are
 * drawn by the print page itself; only PDFs need this.
 */

import { PDFDocument } from 'pdf-lib'
import { db } from './clocky-context'
import type { ReceiptBox } from './receipt-pages'

/** A stored receipt's bytes; null when storage does not answer. */
export async function receiptBytes(path: string): Promise<Uint8Array | null> {
  const { data, error } = await db().storage.from('receipts').download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

/** A PDF's pages; null when it cannot be read (damaged, or locked with a password). */
export async function pdfPageCount(bytes: Uint8Array): Promise<number | null> {
  try {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false })
    return pdf.getPageCount() || null
  } catch {
    return null
  }
}

/**
 * The printed document with every PDF receipt page drawn into its box, scaled
 * to fit and centred. `pxToPt` turns the print page's CSS pixels into PDF
 * points (A4 is 595.28pt across a 620px sheet).
 */
export async function drawPdfReceipts(printed: Uint8Array, boxes: readonly ReceiptBox[], files: ReadonlyMap<number, Uint8Array>, pxToPt: number): Promise<Uint8Array> {
  if (!boxes.length) return printed
  const out = await PDFDocument.load(printed)
  const pages = out.getPages()
  for (const b of boxes) {
    const bytes = files.get(b.receiptId)
    const page = pages[b.page]
    if (!bytes || !page) continue
    // A receipt pdf-lib cannot copy leaves its box empty; the rest of the document still comes out.
    const [art] = await out.embedPdf(bytes, [b.receiptPage]).catch((e: unknown) => {
      console.error('[receipt pdf] could not draw', b.receiptId, e instanceof Error ? e.message : e)
      return []
    })
    if (!art) continue
    const w = b.width * pxToPt
    const h = b.height * pxToPt
    const fit = Math.min(w / art.width, h / art.height)
    const dw = art.width * fit
    const dh = art.height * fit
    const left = b.x * pxToPt + (w - dw) / 2
    const top = b.y * pxToPt + (h - dh) / 2
    page.drawPage(art, { x: left, y: page.getHeight() - top - dh, width: dw, height: dh })
  }
  return out.save()
}
