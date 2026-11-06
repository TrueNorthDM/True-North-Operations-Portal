/**
 * Topic Studio's reads and writes (migration 155). The tables are server only:
 * every caller has asked the access rule first (the page and the import route),
 * and passes the service-key client.
 *
 * Who sees which topic (owner, 5 November 2026):
 *   SEO      (topic-studio-seo)  every topic not archived.
 *   Writer   (topic-studio)      only topics shared with writers, not archived.
 */

import type { createAdminClient } from '@/lib/supabase/admin'
import type { Existing, ImportTopic } from './import-file'
import { draftOf } from './import-file'

type Db = ReturnType<typeof createAdminClient>

export type TopicRole = 'seo' | 'writer'

/** The role a person has in Topic Studio, from the two tools; null when neither opens. */
export function topicRole(canTool: (key: string) => boolean): TopicRole | null {
  if (canTool('topic-studio-seo')) return 'seo'
  if (canTool('topic-studio')) return 'writer'
  return null
}

export interface TopicRow {
  id: string
  client_code: string
  topic: string
  primary_keyphrase: string
  shared: boolean
  updated_at: string
}

export interface ClientRow { code: string; name: string }

const LIST = 'id, client_code, topic, primary_keyphrase, shared, updated_at'

/** The topics a role sees, newest first, and the clients they belong to. */
export async function listTopics(db: Db, role: TopicRole): Promise<{ topics: TopicRow[]; clients: ClientRow[] }> {
  let q = db.from('ts_topics').select(LIST).eq('archived', false)
  if (role === 'writer') q = q.eq('shared', true)
  const [t, c] = await Promise.all([q.order('updated_at', { ascending: false }).limit(1000), db.from('ts_clients').select('code, name').order('code')])
  if (t.error) throw new Error(`Topics could not be read: ${t.error.message}`)
  if (c.error) throw new Error(`Clients could not be read: ${c.error.message}`)
  return { topics: (t.data ?? []) as TopicRow[], clients: (c.data ?? []) as ClientRow[] }
}

export interface TopicFull extends TopicRow {
  monday_url: string | null
  archived: boolean
  data: Record<string, unknown>
  artifact_updated_at: string | null
  imported_at: string | null
  client_name: string
  pages: number
}

/** One topic, or null when it does not exist or the role may not open it. */
export async function readTopic(db: Db, id: string, role: TopicRole): Promise<TopicFull | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data, error } = await db.from('ts_topics')
    .select(`${LIST}, monday_url, archived, data, artifact_updated_at, imported_at`)
    .eq('id', id).maybeSingle()
  if (error) throw new Error(`The topic could not be read: ${error.message}`)
  if (!data || data.archived || (role === 'writer' && !data.shared)) return null
  const [client, pages] = await Promise.all([
    db.from('ts_clients').select('name').eq('code', data.client_code).maybeSingle(),
    db.from('ts_pages').select('id', { count: 'exact', head: true }).eq('topic_id', id),
  ])
  return {
    ...(data as Omit<TopicFull, 'client_name' | 'pages' | 'data'>),
    data: (data.data ?? {}) as Record<string, unknown>,
    client_name: client.data?.name ?? data.client_code,
    pages: pages.count ?? 0,
  }
}

/** The topics already here with these Artifact ids, as the import compares them. */
export async function existingByArtifact(db: Db, ids: readonly string[]): Promise<Map<string, Existing>> {
  const out = new Map<string, Existing>()
  if (!ids.length) return out
  const { data, error } = await db.from('ts_topics').select('artifact_id, content_hash, artifact_updated_at, data').in('artifact_id', [...ids])
  if (error) throw new Error(`Topics could not be read: ${error.message}`)
  for (const r of data ?? []) {
    if (r.artifact_id) out.set(r.artifact_id, { content_hash: r.content_hash, artifact_updated_at: r.artifact_updated_at, draft: draftOf(r.data) })
  }
  return out
}

/** Writes one topic (all or nothing, ts_import_topic); returns its id. */
export async function writeTopic(db: Db, file: ImportTopic, personId: string): Promise<string> {
  const { data, error } = await db.rpc('ts_import_topic', { payload: JSON.parse(JSON.stringify(file)), actor: personId })
  if (error || !data) throw new Error(error?.message ?? 'no id returned')
  return data
}
