/**
 * The forgotten-clock safety net (design handoff of 16 October 2026, README
 * "Rules" 4 and 5, SPEC 1I and 1L, Clock Safety.dc.html).
 *
 * The window counts the whole time on the clock since the person clocked in,
 * across every job switch: switching does not restart it, only a clock out
 * does. "Keep going" is retired (audit, 5 November 2026): a clock left running
 * stops at 12h with no question; a window an old "Keep going" moved is still
 * read from window_started_at.
 *
 *   12h 00m  North Time ends the entry at the 12-hour mark (recorded on the
 *            quarter hour, the real mark kept), tells the person in the bell
 *            and by email, the top-bar button turns red until they confirm
 *            their real end, and the occurrence is logged for Clock safety.
 *
 * Leadership, 4 November 2026 (David's answers to the rules): no "Still
 * working?" question and no stop at 5 hours, which got in the way of people
 * who clock in once in the morning. Only a clock left running by mistake is
 * caught, and the person is always told. The "Still working?" step is kept
 * switched off: the warning comes at the same moment as the stop, so it never
 * shows on its own.
 *
 * Only North Time's own clocks are stopped, from the person's start date
 * (audit, 5 November 2026): a clock still open in TSheets, copied in by the
 * import, is TSheets' to end (clocky-safety-run.ts, clocky-panel.ts).
 *
 * Pure: the job, the actions and the panel ask the same questions.
 */

import { roundIso } from './rounding'
import { dayLabel, localDate, timeLabel } from './format'

export const STOP_AFTER_SECONDS = 12 * 3600
/** No warning before the stop (4 November 2026): it would only ever come with it. */
export const WARN_AFTER_SECONDS = STOP_AFTER_SECONDS
/** How long a clock runs before North Time stops it, as people read it. */
export const STOP_AFTER_LABEL = '12h 00m'

/** The columns of tc_entries the window is read from. */
export interface WindowedEntry {
  window_started_at?: string | null
  session_started_at?: string | null
  started_at_real?: string | null
  started_at: string | null
}

/** Where the current 12-hour window started: an old "Keep going", else the clock in. */
export function windowStart(e: WindowedEntry): string | null {
  return e.window_started_at ?? e.session_started_at ?? e.started_at_real ?? e.started_at ?? null
}

/** Where the person clocked in (the session), for "since you clocked in at 8:00 AM". */
export function sessionStart(e: WindowedEntry): string | null {
  return e.session_started_at ?? e.started_at_real ?? e.started_at ?? null
}

export interface SafetyState {
  windowStartedAt: string
  /** The warning point (now the same as the stop). */
  warnAt: string
  /** 12h 00m into the window: where the clock stops. */
  stopAt: string
  /** Seconds the window has run. */
  secondsIn: number
  /** Past the warning point (switched off: same as `due`). */
  warn: boolean
  /** Past 12h 00m: the clock stops now if it has not already. */
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
 * Where an automatic stop ends the entry: the 12-hour mark of the window, as it
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
 * N1, the bell (no email), kept for its old callers: the warning point is the
 * stop now, so the safety job no longer sends it. Says the rule in force: the
 * time is the start of the window, on the quarter hour, in the person's zone.
 */
export const stillWorkingText = (windowStartedAt: string, zone: string): string =>
  `Your clock has been running since you clocked in at ${timeLabel(roundIso(windowStartedAt), zone)}. It stops by itself at ${STOP_AFTER_LABEL}.`

/** 1I, the panel's card (Clock Panel.dc.html): the same, naming what is running now. */
export const stillWorkingPanelText = (windowStartedAt: string, zone: string, runningLabel: string): string =>
  `Your clock has been running since you clocked in at ${timeLabel(roundIso(windowStartedAt), zone)}, now on ${runningLabel}. It stops by itself at ${STOP_AFTER_LABEL}.`

/** What "Keep going" answers now that it is retired (audit, 5 November 2026). */
export const KEEP_GOING_RETIRED = `Keep going is retired: a clock left running stops by itself at ${STOP_AFTER_LABEL}. Clock out when you finish.`

/** "1:00 PM", or "1:00 PM on Mon, Oct 12" when the stop was on another day than `today` (1L). */
export function stopWhen(stoppedAtRecorded: string, zone: string, today: string): string {
  const day = localDate(stoppedAtRecorded, zone)
  return day === today ? timeLabel(stoppedAtRecorded, zone) : `${timeLabel(stoppedAtRecorded, zone)} on ${dayLabel(day)}`
}

/** N2, the bell and the email: "Your clock stopped by itself at 1:00 PM. Confirm when you really stopped." */
export const stoppedText = (when: string): string =>
  `Your clock stopped by itself at ${when}. Confirm when you really stopped.`

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
