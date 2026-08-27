// What the manual-hours panel needs: the month's hand-added entries, and the
// options for adding another.
//
// The options are read from what the account actually uses rather than from a
// list in code. A hard-coded i7 code drifts the day somebody adds one in
// TSheets, and the entry would land in the report under a code the tree does
// not have, which shows as hours that are counted and invisible.

import type { SupabaseClient } from '@supabase/supabase-js'
import { i7JobcodeIdsHere } from './report-source'
import { I7_CODE_CF, ACTIVITY_CF } from '@/lib/tsheets/i7report'
import type { ManualOptions, ManualRow } from '@/components/tsheets/ManualHours'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

/** How far back to look for codes and activities somebody might reuse. */
const OPTION_MONTHS = 12

/** The first day of the window, counted in months so it never lands on the 31st. */
function optionsSince(month: string): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  d.setUTCMonth(d.getUTCMonth() - OPTION_MONTHS)
  return d.toISOString().slice(0, 10)
}

export async function loadManualHours(
  supabase: Client, month: string,
): Promise<{ rows: ManualRow[]; options: ManualOptions }> {
  const start = `${month}-01`
  const end = `${month}-31`

  const [{ data: fieldRows }, jobcodeIds] = await Promise.all([
    supabase.from('tc_fields').select('id, external_id')
      .in('external_id', [Number(I7_CODE_CF), Number(ACTIVITY_CF)]),
    i7JobcodeIdsHere(supabase),
  ])
  const fields = (fieldRows ?? []) as { id: number; external_id: number | null }[]
  const keyOf = (ext: string) => {
    const f = fields.find(r => String(r.external_id) === ext)
    return f ? String(f.id) : null
  }
  const codeKey = keyOf(I7_CODE_CF)
  const activityKey = keyOf(ACTIVITY_CF)

  const [entries, jobcodes, recent] = await Promise.all([
    supabase.from('tc_entries')
      .select('id, person_id, entry_date, duration_seconds, jobcode_id, fields, notes, created_by')
      .eq('kind', 'manual').is('external_id', null)
      .gte('entry_date', start).lte('entry_date', end)
      .order('entry_date', { ascending: false }),
    supabase.from('tc_jobcodes').select('id, name').in('id', [...jobcodeIds]).order('name'),
    // The code and activity lists come from what has actually been logged, so
    // they match what people already type rather than a list kept in code.
    supabase.from('tc_entries').select('fields')
      .gte('entry_date', optionsSince(month))
      .limit(20_000),
  ])

  const people = await peopleForEntry(supabase)

  const nameById = new Map(people.map(p => [p.id, p.name]))
  const jobcodeName = new Map(
    ((jobcodes.data ?? []) as { id: number; name: string }[]).map(j => [j.id, j.name]),
  )

  const rows: ManualRow[] = ((entries.data ?? []) as {
    id: number; person_id: string; entry_date: string; duration_seconds: number
    jobcode_id: number | null; fields: Record<string, string> | null
    notes: string | null; created_by: string | null
  }[]).map(e => ({
    id: e.id,
    personName: nameById.get(e.person_id) ?? 'Unknown',
    entryDate: e.entry_date,
    // One decimal: these are read off an invoice, not clocked to the second.
    hours: Math.round((e.duration_seconds / 3600) * 100) / 100,
    jobcodeName: e.jobcode_id ? jobcodeName.get(e.jobcode_id) ?? '' : '',
    i7Code: (codeKey ? e.fields?.[codeKey] : '') ?? '',
    activity: (activityKey ? e.fields?.[activityKey] : '') ?? '',
    notes: e.notes,
    addedBy: e.created_by ? nameById.get(e.created_by) ?? null : null,
  }))

  const codes = new Set<string>()
  const activities = new Set<string>()
  for (const r of (recent.data ?? []) as { fields: Record<string, string> | null }[]) {
    const c = codeKey ? r.fields?.[codeKey] : null
    const a = activityKey ? r.fields?.[activityKey] : null
    if (c) codes.add(c)
    if (a) activities.add(a)
  }

  return {
    rows,
    options: {
      people,
      jobcodes: (jobcodes.data ?? []) as { id: number; name: string }[],
      i7Codes: [...codes].sort(),
      activities: [...activities].sort(),
    },
  }
}

/**
 * Who the hours can be added for, and whether a rate exists for them.
 *
 * The rate is carried so the form can say "this will count as zero" before
 * the entry is saved, rather than after the invoice has gone out.
 */
async function peopleForEntry(supabase: Client) {
  const [{ data: peopleRows }, { data: rateRows }] = await Promise.all([
    supabase.from('people').select('id, full_name').eq('status', 'active').order('full_name'),
    supabase.from('tr_assignments').select('person_id')
      .is('effective_to', null).eq('active', true).not('person_id', 'is', null),
  ])

  const rated = new Set(((rateRows ?? []) as { person_id: string }[]).map(r => r.person_id))
  return ((peopleRows ?? []) as { id: string; full_name: string }[])
    .map(p => ({ id: p.id, name: p.full_name, hasRate: rated.has(p.id) }))
}
