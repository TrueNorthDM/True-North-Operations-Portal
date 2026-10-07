/**
 * access/surfaces.ts: what is left of the first access matrix (2026-07 to
 * 7 October 2026), kept for the names other modules import. The catalogue of
 * what can be opened is now access/catalogue.ts, and the rule that decides is
 * access/decide.ts.
 *
 * Pure module.
 */

import { ITEM } from './catalogue'

/** Item keys My Work, its save action and the Access page check by name. */
export const PRIORITY_OWN = 'priority-own'
export const PRIORITY_ALL = 'priority-all'
export const REPORT_PEOPLE = 'report-people'
export const REPORT_WORKLOAD = 'report-workload'

/** Every catalogue key: what a guard may ask for. */
export const SURFACE_KEYS: ReadonlySet<string> = new Set([...ITEM.keys(), 'tools'])

/**
 * How much of the People directory someone reaches, as the Directory and the
 * other people lists draw it:
 *   3  anyone's card (and the tabs each have their own tick)
 *   2  the whole company list, read-only
 *   1  their own teams and their own card
 */
export type DirectoryLevel = 1 | 2 | 3
export function directoryLevel(can: (key: string) => boolean): DirectoryLevel {
  if (can('d-cards')) return 3
  if (can('d-company')) return 2
  return 1
}

/** The same three steps for My Team: 2 adds its Teams tab, 3 opens teammates' cards. */
export function myTeamLevel(can: (key: string) => boolean): DirectoryLevel {
  if (can('mt-cards')) return 3
  if (can('mt-teams')) return 2
  return 1
}
