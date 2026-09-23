'use server'

/**
 * Writes for notifications: a person's own choices, an admin's rules, and
 * marking notifications read.
 *
 * Each one verifies the login with auth.getUser() and resolves the person who
 * is actually signed in (real: true), never the one a View Stage preview is
 * showing: a preview changes what is rendered, not who is acting, so writes
 * are refused while one is open. The tables are written with the privileged
 * client because the person behind a login is usually found by email, which
 * row-level security cannot see; every write is narrowed to that person here.
 */

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { isSecurityAdmin } from '@/lib/auth/role'
import { getViewAs } from '@/lib/auth/view-as-server'
import { NOTIFICATION_TYPES, TYPE_BY_KEY, cleanPref, cleanRule, tabOf, type Pref, type Rule } from '@/lib/notifications/catalogue'
import { ruleToRow } from '@/lib/notifications/store'

type Result = { ok: boolean; error?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function signedInPerson(): Promise<{ personId: string } | { error: string }> {
  if (await getViewAs()) return { error: 'View Stage is only a preview. Close it to change notifications.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You are signed out. Sign in again to save.' }
  const me = await loadCurrentPerson(supabase, user, { real: true })
  if (!me) return { error: 'Your login is not linked to anyone in the Directory.' }
  return { personId: me.id }
}

export async function saveNotificationPref(key: string, pref: Pref): Promise<Result> {
  const t = TYPE_BY_KEY.get(key)
  if (!t || !t.available) return { ok: false, error: 'That notification is not available yet.' }
  const clean = cleanPref(pref)
  if (!clean) return { ok: false, error: 'That choice could not be read. Reload the page and try again.' }
  const me = await signedInPerson()
  if ('error' in me) return { ok: false, error: me.error }

  const { error } = await createAdminClient().from('notification_prefs').upsert({
    person_id: me.personId, type_key: key,
    enabled: clean.enabled ?? null, timing: clean.timing ?? null, channel: clean.channel ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'person_id,type_key' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function saveNotificationRule(key: string, rule: Rule): Promise<Result> {
  const t = TYPE_BY_KEY.get(key)
  if (!t || !t.available) return { ok: false, error: 'That notification is not available yet.' }
  const clean = cleanRule(rule)
  if (!clean) return { ok: false, error: 'That rule could not be read. Reload the page and try again.' }
  const me = await signedInPerson()
  if ('error' in me) return { ok: false, error: me.error }
  if (!(await isSecurityAdmin())) return { ok: false, error: 'Only an admin can change the rules for everyone.' }

  const { error } = await createAdminClient().from('notification_rules').upsert({
    ...ruleToRow(key, clean), updated_by: me.personId, updated_at: new Date().toISOString(),
  }, { onConflict: 'type_key' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/notifications')
  return { ok: true }
}

/** Marks some of the signed-in person's notifications read. Anyone else's ids are ignored. */
export async function markNotificationsRead(ids: string[]): Promise<Result> {
  const clean = (Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && UUID.test(id)).slice(0, 200)
  if (!clean.length) return { ok: true }
  const me = await signedInPerson()
  if ('error' in me) return { ok: false, error: me.error }
  const { error } = await createAdminClient().from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('person_id', me.personId).in('id', clean).is('read_at', null)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Every landed notification in one drawer tab, for the signed-in person. */
export async function markTabRead(tab: string): Promise<Result> {
  const keys = NOTIFICATION_TYPES.filter(t => tabOf(t) === tab).map(t => t.key)
  if (!keys.length) return { ok: true }
  const me = await signedInPerson()
  if ('error' in me) return { ok: false, error: me.error }
  const now = new Date().toISOString()
  const { error } = await createAdminClient().from('notifications')
    .update({ read_at: now })
    .eq('person_id', me.personId).in('type_key', keys).is('read_at', null).lte('deliver_at', now)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
