// Design check: the month by month CSV with the live data, without a login.
// The same rows the real route writes. Development only.

import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectHistory } from '@/lib/timeclock/projects'
import { historyCsvRows } from '@/lib/timeclock/project-history-rows'
import { spanWording } from '@/lib/tsheets/range'
import { currentYearMonth } from '@/lib/tsheets/report'
import { csvFile, csvRow } from '@/lib/format/csv'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (process.env.NODE_ENV === 'production') return new Response('Not found', { status: 404 })
  const to = new URL(request.url).searchParams.get('to') ?? currentYearMonth()
  const from = `${to.slice(0, 4)}-01`
  const rows = historyCsvRows(await loadProjectHistory(createAdminClient(), from, to), { period: spanWording(from, to), generatedOn: 'September 23, 2026' })
  return new Response(csvFile(rows.map(csvRow)), {
    headers: { 'Content-Type': 'text/csv; charset=utf-8' },
  })
}
