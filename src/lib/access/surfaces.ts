/**
 * access/surfaces.ts: the catalogue of gateable surfaces, the rows of the
 * Access levels matrix.
 *
 * A "surface" is either a navigable area (Settings, Human Resources) or a
 * capability inside one (see salaries, export the report). Each has a stable
 * `key` stored in access_level_pages.surface_key, so labels can be reworded
 * freely but keys must never change once shipped.
 *
 * `defaults` is what applies before anyone configures the surface, chosen to
 * match how the portal behaved when the matrix was still hardcoded, so turning
 * this on changed nothing until an admin actually edited something.
 *
 * Admin is never listed: a real admin always passes every surface, which is
 * what makes it impossible to configure the portal into a locked-out state.
 *
 * Pure module (no server imports) so the client matrix can render from it.
 */

import type { RoleType } from '@/lib/auth/tier'

/** The levels that can be configured. Admin is always allowed everything. */
export type ConfigurableRole = Exclude<RoleType, 'admin'>
export const CONFIGURABLE_ROLES: readonly ConfigurableRole[] = ['admin_assistant', 'team_leader', 'user']

export type SurfaceGroup = 'Navigation' | 'People directory' | 'Clients Reports' | 'Managing'

export interface Surface {
  key: string
  label: string
  group: SurfaceGroup
  /**
   * 'always' = everyone reaches it and it cannot be switched off (the portal
   * needs a landing page). 'admin' = admin only, never configurable.
   */
  locked?: 'always' | 'admin'
  /** Applies when access_level_pages has no row for this surface + level. */
  defaults: Record<ConfigurableRole, boolean>
  /** Longer explanation shown under the row when it needs one. */
  note?: string
}

const ON: Record<ConfigurableRole, boolean> = { admin_assistant: true, team_leader: true, user: true }
const PRIV: Record<ConfigurableRole, boolean> = { admin_assistant: true, team_leader: false, user: false }
const LEAD: Record<ConfigurableRole, boolean> = { admin_assistant: true, team_leader: true, user: false }

export const SURFACES: readonly Surface[] = [
  // ── Navigation ────────────────────────────────────────────────────────────
  { key: 'home', label: 'Home dashboard', group: 'Navigation', locked: 'always', defaults: ON },
  {
    key: 'tools',
    label: 'Tools & Dashboards',
    group: 'Navigation',
    defaults: ON,
    note: 'Opens the area. Which tools appear inside it is set per team, on the Directory’s Teams tab.',
  },
  { key: 'projects', label: 'Projects', group: 'Navigation', defaults: ON },
  { key: 'my-work', label: 'My Work', group: 'Navigation', defaults: ON },
  { key: 'directory', label: 'People directory', group: 'Navigation', defaults: ON },
  { key: 'human-resources', label: 'Human Resources', group: 'Navigation', defaults: PRIV },
  { key: 'settings', label: 'Settings', group: 'Navigation', defaults: PRIV },
  { key: 'admin', label: 'Admin', group: 'Navigation', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },

  // ── People directory ──────────────────────────────────────────────────────
  // The list of names is visible to everyone, always. These rows control who
  // can OPEN a card, meaning see that person's details.
  {
    key: 'dir-own',
    label: 'Open their own card',
    group: 'People directory',
    locked: 'always',
    defaults: ON,
    note: 'The list of everyone is always visible. This is about opening a card to see the details behind it.',
  },
  {
    key: 'dir-reports',
    label: "Open their reports' and their team's cards",
    group: 'People directory',
    defaults: LEAD,
    note: 'Shows manager, work email, phone, location, hire date and contract type. Never salary or home address.',
  },
  {
    key: 'dir-anyone',
    label: 'Open anyone’s card, with the full admin view',
    group: 'People directory',
    defaults: PRIV,
    note: 'The whole directory: every card, the Emails, Teams, Rates & Costs and Access log tabs, and the sensitive fields (salaries, internal rates, home address, date of birth). These come as one, the screens do not separate them.',
  },

  // ── Clients Reports ───────────────────────────────────────────────────────
  {
    key: 'report-widget',
    label: 'Budget widget on the Home dashboard',
    group: 'Clients Reports',
    defaults: PRIV,
    note: 'Also requires the Clients Reports tool on one of their teams.',
  },
  { key: 'report-export', label: 'Export (PDF, CSV, image) and Team Update', group: 'Clients Reports', defaults: PRIV },
  { key: 'report-note', label: "Edit the month's note", group: 'Clients Reports', defaults: PRIV },

  // ── Managing (admin only, never configurable) ─────────────────────────────
  { key: 'manage-people', label: 'Add or edit people and teams', group: 'Managing', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },
  { key: 'manage-levels', label: 'Change access levels', group: 'Managing', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },
  { key: 'manage-budgets', label: 'Edit budgets, rates and API tokens', group: 'Managing', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },
  { key: 'view-stage', label: 'View Stage, preview each level side by side', group: 'Managing', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },
] as const

export const SURFACE_KEYS: ReadonlySet<string> = new Set(SURFACES.map(s => s.key))
export const SURFACE_BY_KEY: ReadonlyMap<string, Surface> = new Map(SURFACES.map(s => [s.key, s]))

export const SURFACE_GROUPS: readonly SurfaceGroup[] = ['Navigation', 'People directory', 'Clients Reports', 'Managing']

/**
 * Whether a level reaches a surface, given whatever rows are configured.
 * `configured` is keyed "roleType:surfaceKey". Admin short-circuits to true.
 */
export function surfaceAllowed(
  role: RoleType,
  key: string,
  configured: ReadonlyMap<string, boolean>,
): boolean {
  const surface = SURFACE_BY_KEY.get(key)
  if (!surface) return false
  if (surface.locked === 'always') return true
  if (role === 'admin') return true
  if (surface.locked === 'admin') return false
  const set = configured.get(`${role}:${key}`)
  return set ?? surface.defaults[role as ConfigurableRole] ?? false
}
