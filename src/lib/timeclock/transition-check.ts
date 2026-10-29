/**
 * The transition report (North Time > Transition): while TSheets and North
 * Time run side by side, every TSheets entry dated on or after the switch date
 * (tc_settings.structure_switch_date), as TSheets recorded it beside how the
 * portal reads it in the 2026 structure (Client › Division › Project, the 2026
 * Activity, Billable), with what does not fit.
 *
 * TSheets keeps its old jobs and fields until it is switched off (owner, 29
 * October 2026), so an old job is not a problem: the entry is translated
 * (translateOldEntry). Problems are the real gaps: what the person can fix in
 * QuickBooks Time (Activity, i7 Code, Notes) and what only an admin can (a job
 * the portal does not know, a folder with no 2026 client, a value the
 * translation table does not know).
 *
 * Pure: no database, safe on the client and in tests. The loader is
 * transition-data.ts.
 */

import { activityNeedsNotes } from './entry-rules'
import { dayLabel } from './format'
import { formatDuration } from './rounding'
import { I7_CLIENT, translateOldEntry } from './structure-2026'

// ── What goes in ────────────────────────────────────────────────────────────

/** The job as the catalogue knows it (loadCatalog's Job, the parts read here). */
export interface CheckJob {
  id: number
  name: string
  path: string
  parentId: number | null
  kind: string
  billable: boolean
  isFolder: boolean
  structure: 1 | 2
  level: 'client' | 'division' | 'project' | null
  /** A TSheets job: the 2026 client its top folder is linked to, and that folder's name. */
  client2026?: string | null
  topName?: string
}

/** tc_fields ids of the old TSheets fields an entry is translated from. */
export interface OldKeys { project: string | null; company: string | null; activity: string | null; billable: string | null; code: string | null; tasks: string | null }

/** One imported entry (tc_entries with source 'tsheets'). */
export interface CheckEntry {
  id: number
  externalId: number | null
  personId: string
  date: string
  seconds: number
  jobcodeId: number | null
  /** tc_fields.id to the value, as the import stores it. */
  fields: Record<string, string>
  notes: string | null
}

export interface CheckContext {
  jobs: ReadonlyMap<number, CheckJob>
  /** tc_fields.id to its label, every field (the old ones and the 2026 Activity). */
  fieldLabels: ReadonlyMap<string, string>
  /** The 2026 Activity field's id, null while it does not exist. */
  activityFieldId: string | null
  /** The old fields' ids (a TSheets entry is read through them). */
  oldKeys?: OldKeys
  nameOf: (personId: string) => string
}

// ── What comes out ──────────────────────────────────────────────────────────

export type ProblemKind = 'no-job' | 'no-client' | 'folder' | 'no-activity' | 'activity-unknown' | 'no-code' | 'no-notes'

export const PROBLEM_LABEL: Record<ProblemKind, string> = {
  'no-job': 'Job unknown',
  'no-client': 'No 2026 client',
  folder: 'A folder, not a project',
  'no-activity': 'Activity missing',
  'activity-unknown': 'Activity not in the table',
  'no-code': 'i7 Code missing',
  'no-notes': 'Notes missing',
}

/** The sentence under each problem, for the row's tooltip and the legend. */
export const PROBLEM_HINT: Record<ProblemKind, string> = {
  'no-job': 'The import found no job for this entry: its TSheets job is not in the catalogue. For an admin.',
  'no-client': 'The TSheets folder is not linked to a 2026 client (Company settings > Job catalogue > Clients), and the entry\'s Project and Company do not say one. For an admin.',
  folder: 'The entry sits on a client or a division of the 2026 structure, not on one of its projects.',
  'no-activity': 'The Activity is empty (and so is Tasks).',
  'activity-unknown': 'The Activity has a value the translation table does not know yet. For an admin.',
  'no-code': 'An i7 job without a valid i7 Code, so the i7 division and project are unknown.',
  'no-notes': 'The Activity is "Other" or "Meeting: Other", which asks for Notes, and there are none.',
}

/** The order problems are listed in, and counted in. */
export const PROBLEM_ORDER: ProblemKind[] = ['no-job', 'no-client', 'folder', 'no-activity', 'activity-unknown', 'no-code', 'no-notes']

/** What the person can fix in QuickBooks Time; the rest is for an admin, and Remind never sends it. */
export const PERSON_FIXES: ReadonlySet<ProblemKind> = new Set(['no-activity', 'no-code', 'no-notes'])

