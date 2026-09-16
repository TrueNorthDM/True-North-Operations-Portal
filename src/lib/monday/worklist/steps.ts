// Turning a board's columns into steps.
//
// A step is a stage of work with a deadline. That has been the definition since
// September 2026, and it came from the people using the list. Stephanie's
// "tasks from years ago" were a Design Needs column with no date beside it, and
// her six "late" audits on BM - General Audits were read from Kick-Off, a
// column with no label that can ever be done. The rule before this paired every
// people column with the status to its right, so it found both. Neither is a
// stage anybody is waiting on.
//
// Monday does not say which status a deadline belongs to. Deadline Mode links a
// date column to a status column in Monday's own screens, but the API does not
// return that link: every date column's settings came back empty on API
// versions 2024-10 through 2026-01, checked on 15 September 2026. So the link is
// read from the layout, which is how every workflow board here is built: who
// has it, where it is, and the date to finish it by.
//
// The rule, measured against all 203 boards that carry a people column:
//
//   1. Each date or timeline column closes a run of columns, starting just
//      after the previous date column.
//   2. The run's step is its LAST status column that can be done and is not an
//      attribute. "Can be done" is Monday's own configuration: at least one of
//      the column's labels is marked done. A status that can never be done
//      keeps a row open forever, which is what Kick-Off did to 127 rows.
//      Attributes are the columns that describe an item rather than a stage of
//      it: Priority, Type, Language, Kick-Off, and anything ending in "Needs".
//   3. The owner is the nearest people column to the LEFT of that status inside
//      the run; failing that, to its RIGHT inside the run (AAAF - General Audits
//      lays out Audit, then SEO, then Audit by); failing that, the nearest one
//      BEFORE the run (ReWrite 2 has its own deadline, and its ReWriter column
//      sits before the first ReWrite).
//   4. A people column that owns no such status is not a step. Mostly these are
//      Assigner columns, whose "Assign" status has no deadline.
//
// One owner can hold several stages in a row, like Editor 2 on AAAF - SEO &
// Writing (Editorial 2nd Revision, then Editorial Final). They stay one step
// with several stages rather than becoming two steps, because a step's key is
// its people column all the way through to the change log and the Report.
//
// Still a starting point rather than an authority, as the first rule was: the
// review screen shows what it decided, and a person can switch any step off.

/** Monday column types that hold people. */
export const PEOPLE_TYPES = new Set(['people', 'person', 'multiple-person'])

/**
 * Types that can carry a step's state. Dropdowns are excluded on purpose:
 * "Audit Type" and "Writing Level" are dropdowns on some boards, and pairing an
 * owner with one invents a step that never existed.
 */
export const STATUS_TYPES = new Set(['status', 'color'])

/** Column types that can carry a deadline. */
export const DATE_TYPES = new Set(['date', 'timeline'])

export interface BoardColumn {
  id: string
  title: string
  type: string
  /** Monday's JSON settings. Needed for status columns: it lists which labels count as done. */
  settings_str?: string | null
}

/** One stage of a step: the status to finish and the date to finish it by. */
export interface StepStage {
  statusCol: string
  statusTitle: string
  dateCol: string
  dateTitle: string
}

export interface SeededStep {
  peopleCol: string
  peopleTitle: string
  /** The first stage's status column, kept for the readers that predate stages. Null when there are none. */
  statusCol: string | null
  /** The stages' titles, or the people column's own title when it is not a step. */
  stepName: string
  /** Column order, which is also the order the workflow runs in. */
  position: number
  /** In board order. Empty means this people column is not a step. */
  stages: StepStage[]
}

/**
 * Columns that describe an item rather than a stage of work on it.
 *
 * Every one of these was found paired as a "step" on a real board, and each has
 * at least one label Monday counts as done, so the done test alone does not
 * catch them: Priority's done label is "High" on one board, "Workflow
 * Attention" on another.
 */
const ATTRIBUTE = /^(priority|type|category|language|project|department|brand|team|audit type|audit\/page type|page type|writing level|recurrence|scan type|single select|page on site|printable|monthly|zapier|kick[- ]?off|kick[- ]?start|content type)$/i

/** "Design Needs", "Extra Design Needs", "Writing Need": whether a stage is needed, not the stage. */
const NEEDS = /\bneeds?$/i

/** Label indices Monday counts as done, limited to labels the column actually has. */
export function doneLabelIndices(settings: string | null | undefined): number[] {
  if (!settings) return []
  try {
    const s = JSON.parse(settings) as { done_colors?: number[]; labels?: Record<string, string> }
    const labels = s.labels ?? {}
    // A done index with no label behind it cannot be chosen, so it cannot make
    // anything done. BM - General Audits' Kick-Off lists done index 1 and has no
    // label 1: that is exactly how 127 rows stayed open.
    return (s.done_colors ?? []).filter(i => (labels[String(i)] ?? '') !== '')
  } catch {
    return []
  }
}

