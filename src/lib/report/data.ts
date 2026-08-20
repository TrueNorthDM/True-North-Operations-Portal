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

export async function loadReportOverview(
  supabase: Client,
  f: { personId?: string | null; teamId?: string | null },
): Promise<ReportData> {
  const [snapshot, recording] = await Promise.all([
    loadWorklist(supabase, { personId: f.personId, teamId: f.teamId, includeDone: false }),
    readRecording(supabase),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const openRows = snapshot.rows.filter(r => !r.statusDone)
  const lateNow = openRows.filter(r => isLate(r.dueDate, r.dueSuspect, today)).length

  // A plain hyphen, the same one an empty cell uses in the work list.
  const unknown = { value: '-', unit: '', note: 'Waiting on the change log' }

  return {
    recording,
    overview: {
      kpis: [
        { label: 'Delivered', ...unknown },
        { label: 'On time', ...unknown },
        { label: 'Median held', ...unknown },
        { label: 'Open now', value: String(snapshot.open), unit: 'steps', note: 'Current snapshot, not the period' },
        { label: 'Late now', value: String(lateNow), unit: 'steps', note: 'Open with the due date behind them' },
      ],
      weeks: [],
      // The buckets are measured from the hand-off, which is a change-log
      // fact. item_updated_at is nearby and tempting and means something else
      // entirely: the last time anyone touched the item, by anyone, for any
      // reason. Better an empty panel than a plausible wrong one.
      aging: AGE_BUCKETS.map(b => ({ label: b.label, color: b.color, count: 0 })),
      held: [],
    },
  }
}
