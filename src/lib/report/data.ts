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

import type { SupabaseClient } from '@supabase/supabase-js'
import { loadWorklist } from '@/lib/monday/worklist/data'
import { AGE_BUCKETS, type Overview } from './overview'
import { weekColumns, type Period } from './scope'
import {
  deriveSpans, median, onTimeShare, percentile90, type LoggedEvent, type Span,
} from './spans'

/* eslint-disable @typescript-eslint/no-explicit-any */
// Same shape the work list uses, and for the same reason: monday_* tables are
// not in the generated Database type, and monday_assignment_events is newer
// still, so a typed client rejects every query here.
type Client = SupabaseClient<any, any, any>

export type Recording =
  | { state: 'off' }                                   // table not there yet
  | { state: 'empty'; startedAt: string | null }        // there, nothing logged
  | { state: 'on'; startedAt: string; events: number }

export type ReportData = {
  overview: Overview
  recording: Recording
}

/** Postgres and PostgREST for "that table does not exist". */
const NO_TABLE = new Set(['42P01', 'PGRST205'])

async function readRecording(supabase: Client): Promise<Recording> {
  const { data, error } = await supabase
    .from('monday_assignment_events')
    .select('detected_at')
    .order('detected_at', { ascending: true })
    .limit(1)

  // Only the missing table is treated as "not recording". Anything else is a
  // real failure and has to surface, or the page quietly reports nothing at
  // all every time the database has a bad minute.
  if (error) {
    if (NO_TABLE.has(error.code ?? '')) return { state: 'off' }
    throw error
  }

  const first = (data ?? [])[0] as { detected_at: string } | undefined
  if (!first) return { state: 'empty', startedAt: null }

  const { count } = await supabase
    .from('monday_assignment_events')
    .select('id', { count: 'exact', head: true })

  return { state: 'on', startedAt: first.detected_at, events: count ?? 0 }
}

/**
 * A date that is behind us and worth believing.
 *
 * dueSuspect rows carry years like 202, typed wrong once and never noticed.
 * Counting them as late puts the most broken row at the top of a number
 * somebody is going to act on.
 */
function isLate(due: string | null, suspect: boolean, today: string): boolean {
  return !suspect && due !== null && due < today
}

/** Monday accounts belonging to the people this scope covers. */
async function accountsInScope(
  supabase: Client, f: { personId?: string | null; teamId?: string | null },
): Promise<number[] | null> {
  let personIds: string[] | null = null

  if (f.personId) personIds = [f.personId]
  else if (f.teamId) {
    const { data } = await supabase.from('team_members').select('person_id').eq('team_id', f.teamId)
    personIds = ((data ?? []) as { person_id: string }[]).map(m => m.person_id)
  }

  if (personIds === null) return null
  if (!personIds.length) return []

  const { data } = await supabase
    .from('monday_user_links').select('monday_user_id').in('person_id', personIds)
  return ((data ?? []) as { monday_user_id: number }[]).map(r => r.monday_user_id)
}

/** Names for the held chart, by Monday account. */
async function namesFor(supabase: Client, ids: number[]): Promise<Map<number, string>> {
  if (!ids.length) return new Map()
  const { data } = await supabase.from('monday_users').select('id, name').in('id', ids)
  return new Map(((data ?? []) as { id: number; name: string }[]).map(u => [u.id, u.name]))
}

/** Monday and the day the week starts on. Weeks run Monday to Sunday. */
function weekStart(iso: string): string {
  const d = new Date(iso)
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}

const WEEK_LABEL = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' })

/**
 * The weekly delivery chart.
 *
 * Every week in the period gets a column, including the ones with nothing in
 * them. Skipping empty weeks would draw a busy fortnight and a quiet quarter
 * with the same number of bars.
 */
function weeklyDelivery(spans: Span[], period: Period, now: Date): Overview['weeks'] {
  const columns = weekColumns(period)
  const thisWeek = weekStart(now.toISOString())

  const starts: string[] = []
  for (let i = columns - 1; i >= 0; i--) {
    const d = new Date(`${thisWeek}T00:00:00Z`)
    d.setUTCDate(d.getUTCDate() - i * 7)
    starts.push(d.toISOString().slice(0, 10))
  }

  const counts = new Map(starts.map(s => [s, { total: 0, late: 0 }]))
  for (const s of spans) {
    const bucket = counts.get(weekStart(s.doneAt))
    if (!bucket) continue
    bucket.total++
    if ((s.lateDays ?? 0) > 0) bucket.late++
  }

  return starts.map(s => ({ label: WEEK_LABEL(s), ...counts.get(s)! }))
}

