// What the manual-hours panel needs: the month's hand-added entries, and the
// options for adding another.
//
// The options are read from what the account actually uses rather than from a
// list in code. A hard-coded i7 code drifts the day somebody adds one in
// TSheets, and the entry would land in the report under a code the tree does
// not have, which shows as hours that are counted and invisible.

import type { SupabaseClient } from '@supabase/supabase-js'
import { i7JobcodeIdsHere, jobcodeSubtree } from './report-source'
import { loadI7Assignments } from '@/lib/tsheets/report-data'
import { rateStateFor } from '@/lib/tsheets/rates'
import { I7_CODE_CF, ACTIVITY_CF, mapCodeToProject, I7_PROJECTS } from '@/lib/tsheets/i7report'
import { loadEntryFieldKeys, loadFieldOptions } from './manual-fields'
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

  const billableKey = (await loadEntryFieldKeys(supabase)).billable

  const [entries, jobcodes, recent, billable] = await Promise.all([
    supabase.from('tc_entries')
      .select('id, person_id, entry_date, duration_seconds, jobcode_id, fields, notes, created_by')
      .eq('kind', 'manual').is('external_id', null)
      .gte('entry_date', start).lte('entry_date', end)
      .order('entry_date', { ascending: false }),
    supabase.from('tc_jobcodes').select('id, name, parent_id, active').in('id', [...jobcodeIds]),
    // The code and activity lists come from what has actually been logged, so
    // they match what people already type rather than a list kept in code.
    supabase.from('tc_entries').select('fields')
      .gte('entry_date', optionsSince(month))
      .limit(20_000),
    loadFieldOptions(supabase, billableKey),
  ])

  const people = await peopleForEntry(supabase, month)

  const allJobcodes = (jobcodes.data ?? []) as {
    id: number; name: string; parent_id: number | null; active: boolean
  }[]

  const nameById = new Map(people.map(p => [p.id, p.name]))
  // Every i7 job code, retired ones included, so an OLD entry still shows the
  // name of the code it was logged under. What may be CHOSEN is narrower, below.
  const jobcodeName = new Map(allJobcodes.map(j => [j.id, j.name]))

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
    tag: (codeKey ? e.fields?.[codeKey] : '') ?? '',
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
      jobcodes: choosableJobcodes(allJobcodes),
      i7Codes: groupCodesByProject([...codes]),
      activities: [...activities].sort(byLabel),
      billable,
    },
  }
}

/**
 * Case-insensitively, or ASCII order buries every lower-case label under the
 * upper-case ones: i7-ADMIN and i7-MKTG sat below WMW-MKTG, which is the last
 * place anyone looks for a code beginning with i.
 */
const byLabel = (a: string, b: string) => a.localeCompare(b, 'en', { sensitivity: 'base' })

/**
 * The i7 codes, under the project each one lands in.
 *
 * The report decides a code's project from its first letters, and that rule has
 * never been visible anywhere: it only shows itself afterwards, when the hours
 * turn up in a row of the tree. Grouping the list by it answers, at the moment
 * of choosing, the question the person actually has, which is where this hour
 * will appear on the invoice.
 *
 * Group order follows the report's own, so the list reads like the table it
 * feeds. Anything whose prefix matches no project lands in 'Unassigned' and
 * sorts last: it still counts hours, and it should look like the loose end it is.
 */
export function groupCodesByProject(codes: string[]): { code: string; project: string }[] {
  const order = new Map<string, number>(I7_PROJECTS.map((p, i) => [p, i]))
  const rank = (p: string) => order.get(p) ?? I7_PROJECTS.length
  return codes
    .map(code => ({ code, project: mapCodeToProject(code) }))
    .sort((a, b) => rank(a.project) - rank(b.project) || byLabel(a.code, b.code))
}

/**
 * The job codes a new entry may be logged against.
 *
 * Two narrowings, both of which the list was missing, and both of which TSheets
 * applies without being asked:
 *
 *   Folders are not job codes. "2 - i7 Marketing" is a branch you drill into
 *   over there, never a thing you log to, and it was sitting in the list beside
 *   its own children as though it were one of them.
 *
 *   Retired codes are not on offer. tc_jobcodes carries `active` and nobody was
 *   reading it, so codes TSheets has taken out of circulation were still being
 *   offered for a line on a new invoice.
 *
 * The REPORT still reads every code, active or not: the hours logged under a
 * code before it was retired are real and have to keep counting. It is only the
 * choosing that narrows.
 */
function choosableJobcodes(
  all: { id: number; name: string; parent_id: number | null; active: boolean }[],
): { id: number; name: string }[] {
  const isFolder = new Set(all.map(j => j.parent_id).filter((p): p is number => p != null))
  return all
    .filter(j => j.active && !isFolder.has(j.id))
    .map(j => ({ id: j.id, name: j.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }))
}

/**
 * Who the hours can be added for, and whether the report will actually cost them.
 *
 * The rate is carried so the form can say "this will count as zero" before the
 * entry is saved, rather than after the invoice has gone out.
 *
 * It asks the question through loadI7Assignments and rateFor, which is what the
 * report itself uses, so the warning cannot disagree with the number it is
 * warning about. Asking separately is how it went wrong: the check read every
 * active rate for every client, while the sentence promised something about the
 * i7 rate for the month being reported. Those coincided until they did not.
 *
 * Two cases the old check waved through, both of which cost zero:
 *   - a rate for another client and none for i7
 *   - an i7 rate that starts after the month being reported, which is exactly
 *     what "Start on 1 September" produces while August is still being invoiced
 */
