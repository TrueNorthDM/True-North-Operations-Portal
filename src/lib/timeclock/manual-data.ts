// What the manual-hours panel needs: the month's hand-added entries, and the
// options for adding another.
//
// The options are read from what the account actually uses rather than from a
// list in code. A hard-coded i7 code drifts the day somebody adds one in
// TSheets, and the entry would land in the report under a code the tree does
// not have, which shows as hours that are counted and invisible.

import type { SupabaseClient } from '@supabase/supabase-js'
import { i7JobcodeIdsHere } from './report-source'
import { loadI7Assignments } from '@/lib/tsheets/report-data'
import { rateStateFor } from '@/lib/tsheets/rates'
import { mapCodeToProject, I7_PROJECTS } from '@/lib/tsheets/i7report'
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
 * One form for every branch, the way QuickBooks Time asks: the top job first,
 * then the discipline inside it, then a middle that depends on which branch you
 * entered by.
 *
 * This replaced two panels, one per client report, each of which only knew how
 * to tag its own client. Two nearly identical forms that had to keep behaving
 * alike is the shape of a defect waiting to happen, and neither of them could
 * ever have added an hour for a client that did not yet have a report.
 */
export async function loadAllManualHours(
  supabase: Client, month: string,
): Promise<{ rows: ManualRow[]; options: ManualOptions }> {
  const start = `${month}-01`
  const end = `${month}-31`

  const keys = await loadEntryFieldKeys(supabase)

  const [{ data: jobRows }, { data: entryRows }, people, companies, projects, billable, i7Ids] =
    await Promise.all([
      supabase.from('tc_jobcodes').select('id, name, parent_id, active, external_id'),
      supabase.from('tc_entries')
        .select('id, person_id, entry_date, duration_seconds, jobcode_id, fields, notes, created_by')
        .eq('kind', 'manual').is('external_id', null)
        .gte('entry_date', start).lte('entry_date', end)
        .order('entry_date', { ascending: false }),
      peopleForEntry(supabase, month),
      loadFieldOptions(supabase, keys.company),
      loadFieldOptions(supabase, keys.project),
      loadFieldOptions(supabase, keys.billable),
      i7JobcodeIdsHere(supabase),
    ])

  const all = (jobRows ?? []) as {
    id: number; name: string; parent_id: number | null; active: boolean; external_id: number | null
  }[]
  const jobcodeName = new Map(all.map(j => [j.id, j.name]))
  const childrenOf = new Map<number, typeof all>()
  for (const j of all) {
    if (j.parent_id == null) continue
    childrenOf.set(j.parent_id, [...(childrenOf.get(j.parent_id) ?? []), j])
  }

  // Every active root. QuickBooks Time also assigns each job to people and shows
  // only the assigned ones, but the portal does not import that, so narrowing to
  // the three everybody has would mean writing three names into the code and
  // watching them go stale. The screen says what it is offering instead.
  const tops = all
    .filter(j => j.parent_id === null && j.active)
    .sort((a, b) => byLabel(a.name, b.name))
    .map(j => ({
      id: String(j.id),
      name: j.name,
      branch: (i7Ids.has(j.id) ? 'i7' : 'project') as 'i7' | 'project',
    }))

  // A root with no children is the job itself, which is how Adventist
  // Messengers works over there: you pick it and there is nothing to drill into.
  const jobsByTop: Record<string, { id: number; name: string }[]> = {}
  for (const t of tops) {
    const kids = childrenOf.get(Number(t.id)) ?? []
    jobsByTop[t.id] = choosableJobcodes(kids.length ? kids : all.filter(j => String(j.id) === t.id))
  }

  const codes = new Set<string>()
  const activities = new Set<string>()
  for (const r of (entryRows ?? []) as { fields: Record<string, string> | null }[]) {
    const c = keys.code ? r.fields?.[keys.code] : null
    const a = keys.activity ? r.fields?.[keys.activity] : null
    if (c) codes.add(c)
    if (a) activities.add(a)
  }
  const recentCodes = await recentI7Codes(supabase, month, keys.code)
  for (const c of recentCodes) codes.add(c)

  const rows: ManualRow[] = ((entryRows ?? []) as {
    id: number; person_id: string; entry_date: string; duration_seconds: number
    jobcode_id: number | null; fields: Record<string, string> | null
    notes: string | null; created_by: string | null
  }[]).map(e => {
    const f = e.fields ?? {}
    const code = keys.code ? f[keys.code] : ''
    const project = keys.project ? f[keys.project] : ''
    return {
      id: e.id,
      personName: people.find(p => p.id === e.person_id)?.name ?? 'Unknown',
      entryDate: e.entry_date,
      hours: Math.round((e.duration_seconds / 3600) * 100) / 100,
      jobcodeName: e.jobcode_id ? jobcodeName.get(e.jobcode_id) ?? '' : '',
      // Whichever of the two the branch filled in. They are the same slot in
      // the sentence, so the row reads the same either way.
      tag: code || project || '',
      activity: (keys.activity ? f[keys.activity] : '') ?? '',
      notes: e.notes,
      addedBy: e.created_by ? people.find(p => p.id === e.created_by)?.name ?? null : null,
    }
  })

  return {
    rows,
    options: {
      people,
      tops,
      jobsByTop,
      i7Codes: groupCodesByProject([...codes]),
      companies,
      projects,
      activities: [...new Set([...activities, ...(await loadFieldOptions(supabase, keys.activity))])].sort(byLabel),
      billable,
    },
  }
}

/** i7 codes seen in the last year, so the list matches what people already type. */
async function recentI7Codes(supabase: Client, month: string, codeKey: string | null): Promise<string[]> {
  if (!codeKey) return []
  const { data } = await supabase.from('tc_entries').select('fields')
    .gte('entry_date', optionsSince(month)).limit(20_000)
  const out = new Set<string>()
  for (const r of (data ?? []) as { fields: Record<string, string> | null }[]) {
    const c = r.fields?.[codeKey]
    if (c) out.add(c)
  }
  return [...out]
}
