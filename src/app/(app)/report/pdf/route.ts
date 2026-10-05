/**
 * GET /report/pdf?tab=&scope=&period=&team=&orientation=
 *
 * The Report as a PDF, by the same mechanics as the Time report: render the
 * print page in headless Chromium and print it. That is the only way to force
 * landscape in Safari, which ignores CSS @page{size}, and it produces a file
 * with no browser header, no footer and no print dialog.
 *
 * The caller's cookies are forwarded to the headless page so it passes the
 * same gate when it loads /report/print. No proxy change, no token.
 */

import type { Browser } from 'puppeteer-core'
import { internalOrigin } from '@/lib/auth/public-origin'
import { launchBrowser } from '@/lib/pdf/browser'
import { loadAccess, requireSurface } from '@/lib/access/resolve'
import { SCOPE_LABEL } from '@/lib/report/scope'
import { resolveReportView } from '@/lib/report/view'
import { createClient } from '@/lib/supabase/server'
import { getCurrentPerson } from '@/lib/auth/session'
import { exportName } from '@/lib/report/csv'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'


export async function GET(request: Request) {
  await requireSurface('report')

  const access = await loadAccess()
  if (!access.can('report-export')) {
    return new Response('Not allowed to export the Report.', {
      status: 403, headers: { 'Content-Type': 'text/plain' },
    })
  }

  const url = new URL(request.url)
  const me = await getCurrentPerson()
  const { tab, scope, period, team, person } = await resolveReportView(
    await createClient(), access.can, me?.id ?? null, Object.fromEntries(url.searchParams),
  )

  // The menu offers both. Workload and People are wide tables and default to
  // landscape when nothing was chosen, because a portrait page cuts them.
  const asked = url.searchParams.get('orientation')
  const landscape = asked ? asked === 'landscape' : tab === 'workload' || tab === 'people'

  const query = new URLSearchParams({ tab, scope, period: String(period), pdf: '1' })
  if (team) query.set('team', team)
  if (person) query.set('person', person)
  const target = `${internalOrigin(request.url)}/report/print?${query}`
  const cookie = request.headers.get('cookie') ?? ''

  let browser: Browser | null = null
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    if (cookie) await page.setExtraHTTPHeaders({ cookie })
    await page.goto(target, { waitUntil: 'networkidle0', timeout: 45_000 })
    await page.waitForSelector('.print-doc', { timeout: 10_000 })

    const label = `${SCOPE_LABEL[scope]}, last ${period} days`
    const esc = (s: string) => s.replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]!))
    const footerTemplate =
      '<div style="width:100%;font-size:7px;color:#8593a4;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;padding:0 9mm;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;">'
      + '<span>True North Digital Marketing · Operations Portal · Confidential</span>'
      + `<span>${esc(label)}</span>`
      + '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>'
      + '</div>'

    const pdf = await page.pdf({
      format: 'A4',
      landscape,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate,
      margin: { top: '9mm', right: '9mm', bottom: '13mm', left: '9mm' },
    })

    const name = `${exportName(tab, SCOPE_LABEL[scope], period)}.pdf`
    const ascii = name.replace(/[^\x20-\x7e]/g, '-')

    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('[report/pdf] generation failed:', err)
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    return new Response(`PDF generation failed: ${detail}`, {
      status: 500, headers: { 'Content-Type': 'text/plain' },
    })
  } finally {
    await browser?.close()
  }
}
