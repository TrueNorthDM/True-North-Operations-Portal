// Boards Review, Goals view (Phase B2 staging route).
//
// Lives inside the (app) group, so it gets the portal sidebar/topbar + auth
// gate. The legacy boards.html stays the live Boards Review until cutover (B6);
// this route is where the native rewrite is built and compared.

import { redirect } from 'next/navigation'
import { GoalsView } from '@/components/boards/GoalsView'
import { requireSurface } from '@/lib/access/resolve'

export default async function BoardsBetaPage() {
  // Same pair as its own sub-pages and as the card that leads here: the area
  // from the access level, the tool from the team. This landing checked only
  // the area, so it opened by URL for teams without the Workload grant.
  const access = await requireSurface('tools')
  if (!access.canTool('workload')) redirect('/work-tools')

  return <GoalsView />
}