async function peopleForEntry(supabase: Client, month: string) {
  const [{ data: peopleRows }, assignments] = await Promise.all([
    supabase.from('people').select('id, full_name').eq('status', 'active').order('full_name'),
    // Reaches tr_assignments through the privileged client, like every other
    // reader of that table: migration 054 revoked SELECT on it from
    // `authenticated` and re-granted a column list that cannot include
    // person_id, since that column arrived long afterwards. A session client
    // gets permission denied, and an unchecked error here would quietly tell
    // everybody they have no rate.
    loadI7Assignments(),
  ])

  return ((peopleRows ?? []) as { id: string; full_name: string }[]).map(p => {
    const state = rateStateFor(assignments, p.id, month)
    return {
      id: p.id,
      name: p.full_name,
      hasRate: state === 'rated',
      rateOutsideMonth: state === 'outside',
    }
  })
}

/**
 * Everyone, with no word about rates.
 *
 * The Grant Pass report counts hours and shows no cost, so a rate warning there
 * would be inventing a rule. Saying "hasRate: true" for everybody would have
 * been the shorter path and a lie in the data: the field is absent instead, and
 * the form has nothing to warn about.
 */
async function peopleForProjectEntry(supabase: Client) {
  const { data } = await supabase
    .from('people').select('id, full_name').eq('status', 'active').order('full_name')
  return ((data ?? []) as { id: string; full_name: string }[])
    .map(p => ({ id: p.id, name: p.full_name }))
}

/**
 * The Grant Pass panel: the same form, filled in the way the work outside the
 * i7 tree is tagged.
 *
 * Grant Pass has never had a way to add an hour by hand. It did not need a
 * screen of its own: its report finds hours by looking for `GP church` and
 * `GP School` inside the "2 Project" field, without caring where they came
 * from, so an entry written here is picked up with no further wiring.
 *
 * The project list is narrowed to those two values on purpose. Every other
 * value of that field belongs to some other work, and this panel sits on the
 * Grant Pass page: offering them would be offering to file an hour where nobody
 * would look for it again.
 */
export async function loadProjectManualHours(
  supabase: Client, month: string, root: RegExp, projectValues: (label: string) => boolean,
): Promise<{ rows: ManualRow[]; options: ManualOptions }> {
  const start = `${month}-01`
  const end = `${month}-31`

  const keys = await loadEntryFieldKeys(supabase)
  const branch = await jobcodeSubtree(supabase, j => j.parent_id === null && root.test(j.name))

  const [{ data: jobRows }, { data: entryRows }, people, companies, billable, projectOptions] =
    await Promise.all([
      supabase.from('tc_jobcodes').select('id, name, parent_id, active').in('id', [...branch]),
      supabase.from('tc_entries')
        .select('id, person_id, entry_date, duration_seconds, jobcode_id, fields, notes, created_by')
        .eq('kind', 'manual').is('external_id', null)
        .gte('entry_date', start).lte('entry_date', end)
        .order('entry_date', { ascending: false }),
      peopleForProjectEntry(supabase),
      loadFieldOptions(supabase, keys.company),
      loadFieldOptions(supabase, keys.billable),
      loadFieldOptions(supabase, keys.project),
    ])

  const allJobcodes = (jobRows ?? []) as {
    id: number; name: string; parent_id: number | null; active: boolean
  }[]
  const jobcodeName = new Map(allJobcodes.map(j => [j.id, j.name]))
  const nameById = new Map(people.map(p => [p.id, p.name]))

  const projects = projectOptions.filter(projectValues)
  const wanted = new Set(projects)

  const rows: ManualRow[] = ((entryRows ?? []) as {
    id: number; person_id: string; entry_date: string; duration_seconds: number
    jobcode_id: number | null; fields: Record<string, string> | null
    notes: string | null; created_by: string | null
  }[])
    // Listed by what the entry is TAGGED as, not by which job code it sits
    // under, because that tag is exactly what the Grant Pass report reads.
    .filter(e => wanted.has((keys.project ? e.fields?.[keys.project] : '') ?? ''))
    .map(e => ({
      id: e.id,
      personName: nameById.get(e.person_id) ?? 'Unknown',
      entryDate: e.entry_date,
      hours: Math.round((e.duration_seconds / 3600) * 100) / 100,
      jobcodeName: e.jobcode_id ? jobcodeName.get(e.jobcode_id) ?? '' : '',
      tag: (keys.project ? e.fields?.[keys.project] : '') ?? '',
      activity: (keys.activity ? e.fields?.[keys.activity] : '') ?? '',
      notes: e.notes,
      addedBy: e.created_by ? nameById.get(e.created_by) ?? null : null,
    }))

  const recentActivities = new Set<string>()
  for (const r of (entryRows ?? []) as { fields: Record<string, string> | null }[]) {
    const a = keys.activity ? r.fields?.[keys.activity] : null
    if (a) recentActivities.add(a)
  }

  return {
    rows,
    options: {
      people,
      jobcodes: choosableJobcodes(allJobcodes),
      companies,
      projects,
      activities: [...new Set([...recentActivities, ...(await loadFieldOptions(supabase, keys.activity))])].sort(byLabel),
      billable,
    },
  }
}
