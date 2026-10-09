/**
 * GET /ops/client-reports/i7/image?month=YYYY-MM
 *
 * A shareable PNG of the i7 budget at a glance, the card the team sends around
 * (like the spreadsheet screenshot, but generated). Shows this month's spend
 * against the budget available this month (the month's budget plus or minus
 * what carried in), the percentage, and what is left: the same figures, to the
 * cent, as the report (lib/tsheets/format.ts money).
 *
 * Built server-side: the balance is read with the privileged reader, a
 * self-contained HTML card is rendered into headless Chromium (setContent, no
 * auth forward needed), and screenshot. Same Chromium setup as the PDF route.
 * The month must be YYYY-MM: it is written into that HTML (audit, 9 October 2026).
 */

import type { Browser } from 'puppeteer-core'
import { launchBrowser } from '@/lib/pdf/browser'
import { requirePrivileged } from '@/lib/tsheets/require-privileged'
import { loadI7Carryover } from '@/lib/tsheets/report-data'
import { money as cents } from '@/lib/tsheets/format'
import { monthName } from '@/lib/timeclock/periods'

export const runtime = 'nodejs'
export const maxDuration = 60
export const preferredRegion = 'iad1'
export const dynamic = 'force-dynamic'

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const monthLabel = (ym: string) => monthName(ym)
/** Cents, as on the report; a minus written as the report writes it. */
const money = (n: number) => (n < 0 ? '−' : '') + cents(Math.abs(n))


function cardHtml(month: string, c: { opening: number; monthBudget: number; monthUsed: number; totalAvailable: number; totalLeft: number } | null): string {
  const label = monthLabel(month)
  // Mirrors the dashboard's BudgetBalanceCard: this month's spend measured
  // against the budget actually AVAILABLE this month (full budget +/- carryover),
  // instead of folding the carried-over overage into "used" and dividing by the
  // full budget. Both framings agree on what's left; this keeps the shared image
  // and the dashboard telling the same story.
  const monthTotal = c?.monthBudget ?? 0    // full month budget, shown in the breakdown
  const full = c?.totalAvailable ?? 0       // available after carryover, the denominator
  const used = c?.monthUsed ?? 0            // spend this month (carryover lives in `full`)
  const left = c?.totalLeft ?? 0
  const pct = full > 0 ? Math.round((used / full) * 100) : 0
  const fill = Math.max(0, Math.min(100, pct))
  const over = left < 0
  const usedNote = `${pct}% of budget`
  const calc = c && c.opening !== 0 ? `${money(monthTotal)} ${c.opening < 0 ? '−' : '+'} ${money(Math.abs(c.opening))}` : money(monthTotal)

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;
      background:#eef1f6;display:flex;align-items:center;justify-content:center;width:1000px;height:600px}
    .card{width:936px;background:#fff;border-radius:22px;overflow:hidden;
      box-shadow:0 30px 60px -24px rgba(1,35,88,.4)}
    .head{background:#012358;padding:26px 34px;display:flex;align-items:center;justify-content:space-between}
    .brand{display:flex;align-items:center;gap:14px}
    .mark{width:46px;height:46px;border-radius:12px;background:#1E7D7F;color:#fff;font-weight:800;
      font-size:20px;display:flex;align-items:center;justify-content:center;letter-spacing:.5px}
    .title{color:#fff;font-size:19px;font-weight:800;letter-spacing:.2px}
    .sub{color:#9fb3d4;font-size:12.5px;font-weight:600;margin-top:2px;text-transform:uppercase;letter-spacing:1.4px}
    .period{color:#F2C40A;font-size:20px;font-weight:800;letter-spacing:.3px}
    .body{padding:32px 34px 34px}
    .bar-top{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:10px}
    .bar-used{font-size:15px;color:#3b4a63;font-weight:600}
    .bar-used b{color:#012358;font-weight:800}
    .bar-pct{font-size:15px;font-weight:800;color:#012358}
    .bar{height:16px;border-radius:999px;background:#e9edf3;overflow:hidden;position:relative}
    .fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#1E7D7F 0%,#33a79c 55%,${over ? '#ef4444' : '#f2c40a'} 100%)}
    .bar-bottom{display:flex;justify-content:space-between;margin-top:9px;font-size:13px;color:#78859b}
    .bar-bottom .r{font-weight:800;color:${over ? '#c2410c' : '#16875a'}}
    .stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:30px}
    .stat{background:#f6f8fb;border:1px solid #e6ebf2;border-radius:14px;padding:18px 20px}
    .k{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1.2px;color:#8593a4}
    .v{font-size:32px;font-weight:800;color:#012358;margin-top:8px;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
    .v.red{color:#c2410c}.v.green{color:#16875a}
    .note{font-size:12px;color:#78859b;margin-top:7px;line-height:1.4}
  </style></head><body>
    <div class="card">
      <div class="head">
        <div class="brand">
          <div class="mark">i7</div>
          <div><div class="title">i7 Budget Usage</div><div class="sub">True North Digital Marketing</div></div>
        </div>
        <div class="period">${label}</div>
      </div>
      <div class="body">
        <div class="bar-top">
          <span class="bar-used"><b>${money(used)}</b> used of ${money(full)}</span>
          <span class="bar-pct">${pct}%</span>
        </div>
        <div class="bar"><div class="fill" style="width:${fill}%"></div></div>
        <div class="bar-bottom"><span>Budget for ${label}</span><span class="r">${over ? `${money(-left)} over budget` : `${money(left)} left`}</span></div>
        <div class="stats">
          <div class="stat"><div class="k">Budget used</div><div class="v">${money(used)}</div><div class="note">${usedNote}</div></div>
          <div class="stat"><div class="k">Amount left</div><div class="v ${over ? 'red' : 'green'}">${money(left)}</div><div class="note">${over ? 'Over budget this month' : 'Remaining this month'}</div></div>
          <div class="stat"><div class="k">Budget total</div><div class="v">${money(full)}</div><div class="note">${calc}</div></div>
        </div>
      </div>
    </div>
  </body></html>`
}

export async function GET(request: Request) {
  // Its own control now: this is the Team Update picture, not a file export.
  const denied = await requirePrivileged('report-team-update')
  if (denied) return denied

  const url = new URL(request.url)
  const month = url.searchParams.get('month') ?? ''
  if (!MONTH.test(month)) return new Response('Choose a month (YYYY-MM).', { status: 400, headers: { 'Content-Type': 'text/plain' } })

  let browser: Browser | null = null
  try {
    // The card is the balance and nothing else, so it reads the balance and
    // nothing else, rather than the whole report.
    const carryover = await loadI7Carryover(month)
    const html = cardHtml(month, carryover)

    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.setViewport({ width: 1000, height: 600, deviceScaleFactor: 2 })
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 })
    const el = await page.$('.card')
    const png = el
      ? await el.screenshot({ type: 'png' })
      : await page.screenshot({ type: 'png' })

    const label = monthLabel(month)
    const name = `i7 Budget Summary - ${label}.png`
    const asciiName = name.replace(/[^\x20-\x7e]/g, '-')
    return new Response(png as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    // The detail stays in the server log; the person gets a sentence.
    console.error('[time-report/image] generation failed:', err)
    return new Response('The image could not be made just now. Try again in a moment.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  } finally {
    await browser?.close()
  }
}