/** Reads the log for one scope and period. */
async function loadSpans(
  supabase: Client, accounts: number[] | null, since: Date,
): Promise<Span[]> {
  if (accounts !== null && !accounts.length) return []

  // Every event for these steps, not only the ones inside the period: a span
  // finished last week may have landed on them two months ago, and cutting
  // the read at the period start would lose the hand-off and with it the
  // held time. The done date is what gets filtered, further down.
  let q = supabase
    .from('monday_assignment_events')
    .select('item_id, people_col, monday_user_id, event, due_date, occurred_at')
    .gte('occurred_at', new Date(since.getTime() - 365 * 86_400_000).toISOString())
    .order('occurred_at', { ascending: true })
    .limit(50_000)

  if (accounts) q = q.in('monday_user_id', accounts)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE.has(error.code ?? '')) return []
    throw error
  }

  return deriveSpans((data ?? []) as LoggedEvent[])
    .filter(s => Date.parse(s.doneAt) >= since.getTime())
}

export async function loadReportOverview(
  supabase: Client,
  f: { personId?: string | null; teamId?: string | null; period?: Period },
): Promise<ReportData> {
  const period = f.period ?? 90
  const now = new Date()
  const since = new Date(now.getTime() - period * 86_400_000)

  const accounts = await accountsInScope(supabase, f)

  const [snapshot, recording, spans] = await Promise.all([
    loadWorklist(supabase, { personId: f.personId, teamId: f.teamId, includeDone: false }),
    readRecording(supabase),
    loadSpans(supabase, accounts, since),
  ])

  const today = now.toISOString().slice(0, 10)
  const openRows = snapshot.rows.filter(r => !r.statusDone)
  const lateNow = openRows.filter(r => isLate(r.dueDate, r.dueSuspect, today)).length

  const onTime = onTimeShare(spans)
  const heldAll = median(spans.map(s => s.heldDays))

  // A dash, never a zero. Zero delivered is a measurement; no history is not.
  const dash = (v: string | null, note: string) =>
    v === null ? { value: '-', unit: '', note: 'Waiting on the change log' } : { value: v, unit: '', note }

  /** Held time per person, for the one panel on the Overview that names them. */
  const byPerson = new Map<number, number[]>()
  for (const s of spans) {
    const list = byPerson.get(s.monday_user_id)
    if (list) list.push(s.heldDays)
    else byPerson.set(s.monday_user_id, [s.heldDays])
  }
  const names = await namesFor(supabase, [...byPerson.keys()])

  const held = [...byPerson.entries()]
    .map(([id, days]) => ({
      name: names.get(id) ?? `Monday user ${id}`,
      median: median(days) ?? 0,
      p90: percentile90(days) ?? 0,
    }))
    .sort((a, b) => b.median - a.median)

  /**
   * Age of what is open, measured from the hand-off.
   *
   * The hand-off is a change-log fact. item_updated_at sits right there in the
   * snapshot and means something else entirely: the last time anyone touched
   * the item, by anyone, for any reason. Open work that predates the log has
   * no hand-off yet and is left out rather than dated from the wrong thing.
   */
  const openSince = await loadOpenSince(supabase, accounts)
  const aging = AGE_BUCKETS.map(b => ({ label: b.label, color: b.color, count: 0 }))
  for (const startedAt of openSince.values()) {
    const age = Math.max(0, Math.round((now.getTime() - Date.parse(startedAt)) / 86_400_000))
    const i = AGE_BUCKETS.findIndex(b => b.maxDays === null || age <= b.maxDays)
    aging[i === -1 ? AGE_BUCKETS.length - 1 : i].count++
  }

  return {
    recording,
    overview: {
      kpis: [
        {
          label: 'Delivered',
          ...(recording.state === 'on' && recording.events > 0
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
          ...dash(heldAll === null ? null : `${heldAll < 10 ? heldAll.toFixed(1) : Math.round(heldAll)}d`,
            'From hand-off to done'),
        },
        { label: 'Open now', value: String(snapshot.open), unit: 'steps', note: 'Current snapshot, not the period' },
        { label: 'Late now', value: String(lateNow), unit: 'steps', note: 'Open with the due date behind them' },
      ],
      weeks: recording.state === 'on' && recording.events > 0 ? weeklyDelivery(spans, period, now) : [],
      aging,
      held,
    },
  }
}

/**
 * When each still-open step last landed on somebody.
 *
 * The last assigned or reopened with no done after it. Anything with a done
 * is not open, and anything with no hand-off at all predates the log.
 */
async function loadOpenSince(supabase: Client, accounts: number[] | null): Promise<Map<string, string>> {
  if (accounts !== null && !accounts.length) return new Map()

  let q = supabase
    .from('monday_assignment_events')
    .select('item_id, people_col, monday_user_id, event, occurred_at')
    .in('event', ['assigned', 'reopened', 'done', 'unassigned'])
    .order('occurred_at', { ascending: true })
    .limit(50_000)

  if (accounts) q = q.in('monday_user_id', accounts)

  const { data, error } = await q
  if (error) {
    if (NO_TABLE.has(error.code ?? '')) return new Map()
    throw error
  }

  const open = new Map<string, string>()
  for (const e of (data ?? []) as LoggedEvent[]) {
    const k = `${e.item_id}|${e.people_col}|${e.monday_user_id}`
    if (e.event === 'assigned' || e.event === 'reopened') open.set(k, e.occurred_at)
    else open.delete(k)
  }
  return open
}
