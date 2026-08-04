/**
 * access/levels.ts: the four portal access levels (people.role_type) as labels
 * and one-line descriptions.
 *
 * What each level may actually REACH is no longer written here, it is
 * configuration: the catalogue of surfaces lives in access/surfaces.ts and the
 * per-level answers live in access_level_pages, edited on Admin → Access levels
 * and enforced by access/resolve.ts. This file is only the naming.
 *
 * Pure module (no server imports) so the client board can render from it.
 */

import type { RoleType } from '@/lib/auth/tier'

export interface LevelDef {
  key: RoleType
  label: string
  /** One line, what this level is for. */
  summary: string
}

// Pill colours are NOT defined here, the board renders them with roleTypePill
// (components/admin/people-types), so a level looks the same on this board and
// on every Directory card.
export const LEVELS: readonly LevelDef[] = [
  { key: 'admin', label: 'Admin', summary: 'Runs the portal. Always has everything, and is the only level that can change these settings.' },
  { key: 'admin_assistant', label: 'Admin Assistant', summary: 'Starts with the same access as Admin, minus the ability to change it.' },
  { key: 'team_leader', label: 'Team Leader', summary: 'Their own card plus the people they lead. Everything else is configurable.' },
  { key: 'user', label: 'User', summary: 'Their own card only. The default for a new person.' },
] as const

/** Things worth knowing before handing out access. Shown as a callout. */
export const KNOWN_GAPS: readonly { title: string; detail: string }[] = [
  {
    title: 'Tools need a team as well as a level',
    detail: 'Allowing "Tools & Dashboards" above only opens the area. Which tools appear inside it comes from the person’s teams, on the Directory’s Teams tab. Someone in no team sees no tools, however permissive their level is. Admins are exempt.',
  },
  {
    title: 'Admin cannot be restricted',
    detail: 'The Admin column is deliberately absent: a real admin passes every check. That is what guarantees there is always a way back from a configuration mistake.',
  },
  {
    title: 'Pay is blocked in the database; contact details are not',
    detail: 'Salaries, internal cost rates and client rates were revoked from the signed-in role, so no session can read them through the API, whatever the level says. Home address, date of birth, personal email and phone are different: the screens hide them, the table still hands them to any signed-in account that asks directly.',
  },
  {
    title: 'These levels shape the screens, not the org chart',
    detail: 'The Home page shows the whole company org chart to everyone, by design: people need to know who to go to. What a level narrows is whose card, contact details and pay someone can reach, not who they know exists.',
  },
] as const
