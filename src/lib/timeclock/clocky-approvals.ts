/**
 * The Approvals page's data (design handoff of 16 October 2026, README "Time
 * correction requests and approvals", Time Entries.dc.html frames 3L and 3L-2):
 * the time corrections waiting for the viewer's decision in their scope, and
 * for Super Admins the time off too; and what was decided.
 *
 * Not a "use server" file: app/(app)/clocky-hours/approvals/actions.ts serves it.
 */

import { allRows, db, loadCatalog, loadDirectory, type Viewer } from './clocky-context'
import { overlapFor } from './clocky-store'
import { approveOverlapLine } from './entry-rules'
import { dayLabel, initials, stampLabel, timeLabel, zoneAbbr } from './format'
import { recordedSeconds } from './rounding'
import { workingDays } from './absence'
import { canApproveCorrection, canDecideTimeOff, seesEveryone } from './scope'
import type { ApprovalRow, ApprovalsData } from './clocky-types'
import { goesToLabel, teamLeadNames, waitingOrder } from './clocky-requests'

/** Decided requests shown: the last 90 days. */
const DECIDED_DAYS = 90

type Correction = { id: number; person_id: string; entry_date: string; started_at: string; ended_at: string; jobcode_id: number; fields: Record<string, string>; reason: string; state: string; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; entry_id: number | null }
type TimeOff = { id: number; person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number; state: string; reason: string | null; requested_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null }

/** The one-line subtitle per level (exact copy; a Team Leader's names their teams). */
export function approvalsSubtitle(level: 'super' | 'admin' | 'lead', teamNames: readonly string[]): string {
  if (level === 'super') return 'Time corrections and time off waiting for a decision. Only Super Admins decide time off.'
  if (level === 'admin') return 'Time corrections from everyone, waiting for a decision. Super Admins decide time off.'
  const teams = teamNames.length <= 1 ? `the ${teamNames[0] ?? 'your'} team` : `the ${teamNames.slice(0, -1).join(', ')} and ${teamNames[teamNames.length - 1]} teams`
  return `Time corrections from ${teams}, waiting for your decision.`
}

