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
//   arriving     assigned events per week, from the change log
//   finishing    done events per week, from the change log
//   estimated    open steps ahead × hours per step, and the hours per step is
//                the estimate the audit exists to expose

import type { Db } from '@/lib/supabase/types'
import { loadWorklist, type PeopleFilter } from '@/lib/monday/worklist/data'
import { initialsOf } from '@/lib/directory/people-types'
import { colourOf } from '@/lib/directory/team-colour'
import type { EffortBasis } from '@/components/report/WorkloadHoldings'
import type { WorkloadRow } from './workload'
import { BACKLOG_WEEKS, UTILISATION_WEEKS } from './workload'
import { accountsInScope, loadSpans, NO_TABLE } from './data'
import { activePeople, primaryTeams, teamColours } from './directory'
import type { LoggedEvent } from './spans'
import type { Period } from './scope'
import { buildEffortTable, hoursFor, isMeasured, type BoardEffort } from './effort'

type Client = Db

const DAY = 86_400_000

/** The horizon the Load column looks ahead over. Fixed, never the period. */
const AHEAD_DAYS = 30

function weekIndex(iso: string, now: number, weeks: number): number | null {
  const back = Math.floor((now - Date.parse(iso)) / (7 * DAY))
  return back >= 0 && back < weeks ? weeks - 1 - back : null
}

export async function loadWorkload(
  supabase: Client,
  f: PeopleFilter & { period?: Period },
): Promise<{ people: WorkloadRow[]; effort: EffortBasis[]; estimateReady: boolean }> {
  const period = f.period ?? 90
  const now = Date.now()

  const [accounts, snapshot] = await Promise.all([
    accountsInScope(supabase, f),
    // Open steps only: Load is about what is still ahead of them.
    loadWorklist(supabase, { personId: f.personId, teamId: f.teamId, teamIds: f.teamIds, includeDone: false }),
  ])

  const people = await activePeople(supabase, f)
  if (!people.length) return { people: [], effort: [], estimateReady: false }

  const personIds = people.map(p => p.id)
  const [teamOf, colours] = await Promise.all([primaryTeams(supabase, personIds), teamColours(supabase)])
  const utilSince = new Date(now - UTILISATION_WEEKS * 7 * DAY).toISOString().slice(0, 10)

  const [{ data: entries }, links, spans, events] = await Promise.all([
    supabase.from('tc_entries')
      .select('person_id, duration_seconds')
      .in('person_id', personIds)
      .in('state', ['approved', 'locked'])
      .gte('entry_date', utilSince)
      .limit(100_000),
    supabase.from('monday_user_links').select('monday_user_id, person_id').in('person_id', personIds),
    loadSpans(supabase, accounts, new Date(now - period * DAY)),
    loadFlowEvents(supabase, accounts, new Date(now - BACKLOG_WEEKS * 7 * DAY)),
  ])

  const seconds = new Map<string, number>()
  for (const e of (entries ?? []) as { person_id: string; duration_seconds: number }[]) {
    seconds.set(e.person_id, (seconds.get(e.person_id) ?? 0) + e.duration_seconds)
  }

  const personOf = new Map<number, string>(
    ((links.data ?? []) as { monday_user_id: number; person_id: string }[])
      .map(l => [l.monday_user_id, l.person_id]),
  )

  const totalHours = [...seconds.values()].reduce((s, x) => s + x, 0) / 3600

  // Per board where the board is linked to a project, and one shared average
  // everywhere else. A translation step and a monthly report step do not take
  // the same time, and one number for both tells a lead neither.
  const effort = buildEffortTable(
    await boardEffort(supabase, spans, new Date(now - period * DAY)),
    totalHours,
    spans.length,
  )

  // Open steps due inside the horizon. A step with no date is left out: it is
  // work, but nothing says it is work for the next 30 days.
  const horizon = new Date(now + AHEAD_DAYS * DAY).toISOString().slice(0, 10)
  // Hours, not steps: two open steps on different boards are not the same
  // amount of work, which is the whole reason the effort table exists.
  const aheadOf = new Map<string, number>()
  for (const r of snapshot.rows) {
    if (r.statusDone || r.dueSuspect || !r.dueDate) continue
    if (r.dueDate > horizon) continue
    const pid = personOf.get(r.mondayUserId)
    if (!pid) continue
    // Everything left here is due inside the horizon, overdue included: a
    // step whose date has passed is still ahead of them, because it is not
    // done. Excluding it would make the most overloaded person look free.
    aheadOf.set(pid, (aheadOf.get(pid) ?? 0) + (hoursFor(effort, r.boardId) ?? 0))
  }

  const flow = flowByPerson(events, personOf, now)

  const rows: WorkloadRow[] = people.map(p => {
    const secs = seconds.get(p.id)
    const logged = secs === undefined ? null : Math.round(secs / 3600)
    const observed = logged === null ? null : Math.round((logged / UTILISATION_WEEKS) * 10) / 10
    const f = flow.get(p.id) ?? { weekly: new Array(BACKLOG_WEEKS).fill(0), arriving: 0, finishing: 0 }

    return {
      id: p.id,
      name: p.full_name,
      initials: initialsOf(p.full_name),
      color: colourOf(colours, teamOf.get(p.id) ?? null),
      contracted: p.weekly_hours ?? 0,
      observed,
      hoursLogged: logged,
      estimatedAhead: Math.round(aheadOf.get(p.id) ?? 0),
      arriving: f.arriving,
      finishing: f.finishing,
      weekly: f.weekly,
    }
  })

  const audit = await effortAudit(supabase, effort, totalHours, spans.length)
  return { people: rows, effort: audit, estimateReady: effort.fallback !== null || effort.perBoard.size > 0 }
}

