// The Workload tab, on real data.
//
// The one tab whose numbers are partly estimated, which is why screen 3.4
// sits under it permanently. Two of its three readings divide by hours, and
// the third is the flow of work arriving against work finishing.
//
// What is measured and what is estimated:
//
//   contracted   people.weekly_hours, a fact somebody typed
//   observed     approved timeclock hours over the window, divided by weeks
//   hoursLogged  approved timeclock hours, straight
//   arriving     hand-offs per week, from the change log (repeats and each
//                board's first read left out, migration 102)
//   finishing    done events per week, from the change log
//   estimated    open steps ahead × hours per step, and the hours per step is
//                the estimate the audit exists to expose
//
// Hours per step divides hours by steps delivered over the same 13 weeks and
// by the same people (audit, 9 October 2026). It used to divide 13 weeks of
// hours by the deliveries of whatever period was picked, which made the
// 30-day view's Load about three times the 90-day one.

import type { PeopleFilter } from '@/lib/monday/worklist/data'
import { initialsOf } from '@/lib/directory/people-types'
import { colourOf } from '@/lib/directory/team-colour'
import type { EffortBasis } from './types'
import type { WorkloadRow } from './workload'
import { BACKLOG_WEEKS, LOAD_HORIZON_DAYS, UTILISATION_WEEKS } from './workload'
import {
  accountOwners, accountsInScope, failed, loadOpenWork, loadSpans, reportCall, reportDb,
} from './data'
import { activePeople, primaryTeams, teamColours } from './directory'
import { periodStart, periodStartDay, reportToday } from './clock'
import { addDays } from '@/lib/notifications/schedule'
import type { Span } from './spans'
import type { Period } from './scope'
import { buildEffortTable, hoursFor, isMeasured, type BoardEffort, type EffortTable } from './effort'
import { approvedHours, hoursByCode } from './hours'

const DAY = 86_400_000

type FlowEvent = { monday_user_id: number; event: 'assigned' | 'done'; occurred_at: string }

function weekIndex(iso: string, now: number, weeks: number): number | null {
  const back = Math.floor((now - Date.parse(iso)) / (7 * DAY))
  return back >= 0 && back < weeks ? weeks - 1 - back : null
}

export async function loadWorkload(
  // The period switch does not move this tab: every window here is fixed.
  f: PeopleFilter & { period?: Period },
): Promise<{ people: WorkloadRow[]; effort: EffortBasis[]; estimateReady: boolean }> {
  const now = new Date()

  const [accounts, open, people, owners, colours] = await Promise.all([
    accountsInScope(f),
    // Open steps only: Load is about what is still ahead of them.
    loadOpenWork(f),
    activePeople(f),
    accountOwners(),
    teamColours(),
  ])
  if (!people.length) return { people: [], effort: [], estimateReady: false }

  const personIds = people.map(p => p.id)
  const window = UTILISATION_WEEKS * 7
  const since = periodStart(window, now)
  const [teamOf, seconds, scopeSpans, companySpans, events] = await Promise.all([
    primaryTeams(personIds),
    approvedHours(personIds, periodStartDay(window, now)),
    loadSpans(accounts, since),
    // A board's own hours per step is a fact about the board, so it is
    // measured on everyone's deliveries, like its hours.
    accounts === null ? Promise.resolve(null) : loadSpans(null, since),
    loadFlowEvents(accounts, new Date(now.getTime() - BACKLOG_WEEKS * 7 * DAY)),
  ])

  // The shared average: these people's hours over the steps these people
  // delivered, both over the same 13 weeks.
  const inScope = new Set(personIds)
  const delivered = scopeSpans.filter(s => inScope.has(owners.get(s.monday_user_id)?.personId ?? '')).length
  const totalHours = [...seconds.values()].reduce((s, x) => s + x, 0) / 3600

  // Per board where the board is linked to a project, and one shared average
  // everywhere else. A translation step and a monthly report step do not take
  // the same time, and one number for both tells a lead neither.
  const effort = buildEffortTable(
    await boardEffort(companySpans ?? scopeSpans, periodStartDay(window, now)),
    totalHours,
    delivered,
  )

  const ahead = estimatedAhead(open, effort, owners, addDays(reportToday(now), LOAD_HORIZON_DAYS))
  const flow = flowByPerson(events, owners, now.getTime())

  const rows: WorkloadRow[] = people.map(p => {
    const secs = seconds.get(p.id)
    const logged = secs === undefined ? null : Math.round(secs / 3600)
    const observed = logged === null ? null : Math.round((logged / UTILISATION_WEEKS) * 10) / 10
    const fl = flow.get(p.id) ?? { weekly: new Array(BACKLOG_WEEKS).fill(0), arriving: 0, finishing: 0 }
    const a = ahead.get(p.id)
    const team = teamOf.get(p.id) ?? null

    return {
      id: p.id,
      name: p.full_name,
      initials: initialsOf(p.full_name),
      color: colourOf(colours, team),
      contracted: p.weekly_hours ?? 0,
      observed,
      hoursLogged: logged,
      // Nothing due in the horizon is a measured zero; a step whose hours
      // nobody can estimate makes the whole figure unknown, never a zero.
      estimatedAhead: a === undefined ? 0 : a === null ? null : Math.round(a),
      arriving: fl.arriving,
      finishing: fl.finishing,
      weekly: fl.weekly,
    }
  })

  const audit = await effortAudit(effort, totalHours, delivered)
  return { people: rows, effort: audit, estimateReady: effort.fallback !== null || effort.perBoard.size > 0 }
}

