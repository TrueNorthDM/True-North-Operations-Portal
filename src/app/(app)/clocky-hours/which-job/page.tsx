// "Which job?" (Clocky part 2, Job Catalogue.dc.html 11D): every job and when
// to use it, for everyone. The lines are the job catalogue's (Company settings).

import { requireSurface } from '@/lib/access/resolve'
import { loadCatalog } from '@/lib/timeclock/clocky-context'
import { guideGroups } from '@/lib/timeclock/job-catalogue'
import { WhichJobView } from '@/components/clocky/WhichJobView'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Which job?' }

export default async function WhichJobRoute() {
  await requireSurface('ck-which-job')
  const catalog = await loadCatalog()
  return <WhichJobView groups={guideGroups(catalog)} codes={catalog.fields.find(f => f.key === 'code')?.options ?? []} />
}
