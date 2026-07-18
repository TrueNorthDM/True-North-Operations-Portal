/**
 * tier.ts — the signed-in user's access tier, derived from people.role_type.
 *
 * Part 4 of "People, Teams and Permissions". role_type is the source of truth
 * for what a person may SEE in the portal; the hard security boundary is still
 * profiles.role + RLS (unchanged) — this only drives UI visibility. Two
 * privileged tiers (admin, admin_assistant) get the full portal; team_leader
 * and user get the restricted view (own / subordinates only).
 *
 * Pure module (no server imports) so client components can take the derived
 * booleans as props. Resolution lives in auth/role.ts (getCurrentTier).
 */

export type RoleType = 'admin' | 'admin_assistant' | 'team_leader' | 'user'

const ROLE_TYPES: readonly RoleType[] = ['admin', 'admin_assistant', 'team_leader', 'user']

/** Coerce an unknown/missing value to a valid RoleType (defaults to 'user'). */
export function asRoleType(v: string | null | undefined): RoleType {
  return ROLE_TYPES.includes(v as RoleType) ? (v as RoleType) : 'user'
}

export interface Tier {
  roleType: RoleType
  /** admin | admin_assistant — full portal (Admin, Settings, all Directory tabs, i7 buttons). */
  isPrivileged: boolean
  /** team_leader — restricted, but sees subordinates' cards (vs. only their own). */
  isLead: boolean
}

export function tierOf(roleType: RoleType): Tier {
  return {
    roleType,
    isPrivileged: roleType === 'admin' || roleType === 'admin_assistant',
    isLead: roleType === 'team_leader',
  }
}
