// Design check: Project Hours & Others with the live data, without a login,
// i7 and MME included (September 2026). ?from=&to= (YYYY-MM), this month by
// default. ?print=client|internal renders the PDF sheet. Development only.

import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadProjectHistory, loadProjectTracking } from '@/lib/timeclock/projects'
import { currentYearMonth } from '@/lib/tsheets/report'
import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { ProjectFullHistory } from '@/components/tsheets/ProjectFullHistory'
import { ProjectHoursPrint } from '@/components/tsheets/ProjectHoursPrint'

export const dynamic = 'force-dynamic'

export default async function ProjectHoursLive({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; print?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { to = currentYearMonth(), from = to, print } = await searchParams
  const db = createAdminClient()
  const [data, history] = await Promise.all([
    loadProjectTracking(db, from, to),
    loadProjectHistory(db, `${to.slice(0, 4)}-01`, to),
  ])
  // ?print=client|internal: the PDF sheet itself, as the PDF route prints it.
  if (print === 'client' || print === 'internal') {
    return <ProjectHoursPrint data={data} type={print} periodLabel={to} generatedOn="September 23, 2026" />
  }
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1400px] mx-auto space-y-8">
        <ProjectHoursReport data={data} />
        <ProjectFullHistory blocks={history} year={to.slice(0, 4)} />
      </div>
    </div>
  )
}
