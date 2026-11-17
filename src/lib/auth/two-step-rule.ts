/**
 * When two-step sign-in is asked for (plan step p4-2fa, migration 090). Pure, so
 * it is tested without a database; lib/auth/two-step.ts feeds it.
 *
 * Optional since 17 November 2026 (owner): nobody has to set it up and nobody
 * is reminded. Whoever turned it on in Settings is asked for the code at every
 * sign-in, until they turn it off there. Before that date it was compulsory
 * after a week (from the first sign-in, or from the cutoff after the move); the
 * launch and cutoff dates stay in portal_settings as that history.
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

/** The day the second step becomes required: none, since it is optional (owner, 17 November 2026). */
export function twoStepDeadline(_f: TwoStepFacts): Date | null {
  return null
}

/**
 * What a signed-in session needs now.
 *   ok               nothing: the code was given this session, or no deadline yet
 *   challenge        they have an app set up: ask for its code
 *   enroll-required, enroll-optional  no longer given: with no deadline, nobody is sent to set it up
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
