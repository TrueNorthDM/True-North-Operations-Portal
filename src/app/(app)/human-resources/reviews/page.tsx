// Human Resources > Reviews (design handoff, B1 and A5): the year's list. HR,
// the VP of Operations, the CISO and Super Admins see everyone; a manager sees
// the people who report to them; everyone else only their own review. Before
// the year starts, the checklist and "Start the cycle" (Super Admin).

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ReviewList, type ImportListRow, type ListRow, type StartCheck } from '@/components/review/ReviewList'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { loadCycles, loadImports, loadPriorities, loadReviews, loadTeamStates, nameIn, reviewToday } from '@/lib/review/data'
import { dueOf, dueWords, waitsFor } from '@/lib/review/rules'
import { fmtDay } from '@/lib/review/format'
import { startCycle } from '../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reviews' }

export default async function ReviewsRoute({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const ctx = await reviewContext(await requireSurface('human-resources'))
  const { viewer, roster, settings, access } = ctx
  const cycles = await loadCycles()
  const imported = await loadImports()
  const importYears = [...new Set(imported.filter(i => i.imported_at).map(i => i.year))]
  const years = [...new Set([...cycles.map(c => c.year), ...importYears])].sort((a, b) => b - a)
  const q = Number((await searchParams).year)
  const year = years.includes(q) ? q : years[0]
  const today = reviewToday()
  const crumbs = <Breadcrumb parents={['/human-resources']} self="/human-resources/reviews" />

  if (!year) {
    if (!viewer.seesAll) redirect(await previewHref('/human-resources'))
    return <div className="flex flex-col gap-4">{crumbs}<ReviewList year={new Date().getFullYear()} years={[]} intro="No review year is set up yet. Set the dates in Company settings › Human Resources." rows={[]} imports={null} canPriorities={false} suggestions={0} start={null} /></div>
  }

  const cycle = cycles.find(c => c.year === year) ?? null
  // A year with only imported files: the list of those files.
  if (!cycle) {
    const rows: ImportListRow[] = imported.filter(i => i.year === year && i.imported_at && i.person_id && (viewer.seesAll || viewer.reports.has(i.person_id) || i.person_id === viewer.personId))
      .map(i => ({ id: i.id, name: nameIn(roster, i.person_id), file: i.file_name, when: i.imported_at })).sort((a, b) => a.name.localeCompare(b.name))
    return <div className="flex flex-col gap-4">{crumbs}<ReviewList year={year} years={years} intro={`The ${year} reviews, imported from Google Drive.`} rows={[]} imports={rows} canPriorities={false} suggestions={0} start={null} /></div>
  }

  const [reviews, states, priorities] = await Promise.all([loadReviews(cycle.id), loadTeamStates(cycle.id), loadPriorities(cycle.id)])
  const visible = reviews.filter(r => viewer.seesAll || r.reviewer_id === viewer.personId || r.person_id === viewer.personId)
  if (!viewer.seesAll && !visible.some(r => r.person_id !== viewer.personId)) {
    const mine = visible.find(r => r.person_id === viewer.personId)
    redirect(await previewHref(mine ? `/human-resources/reviews/${mine.id}` : '/human-resources'))
  }
  const now = new Date()
  const rows: ListRow[] = visible.map(r => {
    const p = roster.people.get(r.person_id)
    const due = dueOf(r.step, r.phase, cycle)
    const leader = r.phase === 2 ? nameIn(roster, r.reviewer_id) : null
    const role = r.person_id === settings.vpId ? `VP of Operations${settings.cisoId ? `, with ${nameIn(roster, settings.cisoId)}` : ''}` : r.person_id === settings.cisoId ? `CISO${settings.vpId ? `, with ${nameIn(roster, settings.vpId)}` : ''}` : null
    const w = waitsFor({ step: r.step, personId: r.person_id, reviewerId: r.reviewer_id, meetingEndsAt: r.meeting_ends_at, agreedAt: r.agreed_at }, now)
    const late = !!due && today > due && r.step !== 'approved'
    return {
      id: r.id, personId: r.person_id, name: p?.name ?? 'Someone', sub: role ?? p?.title ?? '', team: r.team_id ? roster.teams.get(r.team_id)?.name ?? '' : 'No team', leader,
      step: r.step, sentBack: !!r.sent_back_at && r.step === 'self', booked: r.meeting_starts_at,
      waits: r.step === 'meeting' && !r.meeting_starts_at ? `${nameIn(roster, r.reviewer_id)}, to book` : r.step === 'meeting' && r.meeting_starts_at && !(r.meeting_ends_at && new Date(r.meeting_ends_at) <= now) ? `Booked for ${fmtDay(r.meeting_starts_at.slice(0, 10))}` : r.step === 'waiting' ? 'Team priorities' : w ? nameIn(roster, w) : r.approved_at ? `Approved ${fmtDay(r.approved_at.slice(0, 10)).replace(/^\w+, /, '')}` : '',
      due, dueText: r.step === 'approved' ? '' : late ? dueWords(due!, today) : due ? fmtDay(due) : '', late, approvedOn: r.approved_at, drive: r.drive_status,
    }
  })
  const order = { self: 0, waiting: 1, review: 2, meeting: 3, approval: 4, approved: 5 } as const
  rows.sort((a, b) => Number(b.late) - Number(a.late) || order[a.step] - order[b.step] || a.name.localeCompare(b.name))

  let start: { checks: StartCheck[]; phase1: number; teamsOpenBy: string | null; canStart: boolean } | null = null
  if (!cycle.started_at && viewer.seesAll) {
    const parts = ctx.parts
    const lastYear = imported.filter(i => i.year === year - 1)
    const needPerson = lastYear.filter(i => !i.imported_at && i.match !== 'skipped').length
    const company = priorities.filter(p => !p.team_id)
    const datesOk = !!(cycle.leaders_open_on && cycle.self_due && cycle.review_due && cycle.meeting_due && cycle.approval_due)
    start = {
      phase1: parts.filter(p => p.phase === 1).length,
      teamsOpenBy: cycle.teams_open_by,
      canStart: access.can('hr-start'),
      checks: [
        { key: 'dates', label: 'Dates', ok: datesOk, href: '/admin/settings#human-resources', action: 'Change', text: datesOk ? `Team Leaders open on ${fmtDay(cycle.leaders_open_on)} · Teams open by ${fmtDay(cycle.teams_open_by)} · Approval by ${fmtDay(cycle.approval_due)}` : 'Not all set yet.' },
        { key: 'roles', label: 'Roles', ok: settings.vpId && settings.cisoId && settings.hrId ? true : 'warn', href: '/admin/settings#human-resources', action: 'Change', text: `VP of Operations: ${nameIn(roster, settings.vpId) || 'not picked'} · CISO: ${nameIn(roster, settings.cisoId) || 'not picked'} · HR: ${nameIn(roster, settings.hrId) || 'not picked'}` },
        { key: 'people', label: 'Who takes part', ok: true, href: '/admin/settings#human-resources', action: 'Change', text: `${parts.length - settings.extra.length} employees from the Directory · ${settings.extra.length ? `${settings.extra.length} added` : 'nobody added'}` },
        { key: 'priorities', label: `Company Priorities for ${year + 1}`, ok: company.length ? true : 'warn', href: '/human-resources/reviews/priorities', action: 'Open', text: company.length ? `${company.length} written` : 'None written yet.' },
        { key: 'drive', label: 'Google Drive folder', ok: settings.driveFolderId ? true : 'warn', href: '/admin/settings#human-resources', action: 'Change', text: settings.driveFolderName ? `${settings.driveFolderName} / ${year}` : 'Not picked: the PDFs go into the portal\'s Drive folder.' },
        { key: 'last', label: "Last year's reviews", ok: !lastYear.length ? 'warn' : needPerson ? 'warn' : true, href: '/admin/settings#human-resources', action: 'Fix it', text: !lastYear.length ? `No ${year - 1} reviews imported. It does not stop the cycle.` : `${lastYear.filter(i => i.imported_at).length} of ${lastYear.length} files imported${needPerson ? ` · ${needPerson} still ${needPerson === 1 ? 'needs' : 'need'} a person. It does not stop the cycle.` : ''}` },
      ],
    }
  }
  const suggestions = [...states.values()].filter(s => s.state === 'sent').length
  const intro = cycle.started_at
    ? `Annual performance reviews. The ${year} cycle opened on ${fmtDay(cycle.started_at.slice(0, 10))}${cycle.self_due ? `; self-reviews ${today > cycle.self_due ? 'were' : 'are'} due ${fmtDay(cycle.self_due).replace(/^\w+, /, '')}` : ''}.`
    : `The ${year} cycle has not started.${viewer.seesAll ? ' Check what it needs, then start it.' : ''}`
  return (
    <div className="flex flex-col gap-4">
      {crumbs}
      <ReviewList year={year} years={years} intro={intro} rows={cycle.started_at ? rows : []} imports={null} canPriorities={viewer.leads} suggestions={suggestions} start={start} onStart={startCycle} />
    </div>
  )
}
