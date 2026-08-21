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

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadWorklist } from '@/lib/monday/worklist/data'
import { initialsOf, TEAM_COLOR, teamKeyFromName } from '@/lib/directory/people-types'
import type { EffortBasis } from '@/components/report/WorkloadHoldings'
import type { WorkloadRow } from './workload'
import { BACKLOG_WEEKS, UTILISATION_WEEKS } from './workload'
import { accountsInScope, loadSpans, NO_TABLE } from './data'
import { activePeople, primaryTeams } from './directory'
import type { LoggedEvent } from './spans'
import type { Period } from './scope'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const DAY = 86_400_000

/** The horizon the Load column looks ahead over. Fixed, never the period. */
const AHEAD_DAYS = 30

/**
 * Hours a step takes, estimated.
 *
 * No board in this account is linked to a timeclock project code, so there is
 * nothing to measure per board: every board shares one average, total approved
 * hours over total steps delivered. The audit says "fallback" for all of them,
 * which is the truth and is exactly what that chip is for.
 *
 * Null when the log has delivered nothing yet. An average over no steps is not
 * a small number, it is no number, and Load has to say so rather than divide.
 */
export function hoursPerStep(totalHours: number, delivered: number): number | null {
  if (delivered <= 0) return null
  return Math.round((totalHours / delivered) * 10) / 10
}

function weekIndex(iso: string, now: number, weeks: number): number | null {
  const back = Math.floor((now - Date.parse(iso)) / (7 * DAY))
  return back >= 0 && back < weeks ? weeks - 1 - back : null
}

export async function loadWorkload(
  supabase: Client,
  f: { personId?: string | null; teamId?: string | null; period?: Period },
): Promise<{ people: WorkloadRow[]; effort: EffortBasis[]; estimateReady: boolean }> {
  const period = f.period ?? 90
  const now = Date.now()

  const [accounts, snapshot] = await Promise.all([
    accountsInScope(supabase, f),
    // Open steps only: Load is about what is still ahead of them.
    loadWorklist(supabase, { personId: f.personId, teamId: f.teamId, includeDone: false }),
  ])

  const people = await activePeople(supabase, f)
  if (!people.length) return { people: [], effort: [], estimateReady: false }

  const personIds = people.map(p => p.id)
  const teamOf = await primaryTeams(supabase, personIds)
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

  // One average across everybody in scope, so two people on the same screen
  // are measured with the same ruler.
  const totalHours = [...seconds.values()].reduce((s, x) => s + x, 0) / 3600
  const perStep = hoursPerStep(totalHours, spans.length)

  // Open steps due inside the horizon. A step with no date is left out: it is
  // work, but nothing says it is work for the next 30 days.
  const horizon = new Date(now + AHEAD_DAYS * DAY).toISOString().slice(0, 10)
  const aheadOf = new Map<string, number>()
  for (const r of snapshot.rows) {
    if (r.statusDone || r.dueSuspect || !r.dueDate) continue
    if (r.dueDate > horizon) continue
    const pid = personOf.get(r.mondayUserId)
    if (!pid) continue
    // Everything left here is due inside the horizon, overdue included: a
    // step whose date has passed is still ahead of them, because it is not
    // done. Excluding it would make the most overloaded person look free.
    aheadOf.set(pid, (aheadOf.get(pid) ?? 0) + 1)
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
      color: TEAM_COLOR[teamKeyFromName(teamOf.get(p.id) ?? null)],
      contracted: p.weekly_hours ?? 0,
      observed,
      hoursLogged: logged,
      estimatedAhead: Math.round((aheadOf.get(p.id) ?? 0) * (perStep ?? 0)),
      arriving: f.arriving,
      finishing: f.finishing,
      weekly: f.weekly,
    }
  })

  const { count: boards } = await supabase
    .from('monday_boards').select('id', { count: 'exact', head: true }).eq('included', true)

  const effort: EffortBasis[] = perStep === null ? [] : [{
    board: `${boards ?? 0} boards`,
    basis: `${Math.round(totalHours).toLocaleString('en-US')}h over ${spans.length} steps delivered`,
    perStep: `${perStep}h`,
    // No board in this account carries its own project code, so there is
    // nothing to measure per board and every one of them is a fallback.
    measured: false,
  }]

  return { people: rows, effort, estimateReady: perStep !== null }
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
