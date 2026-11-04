// Dates as the review screens say them (design handoff): "Mon, Nov 30",
// "Nov 27", "Fri, Dec 18, 2026, 9:14 AM". Days are YYYY-MM-DD, instants ISO;
// instants read in Washington time, like the rest of the portal's dates.

const ZONE = 'America/New_York'

export const fmtDay = (day: string | null | undefined, year = false) =>
  day ? new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' }) : ''

export const fmtShort = (day: string | null | undefined) =>
  day ? new Date(`${day.slice(0, 10)}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''

/** An instant's day in Washington, YYYY-MM-DD. */
export const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: ZONE })

export const fmtInstantDay = (iso: string | null | undefined, year = false) => (iso ? fmtDay(dayOf(iso), year) : '')
export const fmtInstantShort = (iso: string | null | undefined) => (iso ? fmtShort(dayOf(iso)) : '')

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: ZONE })

export const fmtWhen = (iso: string | null | undefined) => (iso ? `${fmtInstantDay(iso, true)}, ${fmtTime(iso)}` : '')

/** "Mar 14, 2022 (4 years)". */
export function hireLabel(day: string | null, today: string): string {
  if (!day) return 'Not set'
  const [y, m, d] = day.split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  const years = ty - y - (tm < m || (tm === m && td < d) ? 1 : 0)
  const label = new Date(`${day}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
  return years >= 1 ? `${label} (${years} ${years === 1 ? 'year' : 'years'})` : label
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
