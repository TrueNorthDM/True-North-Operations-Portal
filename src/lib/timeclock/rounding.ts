/**
 * Clocky's 15-minute rule (design handoff of 16 October 2026, README "Rules" 1,
 * SPEC section 13).
 *
 * Every recorded start, end and typed duration rounds to the nearest 15
 * minutes: 8:07 is recorded as 8:00, 8:08 as 8:15, and from 7 minutes 30
 * seconds it rounds up. What is saved, totalled, billed and reported is the
 * rounded value, so every duration and total the portal shows is a multiple of
 * 15 minutes. Only a live timer (h:mm:ss) shows the real time running.
 *
 * Rounding an instant is the same in every time zone: all of them sit a whole
 * number of quarter hours from UTC (New York -4:00, Nairobi +3:00, India
 * +5:30, Nepal +5:45), so the quarter hours line up everywhere.
 *
 * Pure: the server rounds what it saves with these, and the screens format
 * with them, so the two can never disagree.
 */

/** A quarter hour, in seconds. */
export const QUARTER = 900
const QUARTER_MS = QUARTER * 1000

const toMs = (t: Date | string | number): number =>
  t instanceof Date ? t.getTime() : typeof t === 'string' ? Date.parse(t) : t

/** An instant on the nearest quarter hour: 8:07 is 8:00, 8:07:30 and 8:08 are 8:15. */
export function roundInstant(t: Date | string | number): Date {
  return new Date(Math.floor((toMs(t) + QUARTER_MS / 2) / QUARTER_MS) * QUARTER_MS)
}

/** The same, as an ISO string, the way the database stores it. */
export const roundIso = (t: Date | string | number): string => roundInstant(t).toISOString()

/** A length of time on the nearest quarter hour, never negative: 2h 20m is 2h 15m, 2h 23m is 2h 30m. */
export function roundSeconds(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.floor((seconds + QUARTER / 2) / QUARTER) * QUARTER
}

/** Whether an instant already sits on a quarter hour (what a recorded time always does). */
export const onQuarter = (t: Date | string | number): boolean => toMs(t) % QUARTER_MS === 0

/** Seconds between two recorded (rounded) instants, never negative. */
export function recordedSeconds(startIso: string, endIso: string): number {
  const s = Date.parse(startIso)
  const e = Date.parse(endIso)
  if (Number.isNaN(s) || Number.isNaN(e)) return 0
  return Math.max(0, Math.round((e - s) / 1000))
}

/**
 * What a running entry counts so far: from its recorded start to now rounded,
 * so a list, a day total or a week total shows a multiple of 15 minutes too.
 */
export function runningSeconds(recordedStartIso: string, now: Date): number {
  return recordedSeconds(recordedStartIso, roundIso(now))
}

/** What an entry counts: its recorded duration, a running clock to now (on the quarter hour). */
export const entrySeconds = (e: { ended_at: string | null; started_at: string | null; duration_seconds: number; kind: string }, now: Date): number =>
  e.ended_at === null && e.kind === 'clock' && e.started_at ? runningSeconds(e.started_at, now) : e.duration_seconds

const pad = (n: number) => String(n).padStart(2, '0')

/** "7h 45m": every duration and total the portal shows, on the quarter hour. */
export function formatDuration(seconds: number): string {
  const m = roundSeconds(seconds) / 60
  return `${Math.floor(m / 60)}h ${pad(m % 60)}m`
}

/** "7:45": the same, where space is tight (the panel's Today and Week, the week grid). */
export function formatClock(seconds: number): string {
  const m = roundSeconds(seconds) / 60
  return `${Math.floor(m / 60)}:${pad(m % 60)}`
}

/** "1:58:34": a live timer, the one place the real time shows. */
export function formatTimer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/**
 * A typed duration, in seconds: "2:30", "2.5", "2h 30m", "2h", "45m". Empty is
 * 0; anything else is NaN (the week grid's "Use "2:30" or "2.5"" check). Not
 * rounded: the caller rounds what it saves and says so.
 */
export function parseDuration(text: string): number {
  const t = (text ?? '').trim().toLowerCase()
  if (!t) return 0
  let m: RegExpExecArray | null
  if ((m = /^(\d+):(\d{1,2})$/.exec(t))) return Number(m[1]) * 3600 + Number(m[2]) * 60
  if ((m = /^(\d+(?:\.\d+)?)$/.exec(t))) return Math.round(Number(m[1]) * 3600)
  if ((m = /^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/.exec(t)) && (m[1] || m[2])) return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60
  return NaN
}
