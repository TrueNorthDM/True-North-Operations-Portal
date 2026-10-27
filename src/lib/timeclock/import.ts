// The migration: QuickBooks Time → the portal's own tables.
//
// Built as an importer rather than a one-off script, because it has to run many
// times. A copy is made once and starts ageing the next second; a migration
// converges. Every imported row carries its TSheets id in external_id with a
// unique index, so re-running upserts instead of duplicating, and the last run
// before the cutover is the only one that is final.
//
// Three things change upstream between now and the cutover, and all three are
// handled: new and edited entries (modified_since), retroactive approvals (they
// move last_modified, so modified_since catches them), and deletions (which
// modified_since cannot see, hence /timesheets_deleted).
//
// Rows born in the portal have no external_id and are never touched here.
// Neither are jobs and field options a Super Admin changed in the job
// catalogue (edited_in_portal_at, Clocky part 2): the portal keeps those now,
// and the import only adds what is new in QuickBooks Time.

import type { Db } from '@/lib/supabase/types'
import {
  fetchAllJobcodes, fetchAllUsers, fetchFields, fetchFieldOptions,
  fetchTimesheetRange, fetchDeletedIds,
  type SourceTimesheet,
} from './source'
import { splitByStart } from './waves'
import { missingTable } from '@/lib/supabase/errors'
import { jobPath } from './format'

type Client = Db

export interface Maps {
  jobcodeByExternal: Map<number, number>
  personByTsheetsUser: Map<number, string>
  fieldByExternal: Map<number, number>
}

const BATCH = 500

/** TSheets job code types → ours. Anything unpaid is still absence, not work. */
function jobcodeKind(type: string): 'regular' | 'pto' | 'unpaid' {
  if (type === 'pto' || type === 'paid_holiday') return 'pto'
  if (type === 'unpaid_time_off' || type === 'unpaid_holiday') return 'unpaid'
  return 'regular'
}

// ─── Catalog: job codes, fields, people ─────────────────────────────────────

/**
 * The job code tree, all 545 of them.
 *
 * Two passes: rows first, parents second. A child can arrive before its parent,
 * and a self-referencing foreign key does not forgive that.
 */
export async function importJobcodes(supabase: Client, token: string): Promise<number> {
  const edited = await editedExternals(supabase, 'tc_jobcodes')
  const source = (await fetchAllJobcodes(token)).filter(j => !edited.has(j.id))

  for (let i = 0; i < source.length; i += BATCH) {
    const rows = source.slice(i, i + BATCH).map(j => ({
      external_id: j.id,
      name: j.name,
      kind: jobcodeKind(j.type),
      billable: Boolean(j.billable),
      active: Boolean(j.active),
      imported_at: new Date().toISOString(),
    }))
    const { error } = await supabase.from('tc_jobcodes').upsert(rows, { onConflict: 'external_id' })
    if (error) throw new Error(`tc_jobcodes upsert: ${error.message}`)
  }

  // Parents are set by group, not one row at a time. 545 sequential UPDATEs is
  // 545 round trips to the database, which took longer than the whole month of
  // timesheets that follows it. Grouping by parent turns it into about fifty.
  const byExternal = await loadJobcodeMap(supabase)
  const childrenOf = new Map<number | null, number[]>()
  for (const j of source) {
    const mine = byExternal.get(j.id)
    if (!mine) continue
    const parent = j.parent_id ? byExternal.get(j.parent_id) ?? null : null
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), mine])
  }
  for (const [parent, ids] of childrenOf) {
    for (let i = 0; i < ids.length; i += BATCH) {
      const { error } = await supabase
        .from('tc_jobcodes').update({ parent_id: parent }).in('id', ids.slice(i, i + BATCH))
      if (error) throw new Error(`tc_jobcodes parent: ${error.message}`)
    }
  }
  return source.length
}

/** The QuickBooks Time ids of rows changed in the job catalogue, which the import leaves alone. */
async function editedExternals(supabase: Client, table: 'tc_jobcodes' | 'tc_field_options'): Promise<Set<number>> {
  const { data, error } = await supabase.from(table).select('external_id').not('edited_in_portal_at', 'is', null).not('external_id', 'is', null).limit(5000)
  if (error) throw new Error(`${table} edited read: ${error.message}`)
  return new Set((data ?? []).map(r => Number(r.external_id)))
}

