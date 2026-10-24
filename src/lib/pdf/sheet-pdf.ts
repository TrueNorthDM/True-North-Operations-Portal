/**
 * One A4 sheet as a PDF (Clocky part 2: invoices, payroll summaries,
 * reimbursement documents). Same mechanics as the Report PDF: the print page
 * rendered in headless Chromium with the caller's cookies, so it passes the
 * same gate; then the sheet alone (.print-doc, 620px wide, or 860px for the
 * landscape report) is printed at the scale that fills A4's width, on one page
 * (a reimbursement document runs on with its receipts, `paged`).
 */

import type { Browser } from 'puppeteer-core'
import { internalOrigin } from '@/lib/auth/public-origin'
import { launchBrowser } from './browser'
import { fitOnePage, pagePx, sheetPages, type ReceiptBox } from '@/lib/timeclock/receipt-pages'

/** A4 at 96 dpi is 793.7px wide (1122.5px on its side); the documents are drawn 620px wide. */
const A4 = 793.7
const A4_LANDSCAPE = 1122.5

/**
 * A sheet that numbers its pages (9D-p, 12C): the sheet is measured, the page
 * numbers written once its own length is known, every page printed, and
 * `draw` puts a reimbursement document's PDF receipts into the boxes their
 * pages left for them. The sheet is the .print-doc itself when it says
 * data-sheet (the report), else its first child (the pay documents).
 */
export interface PagedSheet {
  labels: (docPages: number) => { doc: string; receipts: string[]; on: string | null }
  /** The report: a little over one page fits on one, a little smaller (fitOnePage). */
  fit?: boolean
  draw: (pdf: Uint8Array, boxes: ReceiptBox[], pxToPt: number) => Promise<Uint8Array>
}

/** The Clocky report (Reports.dc.html 12C) is one landscape page drawn 860px wide. */
export interface SheetLayout { width: number; landscape: boolean; /** Every page it needs (the report), not the first alone. */ allPages?: boolean; paged?: PagedSheet }
const PORTRAIT: SheetLayout = { width: 620, landscape: false }

const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })

/** The file is named by the sheet itself (data-file), else by `fileName` from its title. */
export async function sheetPdf(request: Request, printPath: string, fileName: (title: string) => string, layout: SheetLayout = PORTRAIT): Promise<Response> {
  // The print page's own query (the report's filters) and the View Stage preview.
  const target = new URL(printPath, internalOrigin(request.url))
  const vs = new URL(request.url).searchParams.get('_vs')
  if (vs) target.searchParams.set('_vs', vs)
  const cookie = request.headers.get('cookie') ?? ''

  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    if (cookie) await page.setExtraHTTPHeaders({ cookie })
    const res = await page.goto(target.toString(), { waitUntil: 'networkidle0', timeout: 45_000 })
    if (!res || res.status() === 404) return text('That document is not open to you.', 404)
    await page.waitForSelector('.print-doc', { timeout: 10_000 })
    // The sheet alone: no rail, no top bar, no page padding around it.
    const named = await page.evaluate(() => {
      const doc = document.querySelector('.print-doc')!
      document.body.replaceChildren(doc)
      document.body.style.margin = '0'
      document.body.style.background = '#fff'
      return { title: doc.querySelector('[data-invoice-number], [data-doc-title]')?.textContent ?? 'document', file: doc.querySelector('[data-file]')?.getAttribute('data-file') ?? null }
    })
    const paged = layout.paged
    let boxes: ReceiptBox[] = []
    // The width the sheet is printed at: its own, or wider when a report is fitted on one page.
    let width = layout.width
    if (paged) {
      // The sheet's own pages (measured without its A4 minimum), then its footer at the foot of the last one and every number to match.
      const measure = (w: number | null) => page.evaluate(w => {
        const doc = document.querySelector<HTMLElement>('.print-doc')!
        const sheet = (doc.hasAttribute('data-sheet') ? doc : doc.firstElementChild) as HTMLElement
        sheet.style.minHeight = '0'
        if (w) { doc.style.width = `${w}px`; sheet.style.width = `${w}px` }
        const top = sheet.getBoundingClientRect().top
        return { natural: sheet.offsetHeight, keeps: [...sheet.querySelectorAll('[data-keep]')].map(e => { const r = e.getBoundingClientRect(); return { top: r.top - top, height: r.height } }) }
      }, w)
      let drawn = await measure(null)
      // A report a little over one page is drawn wider, so it prints on one page a little smaller.
      if (paged.fit) {
        const fit = fitOnePage(drawn.natural, layout.width, layout.landscape)
        if (fit.width !== layout.width) { width = fit.width; drawn = await measure(width) }
      }
      const onePage = pagePx(width, layout.landscape)
      const { pages: docPages, push } = sheetPages(drawn.natural, drawn.keeps, onePage)
      boxes = await page.evaluate((labels, docPages, minHeight) => {
        const doc = document.querySelector<HTMLElement>('.print-doc')!
        const sheet = (doc.hasAttribute('data-sheet') ? doc : doc.firstElementChild) as HTMLElement
        sheet.style.minHeight = `${minHeight}px`
        for (const e of doc.querySelectorAll<HTMLElement>('[data-page-at]')) e.textContent = e.dataset.pageAt === 'doc' ? labels.doc : labels.receipts[Number(e.dataset.pageAt)] ?? e.textContent
        const on = doc.querySelector('[data-receipts-on]')
        if (on) on.textContent = labels.on ? ` ${labels.on}` : ''
        return [...doc.querySelectorAll<HTMLElement>('[data-receipt-box]')].map(box => {
          const sheetOf = box.parentElement!
          const at = Number(sheetOf.querySelector<HTMLElement>('[data-page-at]')?.dataset.pageAt ?? 0)
          const [receiptId, receiptPage] = (box.dataset.receiptBox ?? '0:0').split(':').map(Number)
          const a = box.getBoundingClientRect()
          const b = sheetOf.getBoundingClientRect()
          return { page: docPages + at, receiptId, receiptPage, x: a.left - b.left, y: a.top - b.top, width: a.width, height: a.height }
        })
      }, paged.labels(docPages), docPages, Math.floor(docPages * onePage - push) - 1)
    }
    const scale = (layout.landscape ? A4_LANDSCAPE : A4) / width
    const printed = await page.pdf({ format: 'A4', landscape: layout.landscape, printBackground: true, scale, margin: { top: 0, right: 0, bottom: 0, left: 0 }, ...(layout.allPages || paged ? {} : { pageRanges: '1' }) })
    // A4 is 595.28pt wide (841.89pt on its side); the sheet is drawn `width` pixels wide.
    const pdf = paged ? await paged.draw(printed, boxes, (layout.landscape ? 841.89 : 595.28) / width) : printed
    const name = (named.file ?? fileName(named.title)).replace(/[^A-Za-z0-9._-]/g, '-')
    return new Response(pdf as unknown as BodyInit, {
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[sheet pdf] generation failed:', err)
    return text('The PDF could not be made. Try again in a moment.', 500)
  } finally {
    await browser?.close()
  }
}
