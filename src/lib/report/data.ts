// What the Report can honestly say today.
//
// The five headline numbers do not all come from the same place, and the
// split is the whole point:
//
//   Open now, Late now      the current Monday snapshot, through loadWorklist
//   Delivered, On time,     the change log, which only knows what it has
//   Median held             watched happen since it started recording
//
// monday_assignments is deleted and re-inserted board by board on every sync,
// so it holds the present and nothing else. Until monday_assignment_events has
// been recording for a while there is no past to report on, and this returns
// that fact rather than a zero: a zero says "nothing was delivered", which is
// a different and much worse claim than "we were not watching yet".
//
// Every read here is the server's own (the privileged client), narrowed by the
// filter the app already decided (lib/report/view.ts). The change log and the
// timeclock are read through database functions (migration 102) that return
// one JSON value: read as rows they stopped at 1,000, and the Report was built
// on the log's first morning and on half the hours (audit, 9 October 2026).
// A read that fails stops the page; it never becomes a zero.

import type { Db } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadWorklist, peopleInFilter, type PeopleFilter, type WorkRow } from '@/lib/monday/worklist/data'
import { addDays, weekOf, zoneDate } from '@/lib/notifications/schedule'
import { AGE_BUCKETS, formatDays, type Overview } from './overview'
import { weekColumns, type Period } from './scope'
import { periodStart, REPORT_ZONE, reportToday, workingDaysBetween } from './clock'
import {
  deriveSpans, median, onTimeShare, percentile90, type LoggedEvent, type Span,
} from './spans'

type Client = Db

export type Recording =
  | { state: 'off' }                 // table not there yet
  | { state: 'empty' }               // there, nothing logged
  | { state: 'on'; startedAt: string }

export type ReportData = {
  overview: Overview
  recording: Recording
}

/** Postgres and PostgREST for "that table does not exist". */
export const NO_TABLE = new Set(['42P01', 'PGRST205'])

/** The Report's reads: the server's own client. */
export function reportDb(): Client {
  return createAdminClient()
}

/** A read that failed stops the page, with what could not be read. */
export function failed(what: string, error: { message: string } | null | undefined): void {
  if (error) throw new Error(`The Report could not read ${what}: ${error.message}`)
}