/** The entry form: the six custom fields and every one of their values. */
export async function importFields(supabase: Client, token: string): Promise<number> {
  const fields = await fetchFields(token)
  const { error } = await supabase.from('tc_fields').upsert(
    fields.map((f, i) => ({
      external_id: f.id,
      name: f.name,
      position: i,
      required: Boolean(f.required),
      active: Boolean(f.active),
    })),
    { onConflict: 'external_id' },
  )
  if (error) throw new Error(`tc_fields upsert: ${error.message}`)

  const { data: mine } = await supabase.from('tc_fields').select('id, external_id')
  const idByExternal = new Map<number, number>()
  for (const r of (mine ?? []) as { id: number; external_id: number | null }[]) {
    if (r.external_id != null) idByExternal.set(r.external_id, r.id)
  }

  const edited = await editedExternals(supabase, 'tc_field_options')
  let options = 0
  for (const f of fields) {
    const fieldId = idByExternal.get(f.id)
    if (!fieldId) continue
    const items = (await fetchFieldOptions(token, f.id)).filter(o => !edited.has(o.id))
    if (!items.length) continue
    const { error: optErr } = await supabase.from('tc_field_options').upsert(
      items.map((o, i) => ({
        field_id: fieldId,
        external_id: o.id,
        label: o.name,
        position: i,
        active: Boolean(o.active),
      })),
      { onConflict: 'field_id,label' },
    )
    if (optErr) throw new Error(`tc_field_options upsert (${f.name}): ${optErr.message}`)
    options += items.length
  }
  return options
}

/**
 * People.
 *
 * Recognition goes through tc_user_links, not people.tsheets_user_id. One person
 * can own several TSheets accounts (an old one and a current one), and the
 * person row only carries the primary, so reading that column meant the import
 * did not recognise the second account and created a duplicate person for it.
 * Fifteen of those were merged in migration 063.
 *
 * Anyone genuinely unknown is a former employee who was never in the directory,
 * and is created as tsheets_only + inactive so their decade of hours has an
 * owner without cluttering the Directory. If one turns out to be someone who is
 * already there under another spelling, "link to person" in Settings merges them.
 */
/** Every TSheets account the portal already owns, across all its people. */
async function loadKnownAccounts(supabase: Client): Promise<Set<number>> {
  const known = new Set<number>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('tc_user_links').select('tsheets_user_id').range(from, from + 999)
    if (error) throw new Error(`tc_user_links read: ${error.message}`)
    const rows = (data ?? []) as { tsheets_user_id: number }[]
    for (const r of rows) known.add(r.tsheets_user_id)
    if (rows.length < 1000) break
  }
  return known
}

export async function importPeople(supabase: Client, token: string): Promise<{ linked: number; created: number }> {
  const users = await fetchAllUsers(token)
  const known = await loadKnownAccounts(supabase)

  let created = 0
  for (const u of users) {
    if (known.has(u.id)) continue
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim()
    if (!fullName) continue
    const { data: person, error: insErr } = await supabase.from('people').insert({
      full_name: fullName,
      tsheets_user_id: u.id,
      tsheets_only: true,
      status: u.active ? 'active' : 'inactive',
    }).select('id').single()
    if (insErr) throw new Error(`people insert (${fullName}): ${insErr.message}`)
    const { error: linkErr } = await supabase.from('tc_user_links').insert({
      tsheets_user_id: u.id,
      person_id: (person as { id: string }).id,
      is_primary: true,
    })
    if (linkErr) throw new Error(`tc_user_links insert (${fullName}): ${linkErr.message}`)
    known.add(u.id)
    created++
  }
  return { linked: known.size - created, created }
}

// ─── Maps ───────────────────────────────────────────────────────────────────

async function loadJobcodeMap(supabase: Client): Promise<Map<number, number>> {
  const map = new Map<number, number>()
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('tc_jobcodes').select('id, external_id').range(from, from + 999)
    if (error) throw new Error(`tc_jobcodes read: ${error.message}`)
    for (const r of (data ?? []) as { id: number; external_id: number | null }[]) {
      if (r.external_id != null) map.set(r.external_id, r.id)
    }
    if (!data || data.length < 1000) break
  }
  return map
}

