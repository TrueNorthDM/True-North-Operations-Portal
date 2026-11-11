// The priorities for next year (owner, 10 November 2026): the CISO's Company
// Priorities, the VP of Operations' and each team's. Open to the VP of
// Operations, the CISO, HR and Super Admins; everyone else goes back to the list.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PrioritiesPage, type Block, type MidYear, type TeamRow } from '@/components/review/PrioritiesPage'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { ensureCurrentCycle, loadLog, loadPriorities, nameIn } from '@/lib/review/data'
import { leadersOf } from '@/lib/review/rules'
import { fmtDay, fmtInstantDay, fmtTime } from '@/lib/review/format'
import { markPrioritiesReady, removePriority, savePriority, setPriorityMid, tellCheckin } from '../../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Priorities' }

/** "Ed Wagner, Arnaldo Oliveira and David Sharpe". */
const listOf = (names: string[]) => names.length < 2 ? names[0] ?? '' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

export default async function PrioritiesRoute() {
  const { viewer, roster, settings } = await reviewContext(await requireSurface('human-resources'))
  if (!viewer.leads && !viewer.seesAll) redirect(await previewHref('/human-resources/reviews'))
  const cycle = await ensureCurrentCycle()
  const [all, log] = await Promise.all([loadPriorities(cycle.id), loadLog({ cycleId: cycle.id }, 40)])
  const changedLine = (by: string | null, at: string) => `Changed by ${nameIn(roster, by)} on ${fmtInstantDay(at)}, ${fmtTime(at)}`
  const rowsOf = (kind: 'company' | 'vp') => all.filter(p => !p.team_id && (p.kind ?? 'company') === kind).map(p => ({ id: p.id, title: p.title, body: p.body, changed: p.updated_by ? changedLine(p.updated_by, p.updated_at) : null }))
  const blocks: Block[] = [
    { kind: 'company', title: 'Company Priorities', writer: nameIn(roster, settings.cisoId) || 'The CISO', canEdit: viewer.isCiso || viewer.isSuperAdmin,
      ready: cycle.company_done_at ? fmtInstantDay(cycle.company_done_at) : null, due: cycle.company_due ? fmtDay(cycle.company_due) : null, rows: rowsOf('company') },
    { kind: 'vp', title: "VP of Operations' priorities", writer: nameIn(roster, settings.vpId) || 'The VP of Operations', canEdit: viewer.isVp || viewer.isSuperAdmin,
      ready: cycle.vp_done_at ? fmtInstantDay(cycle.vp_done_at) : null, due: cycle.vp_due ? fmtDay(cycle.vp_due) : null, rows: rowsOf('vp') },
  ]
  const teams: TeamRow[] = []
  const noLeader: string[] = []
  for (const t of roster.teams.values()) {
    const leaders = leadersOf(t.id, roster.members).filter(id => roster.people.get(id)?.active)
    if (!leaders.length) { noLeader.push(t.name); continue }
    const mine = all.filter(p => p.team_id === t.id && p.title.trim())
    teams.push({
      // A team may have several leaders (Leadership has three): all of them, in the Directory's order.
      teamId: t.id, name: t.name, leader: listOf(leaders.map(id => nameIn(roster, id))), written: mine.length,
      line: mine.length ? mine.map(p => p.title).join(' · ') : `Written first in their self-review${cycle.self_due ? `, due ${fmtDay(cycle.self_due)}` : ''}.`,
    })
  }
  teams.sort((a, b) => Number(!!a.written) - Number(!!b.written) || a.name.localeCompare(b.name))
  const mid: MidYear | null = cycle.checkin_started_at ? {
    started: fmtInstantDay(cycle.checkin_started_at), told: cycle.checkin_told_at ? fmtInstantDay(cycle.checkin_told_at) : null, due: cycle.ck_priorities_due ? fmtDay(cycle.ck_priorities_due) : null,
    canEdit: viewer.leads, canTell: viewer.isVp || viewer.isSuperAdmin,
    rows: all.filter(p => !p.team_id).map(p => ({ id: p.id, title: p.title, kind: p.kind === 'vp' ? 'vp' as const : 'company' as const, status: p.mid_status, note: p.mid_note ?? '' })),
  } : null
  const notice = cycle.started_at
    ? `The ${cycle.year} reviews started ${fmtInstantDay(cycle.started_at)}. The goals for ${cycle.year + 1} open in every self-review when both are marked ready${cycle.vp_due ? `, or after ${fmtDay(cycle.vp_due)}` : ''}.`
    : `The ${cycle.year} reviews have not started. The priorities can be written now; the goals open once both are ready.`
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb parents={['/human-resources', '/human-resources/reviews']} now="Priorities" />
      <PrioritiesPage cycleId={cycle.id} year={cycle.year} notice={notice}
        intro="The CISO writes the Company Priorities, the VP of Operations adds theirs, and each Team Leader writes their team's first thing in their self-review. Every review shows the Company Priorities and the VP's; a person also sees their own team's."
        blocks={blocks} teams={teams} noLeader={noLeader}
        log={log.filter(l => l.kind.startsWith('priorit') || l.kind.startsWith('team')).map(l => ({ who: nameIn(roster, l.actor_id), text: l.text, at: l.created_at }))}
        mid={mid} api={{ savePriority, removePriority, markPrioritiesReady, setPriorityMid, tellCheckin }} />
    </div>
  )
}
