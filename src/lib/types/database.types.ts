/**
 * The database's types, for the code.
 *
 * `Database` is generated from the production schema (database.generated.ts,
 * by deploy/db/gen-types.sh), so it cannot drift from the tables the way the
 * hand-written version did (8 October 2026 audit: columns it called required
 * were nullable, and tables added since were missing).
 *
 * This file only adds what the database cannot say about itself: the shape of
 * a JSON column, or the few values a text column accepts (a CHECK constraint
 * is not part of the generated types). Each refinement narrows a generated
 * row; it never invents a column.
 */

import type { PersonAddress } from '@/lib/address'
import type { PersonMilestone } from '@/lib/milestones'
import type { Tables } from './database.generated'

export type { Database, Json, Tables, TablesInsert, TablesUpdate } from './database.generated'

export type LanguageCode = 'en' | 'pt' | 'es' | 'sw'

/** The database security role (profiles.role, is_admin()). */
export type Role = 'admin' | 'viewer'

export type ProfileRow = Omit<Tables<'profiles'>, 'role'> & { role: Role }

export type PersonRow = Omit<Tables<'people'>, 'status' | 'address' | 'milestones'> & {
  status: 'active' | 'inactive'
  address: PersonAddress | null       // structured mailing address, JSON (migration 042)
  milestones: PersonMilestone[] | null // career timeline, JSON array (migration 044)
}

export type PublishingTargetRow = Tables<'publishing_targets'>

export type AuditLogRow = Omit<Tables<'audit_log'>, 'action'> & { action: 'insert' | 'update' | 'delete' }

/** `fields`: the entry's custom field answers, a JSON object of strings. */
export type TcEntryRow = Omit<Tables<'tc_entries'>, 'fields'> & { fields: Record<string, string> }