export async function loadMaps(supabase: Client): Promise<Maps> {
  const jobcodeByExternal = await loadJobcodeMap(supabase)

  // Account to person, from the link table: a timesheet belonging to somebody's
  // second TSheets account has to land on the same person as their first.
  const personByTsheetsUser = new Map<number, string>()
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase
      .from('tc_user_links').select('tsheets_user_id, person_id').range(from, from + 999)
    const rows = (data ?? []) as { tsheets_user_id: number; person_id: string }[]
    for (const r of rows) personByTsheetsUser.set(r.tsheets_user_id, r.person_id)
    if (rows.length < 1000) break
  }

  const fieldByExternal = new Map<number, number>()
  const { data: fields } = await supabase.from('tc_fields').select('id, external_id')
  for (const r of (fields ?? []) as { id: number; external_id: number | null }[]) {
    if (r.external_id != null) fieldByExternal.set(r.external_id, r.id)
  }

  return { jobcodeByExternal, personByTsheetsUser, fieldByExternal }
}

// ─── Entries ────────────────────────────────────────────────────────────────

/**
 * One TSheets timesheet as one of ours.
 *
 * Returns null when the entry cannot be given an owner, which is the one thing
 * worth dropping loudly rather than storing half of.
 */
export function toEntry(t: SourceTimesheet, maps: Maps, jobcodeKinds: Map<number, string>) {
  const personId = maps.personByTsheetsUser.get(t.user_id)
  if (!personId) return null

  const jobcodeId = maps.jobcodeByExternal.get(t.jobcode_id) ?? null
  const kindOfCode = jobcodeId ? jobcodeKinds.get(jobcodeId) : undefined

  // Absence wins over how it was typed: an 8-hour manual entry against Vacation
  // is absence, not work, whatever the entry method was.
  const kind = kindOfCode === 'pto' || kindOfCode === 'unpaid'
    ? 'absence'
    : (t.type === 'manual' ? 'manual' : 'clock')

  const state = t.locked
    ? 'locked'
    : t.state === 'APPROVED' ? 'approved'
    : t.state === 'SUBMITTED' ? 'submitted'
    : 'open'

  const fields: Record<string, string> = {}
  for (const [externalId, value] of Object.entries(t.customfields ?? {})) {
    if (!value) continue
    const mine = maps.fieldByExternal.get(Number(externalId))
    if (mine) fields[String(mine)] = value
  }

  return {
    external_id: t.id,
    person_id: personId,
    jobcode_id: jobcodeId,
    started_at: t.start || null,
    ended_at: t.end || null,
    duration_seconds: Math.max(0, t.duration ?? 0),
    entry_date: t.date,
    kind,
    state,
    notes: t.notes || null,
    fields,
    source: 'tsheets' as const,
    created_by: t.created_by_user_id ? maps.personByTsheetsUser.get(t.created_by_user_id) ?? null : null,
    updated_at: new Date().toISOString(),
  }
}

export interface MonthResult {
  month: string
  sourceEntries: number
  sourceSeconds: number
  written: number
  skipped: number
  /** Entries dated on or after their person's North Time start date, kept in tc_import_skipped. */
  setAside: number
}

/** One month, pulled and upserted, then reconciled against what we now hold. */
export async function importMonth(
  supabase: Client,
  token: string,
  month: string,                     // 'YYYY-MM'
  maps: Maps,
  jobcodeKinds: Map<number, string>,
  modifiedSince?: string,
  starts: ReadonlyMap<string, string> = new Map(),
): Promise<MonthResult> {
  const [y, m] = month.split('-').map(Number)
  const start = `${month}-01`
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  const source = await fetchTimesheetRange(token, start, end, modifiedSince)
  const all = source.map(t => toEntry(t, maps, jobcodeKinds)).filter(Boolean) as NonNullable<ReturnType<typeof toEntry>>[]
  // From a person's North Time start date (waves.ts), their TSheets entries on
  // or after it are set aside for someone to decide, never written as hours.
  const { keep, skip } = splitByStart(all, starts)
  await setAside(supabase, skip, source)
  const rows = await keepClockyChanges(supabase, keep)

  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await supabase
      .from('tc_entries').upsert(rows.slice(i, i + BATCH), { onConflict: 'external_id' })
    if (error) throw new Error(`tc_entries upsert (${month}): ${error.message}`)
  }

  // Reconciled against what TSheets holds less what was set aside: those are
  // counted in tc_import_skipped, and the month should not read as a gap.
  const aside = new Set(skip.map(r => r.external_id))
  const counted = source.filter(t => !aside.has(t.id))
  await reconcileMonth(supabase, month, counted.length, counted.reduce((s, t) => s + (t.duration ?? 0), 0))

  return {
    month,
    sourceEntries: source.length,
    sourceSeconds: source.reduce((s, t) => s + (t.duration ?? 0), 0),
    written: rows.length,
    skipped: source.length - rows.length,
    setAside: skip.length,
  }
}

