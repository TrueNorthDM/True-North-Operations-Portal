// Design check: Project Hours & Others with the live data, without a login,
// i7 and MME included (September 2026). ?from=&to= (YYYY-MM), this month by
// default. Development only.

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectHistory, loadProjectTracking } from '@/lib/timeclock/projects'
import { currentYearMonth } from '@/lib/tsheets/report'
import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { ProjectFullHistory } from '@/components/tsheets/ProjectFullHistory'

export const dynamic = 'force-dynamic'

export default async function ProjectHoursLive({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { to = currentYearMonth(), from = to } = await searchParams
  const db = createAdminClient()
  const [data, history] = await Promise.all([
    loadProjectTracking(db, from, to),
    loadProjectHistory(db, `${to.slice(0, 4)}-01`, to),
  ])
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <ProjectHoursReport data={data} />
        <ProjectFullHistory blocks={history} year={to.slice(0, 4)} />
      </div>
    </div>
  )
}
