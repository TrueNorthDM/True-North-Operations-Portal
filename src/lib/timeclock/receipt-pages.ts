/**
 * A reimbursement document's receipts as pages after it (Requests.dc.html
 * 9D-p): "Preview, 3 pages (the document and its 2 receipts)", the footer's
 * "Receipts on pages 2 and 3." and "Page 1 of 3". A photo is drawn on its
 * page; a PDF receipt brings each of its own pages; a HEIC photo, which no PDF
 * can hold, keeps its page with a line saying where to open it.
 *
 * Pure: the preview, the print page and the PDF route share it.
 */

/** One A4 page in a sheet's pixels: the sheet fills its width (A4 is 793.7 by 1122.5 at 96 dpi). */
export const pagePx = (width: number, landscape = false) => (landscape ? (width * 793.7) / 1122.5 : (width * 1122.5) / 793.7)

/** The pay documents' page: 620 wide, portrait. */
export const A4_PAGE_PX = pagePx(620)

/** The sheet's own pages from its drawn height (a hair of rounding is not a page). */
export const docPagesOf = (heightPx: number, page = A4_PAGE_PX) => Math.max(1, Math.ceil((heightPx - 2) / page))

/**
 * The sheet's pages once printed: a row the page edge would cut moves whole to
 * the next page (break-inside: avoid), which adds its gap to the sheet.
 * `natural` is the sheet's height without its A4 minimum, `keeps` the rows,
 * the total and the footer, from the sheet's top. `push` is the space the
 * moves add, so the footer can still sit at the foot of the last page.
 */
export function sheetPages(natural: number, keeps: readonly { top: number; height: number }[], page = A4_PAGE_PX): { pages: number; push: number } {
  let push = 0
  for (const k of keeps) {
    const top = k.top + push
    const first = Math.floor(top / page)
    if (k.height < page && Math.floor((top + k.height - 0.5) / page) > first) push += (first + 1) * page - top
  }
  return { pages: docPagesOf(natural + push, page), push }
}

/**
 * A sheet that runs a little over one page (the report, 12C: 16 people are
 * about 700px on a 608px page) prints on one page, a little smaller, as a
 * printer's "fit to page" would: the sheet is drawn wider, so the page's
 * scale shrinks it, and its height fits. Over `minScale` of shrinking, it
 * runs onto more pages instead. `width` is the width to draw it at.
 */
export function fitOnePage(natural: number, width: number, landscape: boolean, minScale = 0.75): { width: number; fits: boolean } {
  const page = pagePx(width, landscape)
  if (natural <= page) return { width, fits: true }
  if (page / natural < minScale) return { width, fits: false }
  return { width: Math.ceil((width * natural) / page) + 1, fits: true }
}

export type ReceiptShow = 'image' | 'pdf' | 'none'

export interface DocReceipt {
  /** The reimbursement's id: /requests/reimbursements/receipt/<id>. */
  id: number
  file: string
  /** "USB-C hub for a second monitor, $12.99" */
  line: string
  show: ReceiptShow
  /** A PDF receipt's own pages; 1 for a photo. */
  pages: number
}

/** What a stored receipt can be in a PDF, by its file's extension (the upload keeps jpg, png, webp, heic, heif, pdf). */
export function receiptShow(path: string): ReceiptShow {
  const ext = path.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp') return 'image'
  return 'none'
}

/** Where a PDF receipt's page goes: the PDF page it lands on and its box there, in CSS pixels from that page's top left. */
export interface ReceiptBox { page: number; receiptId: number; receiptPage: number; x: number; y: number; width: number; height: number }

/** Every page the document makes: its own, then each receipt's. */
export function totalPages(docPages: number, receipts: readonly Pick<DocReceipt, 'pages'>[]): number {
  return docPages + receipts.reduce((n, r) => n + r.pages, 0)
}

/** The footer's sentence after "Made by the True North Operations Portal.": null without receipts. */
export function receiptsOnText(docPages: number, receipts: readonly Pick<DocReceipt, 'pages'>[]): string | null {
  if (!receipts.length) return null
  const first = docPages + 1
  const last = totalPages(docPages, receipts)
  const noun = receipts.length === 1 ? 'Receipt' : 'Receipts'
  if (first === last) return `${noun} on page ${first}.`
  return `${noun} on pages ${first} ${last === first + 1 ? 'and' : 'to'} ${last}.`
}

/** The preview window's sub-line, before "Nothing downloads until you press Download." */
export function previewPagesText(docPages: number, receipts: readonly Pick<DocReceipt, 'pages'>[]): string {
  const pages = totalPages(docPages, receipts)
  const head = `Preview, ${pages} page${pages === 1 ? '' : 's'}`
  if (!receipts.length) return `${head}.`
  return `${head} (the document and its ${receipts.length === 1 ? 'receipt' : `${receipts.length} receipts`}).`
}

/** Every page's "Page N of M", once the document's own length is known (one page unless its rows run over). */
export function pageLabels(docPages: number, receipts: readonly Pick<DocReceipt, 'pages'>[]): { doc: string; receipts: string[]; on: string | null } {
  const total = totalPages(docPages, receipts)
  const n = total - docPages
  return {
    doc: `Page ${docPages} of ${total}`,
    receipts: Array.from({ length: n }, (_, i) => `Page ${docPages + 1 + i} of ${total}`),
    on: receiptsOnText(docPages, receipts),
  }
}
