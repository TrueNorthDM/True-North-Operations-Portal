/**
 * Google Drive through office@ (owner, 30 October 2026): the portal writes
 * receipts and invoices into one Drive folder, picked by a Super Admin with
 * Google's Picker (Company settings > Integrations). office@ signs in once in
 * Agenda settings as the team calendar; its drive.file permission lets the
 * portal see only the picked folder and the files and folders it makes there.
 * Server only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { accessTokenFor } from './google-app'

const DRIVE_FILE = 'https://www.googleapis.com/auth/drive.file'
const FILES = 'https://www.googleapis.com/drive/v3/files'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
export const FOLDER_MIME = 'application/vnd.google-apps.folder'

/** office@'s account, when it is connected and allowed Drive; and why not, when not. */
export async function driveAccount(): Promise<{ ok: true; accountId: number; email: string } | { ok: false; why: string }> {
  const c = createAdminClient()
  const { data: a } = await c.from('agenda_accounts').select('id, email, status').eq('team_calendar', true).eq('source', 'google').maybeSingle()
  if (!a) return { ok: false, why: 'Connect office@ as the team calendar in Agenda settings first.' }
  if (a.status !== 'connected') return { ok: false, why: `${a.email} needs to be connected again in Agenda settings.` }
  const { data: t } = await c.from('agenda_account_tokens').select('scopes').eq('account_id', a.id).maybeSingle()
  if (!(t?.scopes ?? []).includes(DRIVE_FILE)) return { ok: false, why: `${a.email} did not allow Drive. Reconnect it in Agenda settings and leave the Drive box ticked.` }
  return { ok: true, accountId: a.id as number, email: a.email as string }
}

/** A short-lived token for office@'s Drive: the Picker runs with it in the Super Admin's browser. */
export async function driveToken(): Promise<string | null> {
  const a = await driveAccount()
  return a.ok ? accessTokenFor(a.accountId) : null
}

/** A name safe inside a Drive query string. */
export const quoted = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** Drive's answer when it is not a success, with its status (404: the file is gone). */
export class DriveError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function call(token: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000), headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  const json = await res.json().catch(() => null) as { error?: { message?: string } } | null
  if (!res.ok) throw new DriveError(res.status, `Drive answered ${res.status}: ${json?.error?.message ?? 'no detail'}`)
  return json
}

/** The id of folder `name` inside `parent`, made when it is not there yet. */
export async function folderIn(token: string, parent: string, name: string): Promise<string> {
  const q = `name = ${quoted(name)} and ${quoted(parent)} in parents and mimeType = '${FOLDER_MIME}' and trashed = false`
  const found = await call(token, `${FILES}?${new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`) as { files?: { id: string }[] }
  if (found.files?.[0]) return found.files[0].id
  const made = await call(token, `${FILES}?supportsAllDrives=true&fields=id`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parent] }),
  }) as { id: string }
  return made.id
}

/** The folder picked in Company settings, or null. */
export async function pickedFolder(): Promise<{ id: string; name: string } | null> {
  const { data } = await createAdminClient().from('app_settings').select('drive_folder_id, drive_folder_name').eq('singleton_id', 1).maybeSingle()
  return data?.drive_folder_id ? { id: data.drive_folder_id, name: data.drive_folder_name ?? 'the Drive folder' } : null
}

/**
 * The folder at `names` under `root` (["Docs from the Portal", "Invoices"]),
 * each one made when it is missing. `cache` keeps the ids found in this run,
 * so a run that writes twenty files asks Drive for each folder once.
 */
export async function ensurePath(token: string, root: string, names: readonly string[], cache = new Map<string, string>()): Promise<string> {
  let parent = root
  let key = root
  for (const name of names) {
    key = `${key}/${name}`
    const known = cache.get(key)
    parent = known ?? await folderIn(token, parent, name)
    if (!known) cache.set(key, parent)
  }
  return parent
}

