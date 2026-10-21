/**
 * How far each person is into their hours allowance right now (Clocky part 2,
 * 10A-2 "Over", 10B the clock panel lines, Who's working "Over"): the hours
 * worked in their current week or month, in their own time zone, against the
 * allowance plus the extra hours approved for that period.
 *
 * Not a "use server" file; the callers decide who may see it.
 */

import { allRows, db, loadClockySettings, loadDirectory } from './clocky-context'
import { entrySeconds } from './clocky-panel'
import { localDate } from './format'
import { allowanceRange, allowanceStatus, type AllowanceStatus } from './allowance'
import type { EntryRow } from './clocky-store'
import type { PayTerms } from './pay-terms'

export interface AllowanceUse extends AllowanceStatus {
  hours: number
  period: 'week' | 'month'
  from: string
  to: string
}

/** Extra hours approved for a person in a period (extra hours requests, Clocky part 2 step 4). */
export type ExtraHours = (personId: string, from: string, to: string) => number

export async function loadAllowanceUse(terms: ReadonlyMap<string, Pick<PayTerms, 'personId' | 'allowance'>>, now = new Date(), extra: ExtraHours = () => 0): Promise<Map<string, AllowanceUse>> {
  const withAllowance = [...terms.values()].filter(t => t.allowance)
  const out = new Map<string, AllowanceUse>()
  if (!withAllowance.length) return out
  const [dir, settings] = await Promise.all([loadDirectory(), loadClockySettings()])
  const ranges = new Map(withAllowance.map(t => [t.personId, allowanceRange(localDate(now, dir.zoneOf(t.personId)), t.allowance!.period, settings.weekStart)]))
  const from = [...ranges.values()].reduce((m, r) => (r.from < m ? r.from : m), '9999-12-31')
  const to = [...ranges.values()].reduce((m, r) => (r.to > m ? r.to : m), '0000-01-01')
  const rows = await allRows<Pick<EntryRow, 'person_id' | 'entry_date' | 'started_at' | 'ended_at' | 'duration_seconds' | 'kind'>>((a, b) =>
    db().from('tc_entries').select('person_id, entry_date, started_at, ended_at, duration_seconds, kind').in('person_id', [...ranges.keys()])
      .gte('entry_date', from).lte('entry_date', to).neq('kind', 'absence').order('id').range(a, b), 'Hours could not be read')
  for (const t of withAllowance) {
    const r = ranges.get(t.personId)!
    const used = rows.filter(e => e.person_id === t.personId && e.entry_date >= r.from && e.entry_date <= r.to).reduce((s, e) => s + entrySeconds(e, now), 0)
    out.set(t.personId, { ...allowanceStatus(used, t.allowance!.hours, extra(t.personId, r.from, r.to)), hours: t.allowance!.hours, period: t.allowance!.period, ...r })
  }
  return out
}

/** Extra hours approved per person for periods that overlap from..to (extra_hours_requests). */
export async function loadApprovedExtra(personIds: readonly string[], from: string, to: string): Promise<ExtraHours> {
  if (!personIds.length) return () => 0
  const { data, error } = await db().from('extra_hours_requests').select('person_id, hours, period_start, period_end')
    .in('person_id', [...personIds]).eq('state', 'approved').lte('period_start', to).gte('period_end', from)
  if (error) throw new Error(`Extra hours could not be read: ${error.message}`)
  const rows = data ?? []
  return (personId, a, b) => rows.filter(r => r.person_id === personId && r.period_start <= b && r.period_end >= a).reduce((s, r) => s + Number(r.hours), 0)
}