/** Calls one of the Report's database functions (migration 102). */
export async function reportCall<T>(fn: string, args: Record<string, unknown>, what = fn.replace(/_/g, ' ')): Promise<T> {
  // The generated types do not allow a null account list, which is how the
  // functions are told "everyone".
  const { data, error } = await (reportDb().rpc as unknown as
    (f: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>)(fn, args)
  failed(what, error)
  return data as T
}

/**
 * Whether the change log is running, and since when. No count: counting the
 * whole log on every page view was the slowest read on the page, and only the
 * Method tab says how many changes there are (countChanges).
 */
export async function readRecording(): Promise<Recording> {
  const { data, error } = await reportDb()
    .from('monday_assignment_events')
    .select('detected_at')
    .order('detected_at', { ascending: true })
    .limit(1)

  // Only the missing table is treated as "not recording". Anything else is a
  // real failure and has to surface, or the page quietly reports nothing at
  // all every time the database has a bad minute.
  if (error) {
    if (NO_TABLE.has(error.code ?? '')) return { state: 'off' }
    failed('the change log', error)
  }

  const first = (data ?? [])[0] as { detected_at: string } | undefined
  return first ? { state: 'on', startedAt: first.detected_at } : { state: 'empty' }
}

/** How many changes the log holds, for the Method tab. Estimated by the planner: it is a figure of speech there. */
export async function countChanges(): Promise<number> {
  const { count, error } = await reportDb()
    .from('monday_assignment_events')
    .select('id', { count: 'planned', head: true })
  failed('the change log', error)
  return count ?? 0
}

/**
 * A date that is behind us and worth believing.
 *
 * dueSuspect rows carry years like 202, typed wrong once and never noticed.
 * Counting them as late puts the most broken row at the top of a number
 * somebody is going to act on.
 */
export function isLate(due: string | null, suspect: boolean, today: string): boolean {
  return !suspect && due !== null && due < today
}

/** Monday accounts belonging to the people this scope covers. null is everyone. */
export async function accountsInScope(f: PeopleFilter): Promise<number[] | null> {
  const db = reportDb()
  const personIds = await peopleInFilter(db, f)
  if (personIds === null) return null
  if (!personIds.length) return []

  const out: number[] = []
  // In slices: a long list of people is longer than a query string should be.
  for (let i = 0; i < personIds.length; i += 200) {
    const { data, error } = await db
      .from('monday_user_links').select('monday_user_id').in('person_id', personIds.slice(i, i + 200))
    failed('the Monday account links', error)
    out.push(...((data ?? []) as { monday_user_id: number }[]).map(r => r.monday_user_id))
  }
  return out
}

/**
 * Which person each Monday account belongs to, with their name and whether
 * they are still active. One person can own several accounts, and every
 * per-person figure folds them back onto the directory person.
 */
export type AccountOwner = { personId: string; name: string; active: boolean }

export async function accountOwners(): Promise<Map<number, AccountOwner>> {
  const db = reportDb()
  const [links, people] = await Promise.all([
    db.from('monday_user_links').select('monday_user_id, person_id'),
    db.from('people').select('id, full_name, status'),
  ])
  failed('the Monday account links', links.error)
  failed('the directory', people.error)
  const byId = new Map(((people.data ?? []) as { id: string; full_name: string; status: string }[])
    .map(p => [p.id, p]))
  const out = new Map<number, AccountOwner>()
  for (const l of (links.data ?? []) as { monday_user_id: number; person_id: string }[]) {
    const p = byId.get(l.person_id)
    if (p) out.set(l.monday_user_id, { personId: p.id, name: p.full_name, active: p.status === 'active' })
  }
  return out
}

/**
 * Names Monday gives accounts nobody linked to a person. An account settled
 * as external (a client, an outside collaborator) gets no name: the held
 * chart compares our people, and it named clients.
 */
async function mondayNames(ids: number[]): Promise<Map<number, string | null>> {
  if (!ids.length) return new Map()
  const { data, error } = await reportDb().from('monday_users').select('id, name, is_external').in('id', ids)
  failed('the Monday accounts', error)
  return new Map(((data ?? []) as { id: number; name: string; is_external: boolean }[])
    .map(u => [u.id, u.is_external ? null : u.name]))
}

/**
 * The open work in scope, from the current snapshot.
 *
 * Open only (nothing finished is read just to be thrown away), uncapped (the
 * Everyone view used to stop at 5,000 rows without saying so), and with the
 * whole filter: a login linked to nobody reads nobody, never the company.
 */
export async function loadOpenWork(f: PeopleFilter): Promise<WorkRow[]> {
  const list = await loadWorklist(reportDb(), { ...f, openOnly: true, uncapped: true })
  return list.rows.filter(r => r.statusDone !== true)
}

/** Monday and the day the week starts on, in New York. Weeks run Monday to Sunday. */
function weekStartNy(iso: string): string {
  return weekOf(zoneDate(new Date(iso), REPORT_ZONE))
}

const WEEK_LABEL = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/** The Monday of the first column of the weekly chart. */
export function firstChartWeek(period: Period, now: Date): string {
  return addDays(weekOf(reportToday(now)), -(weekColumns(period) - 1) * 7)
}

/**
 * The weekly delivery chart.
 *
 * Every week gets a column, including the ones with nothing in them. Skipping
 * empty weeks would draw a busy fortnight and a quiet quarter with the same
 * number of bars. Whole weeks only, so its window is its own (stated on the
 * panel) rather than the period's.
 */
export function weeklyDelivery(spans: Span[], period: Period, now: Date): Overview['weeks'] {
  const first = firstChartWeek(period, now)
  const starts = Array.from({ length: weekColumns(period) }, (_, i) => addDays(first, i * 7))

  const counts = new Map(starts.map(s => [s, { total: 0, late: 0 }]))
  for (const s of spans) {
    const bucket = counts.get(weekStartNy(s.doneAt))
    if (!bucket) continue
    bucket.total++
    if ((s.lateDays ?? 0) > 0) bucket.late++
  }

  return starts.map(s => ({ label: WEEK_LABEL(s), ...counts.get(s)! }))
}

/**
 * Every step finished since a moment, as spans. The database returns every
 * event of those steps from a year before (a step finished last week may have
 * landed on them months ago); the done date is what gets filtered.
 */
export async function loadSpans(accounts: number[] | null, since: Date): Promise<Span[]> {
  if (accounts !== null && !accounts.length) return []
  const events = await reportCall<LoggedEvent[]>('report_span_events', {
    p_accounts: accounts, p_since: since.toISOString(),
  })
  return deriveSpans(events ?? []).filter(s => Date.parse(s.doneAt) >= since.getTime())
}

export const keyOfRow = (r: { itemId: number; peopleCol: string; mondayUserId: number }) =>
  `${r.itemId}|${r.peopleCol}|${r.mondayUserId}`

/**
 * When each still-open step landed on its person: the first hand-off since it
 * was last finished or taken off them. Only steps open in the snapshot, and
 * only the ones the log has seen land: work that predates the log has no
 * hand-off date and is left out rather than dated from the wrong thing.
 */
export async function loadOpenSince(accounts: number[] | null): Promise<Map<string, string>> {
  if (accounts !== null && !accounts.length) return new Map()
  const rows = await reportCall<{ item_id: number; people_col: string; monday_user_id: number; since: string }[]>(
    'report_open_since', { p_accounts: accounts },
  )
  return new Map((rows ?? []).map(r => [`${r.item_id}|${r.people_col}|${r.monday_user_id}`, r.since]))
}

/** Median and slowest-in-ten held time per person, slowest first. */
export function heldByPerson(
  spans: Span[], owners: Map<number, AccountOwner>, names: Map<number, string | null>,
): Overview['held'] {
  const byPerson = new Map<string, { name: string; days: number[] }>()
  for (const s of spans) {
    const owner = owners.get(s.monday_user_id)
    // An external account is left off the chart (its work still counts above).
    if (!owner && names.get(s.monday_user_id) === null) continue
    // One row per person, whatever number of Monday accounts they use.
    const key = owner ? owner.personId : `monday:${s.monday_user_id}`
    const name = owner ? owner.name : names.get(s.monday_user_id) ?? `Monday user ${s.monday_user_id}`
    const cur = byPerson.get(key) ?? { name, days: [] }
    cur.days.push(s.heldDays)
    byPerson.set(key, cur)
  }
  return [...byPerson.values()]
    .map(p => ({ name: p.name, median: median(p.days) ?? 0, p90: percentile90(p.days) ?? 0 }))
    .sort((a, b) => b.median - a.median)
}

export async function loadReportOverview(
  f: PeopleFilter & { period?: Period },
): Promise<ReportData> {
  const period = f.period ?? 90
  const now = new Date()
  const since = periodStart(period, now)
  // The weekly chart's whole weeks can start before the period does (5 weeks
  // against 30 days), so the log is read from whichever is earlier.
  const chartFrom = new Date(`${firstChartWeek(period, now)}T00:00:00Z`)
  const readFrom = chartFrom < since ? new Date(chartFrom.getTime() - 86_400_000) : since

  const accounts = await accountsInScope(f)
  const [open, recording, read, openSince, owners] = await Promise.all([
    loadOpenWork(f),
    readRecording(),
    loadSpans(accounts, readFrom),
    loadOpenSince(accounts),
    accountOwners(),
  ])
  const spans = read.filter(s => Date.parse(s.doneAt) >= since.getTime())

  const today = reportToday(now)
  const lateNow = open.filter(r => isLate(r.dueDate, r.dueSuspect, today)).length
  const recorded = recording.state === 'on'

  const onTime = onTimeShare(spans)
  const heldAll = median(spans.map(s => s.heldDays))

  // A dash, never a zero. Zero delivered is a measurement; no history is not.
  const dash = (v: string | null, note: string) =>
    v === null ? { value: '-', unit: '', note: 'Waiting on the change log' } : { value: v, unit: '', note }

  const unlinked = [...new Set(spans.map(s => s.monday_user_id))].filter(id => !owners.has(id))
  const held = heldByPerson(spans, owners, await mondayNames(unlinked))

  /**
   * Age of what is open, in working days from the hand-off.
   *
   * The hand-off is a change-log fact. item_updated_at sits right there in the
   * snapshot and means something else entirely: the last time anyone touched
   * the item, by anyone, for any reason.
   */
  const aging = AGE_BUCKETS.map(b => ({ label: b.label, color: b.color, count: 0 }))
  const nowIso = now.toISOString()
  for (const r of open) {
    const startedAt = openSince.get(keyOfRow(r))
    if (!startedAt) continue
    const age = workingDaysBetween(startedAt, nowIso)
    const i = AGE_BUCKETS.findIndex(b => b.maxDays === null || age <= b.maxDays)
    aging[i === -1 ? AGE_BUCKETS.length - 1 : i].count++
  }

  return {
    recording,
    overview: {
      kpis: [
        {
          label: 'Delivered',
          ...(recorded
            ? { value: String(spans.length), unit: 'steps', note: 'Marked done in the period' }
            : { value: '-', unit: '', note: 'Waiting on the change log' }),
        },
        {
          label: 'On time',
          ...dash(onTime.pct === null ? null : `${onTime.pct}%`,
            `${onTime.onTime} of ${onTime.judged} met their due date`),
        },
        {
          label: 'Median held',
          ...dash(heldAll === null ? null : formatDays(heldAll),
            'Working days, hand-off to done'),
        },
        { label: 'Open now', value: String(open.length), unit: 'steps', note: 'Current snapshot, not the period' },
        { label: 'Late now', value: String(lateNow), unit: 'steps', note: 'Open with the due date behind them' },
      ],
      weeks: recorded ? weeklyDelivery(read, period, now) : [],
      aging,
      held,
    },
  }
}
