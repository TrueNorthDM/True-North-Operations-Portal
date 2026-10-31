/**
 * Recurring events (owner, 30 October 2026, task "Agenda: recurring events"):
 * daily, weekly on chosen days, monthly (on a day of the month or on the nth
 * weekday), yearly, every N, ending never, on a day or after a number of
 * times, as Google Calendar does. A series is one event row holding the rule
 * in Google's own words (an RRULE line), so the same rule goes to Google and
 * comes back from it. The portal works out the days itself to draw them.
 * Pure: no database, no clock.
 */

export type Freq = 'daily' | 'weekly' | 'monthly' | 'yearly'
export interface Repeat {
  freq: Freq
  /** Every N days, weeks, months or years. */
  interval: number
  /** Weekly: the weekdays, 0 Sunday to 6 Saturday. */
  days: number[]
  /** Monthly: on the same day of the month, or on the same nth weekday ("the second Tuesday"). */
  monthBy: 'day' | 'nth'
  ends: 'never' | 'until' | 'count'
  /** The last day it may happen, YYYY-MM-DD. */
  until?: string
  /** How many times in all. */
  count?: number
}

/** The answer when a series is changed: only that one, that one and the ones after it, or all of them. */
export type Scope = 'one' | 'following' | 'all'

const CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const DAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NTH = ['first', 'second', 'third', 'fourth', 'fifth']
/** No series is drawn past this many occurrences, or this many days from its first. */
const MAX_OCCURRENCES = 1000
const MAX_SPAN_DAYS = 3 * 366

const D = (iso: string) => new Date(`${iso}T00:00:00Z`)
const iso = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (s: string, n: number) => iso(new Date(D(s).getTime() + n * 864e5))
const dow = (s: string) => D(s).getUTCDay()
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/** Which weekday of its month a day is: 1 to 5, or -1 when it is the last one. */
export function nthOf(date: string): { n: number; last: boolean } {
  const d = D(date), day = d.getUTCDate()
  return { n: Math.ceil(day / 7), last: day + 7 > daysIn(d.getUTCFullYear(), d.getUTCMonth()) }
}

/** The day of month `m` (0 based) of year `y` that is the nth `weekday`; -1 is the last one. Null when the month has none. */
function nthWeekday(y: number, m: number, weekday: number, n: number): string | null {
  if (n === -1) {
    const last = new Date(Date.UTC(y, m, daysIn(y, m)))
    const back = (last.getUTCDay() - weekday + 7) % 7
    return iso(new Date(last.getTime() - back * 864e5))
  }
  const first = new Date(Date.UTC(y, m, 1))
  const day = 1 + ((weekday - first.getUTCDay() + 7) % 7) + (n - 1) * 7
  return day <= daysIn(y, m) ? iso(new Date(Date.UTC(y, m, day))) : null
}

/** The rule a series starts with when Repeat is first picked: the same weekday, every week. */
export function defaultRepeat(first: string): Repeat {
  return { freq: 'weekly', interval: 1, days: [dow(first)], monthBy: 'day', ends: 'never' }
}

