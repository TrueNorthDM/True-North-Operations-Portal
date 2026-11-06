/**
 * Reads and writes for Claude's settings and usage (migration 158). Server only,
 * like the rest of the Topic Studio store: every caller has asked the access rule
 * first and passes the service-key client.
 */

import type { createAdminClient } from '@/lib/supabase/admin'
import { readSettings, type TsSettings } from './settings'

type Db = ReturnType<typeof createAdminClient>

export async function loadSettings(db: Db): Promise<TsSettings> {
  const { data, error } = await db.from('ts_settings').select('value').eq('key', 'main').maybeSingle()
  if (error) throw new Error(`Settings could not be read: ${error.message}`)
  return readSettings(data?.value)
}

export async function saveSettings(db: Db, settings: TsSettings, actor: string): Promise<void> {
  const { error } = await db.from('ts_settings').upsert({ key: 'main', value: JSON.parse(JSON.stringify(settings)), updated_at: new Date().toISOString(), updated_by: actor })
  if (error) throw new Error(`Settings could not be saved: ${error.message}`)
}

export interface UsageRow {
  person_id: string
  topic_id: string
  topic_name: string
  feature: string
  model: string
  ok: boolean
  error: string
  input_tokens: number
  output_tokens: number
  ms: number
}

export async function logUsage(db: Db, row: UsageRow): Promise<void> {
  const { error } = await db.from('ts_ai_usage').insert(row)
  // The log must never fail a run that worked.
  if (error) console.error('[topic-studio] usage log', error.message)
}

/** How many successful runs a person has made since `since` (an ISO time). */
export async function usageSince(db: Db, person: string, since: string): Promise<number> {
  const { count, error } = await db.from('ts_ai_usage').select('id', { count: 'exact', head: true }).eq('person_id', person).eq('ok', true).gte('at', since)
  if (error) throw new Error(`Usage could not be read: ${error.message}`)
  return count ?? 0
}

/** When a person last ran a feature (any outcome), or null. */
export async function lastRunAt(db: Db, person: string, feature: string): Promise<number | null> {
  const { data, error } = await db.from('ts_ai_usage').select('at').eq('person_id', person).eq('feature', feature).order('at', { ascending: false }).limit(1)
  if (error) throw new Error(`Usage could not be read: ${error.message}`)
  return data?.[0] ? Date.parse(data[0].at) : null
}

export interface UsageLine { id: number; at: string; person: string; topic: string; feature: string; model: string; ok: boolean; error: string; tokens: number; ms: number }

/** The newest runs for the usage log. */
export async function recentUsage(db: Db, limit = 200): Promise<UsageLine[]> {
  const { data, error } = await db.from('ts_ai_usage').select('id, at, person_id, topic_name, feature, model, ok, error, input_tokens, output_tokens, ms').order('at', { ascending: false }).limit(limit)
  if (error) throw new Error(`Usage could not be read: ${error.message}`)
  const ids = [...new Set((data ?? []).map(r => r.person_id).filter((x): x is string => !!x))]
  const names = new Map<string, string>()
  if (ids.length) {
    const p = await db.from('people').select('id, full_name').in('id', ids)
    for (const r of p.data ?? []) names.set(r.id, r.full_name ?? '')
  }
  return (data ?? []).map(r => ({ id: r.id, at: r.at, person: names.get(r.person_id ?? '') ?? '', topic: r.topic_name, feature: r.feature, model: r.model, ok: r.ok, error: r.error, tokens: r.input_tokens + r.output_tokens, ms: r.ms }))
}
