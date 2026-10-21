/**
 * One A4 sheet as a PDF (Clocky part 2: invoices, payroll summaries,
 * reimbursement documents). Same mechanics as the Report PDF: the print page
 * rendered in headless Chromium with the caller's cookies, so it passes the
 * same gate; then the sheet alone (.print-doc, 620px wide) is printed at the
 * scale that fills A4's width, on one page.
 */

import type { Browser } from 'puppeteer-core'
import { internalOrigin } from '@/lib/auth/public-origin'
import { launchBrowser } from './browser'

/** A4 at 96 dpi is 793.7px wide; the sheet is drawn 620px wide. */
const SCALE = 793.7 / 620

const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })

/** The file is named by the sheet itself (data-file), else by `fileName` from its title. */
export async function sheetPdf(request: Request, printPath: string, fileName: (title: string) => string): Promise<Response> {
  const query = new URLSearchParams()
  const vs = new URL(request.url).searchParams.get('_vs')
  if (vs) query.set('_vs', vs)
  const target = `${internalOrigin(request.url)}${printPath}${query.size ? `?${query}` : ''}`
  const cookie = request.headers.get('cookie') ?? ''

  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    if (cookie) await page.setExtraHTTPHeaders({ cookie })
    const res = await page.goto(target, { waitUntil: 'networkidle0', timeout: 45_000 })
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
    const pdf = await page.pdf({ format: 'A4', printBackground: true, scale: SCALE, margin: { top: 0, right: 0, bottom: 0, left: 0 }, pageRanges: '1' })
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
