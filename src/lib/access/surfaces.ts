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
  // Three grants, not one. They were a single row while they were one page
  // with two tabs; Report made them three views of different things, with
  // different audiences. Splitting the switch is the point: a person can be
  // given their own work without being given the team's delivery figures.
  {
    key: 'my-work',
    label: 'My Work',
    group: 'Navigation',
    defaults: ON,
    note: 'Every step assigned to them across Monday. Opens the area; Report and My Team are separate.',
  },
  {
    key: 'report',
    label: 'Report',
    group: 'Navigation',
    defaults: ON,
    note: 'Delivery, held time and lateness. What each level sees inside it still follows the directory level: level 1 sees only themselves, level 3 sees everyone and the Workload tab.',
  },
  {
    key: 'my-team',
    label: 'My Team',
    group: 'Navigation',
    defaults: ON,
    note: 'The people they work with and what each can reach.',
  },
  {
    key: 'my-hours',
    label: 'My Hours',
    group: 'Navigation',
    defaults: ON,
    note: 'Where a person tracks their own hours. Everyone sees only their own, and that is enforced by the database rather than by the screen. Being built; QuickBooks Time is still the official record, so anything logged here does not count yet.',
  },
  {
    key: 'directory',
    label: 'People directory',
    group: 'Navigation',
    defaults: ON,
    note: 'Switching this off does not remove the personal team view from the avatar menu: seeing your own team is personal, and stays available whatever this row says. The My Team row above is the one that governs the tab inside My Work. The People directory levels below still decide how much of a teammate’s card opens.',
  },
  { key: 'human-resources', label: 'Human Resources', group: 'Navigation', defaults: PRIV },
  // Settings holds the budgets, the hourly rates and the API tokens, so it is
  // locked to admin rather than left configurable.
  { key: 'settings', label: 'Settings', group: 'Navigation', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },
  { key: 'admin', label: 'Admin', group: 'Navigation', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },
  // Clocky Hours is the time module: the rules, the migration from QuickBooks
  // Time, and later the approvals and payroll. My Hours above is the
  // person-facing half of it. Admin only while it is being built, and locked
  // rather than configurable so nobody can hand out the migration controls by
  // ticking a box.
  { key: 'clocky-hours', label: 'Clocky Hours (the time module)', group: 'Navigation', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },

  // ── People directory ──────────────────────────────────────────────────────
  // Three cumulative levels rather than independent switches, because that is
  // how the screens actually stack. Level 1 is the floor everyone gets; each
  // row below adds to it. See directoryLevel() for the resolution.
  {
    key: 'dir-base',
    label: 'Level 1, their own team and their own card',
    group: 'People directory',
    locked: 'always',
    defaults: ON,
    note: 'In the Directory, the People list shows the members of the teams they belong to (all of them, if several) and they can open only their own card. Someone in no team sees just themselves. Note that the org chart on the Home page is company-wide for everyone: this level narrows whose DETAILS they reach, not who they know exists.',
  },
  {
    key: 'dir-teams-config',
    label: 'Level 2, the whole company list, read-only',
    group: 'People directory',
    defaults: PRIV,
    note: 'In the Directory, widens the People list from their own teams to everyone, the same list an admin sees, and adds a Teams tab covering every team with who can open which tool. All of it read-only, and still only their OWN card opens. No Emails, Rates & Costs or Access log. My Team stays scoped to their own teams for everyone: that page answers "who do I work with", not "who works here".',
  },
  {
    key: 'dir-full',
    label: 'Level 3, the full directory, and edit it',
    group: 'People directory',
    defaults: PRIV,
    note: 'Everyone’s card, every team, all tabs (Emails, Teams, Rates & Costs, Access log), the sensitive fields (salaries, internal rates, home address, date of birth), and the ability to change them.',
  },

  // ── Clients Reports ───────────────────────────────────────────────────────
  { key: 'report-widget', label: 'Budget widget on the Home dashboard', group: 'Clients Reports', defaults: PRIV },
  // Written as a capability someone HAS rather than a restriction they suffer,
  // like every other row here, so the matrix reads one way throughout: a tick
  // always means more.
  {
    key: 'report-full',
    label: 'See the whole client report',
    group: 'Clients Reports',
    defaults: PRIV,
    note: 'Without this the report still opens, with two columns hidden (Budget hrs and Budget used) and only their own teammates in the per-person hour columns. Hrs avail. and Budget avail. stay visible, and the team filter is not shown, since the columns are already their own team. The totals stay honest: Hours used is still the figure for everyone, not the sum of the columns they can see, so nobody reads a partial number as the whole.',
  },
  // Exporting hands out the full budget and per-person cost detail, and the
  // note is published on the client report, so both stay with admin.
  { key: 'report-export', label: 'Export (PDF, CSV, image) and Team Update', group: 'Clients Reports', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },
  { key: 'report-note', label: "Edit the month's note", group: 'Clients Reports', locked: 'admin', defaults: { admin_assistant: false, team_leader: false, user: false } },

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

/**
 * The three People-directory levels, resolved from the cumulative rows.
 *
 *   1 = their own team's list, their own card (the floor, always granted)
 *   2 = + the Teams tab for their own teams, tool access read-only
 *   3 = + the whole directory, every tab, the sensitive fields, and editing
 */
export type DirectoryLevel = 1 | 2 | 3

export function directoryLevel(can: (surfaceKey: string) => boolean): DirectoryLevel {
  if (can('dir-full')) return 3
  if (can('dir-teams-config')) return 2
  return 1
}
