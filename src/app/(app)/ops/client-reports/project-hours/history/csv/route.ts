/**
 * GET /ops/client-reports/project-hours/history/csv?from=YYYY-MM&to=YYYY-MM
 *
 * The "month by month" table under Project Hours & Others, as a spreadsheet.
 * Tina went looking for it under Export in September 2026 and it was not there:
 * the report's other CSV is the table above it, not this one.
 *
 * The same table the screen draws, in the screen's shape: metrics down the side,
 * months across, January to the last month of the period on screen, one block
 * per project, figures written as the screen writes them (see historyCsvRows).
 * The rows come from historyRows, the rule the screen itself uses.
 *
 * Only `to` decides the months, as it does on the page. `from` is read so the
 * link can carry the page's own period and resolve it the same way, including
 * the fallback for a month that is out of range.
 *
 * Auth: the proxy requires a session, and this then asks for the same tool
 * grant the report does, exactly as the report's other CSV does.
 */

import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { requireSurface } from '@/lib/access/resolve'
import { projectsExportKeys } from '@/lib/tsheets/export-keys'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectHistory } from '@/lib/timeclock/projects'
import { historyCsvRows } from '@/lib/timeclock/project-history-rows'
import { availableMonths } from '@/lib/tsheets/retention'
import { currentYearMonth } from '@/lib/tsheets/report'
import { resolveRange, spanWording } from '@/lib/tsheets/range'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function cell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: (string | number)[]) => cells.map(cell).join(',')

export async function GET(request: Request) {
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect(await previewHref('/'))
  // An export: the Export tick, and the items whose figures this file carries.
  if (!projectsExportKeys('history').every(k => access.can(k))) redirect(await previewHref('/'))

  const q = new URL(request.url).searchParams
  const legacy = q.get('month') ?? undefined
  const months = availableMonths(new Date())
  const newest = months.includes(currentYearMonth()) ? currentYearMonth() : months[0]
  const range = resolveRange(q.get('from') ?? legacy, q.get('to') ?? legacy, newest)
  // The page's own arithmetic: January of the year the period ends in, to the
  // month it ends in.
  const from = `${range.to.slice(0, 4)}-01`

  let rows: string[][]
  try {
    const generatedOn = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' })
    rows = historyCsvRows(await loadProjectHistory(createAdminClient(), from, range.to), { period: spanWording(from, range.to), generatedOn })
  } catch {
    return new Response('Could not load the report.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  }

  // BOM so Excel reads UTF-8 correctly.
  const csv = '﻿' + rows.map(row).join('\r\n') + '\r\n'
  const name = `Project Hours month by month - ${spanWording(from, range.to)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name.replace(/[^\x20-\x7e]/g, '-')}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'no-store',
    },
  })
}
