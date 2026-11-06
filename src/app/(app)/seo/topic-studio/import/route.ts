/**
 * POST /seo/topic-studio/import: Topic Studio's import of .topic-studio.json
 * files (phase 0, 5 November 2026). A route and not a server action, because
 * a few exports together are bigger than a server action takes.
 *
 * The form carries the files (`files`, one or more) and `mode`:
 *   preview  reads each file and says what importing it would do (new,
 *            updated, same, older) or why it cannot be read. Writes nothing.
 *   commit   imports the new and updated ones; same and older are left alone.
 *            Each topic is written all or nothing (ts_import_topic), the old
 *            one kept in its history.
 *
 * SEO research (topic-studio-seo) only, the person really signed in, never a
 * View Stage preview.
 */

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROUTES } from '@/lib/nav/routes'
import { MAX_FILE_BYTES, MAX_FILES, fileSummary, importStatus, parseTopicFile, withKeptDraft, type ImportStatus, type ImportTopic } from '@/lib/topic-studio/import-file'
import { existingByArtifact, writeTopic } from '@/lib/topic-studio/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export interface ImportFileResult {
  name: string
  status: ImportStatus | 'error'
  /** The client code and topic name, when the file could be read. */
  client?: string
  topic?: string
  /** Terms, pages and draft, or why the file could not be read or saved. */
  note: string
}

const no = (error: string, status = 400) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  const access = await writerAccess()
  if (!access) return no('Sign in again to import. A View Stage preview cannot import.', 401)
  if (!access.canTool('topic-studio-seo')) return no('Importing topics is open to the SEO team.', 403)
  if (!access.personId) return no('Your login is not linked to anyone in the Directory.', 403)

  let form: FormData
  try { form = await request.formData() } catch { return no('The files could not be read. Try again.') }
  const mode = form.get('mode') === 'commit' ? 'commit' : 'preview'
  const files = form.getAll('files').filter((f): f is File => f instanceof File)
  if (!files.length) return no('Choose at least one .topic-studio.json file.')
  if (files.length > MAX_FILES) return no(`Import up to ${MAX_FILES} files at a time.`)

  const read: { name: string; file: ImportTopic | string }[] = []
  for (const f of files) {
    const name = f.name.slice(0, 200)
    if (f.size > MAX_FILE_BYTES) { read.push({ name, file: 'This file is too big for a topic export.' }); continue }
    read.push({ name, file: parseTopicFile(await f.text()) })
  }

  const c = createAdminClient()
  const ok = read.filter((r): r is { name: string; file: ImportTopic } => typeof r.file !== 'string')
  // The same topic twice in one go: only the first counts.
  const seen = new Set<string>()
  let existing
  try { existing = await existingByArtifact(c, ok.map(r => r.file.artifact_id)) } catch (e) { return no((e as Error).message, 500) }

  const results: ImportFileResult[] = []
  let imported = 0
  for (const r of read) {
    if (typeof r.file === 'string') { results.push({ name: r.name, status: 'error', note: r.file }); continue }
    const f = r.file
    const base = { name: r.name, client: f.client.code, topic: f.topic }
    if (seen.has(f.artifact_id)) { results.push({ ...base, status: 'error', note: 'The same topic is in another file of this import.' }); continue }
    seen.add(f.artifact_id)
    const here = existing.get(f.artifact_id) ?? null
    const status = importStatus(f, here)
    const note = status === 'same' ? 'Already here, no changes.'
      : status === 'older' ? 'Older than the copy here, left alone.'
      : `${status === 'updated' ? 'Already here, changed. ' : ''}${fileSummary(f)}.`
    if (mode === 'commit' && (status === 'new' || status === 'updated')) {
      try { await writeTopic(c, withKeptDraft(f, here), access.personId); imported++ }
      catch (e) { results.push({ ...base, status: 'error', note: `Not saved: ${(e as Error).message}` }); continue }
    }
    results.push({ ...base, status, note })
  }

  if (imported) revalidatePath(ROUTES.topicStudio)
  return NextResponse.json({ mode, imported, files: results })
}
