// Approved timeclock hours for the Report, summed by the database
// (migration 102). Read as rows they stopped at 1,000, which over 13 weeks
// was half the hours or less (audit, 9 October 2026). Approved means approved
// or locked: nothing else counts as worked.

import { reportCall } from './data'

const WHAT = 'the approved hours'

/** Seconds per person since a day. Absent: no approved hours at all. */
export async function approvedHours(personIds: string[], sinceDay: string): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (let i = 0; i < personIds.length; i += 500) {
    const part = await reportCall<Record<string, number> | null>(
      'report_hours', { p_people: personIds.slice(i, i + 500), p_since: sinceDay }, WHAT)
    for (const [id, s] of Object.entries(part ?? {})) out.set(id, Number(s))
  }
  return out
}

/** Seconds per timeclock code since a day. */
export async function hoursByCode(codes: number[], sinceDay: string): Promise<Map<number, number>> {
  if (!codes.length) return new Map()
  const part = await reportCall<Record<string, number> | null>(
    'report_jobcode_hours', { p_codes: codes, p_since: sinceDay }, WHAT)
  return new Map(Object.entries(part ?? {}).map(([id, s]) => [Number(id), Number(s)]))
}

export type CodeHours = { code: string | null; folder: string | null; seconds: number }

/** One person's hours since a day, per code, most first. */
export async function personHoursByCode(personId: string, sinceDay: string): Promise<CodeHours[]> {
  const rows = await reportCall<CodeHours[] | null>(
    'report_person_hours', { p_person: personId, p_since: sinceDay }, WHAT)
  return (rows ?? []).map(r => ({ ...r, seconds: Number(r.seconds) }))
}