/**
 * The entries set aside after their person's start date, kept whole in
 * tc_import_skipped (migration 129): the raw timesheet, the person, the day,
 * the hours, the job path and the fields. Upserted by TSheets id, so a later
 * import refreshes them without touching a decision already taken.
 */
async function setAside(
  supabase: Client,
  rows: readonly (NonNullable<ReturnType<typeof toEntry>> & { starts_on: string })[],
  source: readonly SourceTimesheet[],
): Promise<void> {
  if (!rows.length) return
  const raw = new Map(source.map(t => [t.id, t]))
  const paths = await loadJobPaths(supabase)
  const inEntries = new Set<number>()
  for (let i = 0; i < rows.length; i += BATCH) {
    const { data, error } = await supabase.from('tc_entries').select('external_id').in('external_id', rows.slice(i, i + BATCH).map(r => r.external_id))
    if (error) throw new Error(`tc_entries read: ${error.message}`)
    for (const r of (data ?? []) as { external_id: number | null }[]) if (r.external_id != null) inEntries.add(r.external_id)
  }
  const now = new Date().toISOString()
  const out = rows.map(r => ({
    external_id: r.external_id,
    person_id: r.person_id,
    tsheets_user_id: raw.get(r.external_id)?.user_id ?? 0,
    entry_date: r.entry_date,
    starts_on: r.starts_on,
    duration_seconds: r.duration_seconds,
    started_at: r.started_at,
    ended_at: r.ended_at,
    jobcode_id: r.jobcode_id,
    job_path: r.jobcode_id != null ? paths.get(r.jobcode_id) ?? null : null,
    kind: r.kind,
    state: r.state,
    notes: r.notes,
    fields: r.fields,
    raw: JSON.parse(JSON.stringify(raw.get(r.external_id) ?? {})),
    already_in_entries: inEntries.has(r.external_id),
    last_seen_at: now,
    deleted_in_tsheets_at: null,
  }))
  for (let i = 0; i < out.length; i += BATCH) {
    const { error } = await supabase.from('tc_import_skipped').upsert(out.slice(i, i + BATCH), { onConflict: 'external_id' })
    if (error) throw new Error(`tc_import_skipped upsert: ${error.message}`)
  }
}

/** Every job's path ("2 - i7 Marketing › Web Dev"), for the entries set aside. */
async function loadJobPaths(supabase: Client): Promise<Map<number, string>> {
  const rows: { id: number; name: string; parent_id: number | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('tc_jobcodes').select('id, name, parent_id').order('id').range(from, from + 999)
    if (error) throw new Error(`tc_jobcodes read: ${error.message}`)
    const page = (data ?? []) as typeof rows
    rows.push(...page)
    if (page.length < 1000) break
  }
  const byId = new Map(rows.map(r => [r.id, r]))
  const out = new Map<number, string>()
  for (const r of rows) {
    const names = [r.name]
    let cur = r
    for (let i = 0; i < 20 && cur.parent_id != null && byId.has(cur.parent_id); i++) { cur = byId.get(cur.parent_id)!; names.unshift(cur.name) }
    out.set(r.id, names.length === 1 ? names[0] : jobPath(names.slice(1).join(' › '), names[0]))
  }
  return out
}

/**
 * Their number against ours, for one month.
 *
 * Counting what we hold rather than what we just wrote, on purpose: this has to
 * be able to catch a row that failed to land, and "I wrote 412" cannot.
 */
export async function reconcileMonth(
  supabase: Client,
  month: string,
  tsheetsEntries: number,
  tsheetsSeconds: number,
): Promise<void> {
  const [y, m] = month.split('-').map(Number)
  const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)

  let portalEntries = 0
  let portalSeconds = 0
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('tc_entries')
      .select('duration_seconds')
      .eq('source', 'tsheets')
      .gte('entry_date', `${month}-01`)
      .lte('entry_date', end)
      .range(from, from + 999)
    if (error) throw new Error(`reconcile read (${month}): ${error.message}`)
    const rows = (data ?? []) as { duration_seconds: number }[]
    portalEntries += rows.length
    portalSeconds += rows.reduce((s, r) => s + r.duration_seconds, 0)
    if (rows.length < 1000) break
  }

  const { error } = await supabase.from('tc_reconciliation').upsert({
    month,
    tsheets_entries: tsheetsEntries,
    tsheets_seconds: tsheetsSeconds,
    portal_entries: portalEntries,
    portal_seconds: portalSeconds,
    checked_at: new Date().toISOString(),
  }, { onConflict: 'month' })
  if (error) throw new Error(`reconcile write (${month}): ${error.message}`)
}