/** A rule made sound: at least one weekday, an interval of 1 to 99, an end that makes sense. */
export function cleanRepeat(r: Repeat, first: string): Repeat | null {
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(r?.freq)) return null
  const interval = Math.min(99, Math.max(1, Math.floor(Number(r.interval) || 1)))
  const days = r.freq === 'weekly' ? [...new Set((r.days ?? []).map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : []
  const out: Repeat = { freq: r.freq, interval, days: r.freq === 'weekly' && !days.length ? [dow(first)] : days, monthBy: r.monthBy === 'nth' ? 'nth' : 'day', ends: 'never' }
  if (r.ends === 'until' && /^\d{4}-\d{2}-\d{2}$/.test(r.until ?? '') && (r.until as string) >= first) { out.ends = 'until'; out.until = r.until }
  if (r.ends === 'count') { const n = Math.floor(Number(r.count)); if (n >= 1 && n <= 730) { out.ends = 'count'; out.count = n } }
  return out
}

/**
 * Google's RRULE line for a rule. `first` is the series' first day; `allDay`
 * writes UNTIL as a day, otherwise as the end of that day in UTC (late enough
 * for any time zone of the Americas and Europe on that day).
 */
export function toRRule(r: Repeat, first: string, allDay: boolean): string {
  const parts = [`FREQ=${r.freq.toUpperCase()}`]
  if (r.interval > 1) parts.push(`INTERVAL=${r.interval}`)
  if (r.freq === 'weekly') parts.push(`BYDAY=${(r.days.length ? r.days : [dow(first)]).map(d => CODE[d]).join(',')}`, 'WKST=SU')
  if (r.freq === 'monthly') {
    if (r.monthBy === 'nth') { const { n, last } = nthOf(first); parts.push(`BYDAY=${last && n >= 4 ? -1 : n}${CODE[dow(first)]}`) }
    else parts.push(`BYMONTHDAY=${D(first).getUTCDate()}`)
  }
  if (r.ends === 'until' && r.until) parts.push(`UNTIL=${r.until.replace(/-/g, '')}${allDay ? '' : 'T235959Z'}`)
  if (r.ends === 'count' && r.count) parts.push(`COUNT=${r.count}`)
  return `RRULE:${parts.join(';')}`
}

/** A rule back from an RRULE line (ours, or one written in Google); null when it is not one the portal can draw. */
export function fromRRule(line: string | null | undefined): Repeat | null {
  const m = /^RRULE:(.+)$/.exec((line ?? '').trim())
  if (!m) return null
  const p = new Map(m[1].split(';').map(kv => kv.split('=') as [string, string]))
  const freq = (p.get('FREQ') ?? '').toLowerCase() as Freq
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(freq)) return null
  if (p.has('BYSETPOS') || p.has('BYHOUR') || p.has('BYMINUTE') || p.has('BYWEEKNO') || p.has('BYYEARDAY')) return null
  const byday = (p.get('BYDAY') ?? '').split(',').filter(Boolean)
  const r: Repeat = { freq, interval: Math.max(1, Number(p.get('INTERVAL') ?? 1) || 1), days: [], monthBy: 'day', ends: 'never' }
  if (freq === 'weekly') r.days = byday.map(d => CODE.indexOf(d.slice(-2))).filter(d => d >= 0).sort()
  if (freq === 'monthly' && byday.length) r.monthBy = 'nth'
  const until = p.get('UNTIL')
  if (until) { r.ends = 'until'; r.until = `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}` }
  const count = Number(p.get('COUNT'))
  if (count > 0) { r.ends = 'count'; r.count = count }
  return r
}

/**
 * The days a series happens on, from its first day, between `from` and `to`
 * (both included, YYYY-MM-DD). `skip`: days taken out of the series (deleted
 * one by one, or moved, so their own row draws them instead).
 */
export function occurrences(r: Repeat, first: string, from: string, to: string, skip: ReadonlySet<string> = new Set()): string[] {
  const out: string[] = []
  const limit = addDays(first, MAX_SPAN_DAYS)
  const last = [to, limit, r.ends === 'until' && r.until ? r.until : '9999-12-31'].sort()[0]
  let n = 0
  const take = (d: string): boolean => {
    if (d < first) return true
    if (d > last) return false
    n++
    if (r.ends === 'count' && r.count && n > r.count) return false
    if (d >= from && !skip.has(d)) out.push(d)
    return n < MAX_OCCURRENCES
  }
  const fd = D(first), y0 = fd.getUTCFullYear(), m0 = fd.getUTCMonth()
  if (r.freq === 'daily') {
    for (let d = first; ; d = addDays(d, r.interval)) if (!take(d)) break
  } else if (r.freq === 'weekly') {
    const days = r.days.length ? r.days : [dow(first)]
    // Weeks start on Sunday (WKST=SU), counted from the first day's week.
    for (let week = addDays(first, -dow(first)); ; week = addDays(week, 7 * r.interval)) {
      let go = true
      for (const wd of days) { if (!take(addDays(week, wd))) { go = false; break } }
      if (!go || week > last) break
    }
  } else if (r.freq === 'monthly') {
    const { n: nth, last: isLast } = nthOf(first), wd = dow(first), md = fd.getUTCDate()
    for (let k = 0; ; k += r.interval) {
      const y = y0 + Math.floor((m0 + k) / 12), m = (m0 + k) % 12
      if (iso(new Date(Date.UTC(y, m, 1))) > last) break
      const d = r.monthBy === 'nth' ? nthWeekday(y, m, wd, isLast && nth >= 4 ? -1 : nth) : md <= daysIn(y, m) ? iso(new Date(Date.UTC(y, m, md))) : null
      if (d && !take(d)) break
    }
  } else {
    const md = fd.getUTCDate()
    for (let k = 0; ; k += r.interval) {
      const y = y0 + k
      if (`${y}-01-01` > last) break
      if (md <= daysIn(y, m0) && !take(iso(new Date(Date.UTC(y, m0, md))))) break
    }
  }
  return out
}

