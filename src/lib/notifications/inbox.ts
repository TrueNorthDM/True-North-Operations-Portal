/**
 * One person's notifications for the bell, read on every page by the layout:
 * the landed ones (deliver_at in the past), newest first, split by drawer tab.
 * A daily-summary notification waiting for 8:00 is not shown until then.
 *
 * One indexed query. If the table is not there yet (migration 088), the bell
 * is simply empty, as it was before.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { NotificationItem } from '@/components/NotificationDrawer'
import { TYPE_BY_KEY, tabOf } from './catalogue'
import { zoneDate, addDays } from './schedule'

/** The most the drawer holds. Older ones stay in the table until retention clears them. */
const LIMIT = 80

export type Row = { id: string; type_key: string; title: string; body: string; href: string | null; timing: string; deliver_at: string; read_at: string | null }

const TIME = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' })

/** "9:40 AM" today, "Yesterday", then "Sep 20", in the company's calendar. */
export function whenLabel(at: Date, now: Date): string {
  const day = zoneDate(at)
  const today = zoneDate(now)
  if (day === today) return TIME.format(at)
  if (day === addDays(today, -1)) return 'Yesterday'
  return DAY.format(at)
}

/** Rows as the drawer shows them, split by tab. Shared with the design check. */
export function toItems(rows: readonly Row[], now: Date): Record<string, NotificationItem[]> {
  const out: Record<string, NotificationItem[]> = {}
  for (const r of rows) {
    const t = TYPE_BY_KEY.get(r.type_key)
    if (!t) continue
    ;(out[tabOf(t)] ??= []).push({
      id: r.id,
      who: r.title,
      what: r.body,
      when: whenLabel(new Date(r.deliver_at), now),
      src: t.src,
      icon: t.icon,
      href: r.href ?? '/notifications',
      unread: !r.read_at,
      summary: r.timing === 'daily',
    })
  }
  return out
}

export async function loadInbox(personId: string, now = new Date()): Promise<Record<string, NotificationItem[]>> {
  const db = createAdminClient()
  const { data, error } = await db.from('notifications')
    .select('id, type_key, title, body, href, timing, deliver_at, read_at')
    .eq('person_id', personId)
    .lte('deliver_at', now.toISOString())
    .order('deliver_at', { ascending: false })
    .limit(LIMIT)
  if (error) return {}
  return toItems((data ?? []) as Row[], now)
}
