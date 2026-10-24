// The client report, read from the portal's own hours instead of the old cache.
//
// Phase 5 swaps a data source under a report people already use, so it does it
// at the narrowest possible seam: buildI7Report() takes a list of entries in one
// shape, and this produces that same shape from tc_entries. Everything above it
// (the tree, the charts, the exports, the carryover) is untouched, which is what
// makes the change checkable rather than a rewrite you have to trust.
//
// Two filters the old cache applied by accident, which have to be applied on
// purpose here. tsheets_timesheets only ever held entries under the i7 branch,
// because the sync only asked for those job codes. tc_entries holds everything,
// so the i7 subtree has to be selected explicitly.

import type { Db } from '@/lib/supabase/types'
import { I7_PARENT_JOBCODE_ID, I7_CODE_CF, ACTIVITY_CF } from '@/lib/tsheets/i7report'
import type { I7Entry } from '@/lib/tsheets/types'

type Client = Db

const PAGE = 1000

/** tc_fields ids for the two custom fields the report groups by. */
async function fieldKeys(supabase: Client): Promise<{ code: string | null; activity: string | null }> {
  const { data, error } = await supabase
    .from('tc_fields').select('id, external_id')
    .in('external_id', [Number(I7_CODE_CF), Number(ACTIVITY_CF)])
  // Without the field ids every code reads as '' and lands in Unassigned, and
  // the MME hours move onto the i7 invoice: an error, not a quiet regrouping.
  if (error) throw new Error(`The i7 code fields could not be read: ${error.message}`)
  const rows = (data ?? []) as { id: number; external_id: number | null }[]
  const find = (ext: string) => rows.find(r => String(r.external_id) === ext)?.id ?? null
  return {
    code: find(I7_CODE_CF) === null ? null : String(find(I7_CODE_CF)),
    activity: find(ACTIVITY_CF) === null ? null : String(find(ACTIVITY_CF)),
  }
}

/**
 * Every job code under the i7 branch, ours.
 *
 * Walks down rather than assuming a depth: the tree is two deep today, and a
 * report that quietly drops a level the day somebody adds one is worse than a
 * report that is slightly slower to build.
 */
export async function i7JobcodeIdsHere(supabase: Client): Promise<Set<number>> {
  const ids = await jobcodeSubtree(supabase, j => j.external_id === I7_PARENT_JOBCODE_ID)
  // No i7 root is a broken tree, not a month without hours: answering "no i7
  // job codes" would show $0 used and the whole budget left (audit, 9 October 2026).
  if (!ids.size) throw new Error('The i7 job code is missing from the job codes, so the report cannot tell which hours are i7.')
  return ids
}

/**
 * Every job code under one root, the root included.
 *
 * Takes a predicate rather than an id because the roots are found two different
 * ways: the i7 branch by its TSheets id, which the reports have always known,
 * and the True North branch by name, which nothing needed until an entry form
 * had to offer it.
 */
export async function jobcodeSubtree(
  supabase: Client,
  isRoot: (j: { id: number; name: string; parent_id: number | null; external_id: number | null }) => boolean,
): Promise<Set<number>> {
  const all: { id: number; parent_id: number | null; external_id: number | null; name: string }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('tc_jobcodes').select('id, parent_id, external_id, name').order('id').range(from, from + PAGE - 1)
    // A failed page would cut the i7 tree, and with it hours, without a word.
    if (error) throw new Error(`Job codes could not be read: ${error.message}`)
    const rows = (data ?? []) as typeof all
    all.push(...rows)
    if (rows.length < PAGE) break
  }

  const root = all.find(isRoot)
  if (!root) return new Set()

  const childrenOf = new Map<number, number[]>()
  for (const j of all) {
    if (j.parent_id == null) continue
    childrenOf.set(j.parent_id, [...(childrenOf.get(j.parent_id) ?? []), j.id])
  }

  const ids = new Set<number>([root.id])
  const queue = [root.id]
  while (queue.length) {
    const next = queue.shift()!
    for (const child of childrenOf.get(next) ?? []) {
      if (ids.has(child)) continue      // a cycle would otherwise hang the page
      ids.add(child)
      queue.push(child)
    }
  }
  return ids
}

