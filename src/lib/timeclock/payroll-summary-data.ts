/**
 * Reads the payroll summary (payroll-summary.ts) for a pay period, a month, a
 * quarter or any days, with the same period choice as Reports.
 *
 * Who: Super Admins and Finance (seesAllMoney), the people who run payroll.
 * Whose hours: every US employee (people.employment_type 'us') who is active
 * or has hours in the period, contractors never (owner, 12 November 2026).
 * Which hours: everything recorded except a clock still running, approved or not; what is not
 * approved yet is counted apart so Tina can wait for it.
 */

import type { Access } from '@/lib/access/resolve'
import { allRows, db, loadCatalog, loadClockySettings } from './clocky-context'
import { localDate } from './format'
import { loadRouteSettings, seesAllMoney } from './pay-terms'
import { loadSubmissions } from './clocky-store'
import { periodOf } from './reports'
import { buildPayroll, expectedHours, type PayrollEntry, type PayrollLine, type PayrollQuery } from './payroll-summary'
export type { PayrollQuery }

export interface PayrollPage {
  query: PayrollQuery
  from: string
  to: string
  label: string
  /** 8 h a weekday in the range: 80 for a pay period. */
  expected: number
  lines: PayrollLine[]
  /** "payroll-summary-2026-10-25-to-2026-11-07" */
  file: string
}

/** Timesheet states whose hours count as approved. */
const HOURS_OK = new Set(['hours_approved', 'approved', 'recorded'])

/** Whether this person may open the payroll summary at all. */
export async function canSeePayroll(access: Pick<Access, 'personId' | 'can'>): Promise<boolean> {
  return !!access.personId && seesAllMoney(access, await loadRouteSettings())
}

/**
 * The period on screen, read the way Reports reads it (reports.ts periodOf):
 * the last month, pay period or quarter that has ended, or the days chosen.
 */
export async function loadPayroll(query: PayrollQuery, now = new Date()): Promise<PayrollPage | null> {
  const settings = await loadClockySettings()
  if (!settings.anchor) return null
  const today = localDate(now, settings.companyZone)
  const custom = query.kind === 'custom' && query.from && query.to && query.from <= query.to ? { from: query.from, to: query.to } : null
  const { from, to, label } = periodOf(query.kind, today, settings.anchor, custom)

  const c = db()
  const people = await allRows<{ id: string; full_name: string; last_name: string | null; status: string | null }>(
    (a, b) => c.from('people').select('id, full_name, last_name, status').eq('employment_type', 'us').order('id').range(a, b),
    'People could not be read')
  const ids = people.map(p => p.id)
  const [entries, catalog, subs] = await Promise.all([
    ids.length ? allRows<{ person_id: string; jobcode_id: number | null; entry_date: string; duration_seconds: number; state: string | null }>(
      (a, b) => c.from('tc_entries').select('person_id, jobcode_id, entry_date, duration_seconds, state')
        
        // Leaves out only a clock still running: manual entries and all time off have no start or end.
        .in('person_id', ids).or('ended_at.not.is.null,started_at.is.null').gte('entry_date', from).lte('entry_date', to).order('id').range(a, b),
      'The hours could not be read') : Promise.resolve([]),
    loadCatalog(),
    loadSubmissions(c, ids),
  ])

  const approvedByTimesheet = (personId: string, date: string) =>
    (subs.get(personId) ?? []).some(s => s.start <= date && s.end >= date && HOURS_OK.has(s.state))
  const rows: PayrollEntry[] = entries.map(e => {
    const kind = e.jobcode_id != null ? catalog.jobs.get(e.jobcode_id)?.kind : undefined
    return {
      personId: e.person_id, date: e.entry_date, seconds: Number(e.duration_seconds) || 0,
      sort: kind === 'pto' ? 'pto' : kind === 'unpaid' ? 'unpaid' : 'work',
      approved: e.state === 'approved' || e.state === 'locked' || approvedByTimesheet(e.person_id, e.entry_date),
    }
  })
  const withHours = new Set(rows.map(r => r.personId))
  const pool = people.filter(p => p.status === 'active' || withHours.has(p.id))
    .map(p => ({ id: p.id, fullName: p.full_name, lastName: p.last_name }))

  const expected = expectedHours(from, to)
  return {
    query: { ...query, from, to }, from, to, label, expected,
    lines: buildPayroll(pool, rows, expected),
    file: `payroll-summary-${from}-to-${to}`,
  }
}
