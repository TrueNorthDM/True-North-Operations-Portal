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
import { readPage, readProject, type Project, type TopicPage } from './project'

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

/* Phase 1: the topic as the tabs work on it, and the writes they make. */


export interface ClientFull { code: string; name: string; heading: string; faith: boolean; about: string; orig: string }

const profileOf = (code: string, name: string, profile: unknown): ClientFull => {
  const p = profile && typeof profile === 'object' ? (profile as Record<string, unknown>) : {}
  const s = (v: unknown) => (typeof v === 'string' ? v : '')
  return { code, name, heading: s(p.heading) || `${code} Topic`, faith: p.faith === true, about: s(p.about), orig: s(p.orig) }
}

export async function listClientsFull(db: Db): Promise<ClientFull[]> {
  const { data, error } = await db.from('ts_clients').select('code, name, profile').order('code')
  if (error) throw new Error(`Clients could not be read: ${error.message}`)
  return (data ?? []).map(c => profileOf(c.code, c.name, c.profile))
}

export interface DraftRow { html: string; version: number; updatedAt: string | null; updatedBy: string | null }

export interface Bundle {
  id: string
  project: Project
  draft: DraftRow
  pages: TopicPage[]
  client: ClientFull
  archived: boolean
  updatedAt: string
  importedAt: string | null
}

/** A topic with its captured pages, or null when it does not exist or the role may not open it. */
export async function loadBundle(db: Db, id: string, role: TopicRole): Promise<Bundle | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [t, pg, dr] = await Promise.all([
    db.from('ts_topics').select('id, client_code, topic, primary_keyphrase, monday_url, shared, archived, data, updated_at, imported_at').eq('id', id).maybeSingle(),
    db.from('ts_pages').select('artifact_id, kind, url, title, data, captured_at, position').eq('topic_id', id).order('position'),
    db.from('ts_drafts').select('html, version, updated_at, updated_by').eq('topic_id', id).maybeSingle(),
  ])
  if (dr.error) throw new Error(`The draft could not be read: ${dr.error.message}`)
  if (t.error) throw new Error(`The topic could not be read: ${t.error.message}`)
  if (pg.error) throw new Error(`The captured pages could not be read: ${pg.error.message}`)
  const row = t.data
  if (!row || (role === 'writer' && (!row.shared || row.archived))) return null
  const c = await db.from('ts_clients').select('code, name, profile').eq('code', row.client_code).maybeSingle()
  const project = readProject(row)
  return {
    id: row.id,
    project,
    // A topic that has not been written in yet shows the draft an import brought (version 0).
    draft: dr.data ? { html: dr.data.html, version: dr.data.version, updatedAt: dr.data.updated_at, updatedBy: dr.data.updated_by } : { html: project.draftHtml, version: 0, updatedAt: null, updatedBy: null },
    pages: (pg.data ?? []).map(readPage),
    client: c.data ? profileOf(c.data.code, c.data.name, c.data.profile) : profileOf(row.client_code, row.client_code, null),
    archived: row.archived,
    updatedAt: row.updated_at,
    importedAt: row.imported_at,
  }
}

export type Cols = Partial<{ topic: string; primary_keyphrase: string; monday_url: string; client_code: string; shared: boolean; archived: boolean }>

/** Changes a topic in one statement (ts_patch_topic): keys of `patch` replace those of its data, a null removes one. */
export async function patchTopic(db: Db, id: string, patch: Record<string, unknown>, cols: Cols, actor: string): Promise<void> {
  const { error } = await db.rpc('ts_patch_topic', { p_topic: id, p_patch: JSON.parse(JSON.stringify(patch)), p_cols: cols, p_actor: actor })
  if (error) throw new Error(error.message === 'topic_not_found' ? 'That topic no longer exists.' : error.message)
}

export async function savePage(db: Db, id: string, payload: Record<string, unknown>, actor: string): Promise<void> {
  const { error } = await db.rpc('ts_save_page', { p_topic: id, p_page: JSON.parse(JSON.stringify(payload)), p_actor: actor })
  if (error) throw new Error(error.message === 'topic_not_found' ? 'That topic no longer exists.' : error.message)
}

/** Removes the captured pages of a topic whose address is `n` (normalised), and notes the change. */
export async function removePages(db: Db, id: string, ids: readonly number[]): Promise<void> {
  if (!ids.length) return
  const { error } = await db.from('ts_pages').delete().eq('topic_id', id).in('id', [...ids])
  if (error) throw new Error(`The capture could not be removed: ${error.message}`)
}

export async function createTopicRow(db: Db, input: { client: string; topic: string; primary: string }, actor: string): Promise<string> {
  const { data, error } = await db.from('ts_topics').insert({
    client_code: input.client, topic: input.topic, primary_keyphrase: input.primary, data: {}, shared: false, created_by: actor, updated_by: actor,
  }).select('id').single()
  if (error || !data) throw new Error(error?.message ?? 'The topic could not be created.')
  return data.id
}

export async function deleteTopicRow(db: Db, id: string): Promise<void> {
  const { error } = await db.from('ts_topics').delete().eq('id', id)
  if (error) throw new Error(`The topic could not be deleted: ${error.message}`)
}

/** Archived topics, newest first (SEO only: the list page shows them folded away). */
export async function listArchived(db: Db): Promise<TopicRow[]> {
  const { data, error } = await db.from('ts_topics').select(LIST).eq('archived', true).order('updated_at', { ascending: false }).limit(200)
  if (error) throw new Error(`Archived topics could not be read: ${error.message}`)
  return (data ?? []) as TopicRow[]
}

