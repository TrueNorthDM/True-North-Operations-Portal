/**
 * access/levels.ts: the canonical description of the four portal access levels
 * (people.role_type) and exactly what each one can see and do.
 *
 * This is DOCUMENTATION DATA, written to match the code as it actually behaves
 * today, not as it is meant to behave eventually. Where a gate is missing or
 * inconsistent, the capability carries a `caveat` instead of being silently
 * listed as blocked, so the Access levels board never over-promises.
 *
 * Pure module (no server imports) so the client board can render from it.
 * When a gate changes in code, update the matching row here.
 */

import type { RoleType } from '@/lib/auth/tier'

export type CapState = 'yes' | 'no' | 'partial'

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
  { key: 'admin', label: 'Admin', summary: 'Runs the portal. Full access, and can change anything.' },
  { key: 'admin_assistant', label: 'Admin Assistant', summary: 'The same access as Admin, under a different label.' },
  { key: 'team_leader', label: 'Team Leader', summary: 'Read-only. Their own card plus the people they lead.' },
  { key: 'user', label: 'User', summary: 'Read-only. Their own card only. The default for a new person.' },
] as const

export interface Capability {
  label: string
  /** Per-level state, keyed by role_type. */
  state: Record<RoleType, CapState>
  /** Shown under the row when the reality needs a footnote. */
  caveat?: string
}

export interface CapabilityGroup {
  area: string
  items: Capability[]
}

const ALL: Record<RoleType, CapState> = { admin: 'yes', admin_assistant: 'yes', team_leader: 'yes', user: 'yes' }
const PRIVILEGED: Record<RoleType, CapState> = { admin: 'yes', admin_assistant: 'yes', team_leader: 'no', user: 'no' }

export const CAPABILITIES: readonly CapabilityGroup[] = [
  {
    area: 'Navigation',
    items: [
      { label: 'Home, Tools, Projects, My Work, Directory', state: ALL },
      { label: 'Human Resources', state: PRIVILEGED },
      { label: 'Admin (this area)', state: PRIVILEGED },
      { label: 'Settings', state: PRIVILEGED },
    ],
  },
  {
    area: 'People directory',
    items: [
      { label: 'See the list of everyone', state: ALL },
      { label: 'Open their own card', state: ALL },
      { label: "Open their reports' and their team's cards", state: { admin: 'yes', admin_assistant: 'yes', team_leader: 'yes', user: 'no' } },
      { label: "Open anyone's card", state: PRIVILEGED },
      { label: 'Emails, Teams, Rates & Costs and Access log tabs', state: PRIVILEGED },
      { label: 'See salaries and internal rates', state: PRIVILEGED },
      { label: 'See home address and date of birth', state: PRIVILEGED },
    ],
  },
  {
    area: 'Clients Reports',
    items: [
      { label: 'Open the Clients Reports page', state: ALL },
      { label: 'Budget widget on the Home dashboard', state: PRIVILEGED },
      { label: 'Export (PDF, CSV, image) and Team Update', state: PRIVILEGED },
      { label: "Edit the month's note", state: PRIVILEGED },
    ],
  },
  {
    area: 'Managing',
    items: [
      { label: 'Add or edit people and teams', state: PRIVILEGED },
      { label: 'Change access levels (this page)', state: PRIVILEGED },
      { label: 'Edit budgets, rates and API tokens', state: PRIVILEGED },
      { label: 'View Stage, preview each level side by side', state: PRIVILEGED },
    ],
  },
] as const

/** Gaps worth knowing before handing out access. Shown as a callout. */
export const KNOWN_GAPS: readonly { title: string; detail: string }[] = [
  {
    title: 'Admin and Admin Assistant have the same powers',
    detail: 'They are two names for the same access. Both can reach Admin and Settings and both can save. The difference is only the label on the person, so pick either and use it consistently.',
  },
  {
    title: 'The per-team tool toggles do nothing yet',
    detail: 'The Off / Lead / Team switches on each team card are saved, but nothing reads them. Turning a tool Off does not hide it from anyone today.',
  },
  {
    title: 'Salary and address are hidden by the interface only',
    detail: 'The screens never show them to a Team Leader or User, but the underlying table still allows any signed-in account to read those columns through the API.',
  },
] as const
