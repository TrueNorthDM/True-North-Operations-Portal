/**
 * Reads a person's time off record (time-off-year.ts) for one year: the count
 * by type, each time off as a line, and the requests still waiting. For the
 * Time off tab of a person's page; who may open it is decided there
 * (directory/[id]/page.tsx).
 */

import { allRows, db, loadCatalog, loadDirectory } from './clocky-context'
import { dateLabel, rangeLabel } from './format'
import { holidaysBetween, offDays } from './time-off'
import { daysLabel, hmLabel, offKind, offKindOf, offRuns, perDayText, yearCount, type OffKind, type YearCount } from './time-off-year'

export interface TimeOffLine {
  key: string
  /** "Oct 26 to 27", "Sep 14" */
  dates: string
  kind: OffKind
  label: string
  color: string
  /** "16h 00m" */
  hours: string
  /** Under a range: "8h 00m each day", or each day when they differ. */
  perDay: string | null
  /** "2 days" */
  days: string
  /** "North Time" or "TSheets" */
  source: string
  /** Who approved it, "Waiting" for a request not decided yet, or null (TSheets kept no approver). */
  by: string | null
  waiting: boolean
}

export interface TimeOffRecord {
  year: number
  /** The years to step to: from the first with time off to this one. */
  prev: number | null
  next: number | null
  count: YearCount
  lines: TimeOffLine[]
}

const span = (from: string, to: string) => (from === to ? dateLabel(from).replace(/, \d{4}$/, '') : rangeLabel(from, to))

export async function loadTimeOffRecord(personId: string, asked: number | undefined, today: string): Promise<TimeOffRecord> {
  const c = db()
  const thisYear = Number(today.slice(0, 4))
  const { data: first, error: firstErr } = await c.from('tc_entries').select('entry_date').eq('person_id', personId).eq('kind', 'absence').order('entry_date').limit(1).maybeSingle()
  if (firstErr) throw new Error(`Time off could not be read: ${firstErr.message}`)
  const firstYear = first ? Number(String(first.entry_date).slice(0, 4)) : thisYear
  const year = asked && Number.isInteger(asked) && asked >= firstYear && asked <= thisYear + 1 ? asked : thisYear
  const lo = `${year}-01-01`, hi = `${year}-12-31`

  const [entries, requests, catalog, dir] = await Promise.all([
    allRows<{ entry_date: string; duration_seconds: number; jobcode_id: number | null; source: string }>((a, b) => c.from('tc_entries').select('entry_date, duration_seconds, jobcode_id, source')
      .eq('person_id', personId).eq('kind', 'absence').gte('entry_date', lo).lte('entry_date', hi).order('id').range(a, b), 'Time off could not be read'),
    allRows<{ id: number; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number; state: string; decided_by: string | null }>((a, b) => c.from('tc_absence_requests').select('id, jobcode_id, start_date, end_date, hours_per_day, state, decided_by')
      .eq('person_id', personId).in('state', ['pending', 'approved']).lte('start_date', hi).gte('end_date', lo).order('id').range(a, b), 'Time off could not be read'),
    loadCatalog(),
    loadDirectory(),
  ])
  const kindOf = (id: number | null) => offKindOf(id != null ? catalog.jobs.get(id) : null)
  const rows = entries.flatMap(e => { const kind = kindOf(e.jobcode_id); return kind ? [{ date: e.entry_date, seconds: Number(e.duration_seconds) || 0, kind, source: e.source }] : [] })

  const approved = requests.filter(r => r.state === 'approved')
  const taken: TimeOffLine[] = offRuns(rows).map(r => {
    const k = offKind(r.kind)
    // The request that wrote these days, when there is one: its approver.
    const req = r.source === 'portal' ? approved.find(q => q.start_date <= r.to && q.end_date >= r.from) : undefined
    return {
      key: `e-${r.from}-${r.kind}-${r.source}`, dates: span(r.from, r.to), kind: r.kind, label: k.label, color: k.color, hours: hmLabel(r.seconds), perDay: perDayText(r.days), days: daysLabel(r.seconds),
      source: r.source === 'tsheets' ? 'TSheets' : 'North Time', by: req?.decided_by ? dir.nameOf(req.decided_by) : null, waiting: false,
    }
  })
  const holidays = holidaysBetween(lo, hi)
  const waiting: TimeOffLine[] = requests.filter(r => r.state === 'pending').flatMap(r => {
    const kind = kindOf(r.jobcode_id)
    if (!kind) return []
    const k = offKind(kind)
    const days = offDays(r.start_date, r.end_date, holidays).days.length
    const each = Number(r.hours_per_day) * 3600
    return [{ key: `w-${r.id}`, dates: span(r.start_date, r.end_date), kind, label: k.label, color: k.color, hours: hmLabel(days * each), perDay: days > 1 ? `${hmLabel(each)} each day` : null, days: daysLabel(days * each), source: 'North Time', by: 'Waiting', waiting: true }]
  })
  return {
    year, prev: year > firstYear ? year - 1 : null, next: year < thisYear ? year + 1 : null,
    count: yearCount(rows, year),
    lines: [...waiting, ...taken],
  }
}
