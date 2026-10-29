// "Which job?" (Clocky part 2, Job Catalogue.dc.html 11D): every job and when
// to use it, for everyone. The lines are the job catalogue's (Company settings).
// From the switch date: the 2026 structure, Client, Division and Project in one
// table and the shared Activities below it (owner, 28 October 2026).

import { requireSurface } from '@/lib/access/resolve'
import { loadCatalog } from '@/lib/timeclock/clocky-context'
import { activityRows, guideGroups } from '@/lib/timeclock/job-catalogue'
import { structureOn } from '@/lib/timeclock/entry-rules'
import { localDate } from '@/lib/timeclock/format'
import { WhichJobView } from '@/components/clocky/WhichJobView'
import { WhichJob2026View, type ProjectRow } from '@/components/clocky/WhichJob2026View'
import { placeOf } from '@/components/clocky/clock/clock-model'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Which job?' }

export default async function WhichJobRoute() {
  await requireSurface('ck-which-job')
  const catalog = await loadCatalog()
  const today = localDate(new Date(), 'America/New_York')

  if (structureOn(today, catalog.switchDate) === 2) {
    // The catalogue's own rows, so an edit in Company settings shows here at once.
    const projects: ProjectRow[] = [...catalog.jobs.values()]
      .filter(j => j.structure === 2 && j.selectable)
      .map(j => ({ ...placeOf(j.path), use: j.whenToUse ?? '', billable: j.billable }))
    return <WhichJob2026View projects={projects} activities={activityRows(catalog)} />
  }
  return <WhichJobView groups={guideGroups(catalog)} codes={catalog.fields.find(f => f.key === 'code')?.options ?? []} />
}
