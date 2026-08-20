// The overload question: three readings, on three different clocks.
//
// None of them is a score, and the order matters more than any single number:
//
//   Utilisation  hours logged against hours contracted. Says whether someone
//                is working the week they agreed to.
//   Load         estimated work ahead against the hours they actually work,
//                which is not the same divisor and usually not the same answer.
//   Backlog      arriving against finishing. Uses no hours at all, and is the
//                only one that still means something for a person who never
//                logs time.
//
// Kept out of the component because each is a small division that reads as
// obvious and is easy to write with the wrong denominator, and a wrong
// denominator here does not look wrong: it looks like a person who is behind.

export type Reading = 'overloaded' | 'waiting' | 'at-capacity' | 'spare' | 'steady'

export type WorkloadRow = {
  id: string
  name: string
  initials: string
  color: string
  /** Hours a week they agreed to, and hours they actually tend to work. */
  contracted: number
  /** Null for anyone outside the timeclock: contractors, mostly. */
  observed: number | null
  /**
   * Hours logged over the utilisation window.
   *
   * Null and 0 are different facts and the column shows them differently:
   * null is "the timeclock has no record of this person", 0 is "it has a
   * record and they logged nothing". Collapsing the two turns a contractor
   * into somebody who did no work all quarter.
   */
  hoursLogged: number | null
  /** Estimated hours of work due in the next 30 days. */
  estimatedAhead: number
  /** Steps arriving and finishing per week, over the backlog window. */
  arriving: number
  finishing: number
  /** One entry per week of the backlog window: arriving minus finishing. */
  weekly: number[]
}

/** Fixed windows. The period switch moves utilisation and delivered, not these. */
export const LOAD_HORIZON_DAYS = 30
export const BACKLOG_WEEKS = 8
export const UTILISATION_WEEKS = 13

/**
 * The load bar runs to 120%, not 100%.
 *
 * Anything over 100 has to stay legible, and a bar that clips at its own
 * maximum shows 100% and 200% as the same picture. The consequence is that
 * the 100% tick sits at 83.3% of the track rather than at the end.
 */
export const LOAD_SCALE = 120
export const LOAD_TICK_PCT = (100 / LOAD_SCALE) * 100

export const SPARK_MAX_PX = 20

export function utilisation(
  hoursLogged: number | null, contracted: number, weeks = UTILISATION_WEEKS,
): number | null {
  if (hoursLogged === null || contracted <= 0) return null
  return Math.round((hoursLogged / weeks / contracted) * 100)
}

/**
 * Hours available over the horizon.
 *
 * From the hours they actually work, or from the group's average week when
 * the timeclock has nothing for them. Blanking Load instead would lose the
 * one reading that still means something for a contractor, and Backlog alone
 * cannot say whether the queue is more than they can carry.
 *
 * The caller has to mark a row that fell back. An estimate resting on
 * somebody else's week read as measured is worse than no estimate.
 */
export function availableHours(
  observed: number | null, groupAverageWeek: number, days = LOAD_HORIZON_DAYS,
): { hours: number; estimated: boolean } {
  const week = observed ?? groupAverageWeek
  return { hours: Math.round(week * (days / 7)), estimated: observed === null }
}

/** The average week of everyone the timeclock does know about. */
export function groupAverageWeek(people: { observed: number | null }[]): number {
  const known = people.map(p => p.observed).filter((h): h is number => h !== null)
  if (!known.length) return 0
  return Math.round((known.reduce((s, h) => s + h, 0) / known.length) * 10) / 10
}

export function loadPercent(estimatedAhead: number, available: number): number | null {
  if (available <= 0) return null
  return Math.round((estimatedAhead / available) * 100)
}

/** Steps a week piling up (positive) or clearing (negative), to one decimal. */
export function netFlow(arriving: number, finishing: number): number {
  return Math.round((arriving - finishing) * 10) / 10
}

/**
 * What the combination means, resolved in this order and no other.
 *
 * Waiting is the case the column exists for: plenty of work assigned and few
 * hours logged is work parked on somebody else's approval, not a person who
 * cannot cope. Read Load alone and the two are indistinguishable, and the
 * wrong one gets a conversation about capacity.
 */
export function reading(load: number | null, net: number, util: number | null): Reading {
  if (load !== null && load >= 120) return 'overloaded'
  if (net > 0.5 && util !== null && util < 70) return 'waiting'
  if (load !== null && load >= 85) return 'at-capacity'
  if (load !== null && load < 60 && net <= 0.2) return 'spare'
  return 'steady'
}

export const READING_LABEL: Record<Reading, string> = {
  overloaded: 'Overloaded',
  waiting: 'Waiting',
  'at-capacity': 'At capacity',
  spare: 'Spare',
  steady: 'Steady',
}

export const READING_CHIP: Record<Reading, string> = {
  overloaded: 'bg-[rgba(194,65,12,.14)] text-[#c2410c]',
  waiting: 'bg-[rgba(87,155,252,.16)] text-[#2a5cab]',
  'at-capacity': 'bg-[rgba(224,138,30,.16)] text-[#b06d0a]',
  spare: 'bg-[rgba(30,125,127,.12)] text-tn-teal',
  steady: 'bg-[rgba(133,147,164,.14)] text-[var(--chip-neutral-fg)]',
}

/** Full week worked is the good case; well under it and well over it are not. */
export function utilisationColour(util: number): string {
  if (util >= 95) return '#c2410c'
  if (util >= 75) return '#1E7D7F'
  return '#b06d0a'
}

export function loadColour(load: number): string {
  if (load >= 110) return '#c2410c'
  if (load >= 85) return '#E09422'
  return '#1E7D7F'
}

export function netChip(net: number): string {
  if (net > 0.4) return 'bg-[rgba(194,65,12,.12)] text-[#c2410c]'
  if (net < -0.1) return 'bg-[rgba(30,125,127,.12)] text-tn-teal'
  return 'bg-[rgba(133,147,164,.14)] text-[var(--chip-neutral-fg)]'
}

export function formatNet(net: number): string {
  return `${net > 0 ? '+' : ''}${net.toFixed(1)}/wk`
}

/** One sparkline bar: capped so a bad week cannot stretch the row. */
export function sparkBar(net: number): { px: number; piling: boolean } {
  return { px: Math.max(2, Math.min(SPARK_MAX_PX, Math.round(Math.abs(net) * 9))), piling: net > 0 }
}