/** assigned and done events over the backlog window, for the flow columns. */
async function loadFlowEvents(supabase: Client, accounts: number[] | null, since: Date) {
  if (accounts !== null && !accounts.length) return []

  let q = supabase
    .from('monday_assignment_events')
    .select('board_id, item_id, people_col, monday_user_id, event, due_date, occurred_at')
    .in('event', ['assigned', 'done'])
    .gte('occurred_at', since.toISOString())
    .limit(50_000)
  if (accounts) q = q.in('monday_user_id', accounts)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE.has(error.code ?? '')) return []
    throw error
  }
  return (data ?? []) as LoggedEvent[]
}

/** Steps arriving and finishing per week, per person. */
function flowByPerson(events: LoggedEvent[], personOf: Map<number, string>, now: number) {
  const out = new Map<string, { weekly: number[]; arriving: number; finishing: number }>()

  for (const e of events) {
    const pid = personOf.get(e.monday_user_id)
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
 * Hours booked to each mapped board, against what that board delivered.
 *
 * Only boards carrying a project code appear: the rest have nothing of their
 * own to divide and take the shared average instead.
 */
async function boardEffort(supabase: Client, spans: { board_id: number }[], since: Date): Promise<BoardEffort[]> {
  const { data: mapped } = await supabase
    .from('monday_boards')
    .select('id, name, tc_jobcode_id')
    .not('tc_jobcode_id', 'is', null)

  const boards = (mapped ?? []) as { id: number; name: string; tc_jobcode_id: number }[]
  if (!boards.length) return []

  const { data: entries } = await supabase
    .from('tc_entries')
    .select('jobcode_id, duration_seconds')
    .in('jobcode_id', boards.map(b => b.tc_jobcode_id))
    .in('state', ['approved', 'locked'])
    .gte('entry_date', since.toISOString().slice(0, 10))
    .limit(100_000)

  const secondsByCode = new Map<number, number>()
  for (const e of (entries ?? []) as { jobcode_id: number; duration_seconds: number }[]) {
    secondsByCode.set(e.jobcode_id, (secondsByCode.get(e.jobcode_id) ?? 0) + e.duration_seconds)
  }

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
async function effortAudit(
  supabase: Client, effort: ReturnType<typeof buildEffortTable>, totalHours: number, delivered: number,
): Promise<EffortBasis[]> {
  const rows: EffortBasis[] = []

  if (effort.perBoard.size) {
    const { data } = await supabase
      .from('monday_boards').select('id, name').in('id', [...effort.perBoard.keys()])
    for (const b of (data ?? []) as { id: number; name: string }[]) {
      rows.push({
        board: b.name,
        basis: 'its own project code',
        perStep: `${effort.perBoard.get(b.id)}h`,
        measured: isMeasured(effort, b.id),
      })
    }
  }

  if (effort.fallback !== null) {
    const { count } = await supabase
      .from('monday_boards').select('id', { count: 'exact', head: true })
      .eq('included', true).is('tc_jobcode_id', null)
    rows.push({
      board: `${count ?? 0} other boards`,
      basis: `${Math.round(totalHours).toLocaleString('en-US')}h over ${delivered} steps delivered`,
      perStep: `${effort.fallback}h`,
      measured: false,
    })
  }

  return rows
}
