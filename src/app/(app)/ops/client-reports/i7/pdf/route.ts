/**
 * GET /ops/client-reports/i7/pdf?month=YYYY-MM&type=client|internal
 *     (&report=projects for Project Hours, which also has type=history)
 *
 * Server-side PDF of the i7 Budget Usage Report. We render the existing print
 * page (/ops/client-reports/i7/print) in headless Chromium and print it to PDF, so
 * we fully control orientation (client = portrait, internal = LANDSCAPE for the
 * wide per-person table), margins, and (unlike the browser's "Save as PDF")
 * there's no browser header/footer and no print dialog. This is the only way to
 * force landscape in Safari, which ignores CSS @page{size}.
 *
 * Auth: the proxy requires a session, and requirePrivileged restricts this to
 * admins (the PDF carries the same budget figures the report hides from Team
 * Leaders and Users). We forward the caller's cookies to the headless page so
 * it passes the same gate when it loads /print. No proxy change, no token.
 *
 * Chromium: lib/pdf/browser.ts (the server's own, or local Chrome).
 */

import type { Browser } from 'puppeteer-core'
import { internalOrigin } from '@/lib/auth/public-origin'
import { launchBrowser } from '@/lib/pdf/browser'
import { requirePrivileged } from '@/lib/tsheets/require-privileged'
import { requireSurface } from '@/lib/access/resolve'
import { spanWording } from '@/lib/tsheets/range'
import { ROUTES } from '@/lib/nav/routes'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ym: string) => /^\d{4}-\d{2}$/.test(ym) ? `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym


export async function GET(request: Request) {
  const url = new URL(request.url)
  const month = url.searchParams.get('month') ?? ''
  // Which report. One route rather than two, because everything below it is
  // launching a headless browser and setting margins, and none of that differs.
  const report = url.searchParams.get('report') === 'projects' ? 'projects' : 'i7'
  const asked = url.searchParams.get('type')
  // history: Project Hours' month by month table (September 2026). Anyone who
  // may open the report and download its CSV may have it as a PDF: the same
  // figures, the same gate as the CSV and the print page. The other PDFs keep
  // the privileged gate they always had.
  const type = asked === 'internal' ? 'internal' : report === 'projects' && asked === 'history' ? 'history' : 'client'

  if (type === 'history') {
    const access = await requireSurface('tools')
    if (!access.canTool('grant-pass-report') || !access.can('ph-export')) return new Response('Not allowed.', { status: 403 })
  } else {
    // Each report's own Export tick (access catalogue, 7 October 2026).
    const denied = await requirePrivileged(report === 'projects' ? 'ph-export' : 'i7-export')
    if (denied) return denied
  }
  const printPath = report === 'projects'
    ? `${ROUTES.projectHours}/print`
    : `${ROUTES.i7}/print`

  // The page we screenshot to PDF, same origin, cookies forwarded for auth.
  const target = `${internalOrigin(request.url)}${printPath}?month=${encodeURIComponent(month)}&type=${type}&pdf=1`
  const cookie = request.headers.get('cookie') ?? ''

  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    if (cookie) await page.setExtraHTTPHeaders({ cookie })
    await page.goto(target, { waitUntil: 'networkidle0', timeout: 45_000 })
    // Belt-and-suspenders: make sure the document actually rendered.
    await page.waitForSelector('.print-doc', { timeout: 10_000 })

    const label = type === 'history' && /^\d{4}-\d{2}$/.test(month)
      ? spanWording(`${month.slice(0, 4)}-01`, month)
      : monthLabel(month)
    // Footer + page numbers rendered by Puppeteer on EVERY page, so the count
    // adapts to the real content. Header/footer templates get no page CSS,
    // inline styles + system fonts only.
    const footerLeft = type === 'internal'
      ? 'True North Digital Marketing · Operations Portal · Confidential'
      : report === 'projects'
        ? 'True North Digital Marketing · Operations Portal'
        : 'Prepared for i7 Marketing by True North Digital Marketing'
    const esc = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
    const footerTemplate =
      `<div style="width:100%;font-size:7px;color:#8593a4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:0 9mm;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;">`
      + `<span>${footerLeft}</span><span>${esc(label)}</span>`
      + `<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>`
      + `</div>`

    const pdf = await page.pdf({
      format: 'A4',
      // Wide tables need landscape: per person, a year of months, and every
      // Project Hours sheet (its client table is thirteen columns, and printed
      // portrait it was cut off: Tina, September 2026).
      landscape: type === 'internal' || type === 'history' || report === 'projects',
      printBackground: true,
      // Content flows naturally (no forced section breaks), and Puppeteer applies
      // a real margin to EVERY page + a footer/page-number line, so the page
      // count adapts to the data and every page is numbered.
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
      margin: { top: '9mm', right: '9mm', bottom: '13mm', left: '9mm' },
    })

    const name = type === 'history'
      ? `Project Hours month by month - ${label}.pdf`
      : report === 'projects'
      ? (type === 'internal'
        ? `Project Hours by Person - ${label}.pdf`
        : `Project Hours and Others - ${label}.pdf`)
      : (type === 'internal'
        ? `i7 Budget Internal Report - ${label}.pdf`
        : `i7 Budget Month Report - ${label}.pdf`)
    // HTTP headers are Latin-1: an em dash character breaks a plain filename="...".
    // Provide an ASCII fallback + RFC 5987 UTF-8 form so the nice name survives.
    const asciiName = name.replace(/[^\x20-\x7e]/g, '-')

    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[time-report/pdf] generation failed:', err)
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return new Response(`PDF generation failed: ${detail}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  } finally {
    await browser?.close()
  }
}
