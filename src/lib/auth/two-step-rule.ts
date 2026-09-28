/**
 * When two-step sign-in is required (plan step p4-2fa, migration 090). Pure, so
 * it is tested without a database; lib/auth/two-step.ts feeds it.
 *
 * Everyone gets a week to set it up: people who join after it ships count from
 * their first sign-in, people who were already here count from the cutoff set
 * after the move. Whoever has set it up is asked for the code at every sign-in.
 */

export const GRACE_DAYS = 7
const DAY = 86_400_000

export interface TwoStepFacts {
  /** When the account was created, which is its first sign-in. */
  accountCreated: Date
  /** When two-step sign-in shipped. */
  launch: Date | null
  /** From when people who were already here get their week. Null until set. */
  cutoff: Date | null
}

/** The day the second step becomes required, or null while there is none. */
export function twoStepDeadline(f: TwoStepFacts): Date | null {
  if (f.launch && f.accountCreated >= f.launch) return new Date(f.accountCreated.getTime() + GRACE_DAYS * DAY)
  if (f.cutoff) return new Date(f.cutoff.getTime() + GRACE_DAYS * DAY)
  return null
}

/**
 * What a signed-in session needs now.
 *   ok               nothing: the code was given this session, or no deadline yet
 *   challenge        they have an app set up: ask for its code
 *   enroll-required  no app, and the week is over: set it up before going on
 *   enroll-optional  no app, the week is running: offer it, let them skip
 */
export type TwoStepNeed = 'ok' | 'challenge' | 'enroll-required' | 'enroll-optional'

export function twoStepNeed(input: { hasFactor: boolean; aal: string | null; deadline: Date | null; now: Date }): TwoStepNeed {
  if (input.hasFactor) return input.aal === 'aal2' ? 'ok' : 'challenge'
  if (!input.deadline) return 'ok'
  return input.now >= input.deadline ? 'enroll-required' : 'enroll-optional'
}

/** Whole days left before the deadline, at least 1 while it has not passed. */
export function daysLeft(deadline: Date, now: Date): number {
  return Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / DAY))
}
