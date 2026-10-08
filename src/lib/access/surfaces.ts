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
 *   3  anyone's page (p-any), with the full list and its tabs
 *   2  the whole company list, read-only
 *   1  their own teams and their own card
 */
export type DirectoryLevel = 1 | 2 | 3
export function directoryLevel(can: (key: string) => boolean): DirectoryLevel {
  if (can('p-any')) return 3
  if (can('d-company')) return 2
  return 1
}

/** My Team: 2 adds its Teams tab. Whose page opens from it is page-rights.ts. */
export function myTeamLevel(can: (key: string) => boolean): 1 | 2 {
  return can('mt-teams') ? 2 : 1
}
