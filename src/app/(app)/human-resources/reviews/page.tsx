// Human Resources > Reviews (owner, 10 November 2026): the year's list. HR
// and Super Admins see everyone; the VP of Operations, the CISO and each
// reviewer the people who report to them; everyone else only their own
// review. Before the year starts, what it needs and "Start Reviews" (the VP
// of Operations, a Super Admin as back-up); once started, the progress block
// on top for the VP, the CISO, HR and Super Admins.

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { previewHref } from '@/lib/auth/view-as-server'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ReviewList, type DateRow, type ImportListRow, type KickoffInfo, type ListRow } from '@/components/review/ReviewList'
import { reviewContext } from '@/lib/review/page-context'
import { requireSurface } from '@/lib/access/resolve'
import { defaultYear, ensureYearCycle, loadCycles, loadImports, loadParts, loadPriorities, loadReviews, nameIn, reviewToday } from '@/lib/review/data'
import { dueOf, dueWords } from '@/lib/review/rules'
import { partsOf, partWaitsFor } from '@/lib/review/parts'
import { PLAN, planFrom, type DateKey } from '@/lib/review/schedule'
import { loadProgress } from '@/lib/review/progress-data'
import { fmtDay } from '@/lib/review/format'
import { approveAll, moveDatesUp, remindNow, saveReviewDates, startCycle } from '../actions'
import { Tabs } from '@/components/ui/Tabs'
import { hrTabs } from '@/lib/review/hr-tabs'
import { loadHistory, loadTeamGoals } from '@/lib/review/mine'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Reviews' }

const WHO: Record<DateKey, string> = {
  company_due: 'CISO', vp_due: 'VP of Operations', self_due: 'Everyone; Team Leaders write their team\'s priorities first', review_due: 'VP for the Team Leaders, Team Leaders for their members',
  leaders_meeting_due: 'VP and each Team Leader', meeting_due: 'Each Team Leader and their members', leaders_approval_due: 'VP of Operations', approval_due: 'Team Leaders',
}

