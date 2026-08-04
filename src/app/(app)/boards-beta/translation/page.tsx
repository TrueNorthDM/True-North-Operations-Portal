// Boards Review, Translation view (Phase B3 staging route).

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { TranslationView } from '@/components/boards/TranslationView'

export default async function BoardsTranslationPage() {
  // Same pair as the card that leads here, see /boards-beta/targets.
  const access = await requireSurface('tools')
  if (!access.canTool('workload')) redirect('/tools')

  return <TranslationView />
}
