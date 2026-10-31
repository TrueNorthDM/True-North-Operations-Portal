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

async function call(token: string, url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000), headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) } })
  const json = await res.json().catch(() => null) as { error?: { message?: string } } | null
  if (!res.ok) throw new Error(`Drive answered ${res.status}: ${json?.error?.message ?? 'no detail'}`)
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
 * Writes a file into the picked folder, under `path` (one folder per name,
 * made as needed: ["Invoices", "Ana Lima"]). A file of the same name there is
 * replaced, so sending a document again never leaves two copies.
 */
export async function saveToDrive(f: { name: string; mime: string; bytes: Uint8Array; path?: string[] }): Promise<{ id: string; link: string }> {
  const [a, root] = await Promise.all([driveAccount(), pickedFolder()])
  if (!a.ok) throw new Error(a.why)
  if (!root) throw new Error('No Drive folder is picked yet. A Super Admin picks it in Company settings, Integrations.')
  const token = await accessTokenFor(a.accountId)
  if (!token) throw new Error(`${a.email} needs to be connected again in Agenda settings.`)
  let parent = root.id
  for (const name of f.path ?? []) parent = await folderIn(token, parent, name)
  const q = `name = ${quoted(f.name)} and ${quoted(parent)} in parents and trashed = false`
  const found = await call(token, `${FILES}?${new URLSearchParams({ q, fields: 'files(id)', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`) as { files?: { id: string }[] }
  const existing = found.files?.[0]?.id
  const boundary = `tn${Date.now().toString(36)}`
  const meta = existing ? { name: f.name } : { name: f.name, parents: [parent] }
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${boundary}\r\nContent-Type: ${f.mime}\r\n\r\n`, f.bytes as BlobPart, `\r\n--${boundary}--`,
  ])
  const url = existing ? `${UPLOAD}/${encodeURIComponent(existing)}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`
    : `${UPLOAD}?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink`
  const done = await call(token, url, { method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }) as { id: string; webViewLink?: string }
  return { id: done.id, link: done.webViewLink ?? `https://drive.google.com/file/d/${done.id}/view` }
}
