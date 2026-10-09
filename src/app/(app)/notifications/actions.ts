'use server'

/**
 * Writes for a person's own notifications: their choices, "Send me a test",
 * and marking notifications read. An admin's rules for everyone are in
 * ./rule-actions.ts; the time zone and summary hour are the Settings page's
 * (app/(app)/settings/actions.ts).
 *
 * Each one resolves the person who is actually signed in, never the one a
 * View Stage preview is showing (lib/notifications/signed-in.ts). The tables
 * are written with the privileged client because the person behind a login is
 * usually found by email, which row-level security cannot see; every write is
 * narrowed to that person here. A failure the person cannot act on returns a
 * plain message; the detail goes to the server log.
 */

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAccess } from '@/lib/access/resolve'
import { teamPositionLeads } from '@/lib/directory/people-types'
import { NOTIFICATION_TYPES, TYPE_BY_KEY, cleanPref, reaches, tabOf, type Pref } from '@/lib/notifications/catalogue'
import { loadDelivery } from '@/lib/notifications/store'
import { zoneDate } from '@/lib/notifications/schedule'
import { zoneLabel } from '@/lib/notifications/zones'
import { firstName } from '@/lib/notifications/summary'
import { NOT_SAVED, signedInPerson } from '@/lib/notifications/signed-in'
import { renderSummary } from '@/lib/email/summary'
import { sendEmail } from '@/lib/email/resend'
import { publicOrigin } from '@/lib/auth/public-origin'
import { Limiter } from '@/lib/auth/send-limit'

type Result = { ok: boolean; error?: string }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Runs an action; anything thrown becomes a plain message, the detail logged. */
async function guarded(what: string, run: () => Promise<Result>): Promise<Result> {
  try {
    return await run()
  } catch (e) {
    console.error(`[notifications] ${what}:`, (e as Error).message)
    return { ok: false, error: NOT_SAVED }
  }
}
const failed = (what: string, message: string): Result => {
  console.error(`[notifications] ${what}:`, message)
  return { ok: false, error: NOT_SAVED }
}

export async function saveNotificationPref(key: string, pref: Pref): Promise<Result> {
  return guarded('pref', async () => {
    const t = TYPE_BY_KEY.get(key)
    if (!t || !t.available) return { ok: false, error: 'That notification is not available yet.' }
    const clean = cleanPref(pref)
    if (!clean) return { ok: false, error: 'That choice could not be read. Reload the page and try again.' }
    const me = await signedInPerson()
    if ('error' in me) return { ok: false, error: me.error }

    // Only what was sent: a choice not in this save keeps what was stored
    // (writing every column wiped a timing choice the page had not loaded).
    const { error } = await createAdminClient().from('notification_prefs').upsert({
      person_id: me.personId, type_key: key,
      ...('enabled' in clean ? { enabled: clean.enabled ?? null } : {}),
      ...('timing' in clean ? { timing: clean.timing ?? null } : {}),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'person_id,type_key' })
    if (error) return failed('pref', error.message)
    return { ok: true }
  })
}

/** Marks some of the signed-in person's notifications read. Anyone else's ids are ignored. */
export async function markNotificationsRead(ids: string[]): Promise<Result> {
  return guarded('read', async () => {
    const clean = (Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && UUID.test(id)).slice(0, 200)
    if (!clean.length) return { ok: true }
    const me = await signedInPerson()
    if ('error' in me) return { ok: false, error: me.error }
    const { error } = await createAdminClient().from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('person_id', me.personId).in('id', clean).is('read_at', null)
    if (error) return failed('read', error.message)
    return { ok: true }
  })
}

/** Every landed notification in one drawer tab, for the signed-in person. */
export async function markTabRead(tab: string): Promise<Result> {
  return guarded('read tab', async () => {
    const keys = NOTIFICATION_TYPES.filter(t => tabOf(t) === tab).map(t => t.key)
    if (!keys.length) return { ok: true }
    const me = await signedInPerson()
    if ('error' in me) return { ok: false, error: me.error }
    const now = new Date().toISOString()
    const { error } = await createAdminClient().from('notifications')
      .update({ read_at: now })
      .eq('person_id', me.personId).in('type_key', keys).is('read_at', null).lte('deliver_at', now)
    if (error) return failed('read tab', error.message)
    return { ok: true }
  })
}

/** One test email per person a minute: each one is a real send through the email service. */
const testEmails = new Limiter()
const TEST_EMAIL_WINDOW = { limit: 1, ms: 60_000 }

/**
 * "Send me a test" from the preview window: the type's example, to the person
 * asking, either in the bell (marked Test, as it happens) or as a one-item
 * summary email. Only ever to the person asking, and only for a type that can
 * reach them. In the bell, one test per type every 30 seconds (the dedupe
 * key), so a double click is one; by email, one a minute.
 */
export async function sendTestNotification(key: string, channel: 'app' | 'email'): Promise<Result> {
  return guarded('test', async () => {
    const t = TYPE_BY_KEY.get(key)
    if (!t || !t.available) return { ok: false, error: 'That notification is not available yet.' }
    if (t.block !== 'tools' && t.block !== 'system') return { ok: false, error: 'That notification has no test yet.' }
    if (channel === 'email' && t.timings === 'instant') return { ok: false, error: 'This one only comes to the bell, so it has no email test.' }
    const me = await signedInPerson()
    if ('error' in me) return { ok: false, error: me.error }
    const db = createAdminClient()

    const access = await loadAccess()
    const { data: mine } = await db.from('team_members').select('position').eq('person_id', me.personId)
    const leads = ((mine ?? []) as { position: string | null }[]).some(m => teamPositionLeads(m.position ?? 'member'))
    if (!reaches(t, { isAdmin: access.isAdmin, leads, canTool: access.can })) return { ok: false, error: 'This notification does not come to you.' }

    const now = new Date()
    if (channel === 'app') {
      const slot = Math.floor(now.getTime() / 30_000)
      const { error } = await db.from('notifications').upsert({
        person_id: me.personId, type_key: key, title: `Test: ${t.example.title}`, body: t.example.body,
        href: '/settings#notifications', dedupe_key: `test:${slot}`, timing: 'instant',
        deliver_at: now.toISOString(), emailed_at: now.toISOString(),
      }, { onConflict: 'person_id,type_key,dedupe_key', ignoreDuplicates: true })
      if (error) return failed('test', error.message)
      revalidatePath('/', 'layout')
      return { ok: true }
    }

    if (!me.email) return { ok: false, error: 'Your login has no email address.' }
    if (!testEmails.take(me.personId, TEST_EMAIL_WINDOW)) return { ok: false, error: 'One test email a minute. Try again shortly.' }
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
  })
}