/**
 * Estimated hours of open work due inside the horizon, per person. Null for
 * a person with a step nobody can estimate yet.
 */
export function estimatedAhead(
  open: { statusDone: boolean | null; dueSuspect: boolean; dueDate: string | null; mondayUserId: number; boardId: number }[],
  effort: EffortTable,
  owners: Map<number, { personId: string }>,
  horizon: string,
): Map<string, number | null> {
  const out = new Map<string, number | null>()
  for (const r of open) {
    // A step with no date is left out: it is work, but nothing says it is
    // work for the next 30 days.
    if (r.statusDone || r.dueSuspect || !r.dueDate || r.dueDate > horizon) continue
    const pid = owners.get(r.mondayUserId)?.personId
    if (!pid) continue
    // Everything left here is due inside the horizon, overdue included: a
    // step whose date has passed is still ahead of them, because it is not
    // done. Excluding it would make the most overloaded person look free.
    const h = hoursFor(effort, r.boardId)
    const cur = out.get(pid)
    out.set(pid, h === null || cur === null ? null : (cur ?? 0) + h)
  }
  return out
}

/** Hand-offs and finishes over the backlog window, for the flow columns. */
async function loadFlowEvents(accounts: number[] | null, since: Date): Promise<FlowEvent[]> {
  if (accounts !== null && !accounts.length) return []
  return (await reportCall<FlowEvent[] | null>('report_flow_events', {
    p_accounts: accounts, p_since: since.toISOString(),
  })) ?? []
}

/** Steps arriving and finishing per week, per person. */
function flowByPerson(events: FlowEvent[], owners: Map<number, { personId: string }>, now: number) {
  const out = new Map<string, { weekly: number[]; arriving: number; finishing: number }>()

  for (const e of events) {
    const pid = owners.get(e.monday_user_id)?.personId
    if (!pid) continue
    const week = weekIndex(e.occurred_at, now, BACKLOG_WEEKS)
    if (week === null) continue

    const cur = out.get(pid) ?? { weekly: new Array(BACKLOG_WEEKS).fill(0), arriving: 0, finishing: 0 }
    if (e.event === 'assigned') { cur.weekly[week] += 1; cur.arriving += 1 }
    else { cur.weekly[week] -= 1; cur.finishing += 1 }
    out.set(pid, cur)
  }

  // Per week, so a longer window does not read as a bigger queue.
  for (const v of out.values()) {
    v.arriving = Math.round((v.arriving / BACKLOG_WEEKS) * 10) / 10
    v.finishing = Math.round((v.finishing / BACKLOG_WEEKS) * 10) / 10
  }
  return out
}

/**
 * Hours booked to each mapped board, against what that board delivered, both
 * over the same window.
 *
 * Only boards carrying a project code appear: the rest have nothing of their
 * own to divide and take the shared average instead.
 */
async function boardEffort(spans: Span[], sinceDay: string): Promise<BoardEffort[]> {
  const { data, error } = await reportDb()
    .from('monday_boards')
    .select('id, name, tc_jobcode_id')
    .not('tc_jobcode_id', 'is', null)
  failed('the boards', error)

  const boards = (data ?? []) as { id: number; name: string; tc_jobcode_id: number }[]
  if (!boards.length) return []

  const secondsByCode = await hoursByCode([...new Set(boards.map(b => b.tc_jobcode_id))], sinceDay)
  const deliveredByBoard = new Map<number, number>()
  for (const s of spans) deliveredByBoard.set(s.board_id, (deliveredByBoard.get(s.board_id) ?? 0) + 1)

  return boards.map(b => ({
    boardId: b.id,
    boardName: b.name,
    hours: (secondsByCode.get(b.tc_jobcode_id) ?? 0) / 3600,
    delivered: deliveredByBoard.get(b.id) ?? 0,
  }))
}

/**
 * Screen 3.4's rows: what each figure was arrived at from.
 *
 * Measured boards first, since they are the ones somebody can check, then one
 * row standing for everything on the shared average.
 */
async function effortAudit(effort: EffortTable, totalHours: number, delivered: number): Promise<EffortBasis[]> {
  const rows: EffortBasis[] = []
  const db = reportDb()

  if (effort.perBoard.size) {
    const { data, error } = await db.from('monday_boards').select('id, name').in('id', [...effort.perBoard.keys()])
    failed('the boards', error)
    for (const b of (data ?? []) as { id: number; name: string }[]) {
      rows.push({
        board: b.name,
        basis: `its own project code, last ${UTILISATION_WEEKS} weeks`,
        perStep: `${effort.perBoard.get(b.id)}h`,
        measured: isMeasured(effort, b.id),
      })
    }
  }

  if (effort.fallback !== null) {
    const { count, error } = await db
      .from('monday_boards').select('id', { count: 'exact', head: true })
      .eq('included', true).is('tc_jobcode_id', null)
    failed('the boards', error)
    rows.push({
      board: `${count ?? 0} other boards`,
      basis: `${Math.round(totalHours).toLocaleString('en-US')}h over ${delivered} steps delivered, last ${UTILISATION_WEEKS} weeks`,
      perStep: `${effort.fallback}h`,
      measured: false,
    })
  }

  return rows
}