/** The ids of captured pages (rows) whose address is the competitor `n`, for removing a capture. */
export async function pageIdsByAddress(db: Db, id: string, matches: (url: string) => boolean): Promise<number[]> {
  const { data, error } = await db.from('ts_pages').select('id, url, kind').eq('topic_id', id)
  if (error) throw new Error(`The captured pages could not be read: ${error.message}`)
  return (data ?? []).filter(r => r.kind === 'competitor' && matches(r.url)).map(r => r.id)
}


/* Phase 2: the draft, its versions and what writers say about the term list. */

export interface DraftSave { saved: boolean; version: number; savedAt: string | null }

/** Saves the draft when the caller started from the current version (ts_save_draft); otherwise says which version is current. */
export async function saveDraftRow(db: Db, id: string, html: string, base: number, actor: string): Promise<DraftSave> {
  const { data, error } = await db.rpc('ts_save_draft', { p_topic: id, p_html: html, p_base: base, p_actor: actor })
  if (error) throw new Error(error.message === 'topic_not_found' ? 'That topic no longer exists.' : error.message)
  const r = (data ?? {}) as { ok?: boolean; version?: number; updated_at?: string }
  return { saved: r.ok === true, version: typeof r.version === 'number' ? r.version : base, savedAt: r.updated_at ?? null }
}

export type VersionKind = 'saved' | 'auto' | 'restore'

export async function addVersionRow(db: Db, id: string, kind: VersionKind, html: string, note: string, words: number, actor: string | null): Promise<void> {
  const { error } = await db.rpc('ts_add_version', { p_topic: id, p_kind: kind, p_html: html, p_note: note, p_words: words, p_actor: actor as string })
  if (error) throw new Error(`The version could not be saved: ${error.message}`)
}

export interface VersionInfo { id: number; savedAt: string; by: string; kind: VersionKind; note: string; words: number }

const nameOf = async (db: Db, ids: (string | null)[]): Promise<Map<string, string>> => {
  const uniq = [...new Set(ids.filter((x): x is string => !!x))]
  if (!uniq.length) return new Map()
  const { data, error } = await db.from('people').select('id, full_name').in('id', uniq)
  if (error) throw new Error(`Names could not be read: ${error.message}`)
  return new Map((data ?? []).map(p => [p.id, p.full_name ?? '']))
}

/** The versions of a draft, newest first, without their text. */
export async function listVersionRows(db: Db, id: string): Promise<VersionInfo[]> {
  const { data, error } = await db.from('ts_draft_versions').select('id, saved_at, saved_by, kind, note, words').eq('topic_id', id).order('saved_at', { ascending: false }).order('id', { ascending: false }).limit(40)
  if (error) throw new Error(`Versions could not be read: ${error.message}`)
  const names = await nameOf(db, (data ?? []).map(v => v.saved_by))
  return (data ?? []).map(v => ({ id: v.id, savedAt: v.saved_at, by: (v.saved_by && names.get(v.saved_by)) || 'Someone', kind: v.kind as VersionKind, note: v.note, words: v.words }))
}

export async function readVersionHtml(db: Db, id: string, versionId: number): Promise<string | null> {
  const { data, error } = await db.from('ts_draft_versions').select('html').eq('topic_id', id).eq('id', versionId).maybeSingle()
  if (error) throw new Error(`The version could not be read: ${error.message}`)
  return data?.html ?? null
}

/** When the newest version of a topic was taken, or null when there is none. */
export async function lastVersionAt(db: Db, id: string): Promise<string | null> {
  const { data, error } = await db.from('ts_draft_versions').select('saved_at').eq('topic_id', id).order('saved_at', { ascending: false }).limit(1)
  if (error) throw new Error(`Versions could not be read: ${error.message}`)
  return data?.[0]?.saved_at ?? null
}

export interface FeedbackRow { id: number; by: string; rating: 'good' | 'problems'; note: string; createdAt: string; resolved: boolean }

export async function addFeedbackRow(db: Db, id: string, rating: 'good' | 'problems', note: string, person: string): Promise<void> {
  const { error } = await db.from('ts_feedback').insert({ topic_id: id, person_id: person, kind: 'terms', rating, note })
  if (error) throw new Error(`The feedback could not be saved: ${error.message}`)
}

export async function listFeedbackRows(db: Db, id: string): Promise<FeedbackRow[]> {
  const { data, error } = await db.from('ts_feedback').select('id, person_id, rating, note, created_at, resolved_at').eq('topic_id', id).order('created_at', { ascending: false }).limit(100)
  if (error) throw new Error(`Feedback could not be read: ${error.message}`)
  const names = await nameOf(db, (data ?? []).map(f => f.person_id))
  return (data ?? []).map(f => ({ id: f.id, by: (f.person_id && names.get(f.person_id)) || 'Someone', rating: f.rating as 'good' | 'problems', note: f.note, createdAt: f.created_at, resolved: !!f.resolved_at }))
}

export async function resolveFeedbackRow(db: Db, topic: string, feedbackId: number, person: string, resolved: boolean): Promise<void> {
  const { error } = await db.from('ts_feedback').update(resolved ? { resolved_at: new Date().toISOString(), resolved_by: person } : { resolved_at: null, resolved_by: null }).eq('topic_id', topic).eq('id', feedbackId)
  if (error) throw new Error(`The feedback could not be updated: ${error.message}`)
}
