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

import type { SupabaseClient } from '@supabase/supabase-js'
import { I7_PARENT_JOBCODE_ID, I7_CODE_CF, ACTIVITY_CF } from '@/lib/tsheets/i7report'
import type { I7Entry } from '@/lib/tsheets/types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const PAGE = 1000

/** tc_fields ids for the two custom fields the report groups by. */
async function fieldKeys(supabase: Client): Promise<{ code: string | null; activity: string | null }> {
  const { data } = await supabase
    .from('tc_fields').select('id, external_id')
    .in('external_id', [Number(I7_CODE_CF), Number(ACTIVITY_CF)])
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
  return jobcodeSubtree(supabase, j => j.external_id === I7_PARENT_JOBCODE_ID)
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
    const { data } = await supabase
      .from('tc_jobcodes').select('id, parent_id, external_id, name').range(from, from + PAGE - 1)
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

  const out: I7Entry[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('tc_entries')
      .select('person_id, jobcode_id, duration_seconds, entry_date, fields')
      .gte('entry_date', start).lte('entry_date', end)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as {
      person_id: string; jobcode_id: number | null
      duration_seconds: number; entry_date: string; fields: Record<string, string> | null
    }[]

    for (const r of rows) {
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
  const codes = new Set<string>()
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabase
      .from('tc_entries').select('jobcode_id, fields')
      .gte('entry_date', since)
      .order('id', { ascending: true }).range(from, from + PAGE - 1)
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
