// Driving the import across many invocations.
//
// The full pull is 136,167 entries over roughly 45 minutes of paging, and no
// serverless function lives that long. So progress is a row: each call works
// until its time budget runs out, writes down where it stopped, and returns.
// Calling it again continues. Nothing is lost if it dies mid-run, because every
// month is upserted whole and the cursor only advances after the month lands.

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  importJobcodes, importFields, importPeople, loadMaps,
  importMonth, applyDeletions, monthsToImport,
} from './import'
import { fetchTimesheetRange } from './source'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

/** The account has nothing before this; see docs/time-clock/01. */
export const FIRST_MONTH = '2017-01'

/** Last day of a 'YYYY-MM'. Spelling it out beats guessing 31 and getting 404s. */
export function endOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export interface RunReport {
  runId: number
  kind: 'full' | 'delta'
  state: 'running' | 'done' | 'failed'
  monthsDone: string[]
  entriesWritten: number
  entriesDeleted: number
  nextMonth: string | null
  error?: string
  elapsedMs: number
}

async function loadSettings(supabase: Client) {
  const { data } = await supabase.from('tc_settings').select('*').eq('singleton_id', 1).maybeSingle()
  return (data ?? {}) as { import_cutoff_date?: string | null }
}

/** Today, unless a cutoff has been fixed. Never import past the cutoff. */
function cutoffMonth(settings: { import_cutoff_date?: string | null }): string {
  const iso = settings.import_cutoff_date ?? new Date().toISOString().slice(0, 10)
  return iso.slice(0, 7)
}

async function jobcodeKindMap(supabase: Client): Promise<Map<number, string>> {
  const map = new Map<number, string>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from('tc_jobcodes').select('id, kind').range(from, from + 999)
    const rows = (data ?? []) as { id: number; kind: string }[]
    for (const r of rows) map.set(r.id, r.kind)
    if (rows.length < 1000) break
  }
  return map
}

/**
 * One slice of work.
 *
 * `budgetMs` is deliberately short of the function's own limit: the last month
 * has to finish and the cursor has to be written, and being killed between
 * those two is the only way this loses work.
 */
export async function runImport(
  supabase: Client,
  token: string,
  opts: { kind: 'full' | 'delta'; budgetMs?: number },
): Promise<RunReport> {
  const t0 = Date.now()
  const budget = opts.budgetMs ?? 200_000
  const monthsDone: string[] = []
  let written = 0
  let deleted = 0

  // Resume an unfinished run of the same kind rather than starting beside it.
  const { data: open } = await supabase
    .from('tc_import_runs').select('*')
    .eq('kind', opts.kind).eq('state', 'running')
    .order('id', { ascending: false }).limit(1).maybeSingle()

  let run = open as { id: number; cursor_date: string | null; entries_written: number; entries_deleted: number } | null
  if (!run) {
    const { data, error } = await supabase
      .from('tc_import_runs').insert({ kind: opts.kind, state: 'running' }).select().single()
    if (error) throw new Error(`tc_import_runs insert: ${error.message}`)
    run = data as typeof run
  }
  const runId = run!.id

  try {
    const settings = await loadSettings(supabase)
    const cutoff = cutoffMonth(settings)

    // The catalog is imported once per run, not once per slice. It is not free:
    // 545 job codes, nine option lists and 70 people. Repeating it on every
    // resume ate most of the time budget before a single timesheet was read,
    // and pushed the slice past the platform's own limit, so the work landed
    // but the answer never came back.
    const freshRun = !run!.cursor_date
    if (freshRun || opts.kind === 'delta') {
      await importJobcodes(supabase, token)
      await importFields(supabase, token)
      await importPeople(supabase, token)
    }

    const maps = await loadMaps(supabase)
    const kinds = await jobcodeKindMap(supabase)

    if (opts.kind === 'full') {
      const all = monthsToImport(FIRST_MONTH, cutoff)
      const resumeFrom = run!.cursor_date ? run!.cursor_date.slice(0, 7) : all[0]
      const pending = all.slice(all.indexOf(resumeFrom) >= 0 ? all.indexOf(resumeFrom) : 0)

      for (const month of pending) {
        if (Date.now() - t0 > budget) {
          await supabase.from('tc_import_runs').update({
            cursor_date: `${month}-01`,
            entries_written: run!.entries_written + written,
          }).eq('id', runId)
          return {
            runId, kind: opts.kind, state: 'running', monthsDone,
            entriesWritten: written, entriesDeleted: deleted,
            nextMonth: month, elapsedMs: Date.now() - t0,
          }
        }
        const res = await importMonth(supabase, token, month, maps, kinds)
        written += res.written
        monthsDone.push(month)
        await supabase.from('tc_import_runs').update({
          cursor_date: `${month}-01`,
          entries_seen: res.sourceEntries,
          entries_written: run!.entries_written + written,
        }).eq('id', runId)
      }
    } else {
      // Delta: one range call for everything touched since the watermark, then
      // reconcile only the months it actually landed in.
      const { data: lastFull } = await supabase
        .from('tc_import_runs').select('finished_at')
        .eq('state', 'done').order('finished_at', { ascending: false }).limit(1).maybeSingle()
      const since = (lastFull as { finished_at?: string } | null)?.finished_at
        ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

      const changed = await fetchTimesheetRange(token, `${FIRST_MONTH}-01`, endOfMonth(cutoff), since)
      const touched = [...new Set(changed.map(t => t.date.slice(0, 7)))].sort()

      // Deletions first, so the re-import below counts a month that has already
      // lost what it lost.
      deleted = await applyDeletions(supabase, token, since)

      // Then each touched month is re-imported IN FULL, without the watermark.
      // Pulling only what changed would upsert correctly but reconcile against a
      // partial count, and a reconciliation that reports the wrong total is
      // worse than none: it is a green light nobody checked.
      for (const month of touched) {
        const res = await importMonth(supabase, token, month, maps, kinds)
        written += res.written
        monthsDone.push(month)
      }
    }

    await supabase.from('tc_import_runs').update({
      state: 'done',
      finished_at: new Date().toISOString(),
      entries_written: run!.entries_written + written,
      entries_deleted: run!.entries_deleted + deleted,
    }).eq('id', runId)

    return {
      runId, kind: opts.kind, state: 'done', monthsDone,
      entriesWritten: written, entriesDeleted: deleted,
      nextMonth: null, elapsedMs: Date.now() - t0,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    await supabase.from('tc_import_runs').update({
      state: 'failed', error: message, finished_at: new Date().toISOString(),
    }).eq('id', runId)
    return {
      runId, kind: opts.kind, state: 'failed', monthsDone,
      entriesWritten: written, entriesDeleted: deleted,
      nextMonth: null, error: message, elapsedMs: Date.now() - t0,
    }
  }
}
