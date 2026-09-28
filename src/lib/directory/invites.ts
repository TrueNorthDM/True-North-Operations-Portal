import type { createClient } from '@/lib/supabase/server'

/**
 * When each person was invited to the portal (migration 089), by person id.
 * A query of its own, like the other late columns the Directory reads, so a
 * deploy that lands before the migration shows nobody invited instead of failing.
 */
export async function loadInvitesByPerson(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<Map<string, string>> {
  const { data, error } = await supabase.from('people').select('id, portal_invited_at')
  const out = new Map<string, string>()
  if (error) return out
  for (const r of (data ?? []) as { id: string; portal_invited_at: string | null }[]) {
    if (r.portal_invited_at) out.set(r.id, r.portal_invited_at)
  }
  return out
}