/** The i7 entries of a date range, in the shape buildI7Report already expects. */
export async function loadI7EntriesHere(
  supabase: Client,
  start: string,
  end: string,
): Promise<I7Entry[]> {
  const [keys, jobcodeIds] = await Promise.all([
    fieldKeys(supabase),
    i7JobcodeIdsHere(supabase),
  ])
  if (!jobcodeIds.size) return []

  // Filtered by the database, not after it. This used to read every entry in
  // the range for every client and keep the i7 ones in JavaScript: measured in
  // September 2026, 12,102 rows in 13 sequential pages to keep 2,403 of them,
  // on every Home visit and every load of the i7 report. The same 2,403 rows,
  // in the same order, checked by id, now come back in 3 pages. tc_entries has
  // an index on jobcode_id (migration 057).
  const idList = [...jobcodeIds]
  const out: I7Entry[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('tc_entries')
      .select('person_id, jobcode_id, duration_seconds, entry_date, fields')
      .gte('entry_date', start).lte('entry_date', end)
      .in('jobcode_id', idList)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as {
      person_id: string; jobcode_id: number | null
      duration_seconds: number; entry_date: string; fields: Record<string, string> | null
    }[]

    for (const r of rows) {
      // Redundant with the filter above, and kept: if the query ever loses it,
      // the report stays an i7 report instead of quietly becoming every client's.
      if (r.jobcode_id == null || !jobcodeIds.has(r.jobcode_id)) continue
      // Nothing is dropped here any more. This used to require a TSheets id,
      // which was fine while everybody billing hours had one and became silent
      // under-reporting the moment a contractor's hours were added by hand.
      const f = r.fields ?? {}
      out.push({
        personId: r.person_id,
        duration: r.duration_seconds,
        date: r.entry_date,
        i7Code: (keys.code ? f[keys.code] : '') ?? '',
        activity: (keys.activity ? f[keys.activity] : '') ?? '',
      })
    }
    if (rows.length < PAGE) break
  }
  return out
}

/**
 * Every i7 code and person seen since `since`: the scaffold that keeps zero-hour
 * projects, codes and people on screen.
 *
 * Bounded on purpose. The old cache held about five thousand rows because the
 * sync pruned it to a rolling window, so scanning all of it cost five queries.
 * tc_entries holds 136,000, and scanning all of THAT costs a hundred and
 * thirty-seven, which froze the page. The window is what makes the two
 * equivalent: the scaffold means "codes and people currently in play", and a
 * code last used in 2018 is not that.
 */
export async function loadI7UniverseHere(
  supabase: Client,
  since: string,
): Promise<{ jobcodes: string[] }> {
  const [keys, jobcodeIds] = await Promise.all([
    fieldKeys(supabase),
    i7JobcodeIdsHere(supabase),
  ])

  // The roster used to be collected here too, to hold a column open for
  // everyone who had touched i7 in the window. Columns now follow the month
  // being read, so this no longer resolves people at all: one query fewer, and
  // no list that looks like it still decides something.
  // An empty list cannot go into .in(): PostgREST reads in.() as a malformed
  // filter rather than as "nothing". No i7 job codes means no i7 codes.
  if (!jobcodeIds.size) return { jobcodes: [] }

  // Filtered by the database for the same reason as loadI7EntriesHere, and it
  // was the second full pass over the same rows on every load of the report.
  const idList = [...jobcodeIds]
  const codes = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('tc_entries').select('jobcode_id, fields')
      .gte('entry_date', since)
      .in('jobcode_id', idList)
      .order('id', { ascending: true }).range(from, from + PAGE - 1)
    // A failed page would end the list early and drop codes without a word.
    if (error) throw new Error(`The i7 codes could not be read: ${error.message}`)
    const rows = (data ?? []) as {
      jobcode_id: number | null; fields: Record<string, string> | null
    }[]
    for (const r of rows) {
      if (r.jobcode_id == null || !jobcodeIds.has(r.jobcode_id)) continue
      const code = (keys.code ? (r.fields ?? {})[keys.code] : '')?.trim()
      if (code) codes.add(code)
    }
    if (rows.length < PAGE) break
  }
  return { jobcodes: [...codes] }
}
