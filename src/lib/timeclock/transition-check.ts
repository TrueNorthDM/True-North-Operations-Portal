/**
 * The transition report (North Time > Transition): while TSheets and North
 * Time run side by side, every TSheets entry dated on or after the switch date
 * (tc_settings.structure_switch_date), as TSheets recorded it beside how the
 * portal reads it in the 2026 structure (Client › Division › Project, the 2026
 * Activity, Billable from the project), with what does not fit.
 *
 * Pure: no database, safe on the client and in tests. The loader is
 * transition-data.ts.
 */

import { activityNeedsNotes } from './entry-rules'
import { dayLabel } from './format'
import { formatDuration } from './rounding'

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
}

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
  nameOf: (personId: string) => string
}

// ── What comes out ──────────────────────────────────────────────────────────

export type ProblemKind = 'no-job' | 'old-job' | 'folder' | 'no-activity' | 'no-notes'

export const PROBLEM_LABEL: Record<ProblemKind, string> = {
  'no-job': 'Job unknown',
  'old-job': 'Old TSheets job after the switch',
  folder: 'A folder, not a project',
  'no-activity': 'Activity missing',
  'no-notes': 'Notes missing',
}

/** The sentence under each problem, for the row's tooltip and the legend. */
export const PROBLEM_HINT: Record<ProblemKind, string> = {
  'no-job': 'The import found no job for this entry: its TSheets job is not in the catalogue.',
  'old-job': 'The job belongs to the TSheets tree that ended on the switch date, not to the 2026 structure.',
  folder: 'The entry sits on a client or a division of the 2026 structure, not on one of its projects.',
  'no-activity': 'A 2026 project, but the 2026 Activity field is empty.',
  'no-notes': 'The Activity is "Other" or "Meeting: Other", which asks for Notes, and there are none.',
}

/** The order problems are listed in, and counted in. */
export const PROBLEM_ORDER: ProblemKind[] = ['no-job', 'old-job', 'folder', 'no-activity', 'no-notes']

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
  const activity = ctx.activityFieldId ? (e.fields?.[ctx.activityFieldId] ?? '').trim() || null : null
  const notes = (e.notes ?? '').trim() || null
  const timeOff = !!job && job.kind !== 'regular'

  const problems: ProblemKind[] = []
  let place = { client: null as string | null, division: null as string | null, project: null as string | null }
  let billable: boolean | null = null
  if (!job) problems.push('no-job')
  else if (!timeOff) {
    if (job.structure !== 2) problems.push('old-job')
    else {
      place = placeOf(job, ctx.jobs)
      if (job.level !== 'project' || job.isFolder) problems.push('folder')
      else {
        billable = job.billable
        if (!activity) problems.push('no-activity')
      }
    }
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

/** What the person changes in QuickBooks Time for each problem. */
export function fixOf(p: ProblemKind, r: Pick<TransitionRow, 'portal'>): string {
  switch (p) {
    case 'no-job': return 'pick the job again: the portal does not know this one'
    case 'old-job': return 'pick the 2026 project in place of the old TSheets job'
    case 'folder': return 'pick a project inside it, not the client or division'
    case 'no-activity': return 'fill in the Activity'
    case 'no-notes': return `add Notes (${r.portal.activity ?? 'this Activity'} asks for them)`
  }
}

/**
 * The bell row a person gets from Remind: how many of their TSheets entries
 * to fix, then each one (day, hours, job) with what to change, and where.
 */
export function reminderText(rows: readonly TransitionRow[]): { title: string; body: string } {
  const bad = rows.filter(r => r.problems.length)
  const n = bad.length
  const title = n === 1 ? 'One of your TSheets entries needs fixing in QuickBooks Time' : `${n} of your TSheets entries need fixing in QuickBooks Time`
  const lines = [...bad].sort((a, b) => a.date.localeCompare(b.date))
    .map(r => `${dayLabel(r.date)}, ${formatDuration(r.seconds)}, ${r.tsheets.job ?? 'no job'}: ${r.problems.map(p => fixOf(p, r)).join('; ')}.`)
  return { title, body: `${lines.join(' ')} Fix ${n === 1 ? 'it' : 'them'} in QuickBooks Time; the portal reads the change on its next import.` }
}
