'use server'

/**
 * Writes for notifications: a person's own choices, an admin's rules, "Send me
 * a test", and marking notifications read. The time zone and summary hour are
 * the Settings page's (app/(app)/settings/actions.ts).
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
import { headers } from 'next/headers'
import { NOTIFICATION_TYPES, TYPE_BY_KEY, cleanPref, cleanRule, tabOf, type Pref, type Rule } from '@/lib/notifications/catalogue'
import { ruleToRow, loadDelivery } from '@/lib/notifications/store'
import { zoneDate } from '@/lib/notifications/schedule'
import { zoneLabel } from '@/lib/notifications/zones'
import { firstName } from '@/lib/notifications/summary'
import { renderSummary } from '@/lib/email/summary'
import { sendEmail } from '@/lib/email/resend'
import { publicOrigin } from '@/lib/auth/public-origin'

type Result = { ok: boolean; error?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function signedInPerson(): Promise<{ personId: string; name: string; email: string | null } | { error: string }> {
  if (await getViewAs()) return { error: 'View Stage is only a preview. Close it to change notifications.' }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You are signed out. Sign in again to save.' }
  const me = await loadCurrentPerson(supabase, user, { real: true })
  if (!me) return { error: 'Your login is not linked to anyone in the Directory.' }
  return { personId: me.id, name: me.full_name ?? '', email: user.email ?? null }
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
  revalidatePath('/settings')
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

/**
 * "Send me a test" from the preview window: the type's example, to the person
 * asking, either in the bell (marked Test, as it happens) or as a one-item
 * summary email. Only ever to the person asking. In the bell, one test per
 * type every 30 seconds (the dedupe key), so a double click is one.
 */
export async function sendTestNotification(key: string, channel: 'app' | 'email'): Promise<Result> {
  const t = TYPE_BY_KEY.get(key)
  if (!t || !t.available) return { ok: false, error: 'That notification is not available yet.' }
  if (t.block !== 'tools' && t.block !== 'system') return { ok: false, error: 'That notification has no test yet.' }
  const me = await signedInPerson()
  if ('error' in me) return { ok: false, error: me.error }
  const db = createAdminClient()
  const now = new Date()
  const slot = Math.floor(now.getTime() / 30_000)

  if (channel === 'app') {
    const { error } = await db.from('notifications').upsert({
      person_id: me.personId, type_key: key, title: `Test: ${t.example.title}`, body: t.example.body,
      href: '/settings#notifications', dedupe_key: `test:${slot}`, timing: 'instant',
      deliver_at: now.toISOString(), emailed_at: now.toISOString(),
    }, { onConflict: 'person_id,type_key,dedupe_key', ignoreDuplicates: true })
    if (error) return { ok: false, error: error.message }
    revalidatePath('/', 'layout')
    return { ok: true }
  }

  if (!me.email) return { ok: false, error: 'Your login has no email address.' }
  const delivery = (await loadDelivery(db, [me.personId])).get(me.personId)
  const zone = delivery?.zone
  const h = await headers()
  const origin = publicOrigin(`${h.get('x-forwarded-proto') ?? 'https'}://${h.get('host') ?? 'localhost:3000'}`)
  const mail = renderSummary({
    category: t.block, firstName: firstName(me.name), today: zoneDate(now, zone), missed: [], test: true,
    items: [{ type: key, title: t.example.title, body: t.example.body, href: '/settings#notifications', day: zoneDate(now, zone) }],
    origin, zoneLabel: zoneLabel(zone), hour: delivery?.hour,
  })
  const res = await sendEmail({ to: me.email, ...mail })
  return res.sent ? { ok: true } : { ok: false, error: `Not sent: ${res.reason}.` }
}
