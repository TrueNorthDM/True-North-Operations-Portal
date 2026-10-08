/**
 * Turning what the generators found into notifications people actually get.
 *
 * A generator only says "this person should hear about this". Whether they do,
 * and when, is decided here and nowhere else: the admin's rule for the type,
 * then the person's own choice where the rule leaves it open (`effective`).
 * Switched off means no row at all; the daily summary means a row that waits
 * until 8:00 in the person's time zone (New York unless they chose another),
 * and then goes out in the summary email too (summary.ts).
 *
 * Every notification carries a dedupe key, and the table is unique on
 * (person, type, key): the same thing found by two runs is one notification.
 * Generators can therefore look again every run without keeping score.
 */

import type { Db } from '@/lib/supabase/types'
import { TYPE_BY_KEY, effective, type Pref, type Rule } from './catalogue'
import { deliverAt, zoneDate } from './schedule'
import { loadDelivery, loadPrefs, loadRules, type Delivery } from './store'

type Client = Db

export interface Draft {
  personId: string
  type: string
  title: string
  body: string
  href: string | null
  /** Unique per person and type: the same thing found twice is one notification. */
  dedupeKey: string
  /**
   * The day it must land on, in the person's calendar, or not at all. "Due
   * tomorrow" is only true the day before: a daily summary that would arrive
   * on the day itself is skipped, and an earlier run will have caught it.
   */
  deliverDay?: string
}

export interface Row {
  person_id: string
  type_key: string
  title: string
  body: string
  href: string | null
  dedupe_key: string
  timing: 'instant' | 'daily'
  deliver_at: string
}

/** Pure: which drafts become rows, and when they land. `delivery`: person -> summary zone and hour, 8:00 New York when missing. */
export function plan(
  drafts: readonly Draft[],
  rules: Record<string, Rule>,
  prefs: ReadonlyMap<string, Record<string, Pref>>,
  now: Date,
  delivery: ReadonlyMap<string, Delivery> = new Map(),
): Row[] {
  const rows: Row[] = []
  const seen = new Set<string>()
  for (const d of drafts) {
    const t = TYPE_BY_KEY.get(d.type)
    const rule = rules[d.type]
    if (!t || !t.available || !rule) continue
    const key = `${d.personId}|${d.type}|${d.dedupeKey}`
    if (seen.has(key)) continue
    const eff = effective(t, rule, prefs.get(d.personId)?.[d.type])
    if (!eff.enabled) continue
    const { zone, hour } = delivery.get(d.personId) ?? {}
    const at = deliverAt(eff.timing, now, zone, hour)
    if (d.deliverDay && zoneDate(at, zone) !== d.deliverDay) continue
    seen.add(key)
    rows.push({
      person_id: d.personId, type_key: d.type, title: d.title, body: d.body, href: d.href,
      dedupe_key: d.dedupeKey, timing: eff.timing, deliver_at: at.toISOString(),
    })
  }
  return rows
}

export interface DeliverResult { drafts: number; rows: number; byType: Record<string, number>; error?: string }

export async function deliver(db: Client, drafts: readonly Draft[], opts: { now?: Date; dryRun?: boolean } = {}): Promise<DeliverResult & { planned?: Row[] }> {
  const now = opts.now ?? new Date()
  if (!drafts.length) return { drafts: 0, rows: 0, byType: {} }
  const people = [...new Set(drafts.map(d => d.personId))]
  const [{ rules }, prefs, delivery] = await Promise.all([loadRules(db), loadPrefs(db, people), loadDelivery(db, people)])
  const rows = plan(drafts, rules, prefs, now, delivery)
  const byType: Record<string, number> = {}
  for (const r of rows) byType[r.type_key] = (byType[r.type_key] ?? 0) + 1
  if (opts.dryRun) return { drafts: drafts.length, rows: rows.length, byType, planned: rows }

  for (let i = 0; i < rows.length; i += 500) {
    // Already there is the intended outcome for a repeat, not an error.
    const { error } = await db.from('notifications')
      .upsert(rows.slice(i, i + 500), { onConflict: 'person_id,type_key,dedupe_key', ignoreDuplicates: true })
    if (error) return { drafts: drafts.length, rows: i, byType, error: error.message }
  }
  return { drafts: drafts.length, rows: rows.length, byType }
}
