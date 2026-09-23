// Design check: the month by month PDF sheet (Tina, 16 September 2026) with the
// live data, without a login, so it can be printed and looked at before the
// real route (which needs a session) is used. ?to=YYYY-MM, this month by
// default. The CSV beside it is ./csv. Development only.

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectHistory } from '@/lib/timeclock/projects'
import { spanWording } from '@/lib/tsheets/range'
import { currentYearMonth } from '@/lib/tsheets/report'
import { ProjectHistoryPrint } from '@/components/tsheets/ProjectHistoryPrint'

export const dynamic = 'force-dynamic'

export default async function ProjectHistoryExportCheck({ searchParams }: { searchParams: Promise<{ to?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { to = currentYearMonth() } = await searchParams
  const from = `${to.slice(0, 4)}-01`
  const blocks = await loadProjectHistory(createAdminClient(), from, to)
  return <ProjectHistoryPrint blocks={blocks} periodLabel={spanWording(from, to)} generatedOn="September 23, 2026" />
}
