/**
 * The forgotten-clock safety net (design handoff of 16 October 2026, README
 * "Rules" 4 and 5, SPEC 1I and 1L, Clock Safety.dc.html).
 *
 * The window counts the whole time on the clock since the person clocked in,
 * across every job switch: switching does not restart it, only "Keep going"
 * (a new 5-hour window from that moment) or a clock out does.
 *
 *   4h 30m   "Still working?" in the panel and the bell, once per window.
 *   5h 00m   with no answer, Clocky ends the entry at the 5-hour mark (recorded
 *            on the quarter hour, the real mark kept), the top-bar button turns
 *            red until the person confirms their real end, and the occurrence
 *            is logged for Clock safety.
 *
 * A clock still open from QuickBooks Time has no window of its own: it counts
 * from its start, so it closes at the 5-hour mark too, "as soon as Clocky
 * notices", and asks for the real end the same way (SPEC 1L).
 *
 * Pure: the job, the actions and the panel ask the same questions.
 */

import { roundIso } from './rounding'
import { dayLabel, localDate, timeLabel } from './format'

export const WARN_AFTER_SECONDS = 4.5 * 3600
export const STOP_AFTER_SECONDS = 5 * 3600

/** The columns of tc_entries the window is read from. */
export interface WindowedEntry {
  window_started_at?: string | null
  session_started_at?: string | null
  started_at_real?: string | null
  started_at: string | null
}

/** Where the current 5-hour window started: the last "Keep going", else the clock in. */
export function windowStart(e: WindowedEntry): string | null {
  return e.window_started_at ?? e.session_started_at ?? e.started_at_real ?? e.started_at ?? null
}

/** Where the person clocked in (the session), for "since you clocked in at 8:00 AM". */
export function sessionStart(e: WindowedEntry): string | null {
  return e.session_started_at ?? e.started_at_real ?? e.started_at ?? null
}

export interface SafetyState {
  windowStartedAt: string
  /** 4h 30m into the window. */
  warnAt: string
  /** 5h 00m into the window: where the clock stops. */
  stopAt: string
  /** Seconds the window has run. */
  secondsIn: number
  /** Past 4h 30m: "Still working?" shows. */
  warn: boolean
  /** Past 5h 00m: the clock stops now if it has not already. */
  due: boolean
}

export function safetyState(windowStartedAt: string, now: Date): SafetyState {
  const t0 = Date.parse(windowStartedAt)
  const secondsIn = Math.max(0, Math.floor((now.getTime() - t0) / 1000))
  return {
    windowStartedAt,
    warnAt: new Date(t0 + WARN_AFTER_SECONDS * 1000).toISOString(),
    stopAt: new Date(t0 + STOP_AFTER_SECONDS * 1000).toISOString(),
    secondsIn,
    warn: secondsIn >= WARN_AFTER_SECONDS,
    due: secondsIn >= STOP_AFTER_SECONDS,
  }
}

/**
 * Where an automatic stop ends the entry: the 5-hour mark of the window, as it
 * really was (kept in ended_at_real) and on the quarter hour (what counts).
 * Never before the entry's own recorded start: a clock switched after its
 * window ran out (the job was late) stops where the entry began.
 */
export function stopPoint(windowStartedAt: string, recordedStart: string | null): { real: string; recorded: string } {
  const real = new Date(Date.parse(windowStartedAt) + STOP_AFTER_SECONDS * 1000).toISOString()
  let recorded = roundIso(real)
  if (recordedStart && Date.parse(recorded) < Date.parse(recordedStart)) recorded = recordedStart
  return { real, recorded }
}

// ── What the person reads ───────────────────────────────────────────────────

/**
 * N1, the bell (no email): "Still working? Your clock has been running 4h 30m
 * since you clocked in at 8:00 AM. It stops at 5h 00m unless you keep it going."
 * The time is the start of the window, on the quarter hour, in the person's zone.
 */
export const stillWorkingText = (windowStartedAt: string, zone: string): string =>
  `Still working? Your clock has been running 4h 30m since you clocked in at ${timeLabel(roundIso(windowStartedAt), zone)}. It stops at 5h 00m unless you keep it going.`

/** 1I, the panel's warn card (Clock Panel.dc.html): the same, naming what is running now. */
export const stillWorkingPanelText = (windowStartedAt: string, zone: string, runningLabel: string): string =>
  `Your clock has been running for 4h 30m since you clocked in at ${timeLabel(roundIso(windowStartedAt), zone)}, now on ${runningLabel}. It will stop by itself at 5h 00m unless you tell us you are still on it.`

/** "1:00 PM", or "1:00 PM on Mon, Oct 12" when the stop was on another day than `today` (1L). */
export function stopWhen(stoppedAtRecorded: string, zone: string, today: string): string {
  const day = localDate(stoppedAtRecorded, zone)
  return day === today ? timeLabel(stoppedAtRecorded, zone) : `${timeLabel(stoppedAtRecorded, zone)} on ${dayLabel(day)}`
}

/** N2, the bell and the email: "Your clock stopped by itself at 1:00 PM. Confirm when you really stopped." */
export const stoppedText = (when: string): string =>
  `Your clock stopped by itself at ${when}. Confirm when you really stopped.`

/** The done line on a "Still working?" bell row after "Keep going" (Clock Safety.dc.html). */
export const keptGoingNote = (at: Date, zone: string): string =>
  `You kept going at ${timeLabel(at, zone)}. Clocky asks again in 4h 30m.`

/** The toast after "Keep going": from the panel, and from the bell. */
export const KEEP_GOING_TOAST_PANEL = 'Got it. Your clock runs another 5h from now.'
export const KEEP_GOING_TOAST_BELL = 'Keep going. Your clock runs another 5h from now.'

/**
 * Every 1L time picker option, newest first, on 15-minute steps: from a quarter
 * hour after the recorded start up to the stop; or, with "I was still working
 * until...", from a quarter hour after the stop up to now.
 */
export function endOptions(recordedStart: string, recordedStop: string, now: Date, stillWorking: boolean): string[] {
  const q = 900_000
  const lo = stillWorking ? Date.parse(recordedStop) + q : Date.parse(recordedStart) + q
  const hi = stillWorking ? Math.floor(now.getTime() / q) * q : Date.parse(recordedStop)
  const out: string[] = []
  for (let t = hi; t >= lo && out.length < 400; t -= q) out.push(new Date(t).toISOString())
  return out
}