/** Entries deleted upstream, removed here so we do not keep an hour that is gone (unless Clocky has changed them since). */
export async function applyDeletions(supabase: Client, token: string, since: string): Promise<number> {
  const ids = await fetchDeletedIds(token, since)
  if (!ids.length) return 0
  let removed = 0
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH)
    const { error, count } = await supabase
      .from('tc_entries').delete({ count: 'exact' }).in('external_id', chunk).is('changed_here_at', null)
    if (error) throw new Error(`delete: ${error.message}`)
    removed += count ?? 0
    // An entry set aside after its person's start date stays listed, marked as deleted in TSheets.
    const { error: asideErr } = await supabase.from('tc_import_skipped')
      .update({ deleted_in_tsheets_at: new Date().toISOString() }).in('external_id', chunk).is('deleted_in_tsheets_at', null)
    if (asideErr && !missingTable(asideErr)) throw new Error(`tc_import_skipped delete mark: ${asideErr.message}`)
  }
  return removed
}

/**
 * What the import may write, now that Clocky runs beside it (16 October 2026):
 *
 *   - an entry Clocky has changed (changed_here_at: stopped by the safety net
 *     at 5h 00m, its end confirmed, edited with a reason) is the portal's from
 *     then on, and the import leaves it as it is; otherwise the next import
 *     would open a stopped clock again, or undo a fix (audit finding C1);
 *   - a clock still open in QuickBooks Time for someone already running a
 *     clock in the portal waits: one running clock per person is a unique
 *     index, and writing it would fail the whole month. It comes in once it
 *     is closed there.
 */
export async function keepClockyChanges<T extends { external_id: number; person_id: string; ended_at: string | null; kind: string }>(
  supabase: Client, rows: readonly T[],
): Promise<T[]> {
  if (!rows.length) return []
  const changed = new Set<number>()
  const known = new Map<number, string | null>()
  for (let i = 0; i < rows.length; i += BATCH) {
    const ids = rows.slice(i, i + BATCH).map(r => r.external_id)
    const { data, error } = await supabase.from('tc_entries').select('external_id, changed_here_at, ended_at').in('external_id', ids)
    if (error) throw new Error(`tc_entries read: ${error.message}`)
    for (const r of (data ?? []) as { external_id: number | null; changed_here_at: string | null; ended_at: string | null }[]) {
      if (r.external_id == null) continue
      if (r.changed_here_at) changed.add(r.external_id)
      known.set(r.external_id, r.ended_at)
    }
  }
  const open = rows.filter(r => r.kind === 'clock' && r.ended_at === null && !changed.has(r.external_id))
  const busy = new Set<string>()
  if (open.length) {
    const people = [...new Set(open.map(r => r.person_id))]
    const { data, error } = await supabase.from('tc_entries').select('person_id, external_id')
      .in('person_id', people).eq('kind', 'clock').is('ended_at', null)
    if (error) throw new Error(`tc_entries read: ${error.message}`)
    const openIds = new Set(open.map(r => r.external_id))
    for (const r of (data ?? []) as { person_id: string; external_id: number | null }[]) {
      if (r.external_id == null || !openIds.has(r.external_id)) busy.add(r.person_id)
    }
  }
  return rows.filter(r => !changed.has(r.external_id)
    && !(r.kind === 'clock' && r.ended_at === null && busy.has(r.person_id) && known.get(r.external_id) !== null))
}

/** Every month from the first with data up to the cutoff, oldest first. */
export function monthsToImport(firstMonth: string, cutoff: string): string[] {
  const out: string[] = []
  const [fy, fm] = firstMonth.split('-').map(Number)
  const [cy, cm] = cutoff.split('-').map(Number)
  for (let y = fy, m = fm; y < cy || (y === cy && m <= cm); m++) {
    if (m > 12) { m = 1; y++ }
    if (y > cy || (y === cy && m > cm)) break
    out.push(`${y}-${String(m).padStart(2, '0')}`)
  }
  return out
}
