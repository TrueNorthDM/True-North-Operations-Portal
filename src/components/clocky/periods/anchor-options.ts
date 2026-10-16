/**
 * The days Company settings offers as the pay period start (Timesheet
 * Periods.dc.html, 5A: a date dropdown with search). The prototype lists Sep 13
 * to Oct 31, 2026 for "today" Oct 15: 32 days back to 16 days ahead, the same
 * window here around the company's today, with the date in force always on
 * the list. Pure.
 */

import { addDays } from '@/lib/timeclock/periods'

export function anchorOptions(today: string, current: string | null): string[] {
  const out: string[] = []
  for (let d = addDays(today, -32); d <= addDays(today, 16); d = addDays(d, 1)) out.push(d)
  if (current && !out.includes(current)) out.push(current)
  return out.sort()
}
