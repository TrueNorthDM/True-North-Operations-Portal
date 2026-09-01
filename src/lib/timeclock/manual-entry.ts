// Hours added by hand, for people the timeclock does not have.
//
// A contractor outside QuickBooks Time still bills i7 work: they send an
// invoice, somebody reads the hours off it, and until now those hours were
// typed into the invoice by hand and never reached the report. Two numbers
// then existed for one month and had to agree by discipline.
//
// This writes into tc_entries, the same table the sync fills, so there is one
// total rather than two. The entry is marked as manual and carries who added
// it, which is the whole audit trail: nothing here is reconstructible from a
// number in a spreadsheet.

export type ManualEntryInput = {
  personId: string
  /** YYYY-MM-DD, the day the work belongs to. */
  entryDate: string
  jobcodeId: number
  hours: number
  /**
   * The i7 code, inside the i7 tree. Outside it, Company and Project instead:
   * that is the one place the two branches differ, in QuickBooks Time and here.
   */
  i7Code: string
  company?: string
  project?: string
  activity: string
  /**
   * Billable, kept because QuickBooks Time asks for it and somebody comparing
   * the two screens would notice its absence. No report reads it: it travels
   * with the entry so the record matches what an imported one carries.
   */
  billable?: string
  notes?: string
}

export type ManualEntryError =
  | 'no-person' | 'no-jobcode' | 'bad-date' | 'bad-hours' | 'future-date'

/** A day's work, in the units people read off an invoice. */
export const MAX_HOURS_PER_ENTRY = 24

/**
 * What a manual entry must satisfy before it becomes money.
 *
 * Checked here rather than only in the form, because this ends up multiplied
 * by an hourly rate and printed on a client invoice: a typo that reaches the
 * database is a number somebody has to explain later.
 */
export function validateManualEntry(
  input: Partial<ManualEntryInput>, today: string,
): ManualEntryError | null {
  if (!input.personId) return 'no-person'
  if (!input.jobcodeId) return 'no-jobcode'
  if (!input.entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.entryDate)) return 'bad-date'
  // Hours for work that has not happened yet is a typo in the year or month,
  // every time. There is no legitimate reason to bill a future day.
  if (input.entryDate > today) return 'future-date'
  if (!input.hours || input.hours <= 0 || input.hours > MAX_HOURS_PER_ENTRY) return 'bad-hours'
  return null
}

export const ERROR_TEXT: Record<ManualEntryError, string> = {
  'no-person': 'Choose who the hours belong to.',
  'no-jobcode': 'Choose the job code the hours are booked to.',
  'bad-date': 'Give the day the work belongs to.',
  'future-date': 'That day has not happened yet. Check the month and year.',
  'bad-hours': `Hours must be more than zero and no more than ${MAX_HOURS_PER_ENTRY}.`,
}

/** Hours as the seconds the table stores. Rounded once, at the boundary. */
export function toSeconds(hours: number): number {
  return Math.round(hours * 3600)
}
