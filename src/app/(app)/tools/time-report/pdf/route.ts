/**
 * GET /tools/time-report/pdf?month=YYYY-MM&type=client|internal
 *
 * Server-side PDF of the i7 Budget Usage Report. We render the existing print
 * page (/tools/time-report/print) in headless Chromium and print it to PDF, so
 * we fully control orientation (client = portrait, internal = LANDSCAPE for the
 * wide per-person table), margins, and — unlike the browser's "Save as PDF" —
 * there's no browser header/footer and no print dialog. This is the only way to
 * force landscape in Safari, which ignores CSS @page{size}.
 *
 * Auth: this route sits under (app), so the proxy already required a session for
 * the caller. We forward the caller's cookies to the headless page so it passes
 * the same auth gate when it loads /print. No proxy change, no token.
 *
 * Chromium: local dev uses the machine's Chrome; on Vercel we use the bundled
 * @sparticuz/chromium binary.
 */

import puppeteer, { type Browser } from 'puppeteer-core'
import chromium from '@sparticuz/chromium'

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
  const url = new URL(request.url)
  const month = url.searchParams.get('month') ?? ''
  const type = url.searchParams.get('type') === 'internal' ? 'internal' : 'client'

  // The page we screenshot to PDF — same origin, cookies forwarded for auth.
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

    const pdf = await page.pdf({
      format: 'A4',
      landscape: type === 'internal', // wide per-person table needs landscape
      printBackground: true,
      // @page margin is 0 and each .pdf-page supplies its own padding as the
      // visible margin, so no printer margin here.
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    })

    const label = monthLabel(month)
    const name = type === 'internal'
      ? `i7 Budget Internal Report — ${label}.pdf`
      : `i7 Budget Month Report — ${label}.pdf`
    // HTTP headers are Latin-1: the em dash (—) breaks a plain filename="...".
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
    return new Response('Could not generate the PDF. Try the "Save current view as PDF" option instead.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  } finally {
    await browser?.close()
  }
}
