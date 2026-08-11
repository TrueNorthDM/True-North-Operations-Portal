// Grant Pass, read from the portal's own hours.
//
// The page for this client has been an empty placeholder since the reports were
// split, because nobody knew where its hours lived. They live in two places, and
// the answer came from counting rather than choosing:
//
//   2017-2021  tagged by job code, under the deactivated GP Church / GP School
//              branches: 721 entries, 444 hours
//   2022       both, five entries each way
//   2023-2026  tagged by the "2 Project" custom field: 25 entries
//
// No entry is ever tagged both ways, in any year, so the union double-counts
// nothing. That is why this reads both and does not have to choose one.
//
// The volume is the other thing worth knowing: about 470 hours across nine
// years, and roughly six a year lately. This is a history to look back at, not
// a budget to manage, and the shape of the report follows from that.

import type { SupabaseClient } from '@supabase/supabase-js'
import { PROJECT_CF, ACTIVITY_CF } from '@/lib/tsheets/i7report'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const PAGE = 1000

export type Side = 'School' | 'Church'

export interface GrantPassMonth {
  month: string
  schoolSeconds: number
  churchSeconds: number
}

export interface GrantPassSlice {
  label: string
  schoolSeconds: number
  churchSeconds: number
}

export interface GrantPassData {
  months: GrantPassMonth[]
  byPerson: GrantPassSlice[]
  byActivity: GrantPassSlice[]
  totalSchool: number
  totalChurch: number
  entries: number
  firstMonth: string | null
  lastMonth: string | null
}

/** 'GP church', 'gp school', 'GP School' all count. Nobody typed these twice the same. */
export function sideFromText(text: string): Side | null {
  const t = text.trim().toLowerCase()
  if (t === 'gp school') return 'School'
  if (t === 'gp church') return 'Church'
  return null
}

function add(map: Map<string, GrantPassSlice>, label: string, side: Side, seconds: number) {
  const cur = map.get(label) ?? { label, schoolSeconds: 0, churchSeconds: 0 }
  if (side === 'School') cur.schoolSeconds += seconds
  else cur.churchSeconds += seconds
  map.set(label, cur)
}

export async function loadGrantPassData(supabase: Client): Promise<GrantPassData> {
  // The two ways a Grant Pass hour is marked, resolved once.
  const [{ data: fieldRows }, { data: jcRows }, { data: peopleRows }, { data: optionRows }] = await Promise.all([
    supabase.from('tc_fields').select('id, external_id'),
    supabase.from('tc_jobcodes').select('id, name, parent_id'),
    supabase.from('people').select('id, full_name'),
    supabase.from('tc_field_options').select('field_id, label'),
  ])

  const fields = (fieldRows ?? []) as { id: number; external_id: number | null }[]
  const projectKey = fields.find(f => String(f.external_id) === PROJECT_CF)?.id
  const activityKey = fields.find(f => String(f.external_id) === ACTIVITY_CF)?.id

  const jcs = (jcRows ?? []) as { id: number; name: string; parent_id: number | null }[]
  const sideByJobcode = new Map<number, Side>()
  for (const root of jcs.filter(j => /^GP (Church|School)$/i.test(j.name))) {
    const side: Side = /school/i.test(root.name) ? 'School' : 'Church'
    sideByJobcode.set(root.id, side)
    for (const child of jcs.filter(j => j.parent_id === root.id)) sideByJobcode.set(child.id, side)
  }

  const nameById = new Map(((peopleRows ?? []) as { id: string; full_name: string }[])
    .map(p => [p.id, p.full_name]))

  const months = new Map<string, GrantPassMonth>()
  const byPerson = new Map<string, GrantPassSlice>()
  const byActivity = new Map<string, GrantPassSlice>()
  let totalSchool = 0
  let totalChurch = 0
  let entries = 0

  type Row = {
    id: number; person_id: string; jobcode_id: number | null
    duration_seconds: number; entry_date: string; fields: Record<string, string> | null
  }
  const SELECT = 'id, person_id, jobcode_id, duration_seconds, entry_date, fields'

  // Asked for, not filtered out of everything. Scanning all 136,000 entries to
  // find seven hundred was a hundred and thirty-seven round trips and froze the
  // page; the same mistake this module's sibling made an hour earlier. Two
  // narrow queries return the same rows.
  const seen = new Map<number, Row>()

  if (sideByJobcode.size) {
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('tc_entries').select(SELECT)
        .in('jobcode_id', [...sideByJobcode.keys()])
        .order('id', { ascending: true }).range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as Row[]
      for (const r of rows) seen.set(r.id, r)
      if (rows.length < PAGE) break
    }
  }

  // The exact labels to look for, read from the option list rather than typed
  // here, so a new spelling starts counting the day somebody adds it.
  const gpLabels = ((optionRows ?? []) as { field_id: number; label: string }[])
    .filter(o => o.field_id === projectKey && sideFromText(o.label))
    .map(o => o.label)

  // One containment query per label. NOT a `fields->>key` filter: PostgREST
  // reads a numeric key after -> as an ARRAY INDEX, and ours are numeric, so
  // that syntax asks for element nine of an object and fails. Containment is
  // also what the GIN index on fields can actually answer.
  if (projectKey) {
    for (const value of gpLabels) {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('tc_entries').select(SELECT)
          .contains('fields', { [String(projectKey)]: value })
          .order('id', { ascending: true }).range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        const rows = (data ?? []) as Row[]
        for (const r of rows) seen.set(r.id, r)
        if (rows.length < PAGE) break
      }
    }
  }

  for (const r of seen.values()) {
    const f = r.fields ?? {}
    const side = (r.jobcode_id != null ? sideByJobcode.get(r.jobcode_id) : undefined)
      ?? (projectKey ? sideFromText(f[String(projectKey)] ?? '') : null)
    if (!side) continue

    entries++
    const secs = r.duration_seconds
    if (side === 'School') totalSchool += secs
    else totalChurch += secs

    const ym = r.entry_date.slice(0, 7)
    const m = months.get(ym) ?? { month: ym, schoolSeconds: 0, churchSeconds: 0 }
    if (side === 'School') m.schoolSeconds += secs
    else m.churchSeconds += secs
    months.set(ym, m)

    add(byPerson, nameById.get(r.person_id) ?? 'Unknown', side, secs)
    const activity = (activityKey ? f[String(activityKey)] : '')?.trim() || 'Not specified'
    add(byActivity, activity, side, secs)
  }

  const sorted = [...months.values()].sort((a, b) => a.month.localeCompare(b.month))
  const bySize = (a: GrantPassSlice, b: GrantPassSlice) =>
    (b.schoolSeconds + b.churchSeconds) - (a.schoolSeconds + a.churchSeconds)

  return {
    months: sorted,
    byPerson: [...byPerson.values()].sort(bySize),
    byActivity: [...byActivity.values()].sort(bySize),
    totalSchool,
    totalChurch,
    entries,
    firstMonth: sorted[0]?.month ?? null,
    lastMonth: sorted[sorted.length - 1]?.month ?? null,
  }
}
