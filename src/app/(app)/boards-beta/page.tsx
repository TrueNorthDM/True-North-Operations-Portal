// Boards Review, Goals view (Phase B2 staging route).
//
// Lives inside the (app) group, so it gets the portal sidebar/topbar + auth
// gate. The legacy boards.html stays the live Boards Review until cutover (B6);
// this route is where the native rewrite is built and compared.

import { GoalsView } from '@/components/boards/GoalsView'
import { requireSurface } from '@/lib/access/resolve'

export default async function BoardsBetaPage() {
  await requireSurface('tools')

  return <GoalsView />
}
