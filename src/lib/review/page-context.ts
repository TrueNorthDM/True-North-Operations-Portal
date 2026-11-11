/**
 * What every review page needs first: the access item, the review settings,
 * the Directory as it is now, and the viewer's place in the review (lib/review/
 * data.ts). A started year is brought up to date on the way (a new person's
 * review, a second reviewer's part), so nobody waits for the daily job.
 */

import type { Access } from '@/lib/access/resolve'
import { loadCurrentCycle, loadHrSettings, loadRoster, rosterParticipants, syncCycle, viewerOf, type HrSettings, type Roster, type ReviewViewer } from './data'
import type { Participant } from './rules'
import { sendOpenedNotices } from './service'

export interface ReviewContext { access: Access; settings: HrSettings; roster: Roster; parts: Participant[]; viewer: ReviewViewer }

/** `access`: the page's own requireSurface('human-resources'), so each page shows its guard. */
export async function reviewContext(access: Access): Promise<ReviewContext> {
  const [settings, roster] = await Promise.all([loadHrSettings(), loadRoster()])
  const parts = rosterParticipants(roster, settings)
  try {
    const c = await loadCurrentCycle()
    if (c?.started_at) { const { opened } = await syncCycle(c); await sendOpenedNotices(c, opened) }
  } catch (e) {
    console.error('[review] sync:', e instanceof Error ? e.message : e)
  }
  return { access, settings, roster, parts, viewer: viewerOf(access, settings, parts) }
}
