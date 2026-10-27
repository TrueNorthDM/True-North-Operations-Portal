// Driving the import across many invocations.
//
// The full pull is 136,167 entries over roughly 45 minutes of paging, and no
// serverless function lives that long. So progress is a row: each call works
// until its time budget runs out, writes down where it stopped, and returns.
// Calling it again continues. Nothing is lost if it dies mid-run, because every
// month is upserted whole and the cursor only advances after the month lands.

import type { Db } from '@/lib/supabase/types'
import {
  importJobcodes, importFields, importPeople, loadMaps,
  importMonth, applyDeletions, monthsToImport,
} from './import'
import { fetchTimesheetRange } from './source'
import { loadStartDates } from './waves-data'

type Client = Db

/** The account has nothing before this; see docs/time-clock/01. */
export const FIRST_MONTH = '2017-01'

/** Last day of a 'YYYY-MM'. Spelling it out beats guessing 31 and getting 404s. */
export function endOfMonth(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export interface RunReport {
  runId: number
  kind: 'full' | 'delta' | 'recheck'
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
  opts: { kind: 'full' | 'delta' | 'recheck'; budgetMs?: number },
): Promise<RunReport> {
  const t0 = Date.now()
  const budget = opts.budgetMs ?? 200_000
  const monthsDone: string[] = []
  let written = 0
  let deleted = 0

  // A re-check is not an import: it writes no cursor and keeps no place, so it
  // gets no run row. It also cannot have one, because tc_import_runs only
  // accepts 'full' and 'delta', and that insert used to happen OUTSIDE the try
  // below, so the constraint error escaped as an empty 500 with nothing in it
  // to read. Bookkeeping for work that has no state to keep was the mistake;
  // the opaque failure was just how it surfaced.
  const bookkeep = opts.kind !== 'recheck'

  type RunRow = { id: number; cursor_date: string | null; entries_written: number; entries_deleted: number }
  let run: RunRow | null = null
  if (bookkeep) {
    const { data: open } = await supabase
      .from('tc_import_runs').select('*')
      .eq('kind', opts.kind).eq('state', 'running')
      .order('id', { ascending: false }).limit(1).maybeSingle()
    run = (open ?? null) as RunRow | null
    if (!run) {
      const { data, error } = await supabase
        .from('tc_import_runs').insert({ kind: opts.kind, state: 'running' }).select().single()
      if (error) return {
        runId: 0, kind: opts.kind, state: 'failed', monthsDone: [],
        entriesWritten: 0, entriesDeleted: 0, nextMonth: null,
        error: `tc_import_runs insert: ${error.message}`, elapsedMs: Date.now() - t0,
      }
      run = data as RunRow
    }
  }
  const runId = run?.id ?? 0

  try {
    const settings = await loadSettings(supabase)
    const cutoff = cutoffMonth(settings)

    // The catalog is imported once per run, not once per slice. It is not free:
    // 545 job codes, nine option lists and 70 people. Repeating it on every
    // resume ate most of the time budget before a single timesheet was read,
    // and pushed the slice past the platform's own limit, so the work landed
    // but the answer never came back.
    const freshRun = !run?.cursor_date
    if (freshRun || opts.kind === 'delta') {
      await importJobcodes(supabase, token)
      await importFields(supabase, token)
      await importPeople(supabase, token)
    }

    const maps = await loadMaps(supabase)
    const kinds = await jobcodeKindMap(supabase)
    // Each person's North Time start date (Company settings > North Time
    // rollout): from it, their TSheets entries are set aside, not imported.
    // Empty until a wave has a date, and then the import runs as before.
    const starts = await loadStartDates(supabase)

    if (opts.kind === 'recheck') {
      // Only the months that currently disagree, pulled fresh and counted again.
      //
      // A reconciliation row is a snapshot, and a snapshot taken while anything
      // was still writing records a number that was never true for long. That
      // is what happened to May 2022: two import slices ran at once, one counted
      // our rows mid-write, and the row kept the half-written total long after
      // the data had converged. Re-checking is how you tell a stale snapshot
      // from a real gap, and there was no way to do it without re-importing ten
      // years, which is too expensive to ever actually run.
      const { data: rows } = await supabase.from('tc_reconciliation').select('*').order('month')
      const off = ((rows ?? []) as { month: string; tsheets_entries: number; portal_entries: number; tsheets_seconds: number; portal_seconds: number }[])
        .filter(r => r.tsheets_entries !== r.portal_entries || r.tsheets_seconds !== r.portal_seconds)

      for (const r of off) {
        if (Date.now() - t0 > budget) break
        const res = await importMonth(supabase, token, r.month, maps, kinds, undefined, starts)
        written += res.written
        monthsDone.push(r.month)
      }
    } else if (opts.kind === 'full') {
      const all = monthsToImport(FIRST_MONTH, cutoff)
      const resumeFrom = run?.cursor_date ? run.cursor_date.slice(0, 7) : all[0]
      const pending = all.slice(all.indexOf(resumeFrom) >= 0 ? all.indexOf(resumeFrom) : 0)

      for (const month of pending) {
        if (Date.now() - t0 > budget) {
          await supabase.from('tc_import_runs').update({
            cursor_date: `${month}-01`,
            entries_written: (run?.entries_written ?? 0) + written,
          }).eq('id', runId)
          return {
            runId, kind: opts.kind, state: 'running', monthsDone,
            entriesWritten: written, entriesDeleted: deleted,
            nextMonth: month, elapsedMs: Date.now() - t0,
          }
        }
        const res = await importMonth(supabase, token, month, maps, kinds, undefined, starts)
        written += res.written
        monthsDone.push(month)
        await supabase.from('tc_import_runs').update({
          cursor_date: `${month}-01`,
          entries_seen: res.sourceEntries,
          entries_written: (run?.entries_written ?? 0) + written,
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

      // Year by year, not a single ten-year window. TSheets answers 417 to a
      // range that wide, which is how this failed the first time it was ever
      // actually run: the delta had been written and deployed but never
      // exercised, because until now there had been nothing to catch up on.
      //
      // Still asking about every year rather than just the recent ones. Each
      // call returns only what changed, so an untouched year costs one request
      // and comes back empty, and a retroactive approval on 2019 is exactly the
      // thing a cheap shortcut would miss.
      const firstYear = Number(FIRST_MONTH.slice(0, 4))
      const lastYear = Number(cutoff.slice(0, 4))
      const changed: { date: string }[] = []
      for (let y = firstYear; y <= lastYear; y++) {
        const from = y === firstYear ? `${FIRST_MONTH}-01` : `${y}-01-01`
        const to = y === lastYear ? endOfMonth(cutoff) : `${y}-12-31`
        changed.push(...await fetchTimesheetRange(token, from, to, since))
      }
      const touched = [...new Set(changed.map(t => t.date.slice(0, 7)))].sort()

      // Deletions first, so the re-import below counts a month that has already
      // lost what it lost.
      deleted = await applyDeletions(supabase, token, since)

      // Then each touched month is re-imported IN FULL, without the watermark.
      // Pulling only what changed would upsert correctly but reconcile against a
      // partial count, and a reconciliation that reports the wrong total is
      // worse than none: it is a green light nobody checked.
      for (const month of touched) {
        const res = await importMonth(supabase, token, month, maps, kinds, undefined, starts)
        written += res.written
        monthsDone.push(month)
      }
    }

    if (bookkeep) {
      await supabase.from('tc_import_runs').update({
        state: 'done',
        finished_at: new Date().toISOString(),
        entries_written: (run?.entries_written ?? 0) + written,
        entries_deleted: (run?.entries_deleted ?? 0) + deleted,
      }).eq('id', runId)
    }

    return {
      runId, kind: opts.kind, state: 'done', monthsDone,
      entriesWritten: written, entriesDeleted: deleted,
      nextMonth: null, elapsedMs: Date.now() - t0,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (bookkeep) {
      await supabase.from('tc_import_runs').update({
        state: 'failed', error: message, finished_at: new Date().toISOString(),
      }).eq('id', runId)
    }
    return {
      runId, kind: opts.kind, state: 'failed', monthsDone,
      entriesWritten: written, entriesDeleted: deleted,
      nextMonth: null, error: message, elapsedMs: Date.now() - t0,
    }
  }
}
