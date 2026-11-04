// Step 0, Priorities (design handoff, A3): for the VP of Operations and the
// CISO (and Super Admins). Everyone else goes back to the list.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PrioritiesPage, type TeamRow } from '@/components/review/PrioritiesPage'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { loadCurrentCycle, loadLog, loadPriorities, loadTeamStates, nameIn } from '@/lib/review/data'
import { leadersOf } from '@/lib/review/rules'
import { fmtDay, fmtInstantDay, fmtTime } from '@/lib/review/format'
import { approveTeamPriorities, removePriority, returnTeamPriorities, savePriority } from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Priorities' }

export default async function PrioritiesRoute() {
  const { viewer, roster, settings } = await reviewContext(await requireSurface('human-resources'))
  if (!viewer.leads) redirect(await previewHref('/human-resources/reviews'))
  const cycle = await loadCurrentCycle()
  if (!cycle) redirect(await previewHref('/admin/settings#human-resources'))
  const [all, states, log] = await Promise.all([loadPriorities(cycle.id), loadTeamStates(cycle.id), loadLog({ cycleId: cycle.id }, 40)])
  const changedLine = (by: string | null, at: string) => `Changed by ${nameIn(roster, by)} on ${fmtInstantDay(at)}, ${fmtTime(at)}`
  const teams: TeamRow[] = []
  const noLeader: string[] = []
  for (const t of roster.teams.values()) {
    const leaders = leadersOf(t.id, roster.members).filter(id => roster.people.get(id)?.active)
    if (!leaders.length) { noLeader.push(t.name); continue }
    const st = states.get(t.id)
    const mine = all.filter(p => p.team_id === t.id)
    const members = roster.members.filter(m => m.teamId === t.id && !leaders.includes(m.personId) && roster.people.get(m.personId)?.active).length
    const state = st?.state ?? 'none'
    teams.push({
      teamId: t.id, name: t.name, leader: nameIn(roster, leaders[0]), state, members,
      sentLine: st?.sent_at ? `Sent ${fmtInstantDay(st.sent_at)}, ${fmtTime(st.sent_at)}, from ${st.sent_by ? 'their' : 'the'} self-review` : null,
      line: state === 'approved' ? `${mine.length} ${mine.length === 1 ? 'priority' : 'priorities'}, approved ${fmtInstantDay(st!.decided_at)}.${st?.opened_at ? ` ${t.name}'s self-reviews are open.` : ''}`
        : state === 'sent' ? `${mine.length} ${mine.length === 1 ? 'priority' : 'priorities'}, sent ${fmtInstantDay(st!.sent_at)}.`
        : state === 'returned' ? `Sent back ${fmtInstantDay(st!.decided_at)}: ${st?.return_reason ?? ''}`
        : `Writing them in their self-review${cycle.leaders_due ? `, due ${fmtDay(cycle.leaders_due)}` : ''}.`,
      priorities: mine.map(p => ({ id: p.id, title: p.title, body: p.body, changed: p.updated_by ? changedLine(p.updated_by, p.updated_at) : null })),
    })
  }
  teams.sort((a, b) => Number(b.state === 'sent') - Number(a.state === 'sent') || a.name.localeCompare(b.name))
  const notice = cycle.started_at
    ? `Team Leaders' self-reviews are open${cycle.leaders_due ? ` until ${fmtDay(cycle.leaders_due)}` : ''}. A team's self-reviews open when you approve its priorities${cycle.teams_open_by ? `, or on ${fmtDay(cycle.teams_open_by)} at the latest` : ''}.`
    : `The ${cycle.year} cycle has not started. Write the whole-company priorities now; the Team Leaders write theirs once it starts.`
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb parents={['/human-resources', '/human-resources/reviews']} now="Priorities" />
      <PrioritiesPage cycleId={cycle.id} year={cycle.year} notice={notice}
        intro={`Step 0 of the review. The VP of Operations${settings.vpId ? ` (${nameIn(roster, settings.vpId)})` : ''} and the CISO${settings.cisoId ? ` (${nameIn(roster, settings.cisoId)})` : ''} write the whole-company priorities before the Team Leaders start. Each Team Leader writes their team's in their own self-review, and you approve them. A person sees the whole-company priorities and their own team's.`}
        company={all.filter(p => !p.team_id).map(p => ({ id: p.id, title: p.title, body: p.body, changed: p.updated_by ? changedLine(p.updated_by, p.updated_at) : null }))}
        teams={teams} noLeader={noLeader}
        log={log.filter(l => l.kind.startsWith('priority') || l.kind.startsWith('team')).map(l => ({ who: nameIn(roster, l.actor_id), text: l.text, at: l.created_at }))}
        api={{ savePriority, removePriority, approveTeamPriorities, returnTeamPriorities }} />
    </div>
  )
}
