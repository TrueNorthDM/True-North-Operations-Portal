// A person's annual reviews on their Directory page (annual review handoff,
// G2): every year, with the PDF, and how their goals stand. Shown only to who
// may see their reviews: the person, the one they report to now, HR, the VP of
// Operations, the CISO and Super Admins (lib/review/data.ts). A former manager
// stops seeing them.

import Link from 'next/link'
import { BTN } from '@/lib/ui/buttons'
import { CARD } from '@/lib/ui/type'
import { ReviewHistory } from './HrParts'
import { loadGoalsView, loadHistory } from '@/lib/review/mine'
import { canSeePerson, currentReviewerOf, loadHrSettings, loadRoster, nameIn, reviewToday, rosterParticipants, viewerOf } from '@/lib/review/data'
import { fmtDay } from '@/lib/review/format'
import type { Access } from '@/lib/access/resolve'

async function load(access: Access, personId: string) {
  const [settings, roster] = await Promise.all([loadHrSettings(), loadRoster()])
  const viewer = viewerOf(access, settings, rosterParticipants(roster, settings))
  if (!canSeePerson(viewer, personId)) return null
  const manager = currentReviewerOf(roster, settings, personId)
  const [rows, goals] = await Promise.all([loadHistory(personId, roster), loadGoalsView(personId, roster, reviewToday(), manager)])
  return { roster, manager, rows, goals }
}

export async function PersonReviews({ access, personId }: { access: Access; personId: string }) {
  const d = await load(access, personId).catch(e => { console.error('[person] reviews:', e instanceof Error ? e.message : e); return 'failed' as const })
  if (d === 'failed') return <p className="m-0 text-[13px] text-muted">The annual reviews could not be read. Reload the page in a moment.</p>
  if (!d || (!d.rows.length && !d.goals)) return null
  const { roster, manager, rows, goals } = d
  const first = nameIn(roster, personId).split(' ')[0]
  const own = access.personId === personId
  const who = own ? 'You, the person you report to and HR see these.' : `${first}, ${manager === access.personId ? 'you (they report to you)' : manager ? nameIn(roster, manager) : 'the person they report to'} and HR see these.`
  return (
    <div className="flex flex-col gap-3">
      <ReviewHistory rows={rows} intro={who} footer={own ? 'Your reviews stay here for as long as you work at True North.' : 'A new manager sees every past review of the people who report to them now. A former manager stops seeing them.'} />
      {goals && (
        <div className={`${CARD} px-[22px] py-4 flex items-center gap-3 flex-wrap`}>
          <div className="flex-1 min-w-[220px] flex flex-col gap-0.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Goals for {goals.year}</span>
            <span className="text-[13px] text-muted">{goals.summary || 'No goals'}{goals.checkinsBy ? ` · 6-month check-in by ${fmtDay(goals.checkinsBy)}` : ''}</span>
          </div>
          <Link href={own ? '/human-resources?tab=goals' : manager === access.personId ? `/human-resources/team-goals/${personId}` : `/human-resources/reviews/${goals.reviewId}`} className={BTN.smallWhite}>Open the goals</Link>
        </div>
      )}
    </div>
  )
}
