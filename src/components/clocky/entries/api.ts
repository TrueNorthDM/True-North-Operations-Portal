/**
 * What Time entries and Approvals call (docs/time-clock/05-clocky-build.md,
 * "API as built"). The live pages hand in the server actions; the design
 * checks hand in stand-ins over the prototype's sample data, so every frame
 * renders without a database.
 */

import type { EntriesQuery } from '@/lib/timeclock/clocky-entries'
import type { ClockPanelData, EntriesData, HistoryData, Result, SubmitSummary } from '@/lib/timeclock/clocky-types'

export interface EntryInputBody {
  date: string
  mode: 'range' | 'duration'
  start?: string
  end?: string
  duration?: string
  jobcodeId: number
  fields?: Record<string, string>
  notes?: string
  reason: string
  fix?: { otherId: number; trim: 'other' | 'this' }
}

export interface GridRowBody { jobcodeId: number; fields?: Record<string, string>; cells: Record<string, string> }

export interface DecideBody { id: number; decision: 'approve' | 'deny'; note?: string }

/** The reads and writes of the Time entries page. */
export interface EntriesApi {
  getEntries(q: EntriesQuery): Promise<Result<{ data: EntriesData }>>
  getEntryHistory(i: { id: number }): Promise<Result<{ data: HistoryData }>>
  /** A pending or denied time correction request's history (its row's History). */
  getCorrectionHistory(i: { id: number }): Promise<Result<{ data: HistoryData }>>
  getSubmitSummary(i?: { start?: string }): Promise<Result<{ data: SubmitSummary }>>
  addTime(i: EntryInputBody & { personId: string }): Promise<Result<{ entryId: number; toast: string }>>
  editEntry(i: EntryInputBody & { id: number }): Promise<Result<{ entryId: number; changes: number; toast: string }>>
  deleteEntry(i: { id: number; reason: string }): Promise<Result<{ toast: string }>>
  saveWeekGrid(i: { personId: string; weekStart: string; rows: GridRowBody[]; reason: string }): Promise<Result<{ weekSeconds: number; toast: string }>>
  requestCorrection(i: { date: string; start: string; end: string; jobcodeId: number; fields?: Record<string, string>; notes?: string; reason: string }): Promise<Result<{ requestId: number; goesTo: string; toast: string }>>
  submitPeriod(i: { start: string; end: string }): Promise<Result<{ toast: string; locked: number; invoiceId?: number | null }>>
  decideCorrection(i: DecideBody): Promise<Result<{ entryId?: number; toast: string }>>
  decideTimeOff(i: DecideBody): Promise<Result>
  clockIn(i: { jobcodeId: number; fields?: Record<string, string>; notes?: string }): Promise<Result<{ entryId: number; startedAt: string; startedAtReal: string }>>
  switchTo(i: { jobcodeId: number; fields?: Record<string, string>; notes?: string }): Promise<Result<{ entryId: number; previous: { label: string; todaySeconds: number }; toast: string }>>
}

/**
 * What the forms need from the clock panel's data: the jobs, the fields and
 * their smart defaults, the viewer's saved combinations, who a correction goes
 * to, and the server's now (for the live timer and the running entries).
 */
export type Catalog = Pick<ClockPanelData, 'me' | 'now' | 'today' | 'jobs' | 'fields' | 'defaults' | 'combinations' | 'correctionGoesTo' | 'running' | 'switchDate'>
