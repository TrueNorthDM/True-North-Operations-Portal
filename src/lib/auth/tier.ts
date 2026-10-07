/**
 * tier.ts: the access level as the directory stores it (people.role_type).
 *
 * Since 7 October 2026 role_type MIRRORS the level the access rule works out
 * (lib/access/decide.ts): Super Admin and Admin as given (people.access_level),
 * Team Leader for anyone who is Lead of a team, else User. A database trigger
 * keeps it in step (migration 095), so the screens that show a person's level
 * ("Contact type") read it here. What a level may OPEN is never decided from
 * this: that is the access rule's job.
 *
 * Pure module (no server imports).
 */

export type RoleType = 'super_admin' | 'admin' | 'team_leader' | 'user'

const ROLE_TYPES: readonly RoleType[] = ['super_admin', 'admin', 'team_leader', 'user']

/** Coerce an unknown/missing value to a valid RoleType (defaults to 'user'). */
export function asRoleType(v: string | null | undefined): RoleType {
  return ROLE_TYPES.includes(v as RoleType) ? (v as RoleType) : 'user'
}