/** The id of the file called `name` in `parent`, or null. */
export async function fileIn(token: string, parent: string, name: string): Promise<string | null> {
  const q = `name = ${quoted(name)} and ${quoted(parent)} in parents and trashed = false`
  const found = await call(token, `${FILES}?${new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`) as { files?: { id: string }[] }
  return found.files?.[0]?.id ?? null
}

export interface DriveFile { name: string; mime: string; bytes: Uint8Array }
export interface Written { id: string; link: string }

const linkOf = (d: { id: string; webViewLink?: string }): Written => ({ id: d.id, link: d.webViewLink ?? `https://drive.google.com/file/d/${d.id}/view` })

function multipart(meta: Record<string, unknown>, f: DriveFile): { body: Blob; type: string } {
  const boundary = `tn${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  return {
    type: `multipart/related; boundary=${boundary}`,
    body: new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
      `--${boundary}\r\nContent-Type: ${f.mime}\r\n\r\n`, f.bytes as BlobPart, `\r\n--${boundary}--`,
    ]),
  }
}

/** A new file in `parent`. */
export async function uploadFile(token: string, parent: string, f: DriveFile): Promise<Written> {
  const m = multipart({ name: f.name, parents: [parent] }, f)
  return linkOf(await call(token, `${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, { method: 'POST', headers: { 'Content-Type': m.type }, body: m.body }) as { id: string; webViewLink?: string })
}

/** New content for a file already in Drive: a new version, the same id and link (and its name, should it have changed; out of the bin, should it be there). */
export async function updateFile(token: string, fileId: string, f: DriveFile): Promise<Written> {
  const m = multipart({ name: f.name, trashed: false }, f)
  return linkOf(await call(token, `${UPLOAD}/${encodeURIComponent(fileId)}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`, { method: 'PATCH', headers: { 'Content-Type': m.type }, body: m.body }) as { id: string; webViewLink?: string })
}

/**
 * Writes `f` into `parent`: over the file `fileId` when there is one (a new
 * version), else over a file of the same name there (a copy whose id was
 * never saved), else as a new file. A stored id that Drive no longer knows
 * (deleted, or moved out of the portal's sight) is written again as new.
 */
export async function writeFile(token: string, parent: string, f: DriveFile, fileId?: string | null): Promise<Written & { fresh: boolean }> {
  if (fileId) {
    try {
      return { ...(await updateFile(token, fileId, f)), fresh: false }
    } catch (e) {
      if (!(e instanceof DriveError) || e.status !== 404) throw e
    }
  }
  const same = await fileIn(token, parent, f.name)
  if (same) return { ...(await updateFile(token, same, f)), fresh: false }
  return { ...(await uploadFile(token, parent, f)), fresh: true }
}

/** office@'s token and the picked folder, or why they are not there. */
export async function driveReady(): Promise<{ ok: true; token: string; root: { id: string; name: string } } | { ok: false; why: string }> {
  const [a, root] = await Promise.all([driveAccount(), pickedFolder()])
  if (!a.ok) return a
  if (!root) return { ok: false, why: 'No Drive folder is picked yet. A Super Admin picks it in Company settings, Integrations.' }
  const token = await accessTokenFor(a.accountId)
  if (!token) return { ok: false, why: `${a.email} needs to be connected again in Agenda settings.` }
  return { ok: true, token, root }
}

/**
 * Writes a file into the picked folder, under `path` (one folder per name,
 * made as needed). A file of the same name there is replaced, so sending a
 * document again never leaves two copies.
 */
export async function saveToDrive(f: { name: string; mime: string; bytes: Uint8Array; path?: string[] }): Promise<{ id: string; link: string }> {
  const r = await driveReady()
  if (!r.ok) throw new Error(r.why)
  const parent = await ensurePath(r.token, r.root.id, f.path ?? [])
  const done = await writeFile(r.token, parent, f)
  return { id: done.id, link: done.link }
}