export interface TransitionRow {
  id: number
  externalId: number | null
  personId: string
  person: string
  date: string
  seconds: number
  tsheets: {
    /** The job path, null when the import found no job. */
    job: string | null
    /** Every field the entry carries, with its label, in the labels' order. */
    fields: { label: string; value: string }[]
    notes: string | null
  }
  portal: {
    /** Time off (a TSheets time-off job): no project, nothing to check. */
    timeOff: boolean
    client: string | null
    division: string | null
    project: string | null
    activity: string | null
    /** The project's billable flag; null when there is no project. */
    billable: boolean | null
  }
  problems: ProblemKind[]
}

export interface TransitionSummary {
  entries: number
  seconds: number
  /** Entries with at least one problem. */
  problems: number
  byKind: Record<ProblemKind, number>
}

// ── Reading one entry ───────────────────────────────────────────────────────

/** Client, Division and Project of a 2026 job, by walking up its levels. */
function placeOf(job: CheckJob, jobs: ReadonlyMap<number, CheckJob>): { client: string | null; division: string | null; project: string | null } {
  const out = { client: null as string | null, division: null as string | null, project: null as string | null }
  let cur: CheckJob | undefined = job
  for (let i = 0; i < 10 && cur; i++) {
    if (cur.level === 'project' && !out.project) out.project = cur.name
    else if (cur.level === 'division' && !out.division) out.division = cur.name
    else if (cur.level === 'client' && !out.client) out.client = cur.name
    cur = cur.parentId != null ? jobs.get(cur.parentId) : undefined
  }
  return out
}

export function readEntry(e: CheckEntry, ctx: CheckContext): TransitionRow {
  const job = e.jobcodeId != null ? ctx.jobs.get(e.jobcodeId) : undefined
  const fields = Object.entries(e.fields ?? {})
    .filter(([, v]) => v != null && String(v).trim() !== '')
    .map(([id, v]) => ({ id, label: ctx.fieldLabels.get(id) ?? `Field ${id}`, value: String(v) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'en', { numeric: true }))
  const val = (k: string | null | undefined) => (k ? (e.fields?.[k] ?? '').trim() || null : null)
  let activity = val(ctx.activityFieldId)
  const notes = (e.notes ?? '').trim() || null
  const timeOff = !!job && job.kind !== 'regular'

  const problems: ProblemKind[] = []
  let place = { client: null as string | null, division: null as string | null, project: null as string | null }
  let billable: boolean | null = null
  if (!job) problems.push('no-job')
  else if (!timeOff && job.structure === 2) {
    place = placeOf(job, ctx.jobs)
    if (job.level !== 'project' || job.isFolder) problems.push('folder')
    else {
      billable = job.billable
      if (!activity) problems.push('no-activity')
    }
  } else if (!timeOff) {
    // A TSheets job: TSheets keeps its old list, so the entry is translated.
    const k = ctx.oldKeys
    const oldActivity = val(k?.activity)
    const task = val(k?.tasks)
    const code = val(k?.code)
    const t = translateOldEntry({
      folderClient: job.client2026 ?? null, folderName: job.topName ?? null, jobName: job.name,
      project: val(k?.project), company: val(k?.company), activity: oldActivity, task, code,
    })
    place = { client: t.client, division: t.division, project: t.project }
    activity = t.activity ?? oldActivity
    const b = (val(k?.billable) ?? '').toLowerCase()
    billable = b === 'yes' ? true : b === 'no' ? false : null
    if (!t.client) problems.push('no-client')
    if (!oldActivity && !task) problems.push('no-activity')
    else if (!t.activity) problems.push('activity-unknown')
    if (t.client === I7_CLIENT && !t.project) problems.push('no-code')
  }
  if (!timeOff && activityNeedsNotes(activity) && !notes) problems.push('no-notes')

  return {
    id: e.id,
    externalId: e.externalId,
    personId: e.personId,
    person: ctx.nameOf(e.personId),
    date: e.date,
    seconds: e.seconds,
    tsheets: { job: job ? job.path : null, fields: fields.map(({ label, value }) => ({ label, value })), notes },
    portal: { timeOff, ...place, activity, billable },
    problems,
  }
}

// ── The list ────────────────────────────────────────────────────────────────

export interface TransitionFilter {
  /** First day, never before the switch date. */
  from: string
  /** Last day, or null for "up to today and after". */
  to: string | null
  personId: string | null
  onlyProblems: boolean
}

/** The period the page reads: from the switch date by default, and never before it. */
export function periodOf(switchDate: string, from?: string | null, to?: string | null): { from: string; to: string | null } {
  const day = (d: string | null | undefined) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : null)
  const f = day(from)
  const start = f && f > switchDate ? f : switchDate
  const t = day(to)
  return { from: start, to: t && t >= start ? t : null }
}

