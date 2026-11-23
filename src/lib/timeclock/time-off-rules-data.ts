/**
 * Reads where each person stands with their paid time off (time-off-rules.ts):
 * the day Vacation and sick leave open for them, the sick leave already taken
 * or asked each year, and their balances as Finance loaded them from Rippling,
 * less what was approved since. Privileged reads: the callers decide who sees.
 */

import { allRows, db, loadCatalog, loadClockySettings } from './clocky-context'
import { localDate } from './format'
import { holidaysBetween, offDays } from './time-off'
import { offKindOf } from './time-off-year'
import { balanceLeft, NO_STANDING, PAID_KINDS, sickOpensOn, vacationOpensOn, type BalanceRequest, type OffStanding, type PaidKind } from './time-off-rules'

type PersonRow = { id: string; employment_type: string | null; hire_date: string | null; employee_since: string | null }
type BalanceRow = { person_id: string; kind: string; hours: number; as_of: string }
type RequestRow = { person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number; state: string; decided_at: string | null; entries_written_at: string | null }
type EntryRow = { person_id: string; jobcode_id: number | null; entry_date: string; duration_seconds: number }

/** Each person's standing; someone not asked for, or not found, has none (everything open, no balance). */
export async function loadOffStandings(personIds: readonly string[], today: string): Promise<Map<string, OffStanding>> {
  const ids = [...new Set(personIds)]
  const out = new Map<string, OffStanding>()
  if (!ids.length) return out
  const c = db()
  const yearStart = `${today.slice(0, 4)}-01-01`
  const [people, balances, catalog, settings] = await Promise.all([
    allRows<PersonRow>((a, b) => c.from('people').select('id, employment_type, hire_date, employee_since').in('id', ids).order('id').range(a, b), 'People could not be read'),
    allRows<BalanceRow>((a, b) => c.from('tc_time_off_balances').select('person_id, kind, hours, as_of').in('person_id', ids).order('person_id').range(a, b), 'The balances could not be read'),
    loadCatalog(),
    loadClockySettings(),
  ])
  // Far enough back for both: the year's sick leave, and everything since the oldest report.
  const since = balances.reduce((lo, b) => (b.as_of < lo ? b.as_of : lo), yearStart)
  const sickJobs = [...catalog.jobs.values()].filter(j => offKindOf(j) === 'sick').map(j => j.id)
  const [requests, entries] = await Promise.all([
    allRows<RequestRow>((a, b) => c.from('tc_absence_requests').select('person_id, jobcode_id, start_date, end_date, hours_per_day, state, decided_at, entries_written_at')
      .in('person_id', ids).in('state', ['pending', 'approved']).gte('end_date', since).order('id').range(a, b), 'Time off could not be read'),
    sickJobs.length ? allRows<EntryRow>((a, b) => c.from('tc_entries').select('person_id, jobcode_id, entry_date, duration_seconds')
      .in('person_id', ids).eq('kind', 'absence').in('jobcode_id', sickJobs).gte('entry_date', yearStart).order('id').range(a, b), 'Time off could not be read') : Promise.resolve([] as EntryRow[]),
  ])
  const holidays = holidaysBetween(since, `${Number(today.slice(0, 4)) + 2}-12-31`)
  const kindOf = (jobcodeId: number) => offKindOf(catalog.jobs.get(jobcodeId))

  for (const p of people) {
    const mine = requests.filter(r => r.person_id === p.id)
    const sickUsed: Record<string, number> = {}
    const add = (date: string, seconds: number) => { const y = date.slice(0, 4); sickUsed[y] = (sickUsed[y] ?? 0) + seconds }
    // What is in the time entries (TSheets' history, and every approved day North Time has written)...
    for (const e of entries) if (e.person_id === p.id) add(e.entry_date, Number(e.duration_seconds) || 0)
    const reqs: BalanceRequest[] = mine.map(r => {
      const kind = kindOf(r.jobcode_id)
      const days = offDays(r.start_date, r.end_date, holidays).days
      // ...and what is not there yet: a request still waiting, or approved and not written.
      if (kind === 'sick' && (r.state === 'pending' || !r.entries_written_at)) for (const d of days) if (d >= yearStart) add(d, Number(r.hours_per_day) * 3600)
      return { kind, state: r.state as BalanceRequest['state'], days, hoursPerDay: Number(r.hours_per_day), decidedOn: r.state === 'approved' && r.decided_at ? localDate(new Date(r.decided_at), settings.companyZone) : null }
    })
    const standing: OffStanding = {
      employee: p.employment_type === 'us',
      vacationFrom: vacationOpensOn(p.employee_since, p.hire_date),
      sickFrom: sickOpensOn(p.employee_since, p.hire_date),
      sickUsed,
      balances: {},
    }
    for (const b of balances) {
      if (b.person_id !== p.id || !PAID_KINDS.includes(b.kind as PaidKind)) continue
      standing.balances[b.kind as PaidKind] = balanceLeft(b.kind as PaidKind, Number(b.hours), b.as_of, reqs)
    }
    out.set(p.id, standing)
  }
  return out
}

export async function loadOffStanding(personId: string, today: string): Promise<OffStanding> {
  return (await loadOffStandings([personId], today)).get(personId) ?? NO_STANDING
}
