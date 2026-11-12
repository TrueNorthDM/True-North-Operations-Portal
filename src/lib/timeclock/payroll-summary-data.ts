/**
 * Reads the payroll summary (payroll-summary.ts) for one pay period.
 *
 * Who: Super Admins and Finance (seesAllMoney), the people who run payroll.
 * Whose hours: every US employee (people.employment_type 'us') who is active
 * or has hours in the period, contractors never (owner, 12 November 2026).
 * Which hours: everything recorded and finished, approved or not; what is not
 * approved yet is counted apart so Tina can wait for it.
 */

import type { Access } from '@/lib/access/resolve'
import { allRows, db, loadCatalog, loadClockySettings } from './clocky-context'
import { addDays, payPeriodStart, PAY_PERIOD_DAYS } from './periods'
import { localDate } from './format'
import { loadRouteSettings, seesAllMoney } from './pay-terms'
import { loadSubmissions } from './clocky-store'
import { rangeText } from './reports'
import { buildPayroll, type PayrollEntry, type PayrollLine } from './payroll-summary'

export interface PayrollPage {
  from: string
  to: string
  label: string
  /** The period before and after, null when there is none to go to. */
  prev: string
  next: string | null
  lines: PayrollLine[]
  /** "payroll-summary-2026-10-25-to-2026-11-07" */
  file: string
}

const ISO = /^\d{4}-\d{2}-\d{2}$/
/** Timesheet states whose hours count as approved. */
const HOURS_OK = new Set(['hours_approved', 'approved', 'recorded'])

/** Whether this person may open the payroll summary at all. */
export async function canSeePayroll(access: Pick<Access, 'personId' | 'can'>): Promise<boolean> {
  return !!access.personId && seesAllMoney(access, await loadRouteSettings())
}

/**
 * The pay period: the one starting on (or holding) `start`, else the last one
 * that has ended. Never one that has not started.
 */
export async function loadPayroll(start: string | undefined, now = new Date()): Promise<PayrollPage | null> {
  const settings = await loadClockySettings()
  if (!settings.anchor) return null
  const today = localDate(now, settings.companyZone)
  const current = payPeriodStart(today, settings.anchor)
  const asked = start && ISO.test(start) ? payPeriodStart(start, settings.anchor) : addDays(current, -PAY_PERIOD_DAYS)
  const from = asked > current ? current : asked
  const to = addDays(from, PAY_PERIOD_DAYS - 1)

  const c = db()
  const people = await allRows<{ id: string; full_name: string; last_name: string | null; status: string | null }>(
    (a, b) => c.from('people').select('id, full_name, last_name, status').eq('employment_type', 'us').order('id').range(a, b),
    'People could not be read')
  const ids = people.map(p => p.id)
  const [entries, catalog, subs] = await Promise.all([
    ids.length ? allRows<{ person_id: string; jobcode_id: number | null; entry_date: string; duration_seconds: number; state: string | null }>(
      (a, b) => c.from('tc_entries').select('person_id, jobcode_id, entry_date, duration_seconds, state')
        .in('person_id', ids).not('ended_at', 'is', null).gte('entry_date', from).lte('entry_date', to).order('id').range(a, b),
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

  const next = addDays(from, PAY_PERIOD_DAYS)
  return {
    from, to, label: rangeText(from, to),
    prev: addDays(from, -PAY_PERIOD_DAYS), next: next > current ? null : next,
    lines: buildPayroll(pool, rows),
    file: `payroll-summary-${from}-to-${to}`,
  }
}
