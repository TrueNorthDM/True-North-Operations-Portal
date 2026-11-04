/**
 * The annual review and Google Drive (design handoff, A1, A2, E5), through
 * office@'s account like the invoices and receipts (lib/agenda/google-drive.ts):
 *
 *   - last year's reviews: the files picked in Drive are read once and kept in
 *     the portal as PDFs (a Word file is turned into a PDF by Drive itself),
 *     so anyone who may see the review can open the reference, with or
 *     without access to HR's folder;
 *   - the approved PDF: written into the folder picked in Company settings >
 *     Human Resources, inside a folder for the year; with none picked, into
 *     the portal's own folder under "Annual Performance Reviews".
 *
 * Files are kept in the private receipts bucket under reviews/, written
 * through the internal address (the firewall refuses binary uploads on the
 * public one).
 */

import { readOldReview } from './old-review'
import { createAdminClient, createUploadClient } from '@/lib/supabase/admin'
import { driveAccount, driveToken, ensurePath, pickedFolder, writeFile, DriveError } from '@/lib/agenda/google-drive'
import { rdb, type ImportRow } from './data'

const FILES = 'https://www.googleapis.com/drive/v3/files'
const BUCKET = 'receipts'
export const importPath = (id: number) => `reviews/imports/${id}.pdf`
export const reviewPdfPath = (id: number) => `reviews/approved/${id}.pdf`

async function get(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000), headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  if (!res.ok) {
    const j = await res.json().catch(() => null) as { error?: { message?: string } } | null
    throw new DriveError(res.status, `Drive answered ${res.status}: ${j?.error?.message ?? 'no detail'}`)
  }
  return res
}

/**
 * A Drive file as PDF bytes, and its text when Drive can give it: a PDF as it
 * is (no text), a Google Doc exported, a Word file converted by Drive (a copy
 * made, exported twice and removed). The text is what the portal reads the
 * goals and the Job Description from (lib/review/old-review.ts).
 */
async function asDoc(token: string, fileId: string): Promise<{ pdf: Uint8Array; text: string | null }> {
  const meta = await (await get(token, `${FILES}/${encodeURIComponent(fileId)}?fields=id,name,mimeType&supportsAllDrives=true`)).json() as { mimeType: string }
  if (meta.mimeType === 'application/pdf') return { pdf: new Uint8Array(await (await get(token, `${FILES}/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`)).arrayBuffer()), text: null }
  const both = async (id: string) => ({
    pdf: new Uint8Array(await (await get(token, `${FILES}/${encodeURIComponent(id)}/export?mimeType=application/pdf`)).arrayBuffer()),
    text: await (await get(token, `${FILES}/${encodeURIComponent(id)}/export?mimeType=text/plain`)).text().catch(() => null),
  })
  if (meta.mimeType === 'application/vnd.google-apps.document') return both(fileId)
  const copy = await (await get(token, `${FILES}/${encodeURIComponent(fileId)}/copy?supportsAllDrives=true&fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mimeType: 'application/vnd.google-apps.document', name: 'Portal import (temporary)' }),
  })).json() as { id: string }
  try {
    return await both(copy.id)
  } finally {
    await fetch(`${FILES}/${encodeURIComponent(copy.id)}?supportsAllDrives=true`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
  }
}

/**
 * What a file says, kept on its import row and as the person's goals of the
 * year after it (locked in their review; HR corrects them on the import
 * screen). Reading again replaces what an earlier read found.
 */
export async function keepWhatItSays(row: { id: number; year: number; person_id: string | null }, text: string | null, by: string): Promise<{ goals: number; job: number }> {
  const found = text ? readOldReview(text, row.year + 1) : { goals: [], job: {} }
  const fail = (what: string, e: { message: string } | null) => { if (e) throw new Error(`${what}: ${e.message}`) }
  fail('import row', (await rdb().from('review_imports').update({ found: { read: !!text, job: found.job, goals: found.goals.length } }).eq('id', row.id)).error)
  fail('old goals', (await rdb().from('review_goals').delete().eq('import_id', row.id)).error)
  if (row.person_id && found.goals.length) {
    const rows = found.goals.map((g, i) => ({
      person_id: row.person_id, goal_year: row.year + 1, position: i, what: g.what, how: '', by_month: g.byMonth, term: null, priority_id: null,
      result: null, result_comment: '', import_id: row.id, added_by: by,
    }))
    fail('goals', (await rdb().from('review_goals').insert(rows)).error)
  }
  return { goals: found.goals.length, job: Object.keys(found.job).length }
}

/** Imports every matched file of the year not imported yet. */
export async function importReviewFiles(year: number, by: string): Promise<{ ok: true; done: number; failed: number } | { ok: false; error: string }> {
  const acc = await driveAccount()
  if (!acc.ok) return { ok: false, error: acc.why }
  const token = await driveToken()
  if (!token) return { ok: false, error: `${acc.email} needs to be connected again in Agenda settings.` }
  const rows = ((await rdb().from('review_imports').select('*').eq('year', year).is('imported_at', null).not('person_id', 'is', null).in('match', ['matched', 'check'])).data ?? []) as ImportRow[]
  let done = 0, failed = 0
  for (const r of rows) {
    try {
      const doc = await asDoc(token, r.drive_file_id)
      const up = await createUploadClient().storage.from(BUCKET).upload(importPath(r.id), Buffer.from(doc.pdf), { contentType: 'application/pdf', upsert: true })
      if (up.error) throw new Error(up.error.message)
      await rdb().from('review_imports').update({ imported_at: new Date().toISOString(), imported_by: by, match: 'matched' }).eq('id', r.id)
      await keepWhatItSays(r, doc.text, by)
      done++
    } catch (e) {
      failed++
      console.error('[review] import:', r.file_name, e instanceof Error ? e.message : e)
    }
  }
  return { ok: true, done, failed }
}

/** A stored PDF's bytes (an imported review or an approved one), or null. */
export async function storedPdf(path: string): Promise<Uint8Array | null> {
  const { data, error } = await createAdminClient().storage.from(BUCKET).download(path)
  if (error || !data) return null
  return new Uint8Array(await data.arrayBuffer())
}

export async function storePdf(path: string, bytes: Uint8Array): Promise<void> {
  const up = await createUploadClient().storage.from(BUCKET).upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true })
  if (up.error) throw new Error(up.error.message)
}

/** Writes the approved PDF into the HR folder / year. Returns the Drive file id. */
export async function writeApprovedPdf(f: { name: string; year: number; bytes: Uint8Array; fileId: string | null; folderId: string | null }): Promise<string> {
  const acc = await driveAccount()
  if (!acc.ok) throw new Error(acc.why)
  const token = await driveToken()
  if (!token) throw new Error(`${acc.email} needs to be connected again in Agenda settings.`)
  let parent: string
  if (f.folderId) {
    try {
      parent = await ensurePath(token, f.folderId, [String(f.year)])
    } catch (e) {
      if (e instanceof DriveError && e.status === 404) throw new Error('Drive did not find the folder.')
      throw e
    }
  } else {
    const root = await pickedFolder()
    if (!root) throw new Error('No Drive folder is picked yet. Pick one in Company settings > Human Resources.')
    parent = await ensurePath(token, root.id, ['Annual Performance Reviews', String(f.year)])
  }
  const done = await writeFile(token, parent, { name: f.name, mime: 'application/pdf', bytes: f.bytes }, f.fileId)
  return done.id
}