/** A status column that can mark the end of a stage. */
export function isStageStatus(c: BoardColumn): boolean {
  if (!STATUS_TYPES.has(c.type)) return false
  const title = c.title.trim()
  if (ATTRIBUTE.test(title) || NEEDS.test(title)) return false
  return doneLabelIndices(c.settings_str).length > 0
}

/**
 * The column a board's deadline should come from, or nothing.
 *
 * Board-wide, and kept for rows written before steps had deadlines of their own.
 * The boards that get this right all name it the same two ways: something
 * ending in "By" (Audit By, Adapt By, Plan By) or something containing Deadline
 * or Due. There is no fallback: the first date column on a board is often a
 * RECORD of the past (Published On, Item Creation), and a record read as a
 * deadline manufactures overdue work.
 */
export function pickDateColumn(cols: BoardColumn[]): BoardColumn | null {
  const dates = cols.filter(c => DATE_TYPES.has(c.type))
  if (!dates.length) return null
  const deadline = (t: string) =>
    /\bby\s*$/i.test(t.trim()) || /deadline|due\b|due-|target|delivery/i.test(t)
  return dates.find(c => deadline(c.title)) ?? null
}

/**
 * The column saying which language an item is in, or nothing.
 *
 * Exactly "Language": the HFA translation subitems also have "Language Editor"
 * (a people column) and "Language Editing" (a stage of work), and neither says
 * what language the page is. Checked against every board in September 2026:
 * five boards have one, all of them a status column.
 */
export function pickLanguageColumn(cols: BoardColumn[]): BoardColumn | null {
  const TYPES = new Set(['status', 'color', 'dropdown', 'text'])
  return cols.find(c => TYPES.has(c.type) && /^languages?$/i.test(c.title.trim())) ?? null
}

/** Seed one board's steps from its columns, one per people column, in board order. */
export function seedSteps(cols: BoardColumn[]): SeededStep[] {
  const stagesByOwner = new Map<number, StepStage[]>()
  let runStart = 0

  cols.forEach((c, i) => {
    if (!DATE_TYPES.has(c.type)) return

    let status = -1
    for (let j = i - 1; j >= runStart; j--) {
      if (isStageStatus(cols[j])) { status = j; break }
    }

    if (status >= 0) {
      let owner = -1
      for (let j = status - 1; j >= runStart && owner < 0; j--) if (PEOPLE_TYPES.has(cols[j].type)) owner = j
      for (let j = status + 1; j < i && owner < 0; j++) if (PEOPLE_TYPES.has(cols[j].type)) owner = j
      for (let j = runStart - 1; j >= 0 && owner < 0; j--) if (PEOPLE_TYPES.has(cols[j].type)) owner = j

      if (owner >= 0) {
        stagesByOwner.set(owner, [...(stagesByOwner.get(owner) ?? []), {
          statusCol: cols[status].id,
          statusTitle: cols[status].title,
          dateCol: c.id,
          dateTitle: c.title,
        }])
      }
    }
    runStart = i + 1
  })

  const out: SeededStep[] = []
  cols.forEach((c, i) => {
    if (!PEOPLE_TYPES.has(c.type)) return
    const stages = stagesByOwner.get(i) ?? []
    out.push({
      peopleCol: c.id,
      peopleTitle: c.title,
      statusCol: stages[0]?.statusCol ?? null,
      stepName: stages.length ? stages.map(s => s.statusTitle).join(' + ') : c.title,
      position: i,
      stages,
    })
  })
  return out
}

/**
 * The stage a row is on: the first one not finished, or the last when all are.
 *
 * One owner with two stages has one row, and the row has to say where the work
 * actually is. Editorial 2nd Revision done and Editorial Final not yet means
 * Editor 2 still has Editorial Final to do, with its own deadline.
 */
export function currentStage<T extends { done: boolean | null }>(stages: T[]): { stage: T; allDone: boolean } | null {
  if (!stages.length) return null
  const open = stages.find(s => s.done !== true)
  return { stage: open ?? stages[stages.length - 1], allDone: !open }
}

/** Parse the stages stored on a step row. Null means a row seeded before stages existed. */
export function readStages(value: unknown): StepStage[] | null {
  if (value == null) return null
  if (!Array.isArray(value)) return null
  return value.filter((s): s is StepStage =>
    !!s && typeof s === 'object'
    && typeof (s as StepStage).statusCol === 'string'
    && typeof (s as StepStage).dateCol === 'string')
}