export default async function ReviewsRoute({ searchParams }: { searchParams: Promise<{ year?: string; start?: string }> }) {
  const ctx = await reviewContext(await requireSurface('human-resources'))
  const { viewer, roster, settings, access } = ctx
  const canStart = viewer.isVp || access.can('hr-start')
  // From November 1 the current year exists for whoever may start it or sees everything, so "Start Reviews" has a place.
  const thisYear = defaultYear()
  let cycles = await loadCycles()
  if ((canStart || viewer.seesAll) && reviewToday() >= `${thisYear}-11-01` && !cycles.some(c => c.year === thisYear)) {
    await ensureYearCycle(thisYear)
    cycles = await loadCycles()
  }
  const imported = await loadImports()
  const importYears = [...new Set(imported.filter(i => i.imported_at).map(i => i.year))]
  const years = [...new Set([...cycles.map(c => c.year), ...importYears])].sort((a, b) => b - a)
  const sp = await searchParams
  const q = Number(sp.year)
  const year = years.includes(q) ? q : years[0]
  const today = reviewToday()
  const crumbs = <Breadcrumb parents={['/human-resources']} self="/human-resources/reviews" />
  // The same tabs as Human Resources, with Reviews on.
  const me = viewer.personId
  const [history, team] = await Promise.all([me ? loadHistory(me, roster) : [], viewer.reports.size ? loadTeamGoals(viewer, roster, today) : []])
  const tabs = <Tabs label="Human Resources" value="all" items={hrTabs({ first: !history.some(h => h.kind === 'approved') && !team.length, team: viewer.reports.size > 0, all: true })} />
  const none = { kickoff: null, progress: null, dates: null, approvals: null }

  if (!year) {
    if (!viewer.seesAll) redirect(await previewHref('/human-resources'))
    return <div className="flex flex-col gap-4">{crumbs}<ReviewList year={new Date().getFullYear()} years={[]} intro="No review year yet." rows={[]} imports={null} canPriorities={false} {...none} /></div>
  }

  const cycle = cycles.find(c => c.year === year) ?? null
  // A year with only imported files: the list of those files.
  if (!cycle) {
    const rows: ImportListRow[] = imported.filter(i => i.year === year && i.imported_at && i.person_id && (viewer.seesAll || viewer.reports.has(i.person_id) || i.person_id === viewer.personId))
      .map(i => ({ id: i.id, name: nameIn(roster, i.person_id), file: i.file_name, when: i.imported_at })).sort((a, b) => a.name.localeCompare(b.name))
    return <div className="flex flex-col gap-4">{crumbs}<ReviewList year={year} years={years} intro={`The ${year} reviews, imported from Google Drive.`} rows={[]} imports={rows} canPriorities={false} {...none} tabs={tabs} /></div>
  }

  const [reviews, priorities] = await Promise.all([loadReviews(cycle.id), loadPriorities(cycle.id)])
  const extra = await loadParts(reviews.map(r => r.id))
  const lead = viewer.isVp || viewer.isCiso
  const visible = reviews.filter(r => viewer.seesAll || viewer.reports.has(r.person_id) || r.person_id === viewer.personId)
  if (!viewer.seesAll && !lead && !canStart && !visible.some(r => r.person_id !== viewer.personId)) {
    const mine = visible.find(r => r.person_id === viewer.personId)
    redirect(await previewHref(mine ? `/human-resources/reviews/${mine.id}` : '/human-resources'))
  }
  const now = new Date()
  const rows: ListRow[] = visible.map(r => {
    const p = roster.people.get(r.person_id)
    const parts = partsOf(r, extra, r.team_id ? roster.teams.get(r.team_id)?.name ?? '' : '')
    const open = parts.filter(x => x.step !== 'approved' && x.step !== 'waiting')
    // The step shown: the self-review, else the earliest part still open.
    const RANK = { waiting: 0, review: 1, meeting: 2, approval: 3, approved: 4 } as const
    const low = open.sort((a, b) => RANK[a.step] - RANK[b.step])[0]
    const step: ListRow['step'] = r.step === 'self' || r.step === 'waiting' || r.step === 'approved' ? r.step : low?.step === 'review' || low?.step === 'meeting' || low?.step === 'approval' ? low.step : 'approval'
    const due = r.step === 'self' ? dueOf('self', r.phase, cycle) : low ? dueOf(low.step, low.lane, cycle) : null
    const role = r.person_id === settings.vpId ? `VP of Operations${settings.cisoId ? `, with ${nameIn(roster, settings.cisoId)}` : ''}` : r.person_id === settings.cisoId ? 'CISO' : null
    const waits = r.step === 'self' ? nameIn(roster, r.person_id) : r.step === 'approved' ? '' : open.map(x => {
      const w = partWaitsFor(x, r.person_id, now)
      if (x.step === 'meeting' && !x.meetingStartsAt) return `${nameIn(roster, x.reviewerId)}, to book`
      if (x.step === 'meeting' && x.meetingStartsAt && !(x.meetingEndsAt && new Date(x.meetingEndsAt) <= now)) return `Booked for ${fmtDay(x.meetingStartsAt.slice(0, 10))}`
      return w ? nameIn(roster, w) : ''
    }).filter(Boolean).filter((w, i, all) => all.indexOf(w) === i).join(', ')
    const late = !!due && today > due && r.step !== 'approved'
    return {
      id: r.id, personId: r.person_id, name: p?.name ?? 'Someone', sub: role ?? p?.title ?? '', team: r.team_id ? roster.teams.get(r.team_id)?.name ?? '' : 'No team',
      leader: parts.map(x => nameIn(roster, x.reviewerId)).filter(Boolean).join(', ') || null,
      step, sentBack: !!r.sent_back_at && r.step === 'self', booked: low?.meetingStartsAt ?? null,
      waits, due, dueText: r.step === 'approved' ? '' : late ? dueWords(due!, today) : due ? fmtDay(due) : '', late, approvedOn: r.approved_at, drive: r.drive_status,
    }
  })
  const order = { self: 0, waiting: 1, review: 2, meeting: 3, approval: 4, approved: 5 } as const
  rows.sort((a, b) => Number(b.late) - Number(a.late) || order[a.step] - order[b.step] || a.name.localeCompare(b.name))

  // Before the start: what it needs, and the dates it would set from today.
  let kickoff: KickoffInfo | null = null
  if (!cycle.started_at && (viewer.seesAll || canStart || lead)) {
    const lastYear = imported.filter(i => i.year === year - 1)
    const needPerson = lastYear.filter(i => !i.imported_at && !i.person_id && i.match !== 'skipped').length
    const done = lastYear.filter(i => i.imported_at).length
    const plan = planFrom(today)
    const company = priorities.filter(p => !p.team_id && (p.kind ?? 'company') === 'company')
    kickoff = {
      canStart: canStart && year === defaultYear(),
      canSettings: access.can('cs-hr'),
      warn: !settings.vpId || !settings.cisoId ? 'Pick the VP of Operations and the CISO in Company settings first: the reviews cannot start without them.' : needPerson ? `${needPerson} of the ${year - 1} reviews still ${needPerson === 1 ? 'needs' : 'need'} a person. You can fix it after starting.` : null,
      people: ctx.parts.length, added: settings.extra.map(id => nameIn(roster, id)), finish: fmtDay(plan.approval_due),
      plan: [{ label: 'Start the reviews', who: 'VP of Operations', due: `Today, ${fmtDay(today).replace(/^\w+, /, '')}` }, ...PLAN.map(x => ({ label: x.label, who: WHO[x.key], due: fmtDay(plan[x.key]) }))],
      checks: [
        { key: 'roles', label: 'Roles', ok: settings.vpId && settings.cisoId && settings.hrId ? true : settings.vpId && settings.cisoId ? 'warn' : false, href: '/admin/settings#human-resources', action: 'Change', text: `VP of Operations: ${nameIn(roster, settings.vpId) || 'not picked'} · CISO: ${nameIn(roster, settings.cisoId) || 'not picked'} · HR: ${nameIn(roster, settings.hrId) || 'not picked'}` },
        { key: 'people', label: 'Who takes part', ok: true, href: '/admin/settings#human-resources', action: 'Change', text: `${ctx.parts.length - settings.extra.length} employees from the Directory · ${settings.extra.length ? `added: ${settings.extra.map(id => nameIn(roster, id)).join(', ')}` : 'nobody added'} · ${ctx.parts.filter(p => p.secondReviewerId).length} with two reviewers` },
        { key: 'priorities', label: `Company Priorities for ${year + 1}`, ok: company.length ? true : 'warn', href: '/human-resources/reviews/priorities', action: 'Open', text: company.length ? `${company.length} written already` : 'The CISO writes them in the first days after the start.' },
        { key: 'drive', label: 'Google Drive folder', ok: settings.driveFolderId ? true : 'warn', href: '/admin/settings#human-resources', action: 'Change', text: settings.driveFolderName ? `${settings.driveFolderName} / ${year}` : 'Not picked: the PDFs go into the portal\'s Drive folder.' },
        { key: 'last', label: "Last year's reviews", ok: !lastYear.length || done < lastYear.length ? 'warn' : true, href: '/admin/settings#human-resources', action: 'Fix it', text: !lastYear.length ? `No ${year - 1} reviews imported. It does not stop the start.` : `${done} of ${lastYear.length} files imported${needPerson ? ` · ${needPerson} still ${needPerson === 1 ? 'needs' : 'need'} a person` : ''}` },
      ],
    }
  }

  const sees = viewer.seesAll || lead
  const progress = cycle.started_at && sees ? await loadProgress(cycle, roster, settings, now) : null
  const canDates = cycle.started_at && (viewer.isVp || viewer.isHr || access.can('cs-hr-edit'))
  const dates: DateRow[] | null = canDates ? PLAN.map(p => ({ key: p.key, label: p.label, value: (cycle as unknown as Record<string, string | null>)[p.key] ?? null })) : null
  // "Approve all": the parts waiting for the viewer's approval.
  const mineToApprove = me ? reviews.filter(r => partsOf(r, extra).some(p => p.reviewerId === me && p.step === 'approval')) : []
  const approvals = mineToApprove.length ? { ids: mineToApprove.map(r => r.id), names: mineToApprove.map(r => nameIn(roster, r.person_id)).sort() } : null

  const intro = cycle.started_at
    ? `Annual performance reviews. The ${year} reviews started on ${fmtDay(cycle.started_at.slice(0, 10))}${cycle.approval_due ? `; everything is due by ${fmtDay(cycle.approval_due)}` : ''}.`
    : `The ${year} reviews have not started.`
  return (
    <div className="flex flex-col gap-4">
      {crumbs}
      <ReviewList year={year} years={years} intro={intro} rows={cycle.started_at ? rows : []} imports={null} canPriorities={viewer.leads || viewer.seesAll}
        kickoff={kickoff} progress={progress} dates={dates} approvals={approvals} openStart={sp.start === '1'}
        api={{ startCycle, moveDatesUp, saveReviewDates, approveAll, remindNow }} tabs={tabs} />
    </div>
  )
}
