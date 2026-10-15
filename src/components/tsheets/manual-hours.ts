/**
 * The pure half of ManualHours: its types, the form as one value, and the
 * small rules the screen applies to it (when a line may be staged, what the
 * staged list says, what the send button counts). No React here, so each rule
 * can be tested on its own.
 */

import type { ManualEntryInput } from '@/lib/timeclock/manual-entry'

export type ManualRow = {
  id: number
  personName: string
  entryDate: string
  hours: number
  jobcodeName: string
  /**
   * What the entry is tagged with: the i7 code inside the i7 tree, the project
   * outside it. One column, because it is the same slot in the sentence and the
   * row reads the same either way.
   */
  tag: string
  activity: string
  notes: string | null
  addedBy: string | null
}

export type ManualOptions = {
  /**
   * Rate state is absent where it has no meaning. Only the i7 branch turns an
   * hour into money, so only there is "this will count as zero" a real warning;
   * carrying a made-up `hasRate: true` for the others would have been a lie
   * living in the data rather than an absence the form can read.
   */
  people: { id: string; name: string; hasRate?: boolean; rateOutsideMonth?: boolean }[]
  /**
   * The roots, chosen first, exactly as QuickBooks Time asks. `branch` says
   * which middle the form shows once one is picked: an i7 code inside the i7
   * tree, a Company and a Project outside it.
   */
  tops: { id: string; name: string; branch: 'i7' | 'project' }[]
  /** The disciplines inside each root, keyed by the root's id. */
  jobsByTop: Record<string, { id: number; name: string }[]>
  /**
   * The branch-specific middle. Both are carried and the chosen root decides
   * which one is drawn, the same swap QuickBooks Time makes at the same point.
   */
  i7Codes: { code: string; project: string }[]
  companies: string[]
  projects: string[]
  activities: string[]
  billable: string[]
}

/** The fields as typed, every one a string the way the inputs hold it. */
export type ManualForm = {
  personId: string
  entryDate: string
  topId: string
  jobcodeId: string
  hours: string
  i7Code: string
  activity: string
  company: string
  project: string
  billable: string
  notes: string
}

/** A line already staged, carrying the sentence the list shows. */
export type StagedLine = ManualEntryInput & { label: string }

/** Hours to two decimals, so a sum never shows as 7.300000001h. */
export const h2 = (n: number) => Math.round(n * 100) / 100

/** A fresh form: the day starts on the first of the month on screen. */
export const emptyForm = (month: string): ManualForm => ({
  personId: '',
  entryDate: `${month}-01`,
  topId: '',
  jobcodeId: '',
  hours: '',
  i7Code: '',
  activity: '',
  company: '',
  project: '',
  billable: '',
  notes: '',
})

/** The line currently being typed, as the server wants it. */
export const toEntry = (f: ManualForm): ManualEntryInput => ({
  personId: f.personId,
  entryDate: f.entryDate,
  jobcodeId: Number(f.jobcodeId),
  hours: Number(f.hours),
  i7Code: f.i7Code,
  company: f.company,
  project: f.project,
  activity: f.activity,
  billable: f.billable,
  notes: f.notes,
})

/**
 * Why the line cannot be staged yet, or null when it can. The line has to
 * stand on its own before it joins the others, or an empty one sits in the
 * list looking like work that is done.
 */
export function stageProblem(f: ManualForm): string | null {
  if (!f.personId || !f.jobcodeId || !f.entryDate || !(Number(f.hours) > 0)) {
    return 'Fill the day, the hours and the job before adding the line.'
  }
  return null
}

/** What the staged list shows for a line, so it reads like the report will. */
export const describeLine = (options: ManualOptions, topId: string, d: ManualEntryInput) => [
  options.tops.find(t => t.id === topId)?.name,
  (options.jobsByTop[topId] ?? []).find(j => j.id === d.jobcodeId)?.name,
  d.i7Code || d.project,
  d.activity,
].filter(Boolean).join(' › ')

/** Whether the fields hold a line that the send button would carry. */
export const isTyping = (f: ManualForm) => Number(f.hours) > 0 && Boolean(f.jobcodeId)

/**
 * What one press of the send button writes. The line still in the fields
 * counts: making somebody stage it first, then press a second button, is a
 * rule that only exists because of how this is built.
 *
 * Rebuilt field by field: the staged lines carry the sentence the list
 * shows, and that belongs to the screen, not to the write.
 */
export function linesToSend(lines: StagedLine[], f: ManualForm): ManualEntryInput[] {
  const pending: ManualEntryInput[] = isTyping(f) ? [...lines, toEntry(f)] : lines
  return pending.map(d => ({
    personId: d.personId, entryDate: d.entryDate, jobcodeId: d.jobcodeId,
    hours: d.hours, i7Code: d.i7Code, company: d.company, project: d.project,
    activity: d.activity, billable: d.billable, notes: d.notes,
  }))
}

/**
 * How many lines the send button says it will send, and their hours. The
 * line still in the fields counts, because it is going to be sent.
 */
export function pendingSummary(lines: StagedLine[], f: ManualForm): { count: number; hours: number } {
  const typing = isTyping(f)
  return {
    count: lines.length + (typing ? 1 : 0),
    hours: Math.round((lines.reduce((a, l) => a + l.hours, 0) + (typing ? Number(f.hours) : 0)) * 100) / 100,
  }
}

/**
 * Warned the moment the person is chosen, not after the branch is.
 *
 * Waiting for the top meant the warning arrived once the form was half filled
 * in, which is the wrong end of the work: knowing that somebody has no rate is
 * most useful before you type their hours, because the fix is on another
 * screen. So it shows as soon as there is a person, and retracts if the top
 * turns out to be a branch where an hour never becomes money.
 */
export const shouldWarnRate = (
  chosen: ManualOptions['people'][number] | undefined,
  top: ManualOptions['tops'][number] | undefined,
) => chosen?.hasRate === false && top?.branch !== 'project'

/**
 * Only when it is not billable. A tag on every line is a column that says the
 * same thing every time, and stops being read.
 */
export const isNotBillable = (billable: string | undefined) =>
  billable?.toLowerCase() === 'no'

/** What an added row says between the person and the hours. */
export const addedWhat = (r: ManualRow) =>
  [r.tag, r.activity].filter(Boolean).join(' · ') || r.jobcodeName

/** The hours already added this month, to two decimals. */
export const totalHours = (rows: ManualRow[]) => h2(rows.reduce((s, r) => s + r.hours, 0))