export async function loadApprovals(v: Viewer, now: Date): Promise<ApprovalsData> {
  const c = db()
  const [dir, catalog] = await Promise.all([loadDirectory(), loadCatalog()])
  const since = new Date(now.getTime() - DECIDED_DAYS * 86_400_000).toISOString()
  const decidesTimeOff = v.can('ck-timeoff')
  const [corrections, timeOff] = await Promise.all([
    allRows<Correction>((a, b) => c.from('tc_correction_requests').select('*')
      .or(`state.eq.pending,decided_at.gte.${since}`).order('requested_at').range(a, b), 'Time corrections could not be read'),
    decidesTimeOff
      ? allRows<TimeOff>((a, b) => c.from('tc_absence_requests').select('id, person_id, jobcode_id, start_date, end_date, hours_per_day, state, reason, requested_at, decided_by, decided_at, decision_note')
        .or(`state.eq.pending,decided_at.gte.${since}`).in('state', ['pending', 'approved', 'denied']).order('requested_at').range(a, b), 'Time off could not be read')
      : Promise.resolve([] as TimeOff[]),
  ])

  const person = (id: string) => {
    const p = dir.people.get(id)
    const team = p?.teamId ? dir.teams.get(p.teamId) : undefined
    return { name: p?.name ?? 'Someone', initials: initials(p?.name ?? ''), team: team ? { name: team.name, color: team.color } : null }
  }
  const decided = (by: string | null, at: string | null, note: string | null) =>
    by && at ? { by: dir.nameOf(by), at, when: stampLabel(at, v.zone), note } : null

  const rows: ApprovalRow[] = []
  for (const r of corrections) {
    const target = dir.target(r.person_id)
    if (!canApproveCorrection(v, target)) continue
    const zone = dir.zoneOf(r.person_id)
    const job = catalog.jobs.get(r.jobcode_id)
    const activity = catalog.keys.activity ? r.fields?.[catalog.keys.activity] ?? '' : ''
    const abbr = zone !== v.zone ? ` ${zoneAbbr(zone, new Date(r.started_at))}` : ''
    let overlap: string | null = null
    if (r.state === 'pending') {
      const o = await overlapFor(c, r.person_id, { start: r.started_at, end: r.ended_at }, [], now)
      if (o) overlap = approveOverlapLine(o.other, catalog.jobs.get(o.other.row.jobcode_id ?? -1)?.short ?? '', zone)
    }
    rows.push({
      key: `c${r.id}`, type: 'correction', id: r.id, personId: r.person_id, ...person(r.person_id),
      date: r.entry_date,
      goesTo: goesToLabel(teamLeadNames(r.person_id, target.teamIds, dir.led, id => !!dir.people.get(id)?.active, id => dir.nameOf(id))),
      seconds: recordedSeconds(r.started_at, r.ended_at),
      when: `${dayLabel(r.entry_date)}, ${r.entry_date.slice(0, 4)} · ${timeLabel(r.started_at, zone)} to ${timeLabel(r.ended_at, zone)}${abbr}`,
      job: `${job?.path ?? ''} · ${activity || 'No activity'}`,
      reason: r.reason,
      askedAt: r.requested_at,
      asked: `Asked ${stampLabel(r.requested_at, v.zone)}`,
      state: r.state as ApprovalRow['state'],
      decided: decided(r.decided_by, r.decided_at, r.state === 'denied' ? r.decision_note : null),
      entryId: r.entry_id,
      overlap,
      canDecide: r.state === 'pending',
    })
  }
  for (const r of timeOff) {
    if (!canDecideTimeOff(v, dir.target(r.person_id))) continue
    const type = catalog.jobs.get(r.jobcode_id)?.name ?? 'Time off'
    const days = workingDays(r.start_date, r.end_date).length
    const range = r.start_date === r.end_date ? dayLabel(r.start_date) : `${dayLabel(r.start_date)} to ${dayLabel(r.end_date)}`
    rows.push({
      key: `o${r.id}`, type: 'time_off', id: r.id, personId: r.person_id, ...person(r.person_id),
      date: r.start_date,
      goesTo: '',
      seconds: Math.round(days * Number(r.hours_per_day) * 3600),
      when: `${range}, ${r.end_date.slice(0, 4)} · ${type}`,
      job: '',
      reason: r.reason ?? '',
      askedAt: r.requested_at,
      asked: `Asked ${stampLabel(r.requested_at, v.zone)}`,
      state: r.state as ApprovalRow['state'],
      decided: decided(r.decided_by, r.decided_at, r.state === 'denied' ? r.decision_note : null),
      entryId: null,
      overlap: null,
      canDecide: r.state === 'pending',
    })
  }

  const level = v.isSuperAdmin ? 'super' : seesEveryone(v) ? 'admin' : 'lead'
  const led = [...v.ledTeamIds].map(id => dir.teams.get(id)?.name).filter((n): n is string => !!n).sort()
  return {
    level: v.level,
    subtitle: approvalsSubtitle(level, led),
    note: "Times in each person's own time zone. Approved time becomes an entry marked Edited.",
    // As the prototype lists them: waiting by the request's day, oldest first; decided in the order
    // the requests came (corrections, then time off, each as asked), unsorted.
    waiting: waitingOrder(rows.filter(r => r.state === 'pending')),
    decided: rows.filter(r => r.state !== 'pending'),
  }
}

/** The number on the Clocky menu row "Approvals": what is waiting for the viewer. */
export async function countWaiting(v: Viewer): Promise<number> {
  if (!v.can('clocky-approvals')) return 0
  const c = db()
  const dir = await loadDirectory()
  const [corr, off] = await Promise.all([
    allRows<{ person_id: string }>((a, b) => c.from('tc_correction_requests').select('person_id').eq('state', 'pending').order('id').range(a, b), 'Time corrections could not be read'),
    v.can('ck-timeoff')
      ? allRows<{ person_id: string }>((a, b) => c.from('tc_absence_requests').select('person_id').eq('state', 'pending').order('id').range(a, b), 'Time off could not be read')
      : Promise.resolve([] as { person_id: string }[]),
  ])
  return corr.filter(r => canApproveCorrection(v, dir.target(r.person_id))).length
    + off.filter(r => canDecideTimeOff(v, dir.target(r.person_id))).length
}
