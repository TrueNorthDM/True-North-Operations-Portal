/**
 * Reading and writing the notification tables (migrations 088 and 092), always with the
 * privileged client. Who is asking is decided before this is called: the
 * directory person behind a login is usually found by email, which row-level
 * security cannot see, so the tables are closed to the signed-in role and the
 * server acts for the person it has already identified.
 *
 * Every reader degrades to "nothing" while the migration has not been run, so
 * the portal keeps working and the settings page can say what is missing. Any
 * other failed read throws (audit, 9 October 2026): falling back to the
 * catalogue's defaults would deliver a type an admin or the person turned off,
 * and at the wrong hour.
 */

import type { Json } from '@/lib/types/database.types'
import type { Db } from '@/lib/supabase/types'
import { NOTIFICATION_TYPES, defaultRule, type Channel, type Pref, type Rule, type Timing } from './catalogue'
import { loadSettingsFor } from '@/lib/settings/person'

type Client = Db

export { missingTable } from '@/lib/supabase/errors'
import { missingTable } from '@/lib/supabase/errors'

type RuleRow = {
  type_key: string; enabled: boolean; timing: Timing; channel: Channel
  fix_enabled: boolean; fix_timing: boolean; fix_channel: boolean
}
type PrefRow = { person_id: string; type_key: string; enabled: boolean | null; timing: Timing | null; channel: Channel | null }

export const ruleToRow = (key: string, r: Rule) => ({
  type_key: key, enabled: r.enabled, timing: r.timing, channel: r.channel,
  fix_enabled: r.fixEnabled, fix_timing: r.fixTiming, fix_channel: r.fixChannel,
})

const rowToPref = (r: PrefRow): Pref => ({
  ...(r.enabled != null ? { enabled: r.enabled } : {}),
  ...(r.timing ? { timing: r.timing } : {}),
})

/** Every type's rule: what an admin saved, else the catalogue's default. */
export async function loadRules(db: Client): Promise<{ rules: Record<string, Rule>; ready: boolean }> {
  const rules = Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, defaultRule(t)]))
  const { data, error } = await db.from('notification_rules').select('*')
  if (error) {
    if (missingTable(error)) return { rules, ready: false }
    throw new Error(`The notification rules could not be read: ${error.message}`)
  }
  for (const r of (data ?? []) as RuleRow[]) {
    if (!rules[r.type_key]) continue
    rules[r.type_key] = {
      enabled: r.enabled, timing: r.timing, channel: r.channel,
      fixEnabled: r.fix_enabled, fixTiming: r.fix_timing, fixChannel: r.fix_channel,
    }
  }
  return { rules, ready: true }
}

/** Choices per person, then per type. */
export async function loadPrefs(db: Client, personIds: readonly string[]): Promise<Map<string, Record<string, Pref>>> {
  const out = new Map<string, Record<string, Pref>>()
  for (let i = 0; i < personIds.length; i += 200) {
    const { data, error } = await db.from('notification_prefs').select('*').in('person_id', personIds.slice(i, i + 200))
    if (error) {
      if (missingTable(error)) break
      throw new Error(`Notification choices could not be read: ${error.message}`)
    }
    for (const r of (data ?? []) as PrefRow[]) {
      const mine = out.get(r.person_id) ?? out.set(r.person_id, {}).get(r.person_id)!
      mine[r.type_key] = rowToPref(r)
    }
  }
  return out
}

/**
 * Kept state between runs: what has already been seen, so it is told once.
 * Null means no state yet (the first run); a failed read throws, so it is
 * never taken for a first run that would swallow what happened since.
 */
export async function readState<T>(db: Client, key: string): Promise<T | null> {
  const { data, error } = await db.from('notification_state').select('value').eq('key', key).maybeSingle()
  if (error) throw new Error(`Notification state "${key}" could not be read: ${error.message}`)
  if (!data) return null
  return (data as { value: T }).value
}

export async function writeState(db: Client, key: string, value: unknown): Promise<void> {
  const { error } = await db.from('notification_state').upsert({ key, value: value as Json, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) throw new Error(`Notification state "${key}" could not be saved: ${error.message}`)
}

/** When a person's daily summary lands: their time zone and hour. */
export interface Delivery { zone: string; hour: number }

/**
 * Each person's summary time (person_settings, migrations 092 and 093). Anyone
 * missing, or everyone before the migration, gets 8:00 New York. `strict`
 * (sending): a failed read throws instead of putting everyone on 8:00 New York.
 */
export async function loadDelivery(db: Client, personIds: readonly string[], opts: { strict?: boolean } = {}): Promise<Map<string, Delivery>> {
  const settings = await loadSettingsFor(db, personIds, opts)
  return new Map([...settings].map(([id, s]) => [id, { zone: s.timeZone, hour: s.summaryHour }]))
}

/**
 * How many people switched each notification off (prefs with enabled false),
 * for the admin's "Turned off by" column. Only people in `among` count, so a
 * choice left behind by someone the type no longer reaches is not counted.
 */
export async function loadOffCounts(db: Client, among: (typeKey: string, personId: string) => boolean): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  const { data, error } = await db.from('notification_prefs').select('person_id, type_key').eq('enabled', false)
  if (error) return out
  for (const r of (data ?? []) as { person_id: string; type_key: string }[]) {
    if (among(r.type_key, r.person_id)) out[r.type_key] = (out[r.type_key] ?? 0) + 1
  }
  return out
}