/** The series' last day, or null when it never ends (counted from a count when it has one). */
export function lastDay(r: Repeat, first: string): string | null {
  if (r.ends === 'until') return r.until ?? null
  if (r.ends === 'count') { const all = occurrences(r, first, first, '9999-12-31'); return all[all.length - 1] ?? first }
  return null
}

const dayLabel = (s: string) => `${MON[D(s).getUTCMonth()]} ${D(s).getUTCDate()}`
const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)

/** "Every Tuesday, until Dec 15", "Every 2 weeks on Monday and Thursday, 10 times", "Every month on the last Friday". */
export function describe(r: Repeat, first: string): string {
  const every = (unit: string) => (r.interval === 1 ? `Every ${unit}` : `Every ${r.interval} ${unit}s`)
  let s: string
  if (r.freq === 'daily') s = every('day')
  else if (r.freq === 'weekly') {
    const days = r.days.length ? r.days : [dow(first)]
    const weekdays = days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))
    s = r.interval === 1 ? (weekdays ? 'Every weekday' : `Every ${list(days.map(d => DAY_NAME[d]))}`) : `${every('week')} on ${list(days.map(d => DAY_NAME[d]))}`
  } else if (r.freq === 'monthly') {
    if (r.monthBy === 'nth') { const { n, last } = nthOf(first); s = `${every('month')} on the ${last && n >= 4 ? 'last' : NTH[n - 1]} ${DAY_NAME[dow(first)]}` }
    else s = `${every('month')} on day ${D(first).getUTCDate()}`
  } else s = `${every('year')} on ${dayLabel(first)}`
  if (r.ends === 'until' && r.until) s += `, until ${dayLabel(r.until)}`
  if (r.ends === 'count' && r.count) s += `, ${r.count} time${r.count === 1 ? '' : 's'}`
  return s
}

/** The id Google gives one occurrence of a series: the series' id and the occurrence's start. */
export function instanceId(seriesGoogleId: string, start: { date?: string; at?: string }): string {
  if (start.at) return `${seriesGoogleId}_${start.at.replace(/[-:]/g, '').replace(/\.\d+/, '').replace(/Z?$/, 'Z')}`
  return `${seriesGoogleId}_${(start.date ?? '').replace(/-/g, '')}`
}

/** A rule cut to end the day before `day` (This and following); null when nothing of it is left before. */
export function endBefore(r: Repeat, first: string, day: string): Repeat | null {
  const prev = addDays(day, -1)
  if (prev < first) return null
  if (r.ends === 'count' && r.count) {
    const kept = occurrences(r, first, first, prev).length
    return kept ? { ...r, count: kept } : null
  }
  return { ...r, ends: 'until', until: r.ends === 'until' && r.until && r.until < prev ? r.until : prev }
}

/** The rest of a series from `day` on, for its new row: a count goes on with what was left. */
export function restFrom(r: Repeat, first: string, day: string): Repeat {
  if (r.ends === 'count' && r.count) {
    const before = occurrences(r, first, first, addDays(day, -1)).length
    return { ...r, count: Math.max(1, r.count - before) }
  }
  return { ...r }
}
