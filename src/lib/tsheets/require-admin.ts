import { isSecurityAdmin } from '@/lib/auth/role'

/**
 * requireAdmin: shared guard for the i7 settings server actions.
 *
 * Returns null when the caller is an admin, otherwise a user-facing message.
 * Writes are also protected by RLS (is_admin); this just turns a silent RLS
 * rejection into a clear error the UI can show instead of a false "success".
 *
 * Plain module (not "use server") so both settings-actions.ts and
 * sync-actions.ts can import it without exposing it as its own server action.
 */
export async function requireAdmin(): Promise<string | null> {
  return (await isSecurityAdmin()) ? null : 'You must be an admin to run this.'
}