/** Problems first, then the newest day, then the person, then the entry. */
export function sortRows(rows: TransitionRow[]): TransitionRow[] {
  return [...rows].sort((a, b) =>
    (b.problems.length ? 1 : 0) - (a.problems.length ? 1 : 0)
    || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
    || a.person.localeCompare(b.person)
    || a.id - b.id)
}

export function summarize(rows: readonly TransitionRow[]): TransitionSummary {
  const byKind = Object.fromEntries(PROBLEM_ORDER.map(k => [k, 0])) as Record<ProblemKind, number>
  let seconds = 0
  let problems = 0
  for (const r of rows) {
    seconds += r.seconds
    if (r.problems.length) problems++
    for (const p of r.problems) byKind[p]++
  }
  return { entries: rows.length, seconds, problems, byKind }
}

export interface TransitionView {
  rows: TransitionRow[]
  summary: TransitionSummary
  /** The people with entries in the period (before the person and problem filters), by name. */
  people: { id: string; name: string }[]
}

/**
 * Every entry read, then the filters, in order. The counts follow the person
 * filter but not "only problems", so the cards keep saying how many entries
 * the problems are out of.
 */
export function buildTransition(entries: readonly CheckEntry[], ctx: CheckContext, f: TransitionFilter): TransitionView {
  const inPeriod = entries.filter(e => e.date >= f.from && (!f.to || e.date <= f.to))
  const people = [...new Map(inPeriod.map(e => [e.personId, ctx.nameOf(e.personId)])).entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))
  const read = inPeriod.filter(e => !f.personId || e.personId === f.personId).map(e => readEntry(e, ctx))
  const summary = summarize(read)
  const rows = sortRows(f.onlyProblems ? read.filter(r => r.problems.length) : read)
  return { rows, summary, people }
}

// ── The reminder (Remind, owner 28 October 2026) ────────────────────────────

/** How many entries a reminder lists before "And N more". */
export const REMINDER_LINES = 15

/** What the person changes in QuickBooks Time for each problem they can fix (PERSON_FIXES), in TSheets' words. */
export function fixOf(p: ProblemKind, r: Pick<TransitionRow, 'portal'>): string {
  switch (p) {
    case 'no-activity': return 'pick the "3 Activity"'
    case 'no-code': return 'pick the "1 - i7 Code"'
    case 'no-notes': return `add Notes (${r.portal.activity ?? 'this Activity'} asks for them)`
    default: return ''
  }
}

/** The problems on a row the person can fix themselves. */
export const personProblems = (r: Pick<TransitionRow, 'problems'>): ProblemKind[] => r.problems.filter(p => PERSON_FIXES.has(p))

/**
 * The bell row a person gets from Remind: how many of their TSheets entries
 * to fix, then each one (day, hours, job) with what to change, and where. Only
 * what they can fix in QuickBooks Time: the admin's gaps are never sent.
 */
export function reminderText(rows: readonly TransitionRow[]): { title: string; body: string } {
  const bad = rows.filter(r => personProblems(r).length)
  const n = bad.length
  const title = n === 1 ? 'One of your TSheets entries needs fixing in QuickBooks Time' : `${n} of your TSheets entries need fixing in QuickBooks Time`
  const lines = [...bad].sort((a, b) => a.date.localeCompare(b.date))
    .map(r => `${dayLabel(r.date)}, ${formatDuration(r.seconds)}, ${r.tsheets.job ?? 'no job'}: ${personProblems(r).map(p => fixOf(p, r)).join('; ')}.`)
  // A bell row stays readable: the oldest REMINDER_LINES, then how many more.
  const shown = lines.slice(0, REMINDER_LINES)
  const more = lines.length - shown.length
  return { title, body: `${shown.join(' ')}${more ? ` And ${more} more.` : ''} Fix ${n === 1 ? 'it' : 'them'} in QuickBooks Time; the portal reads the change on its next import.` }
}
