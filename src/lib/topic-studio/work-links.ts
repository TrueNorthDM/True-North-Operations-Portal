/**
 * Topic Studio topics by Monday item (phase 2, 6 November 2026): a topic keeps
 * the link of its Monday task (Setup > Monday task link), so My Work can show
 * a task's topic beside its name. Pure parsing plus one small read; used only
 * for people who can open Topic Studio, and a writer is shown only topics that
 * are shared with writers.
 */

import type { createAdminClient } from '@/lib/supabase/admin'
import type { TopicRole } from './store'

type Db = ReturnType<typeof createAdminClient>

/** The Monday item id inside a task link (.../boards/123/pulses/456 gives 456), or null. */
export function pulseId(url: string | null | undefined): number | null {
  const m = /\/pulses\/(\d{1,15})(?:[/?#]|$)/.exec(String(url ?? ''))
  return m ? Number(m[1]) : null
}

/** Item id to topic id, for the topics this role may open. */
export async function topicsByItem(db: Db, role: TopicRole): Promise<Map<number, string>> {
  let q = db.from('ts_topics').select('id, monday_url').eq('archived', false).not('monday_url', 'is', null)
  if (role === 'writer') q = q.eq('shared', true)
  const { data, error } = await q.limit(2000)
  if (error) throw new Error(`Topics could not be read: ${error.message}`)
  const out = new Map<number, string>()
  for (const t of data ?? []) { const p = pulseId(t.monday_url); if (p != null && !out.has(p)) out.set(p, t.id) }
  return out
}
