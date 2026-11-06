/**
 * Topic Studio import (phase 0, 5 November 2026): reading one .topic-studio.json
 * file, the export of the Topic Studio Artifact ("Export for writer"), and
 * deciding what an import of it does.
 *
 * The file is { kind: 'topic-studio-writer', v, exportedAt, project, pages,
 * client, feedback, features }. The project is kept whole in ts_topics.data, so
 * nothing the Artifact knows is lost before each tab is built on it; the few
 * fields the list needs get their own columns.
 *
 * What an import does with each file, against the topic already here with the
 * same Artifact id:
 *   new      no such topic yet: it is added.
 *   updated  the file differs: the topic is replaced, the old one kept in its
 *            history (migration 155, ts_import_topic).
 *   same     nothing changed since the last import: left alone.
 *   older    the file was saved in the Artifact before the copy here: left
 *            alone, so an old download never overwrites newer work.
 *
 * As the Artifact's own import does, a file without a draft keeps the draft
 * already here (a writer's work is never lost to a fresh export).
 *
 * Pure apart from the hash: the route (app/(app)/seo/topic-studio/import) and
 * the tests call it.
 */

import { createHash } from 'node:crypto'

export const EXPORT_KIND = 'topic-studio-writer'
/** Bigger than any real export (they are 100 to 400 KB), small enough to read at once. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_FILES = 25

export type ImportStatus = 'new' | 'updated' | 'same' | 'older'

export interface ImportPage {
  artifact_id: string | null
  kind: string
  url: string
  title: string
  data: Record<string, unknown>
  captured_at: string | null
}

export interface ImportTopic {
  artifact_id: string
  client: { code: string; name: string; profile: Record<string, unknown> }
  topic: string
  primary_keyphrase: string
  monday_url: string | null
  shared: boolean
  archived: boolean
  data: Record<string, unknown>
  artifact_updated_at: string | null
  content_hash: string
  pages: ImportPage[]
}

/** What the import needs to know about the topic already here. */
export interface Existing {
  content_hash: string | null
  artifact_updated_at: string | null
  draft: string
}

const BAD = 'This is not a Topic Studio topic file. Export it from the Artifact with "Export for writer".'

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, max = 2000): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
/** A millisecond time from the Artifact, as an ISO date, or null. */
const when = (v: unknown): string | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? new Date(v).toISOString() : null)

/** Stable JSON: keys sorted, so the same content always hashes the same. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (isObj(v)) return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  return JSON.stringify(v ?? null)
}

/**
 * The file read and checked, or the sentence to show. Only http(s) Monday
 * links are kept; the id must be the Artifact's short id.
 */
export function parseTopicFile(text: string): ImportTopic | string {
  let pkg: unknown
  try { pkg = JSON.parse(text) } catch { return BAD }
  if (!isObj(pkg) || pkg.kind !== EXPORT_KIND || !isObj(pkg.project)) return BAD
  const p = pkg.project
  const id = str(p.id, 64)
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return BAD

  const c = isObj(pkg.client) ? pkg.client : {}
  const code = str(c.code, 16) || str(p.client, 16)
  if (!/^[A-Za-z0-9_-]+$/.test(code)) return 'The file does not say which client the topic is for.'
  const { code: _code, name: cName, ...profile } = c
  void _code

  const topic = str(p.topic, 300)
  if (!topic) return 'The topic in this file has no name (Monday task name).'
  const monday = str(p.monday, 1000)

  const pages: ImportPage[] = (Array.isArray(pkg.pages) ? pkg.pages : []).filter(isObj).map(pg => {
    const { id: pid, kind, url, title, captured, ...rest } = pg
    return {
      artifact_id: str(pid, 64) || null,
      kind: str(kind, 32) || 'competitor',
      url: str(url, 2000),
      title: str(title, 500),
      data: rest,
      captured_at: when(captured),
    }
  })

  // The project as exported, with the export's own extras alongside. importedAt
  // (set by a writer's offline copy) is not content.
  const { importedAt: _imp, ...project } = p
  void _imp
  const data: Record<string, unknown> = { ...project, exported: { v: pkg.v ?? 1, at: when(pkg.exportedAt), feedback: pkg.feedback ?? null, features: pkg.features ?? null } }
  const content_hash = createHash('sha256').update(stable({ project, pages: pkg.pages ?? [] })).digest('hex')

  return {
    artifact_id: id,
    client: { code, name: str(cName, 200) || code, profile },
    topic,
    primary_keyphrase: str(p.primary, 300),
    monday_url: /^https?:\/\//i.test(monday) ? monday : null,
    shared: p.shared === true,
    archived: p.archived === true,
    data,
    artifact_updated_at: when(p.updated),
    content_hash,
    pages,
  }
}

/** What importing this file would do, given the topic already here (or none). */
export function importStatus(file: ImportTopic, existing: Existing | null): ImportStatus {
  if (!existing) return 'new'
  if (existing.content_hash === file.content_hash) return 'same'
  if (file.artifact_updated_at && existing.artifact_updated_at && Date.parse(file.artifact_updated_at) < Date.parse(existing.artifact_updated_at)) return 'older'
  return 'updated'
}

/** The draft in a topic's data, as the Artifact keeps it. */
export const draftOf = (data: unknown): string => (isObj(data) && typeof data.draftHtml === 'string' ? data.draftHtml : '')

/** The file as it will be written: a file without a draft keeps the one here. */
export function withKeptDraft(file: ImportTopic, existing: Existing | null): ImportTopic {
  if (!existing?.draft || draftOf(file.data)) return file
  return { ...file, data: { ...file.data, draftHtml: existing.draft } }
}

/** One line under the file name in the import list. */
export function fileSummary(file: ImportTopic): string {
  const terms = Array.isArray(file.data.terms) ? file.data.terms.length : 0
  const competitors = file.pages.filter(p => p.kind === 'competitor').length
  const words = draftOf(file.data).replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
  const parts = [`${terms} terms`, `${competitors} competitor page${competitors === 1 ? '' : 's'}`]
  if (words) parts.push(`a draft of ${words.toLocaleString('en-US')} words`)
  return parts.join(', ')
}
