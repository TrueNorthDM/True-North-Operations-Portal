'use server'

/**
 * An admin's rule for a notification type, for everyone (/notifications).
 * Apart from the person's own notification actions (./actions.ts) so the
 * access coverage test checks it: those are exempt as "the caller's own", and
 * this one changes what everybody gets (audit, 9 October 2026).
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowedTo } from '@/lib/access/resolve'
import { TYPE_BY_KEY, cleanRule, type Rule } from '@/lib/notifications/catalogue'
import { ruleToRow } from '@/lib/notifications/store'
import { NOT_SAVED, signedInPerson } from '@/lib/notifications/signed-in'

type Result = { ok: boolean; error?: string }

export async function saveNotificationRule(key: string, rule: Rule): Promise<Result> {
  try {
    const t = TYPE_BY_KEY.get(key)
    if (!t || !t.available) return { ok: false, error: 'That notification is not available yet.' }
    const clean = cleanRule(rule)
    if (!clean) return { ok: false, error: 'That rule could not be read. Reload the page and try again.' }
    const me = await signedInPerson()
    if ('error' in me) return { ok: false, error: me.error }
    if (!(await allowedTo('notification-rules'))) return { ok: false, error: 'Only an admin can change the rules for everyone.' }
    // A notification that goes to the holders of an item (Super Admins'
    // "Access rules were changed", for one) is ruled only by someone who holds
    // it: an Admin could otherwise switch off what Super Admins are told.
    if (t.audience.kind === 'tool' && !(await allowedTo(t.audience.tool))) {
      return { ok: false, error: 'This notification goes to people with access you do not have, so its rule is theirs to change.' }
    }

    const { error } = await createAdminClient().from('notification_rules').upsert({
      ...ruleToRow(key, clean), updated_by: me.personId, updated_at: new Date().toISOString(),
    }, { onConflict: 'type_key' })
    if (error) { console.error('[notifications] rule:', error.message); return { ok: false, error: NOT_SAVED } }
    revalidatePath('/notifications')
    revalidatePath('/settings')
    return { ok: true }
  } catch (e) {
    console.error('[notifications] rule:', (e as Error).message)
    return { ok: false, error: NOT_SAVED }
  }
}
