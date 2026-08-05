// The arithmetic behind the clock, with no database and no React in it, so the
// parts that are easy to get quietly wrong can be tested directly.
//
// One idea runs through all of it: the company has a timezone, and the day an
// entry belongs to is decided there, not on the server and not in the browser.
// Somebody clocking out at 8pm in New York is on a different UTC date already,
// and a timesheet that moves a day because a function ran in the wrong place is
// a payroll dispute.

export interface Draft {
  jobcodeId: number | null
  startedAt: string | null      // ISO instant
  endedAt: string | null        // ISO instant
  durationSeconds: number
  entryDate: string             // YYYY-MM-DD, in the company timezone
  notes: string
  fields: Record<string, string>
}

/** The calendar day an instant falls on in a given IANA zone. */
export function dateInZone(instant: Date, timeZone: string): string {
  // en-CA formats as YYYY-MM-DD, which is the one locale that gives ISO order
  // without assembling the parts by hand.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant)
}

/** Wall-clock time of day in a zone, as HH:MM on a 24-hour clock. */
export function timeInZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(instant)
}

/**
 * Seconds between two instants, floored, never negative.
 *
 * Floored rather than rounded because a second that has not fully elapsed has
 * not been worked, and never negative because a clock that runs backwards
 * should show zero, not a credit.
 */
export function durationSeconds(startISO: string, endISO: string): number {
  const start = Date.parse(startISO)
  const end = Date.parse(endISO)
  if (Number.isNaN(start) || Number.isNaN(end)) return 0
  return Math.max(0, Math.floor((end - start) / 1000))
}

/** 9015 → "2:30". The shape a timesheet is read in, not 2.504 hours. */
export function formatHM(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds / 60))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** 9015 → "2.50", the decimal hours payroll and the client reports speak in. */
export function decimalHours(seconds: number): string {
  return (seconds / 3600).toFixed(2)
}

/**
 * The week a date falls in, as [start, end] ISO dates.
 *
 * `weekStart` is 0 for Sunday, matching both the setting imported from
 * QuickBooks Time and JavaScript's getUTCDay.
 */
export function weekBounds(dateISO: string, weekStart = 0): { start: string; end: string } {
  const d = new Date(`${dateISO}T00:00:00Z`)
  const shift = (d.getUTCDay() - weekStart + 7) % 7
  const start = new Date(d)
  start.setUTCDate(d.getUTCDate() - shift)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

/** The days of a week, oldest first, as ISO dates. */
export function daysOfWeek(startISO: string): string[] {
  const start = new Date(`${startISO}T00:00:00Z`)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start)
    d.setUTCDate(start.getUTCDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

/** Move a week back or forward. */
export function shiftWeek(startISO: string, weeks: number): string {
  const d = new Date(`${startISO}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

/**
 * Applied when producing payroll, never when storing.
 *
 * QuickBooks Time rounds every clock in and out to the quarter hour before it
 * saves them, so its numbers are already rounded and the raw time is gone. We
 * keep what happened and apply this on the way out, which is what makes the
 * rule a setting instead of a fact.
 */
export function roundSeconds(
  seconds: number,
  minutes: number,
  direction: 'nearest' | 'up' | 'down',
): number {
  if (minutes <= 0) return seconds
  const step = minutes * 60
  if (direction === 'up') return Math.ceil(seconds / step) * step
  if (direction === 'down') return Math.floor(seconds / step) * step
  return Math.round(seconds / step) * step
}

/**
 * What is wrong with a draft, in a sentence, or null when nothing is.
 *
 * Returns the first problem rather than a list: a person fixing a form acts on
 * one thing at a time, and a wall of red is read as noise.
 */
export function validateDraft(
  draft: Draft,
  requiredFields: { id: number; name: string }[],
): string | null {
  if (!draft.jobcodeId) return 'Pick a job code.'

  for (const f of requiredFields) {
    if (!draft.fields[String(f.id)]) return `${f.name} is required.`
  }

  if (draft.startedAt && draft.endedAt) {
    if (Date.parse(draft.endedAt) <= Date.parse(draft.startedAt)) {
      return 'The end has to come after the start.'
    }
    // Twenty-four hours is not a working day, it is a clock somebody forgot to
    // stop. Better to refuse it than to let it into payroll.
    if (durationSeconds(draft.startedAt, draft.endedAt) > 24 * 3600) {
      return 'That is longer than a day. Check the times.'
    }
  } else if (draft.durationSeconds <= 0) {
    return 'Enter how long it took.'
  } else if (draft.durationSeconds > 24 * 3600) {
    return 'That is longer than a day. Check the hours.'
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.entryDate)) return 'Pick a date.'
  return null
}

/**
 * Do two entries of the same person cover the same moment?
 *
 * Only meaningful for entries that have real start and end times: a manual
 * entry says how long something took, not when, so it cannot overlap anything.
 */
export function overlaps(
  a: { startedAt: string | null; endedAt: string | null },
  b: { startedAt: string | null; endedAt: string | null },
): boolean {
  if (!a.startedAt || !a.endedAt || !b.startedAt || !b.endedAt) return false
  return Date.parse(a.startedAt) < Date.parse(b.endedAt)
    && Date.parse(b.startedAt) < Date.parse(a.endedAt)
}

/**
 * A date and a wall-clock time in a zone, as an ISO instant.
 *
 * People type "09:00 on 5 August", which is not a moment until you know the
 * offset that was in force on that date in that zone. Hardcoding one gets
 * January right and July wrong, so this asks the zone.
 *
 * Two passes, not one. The offset is a function of the instant, and the instant
 * is what we are solving for, so the first guess uses the offset at the naive
 * time and the second corrects it with the offset at the guess. That second
 * pass is what makes the hour either side of a daylight saving change land in
 * the right place.
 */
export function wallToInstant(dateISO: string, hhmm: string, timeZone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || !/^\d{2}:\d{2}$/.test(hhmm)) return null
  const naive = Date.parse(`${dateISO}T${hhmm}:00Z`)
  if (Number.isNaN(naive)) return null

  const offsetAt = (t: number): number => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone, hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(new Date(t))
    const get = (type: string) => Number(parts.find(p => p.type === type)?.value ?? 0)
    // hour12:false renders midnight as 24 in some engines; % 24 normalises it.
    const shown = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
    return shown - t
  }

  let instant = naive - offsetAt(naive)
  instant = naive - offsetAt(instant)
  return new Date(instant).toISOString()
}
