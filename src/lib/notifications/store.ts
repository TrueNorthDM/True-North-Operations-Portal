/**
 * Reading and writing the notification tables (migrations 088 and 092), always with the
 * privileged client. Who is asking is decided before this is called: the
 * directory person behind a login is usually found by email, which row-level
 * security cannot see, so the tables are closed to the signed-in role and the
 * server acts for the person it has already identified.
 *
 * Every reader degrades to "nothing" while the migration has not been run, so
 * the portal keeps working and the settings page can say what is missing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { NOTIFICATION_TYPES, defaultRule, type Channel, type Pref, type Rule, type Timing } from './catalogue'
import { validZone } from './schedule'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

/** The error Postgres gives for a table that does not exist yet. */
export const missingTable = (e: { code?: string; message?: string } | null | undefined): boolean =>
  !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|could not find the table/i.test(e.message ?? ''))

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
  ...(r.channel ? { channel: r.channel } : {}),
})

/** Every type's rule: what an admin saved, else the catalogue's default. */
export async function loadRules(db: Client): Promise<{ rules: Record<string, Rule>; ready: boolean }> {
  const rules = Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, defaultRule(t)]))
  const { data, error } = await db.from('notification_rules').select('*')
  if (error) return { rules, ready: !missingTable(error) }
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
    if (error) break
    for (const r of (data ?? []) as PrefRow[]) {
      const mine = out.get(r.person_id) ?? out.set(r.person_id, {}).get(r.person_id)!
      mine[r.type_key] = rowToPref(r)
    }
  }
  return out
}

/** Kept state between runs: what has already been seen, so it is told once. */
export async function readState<T>(db: Client, key: string): Promise<T | null> {
  const { data, error } = await db.from('notification_state').select('value').eq('key', key).maybeSingle()
  if (error || !data) return null
  return (data as { value: T }).value
}

export async function writeState(db: Client, key: string, value: unknown): Promise<void> {
  await db.from('notification_state').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

/**
 * Each person's own time zone (person_settings, migration 092), only for those
 * who chose one. Missing, or not there yet, means the company's.
 */
export async function loadZones(db: Client, personIds: readonly string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  for (let i = 0; i < personIds.length; i += 200) {
    const { data, error } = await db.from('person_settings').select('person_id, time_zone').in('person_id', personIds.slice(i, i + 200))
    if (error) break
    for (const r of (data ?? []) as { person_id: string; time_zone: string | null }[]) {
      if (r.time_zone) out.set(r.person_id, validZone(r.time_zone))
    }
  }
  return out
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
