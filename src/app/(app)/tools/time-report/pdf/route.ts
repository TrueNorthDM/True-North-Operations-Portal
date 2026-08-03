/**
 * GET /tools/time-report/pdf?month=YYYY-MM&type=client|internal
 *
 * Server-side PDF of the i7 Budget Usage Report. We render the existing print
 * page (/tools/time-report/print) in headless Chromium and print it to PDF, so
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
 * Chromium: local dev uses the machine's Chrome; on Vercel we use the bundled
 * @sparticuz/chromium binary.
 */

import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'
import { requirePrivileged } from '@/lib/tsheets/require-privileged'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthLabel = (ym: string) => /^\d{4}-\d{2}$/.test(ym) ? `${MON[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}` : ym

async function launch(): Promise<Browser> {
  // Local dev: use the installed desktop Chrome. Override with LOCAL_CHROME_PATH.
  if (process.env.NODE_ENV !== 'production') {
    const executablePath = process.env.LOCAL_CHROME_PATH
      || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    return puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  }
  // Vercel: the serverless-friendly bundled Chromium.
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}

export async function GET(request: Request) {
  const denied = await requirePrivileged()
  if (denied) return denied

  const url = new URL(request.url)
  const month = url.searchParams.get('month') ?? ''
  const type = url.searchParams.get('type') === 'internal' ? 'internal' : 'client'

  // The page we screenshot to PDF, same origin, cookies forwarded for auth.
  const target = `${url.origin}/tools/time-report/print?month=${encodeURIComponent(month)}&type=${type}&pdf=1`
  const cookie = request.headers.get('cookie') ?? ''

  let browser: Browser | null = null
  try {
    browser = await launch()
    const page = await browser.newPage()
    if (cookie) await page.setExtraHTTPHeaders({ cookie })
    await page.goto(target, { waitUntil: 'networkidle0', timeout: 45_000 })
    // Belt-and-suspenders: make sure the document actually rendered.
    await page.waitForSelector('.print-doc', { timeout: 10_000 })

    const label = monthLabel(month)
    // Footer + page numbers rendered by Puppeteer on EVERY page, so the count
    // adapts to the real content. Header/footer templates get no page CSS,
    // inline styles + system fonts only.
    const footerLeft = type === 'internal'
      ? 'True North Digital Marketing · Operations Portal · Confidential'
      : 'Prepared for i7 Marketing by True North Digital Marketing'
    const esc = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
    const footerTemplate =
      `<div style="width:100%;font-size:7px;color:#8593a4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:0 9mm;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;">`
      + `<span>${footerLeft}</span><span>${esc(label)}</span>`
      + `<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>`
      + `</div>`

    const pdf = await page.pdf({
      format: 'A4',
      landscape: type === 'internal', // wide per-person table needs landscape
      printBackground: true,
      // Content flows naturally (no forced section breaks), and Puppeteer applies
      // a real margin to EVERY page + a footer/page-number line, so the page
      // count adapts to the data and every page is numbered.
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
      margin: { top: '9mm', right: '9mm', bottom: '13mm', left: '9mm' },
    })

    const name = type === 'internal'
      ? `i7 Budget Internal Report - ${label}.pdf`
      : `i7 Budget Month Report - ${label}.pdf`
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
