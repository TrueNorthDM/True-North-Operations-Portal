/**
 * What should be in Google Drive, and what is (owner, 31 October 2026). Pure:
 * the scheduled copy (lib/drive/copies.ts), Company settings' "How the copies
 * are doing" and the Drive columns of the Invoices and Documents lists all
 * read these, so they never disagree.
 *
 *   invoice   copied when approved; the same file gets a new version when it
 *             is paid (and again if it is approved again after a reopen)
 *   receipt   a reimbursement's receipt, copied when the reimbursement is
 *             approved (anyone's: employees and contractors)
 *   rmb       a reimbursement document, copied when made; a new version when
 *             an item is added to it (its total changes) and when it is paid
 *
 * Only what is approved or made on or after drive_copy_from (1 November 2026,
 * New York days) is copied. A version is a key: "approved:<when>",
 * "paid:<day>", "made:<total>". What is in Drive is a row's version_key; a
 * copy is needed when it differs from the key wanted now.
 */

import { localDate, stampLabel } from '@/lib/timeclock/format'

export type DriveKind = 'invoice' | 'receipt' | 'rmb'
export const DRIVE_KINDS: readonly DriveKind[] = ['invoice', 'receipt', 'rmb']

/** The folder the portal makes inside the picked one. */
export const ROOT_FOLDER = 'Docs from the Portal'

/** Each kind's folders, from the picked folder down. No folder per person. */
export const FOLDERS: Record<DriveKind, readonly string[]> = {
  invoice: [ROOT_FOLDER, 'Invoices'],
  receipt: [ROOT_FOLDER, 'Reimbursement Requests', 'Receipts'],
  rmb: [ROOT_FOLDER, 'Reimbursement Requests', 'RMB'],
}

/** The folders to make under the picked one: when the picked folder is itself "Docs from the Portal", it is the root and no second one is nested in it. */
export function folderPath(kind: DriveKind, pickedName: string | null | undefined): string[] {
  const path = [...FOLDERS[kind]]
  return (pickedName ?? '').trim().toLowerCase() === ROOT_FOLDER.toLowerCase() ? path.slice(1) : path
}

/** "Docs from the Portal / Invoices": where the file is, as the screens say it. */
export const folderText = (kind: DriveKind): string => FOLDERS[kind].join(' / ')

const ZONE = 'America/New_York'
/** On or after the first day copied, by the New York day. */
export const fromOn = (at: string | null | undefined, from: string): boolean => !!at && localDate(at, ZONE) >= from

export interface Want {
  kind: DriveKind
  refId: number
  /** The version that should be in Drive now. */
  key: string
  /** When it became due: the oldest are copied first. */
  at: string
}

export type InvoiceSrc = { id: number; state: string; approved_at: string | null; paid_on: string | null }
export type ReceiptSrc = { id: number; state: string; decided_at: string | null; receipt_path: string | null }
export type RmbSrc = { id: number; state: string; created_at: string; paid_on: string | null; total: number | string }

/** Why an item has no copy wanted: not approved yet, or approved before the first day copied. */
export type NoWant = 'after' | 'before'

export function wantInvoice(i: InvoiceSrc, from: string): Want | NoWant {
  if ((i.state !== 'approved' && i.state !== 'paid') || !i.approved_at) return 'after'
  if (!fromOn(i.approved_at, from)) return 'before'
  return i.state === 'paid' && i.paid_on
    ? { kind: 'invoice', refId: i.id, key: `paid:${i.paid_on}`, at: `${i.paid_on}T12:00:00.000Z` }
    : { kind: 'invoice', refId: i.id, key: `approved:${i.approved_at}`, at: i.approved_at }
}

/** A reimbursement is approved once it is approved, on an invoice or paid. */
const APPROVED = new Set(['approved', 'on_invoice', 'paid'])

export function wantReceipt(r: ReceiptSrc, from: string): Want | NoWant | null {
  if (!r.receipt_path) return null
  if (!APPROVED.has(r.state) || !r.decided_at) return 'after'
  if (!fromOn(r.decided_at, from)) return 'before'
  return { kind: 'receipt', refId: r.id, key: 'approved', at: r.decided_at }
}

export function wantRmb(d: RmbSrc, from: string): Want | NoWant {
  if (!fromOn(d.created_at, from)) return 'before'
  return d.state === 'paid' && d.paid_on
    ? { kind: 'rmb', refId: d.id, key: `paid:${d.paid_on}`, at: `${d.paid_on}T12:00:00.000Z` }
    : { kind: 'rmb', refId: d.id, key: `made:${Number(d.total).toFixed(2)}`, at: d.created_at }
}

export const isWant = (w: Want | NoWant | null): w is Want => !!w && typeof w === 'object'

export interface CopyRow {
  id: number
  kind: string
  ref_id: number
  version_key: string | null
  pending_key: string | null
  state: string
  drive_file_id: string | null
  web_link: string | null
  file_name: string | null
  folder_path: string | null
  attempts: number
  last_error: string | null
  next_at: string
  claimed_at: string | null
  history: unknown
  copied_at: string | null
  updated_at: string
}

/** A run holds a copy this long at most; one that died while writing lets go after it. */
export const CLAIM_MS = 10 * 60_000
/** Tries before a copy is shown as failed and waits for Try again. */
export const MAX_ATTEMPTS = 5

/** 5 minutes after the first failed try, then 10, 20, 40: never more than 6 hours. */
export const backoffMs = (attempts: number): number => Math.min(6 * 3_600_000, 5 * 60_000 * 2 ** Math.max(0, attempts - 1))

/** Whether the wanted version still has to be written. */
export function needsCopy(want: Want, row: CopyRow | undefined, now: number): boolean {
  if (!row) return true
  if (row.version_key === want.key) return false
  if (row.claimed_at && now - Date.parse(row.claimed_at) < CLAIM_MS) return false
  // Failed with this very version: it waits for Try again. A newer version is tried afresh.
  if (row.state === 'failed') return row.pending_key !== want.key
  if (row.state === 'waiting' && row.pending_key === want.key && Date.parse(row.next_at) > now) return false
  return true
}

export const keyOf = (kind: string, refId: number) => `${kind}:${refId}`

/** What one run copies: what is missing or out of date, the oldest first, `limit` at most. */
export function planCopies(wants: readonly Want[], rows: readonly CopyRow[], now: number, limit: number): Want[] {
  const byKey = new Map(rows.map(r => [keyOf(r.kind, r.ref_id), r]))
  return wants.filter(w => needsCopy(w, byKey.get(keyOf(w.kind, w.refId)), now))
    .sort((a, b) => a.at.localeCompare(b.at) || a.refId - b.refId)
    .slice(0, limit)
}

/** What a try that failed leaves: waiting a little longer each time, failed after the last. */
export function afterFailure(attempts: number, now: number): { state: 'waiting' | 'failed'; next_at: string } {
  return attempts >= MAX_ATTEMPTS ? { state: 'failed', next_at: new Date(now).toISOString() } : { state: 'waiting', next_at: new Date(now + backoffMs(attempts)).toISOString() }
}

/** One item's Drive cell on the lists and its box on the invoice. */
export interface DriveShow {
  state: 'done' | 'waiting' | 'failed' | 'after' | 'before'
  /** Opens the file in Drive (also while a newer version waits). */
  link: string | null
  error: string | null
  /** The drive_copies row, for Try again. */
  copyId: number | null
  /** The file is in Drive and a newer version waits to be written over it. */
  updating: boolean
}

/** The "Google Drive" box beside one invoice. */
export interface DriveBoxData {
  show: DriveShow
  /** "INV-2026-010-Arnaldo Oliveira.pdf" */
  file: string
  /** "Docs from the Portal / Invoices" */
  folder: string
  history: { text: string; when: string }[]
}

export function driveShow(want: Want | NoWant | null, row: CopyRow | undefined): DriveShow {
  const base = { link: row?.web_link ?? null, error: null, copyId: row?.id ?? null, updating: false }
  if (!want) return { ...base, state: 'before', link: null }
  if (want === 'after' || want === 'before') return { ...base, state: want, link: want === 'after' ? null : base.link }
  if (row?.version_key === want.key) return { ...base, state: 'done' }
  if (row?.state === 'failed' && row.pending_key === want.key) return { ...base, state: 'failed', error: row.last_error, updating: !!row.version_key }
  return { ...base, state: 'waiting', updating: !!row?.version_key }
}

/** Each version written, oldest first, as the row keeps it. */
export function historyOf(h: unknown): { key: string; at: string }[] {
  return Array.isArray(h) ? h.filter((x): x is { key: string; at: string } => !!x && typeof x.key === 'string' && typeof x.at === 'string') : []
}

/** The history lines of the invoice's Drive box: "Copied when approved, Nov 3, 2026, 10:12 AM", then "Updated when paid, ...". */
export function historyLines(h: unknown, zone: string): { text: string; when: string }[] {
  return historyOf(h).map((x, i) => {
    const stage = x.key.split(':')[0]
    const what = stage === 'paid' ? 'when paid' : stage === 'made' ? (i === 0 ? 'when made' : 'when an item was added') : i === 0 ? 'when approved' : 'when approved again'
    return { text: `${i === 0 ? 'Copied' : 'Updated'} ${what}`, when: stampLabel(x.at, zone) }
  })
}

/** The counts of "How the copies are doing". */
export function copyCounts(shows: readonly DriveShow[]): { done: number; waiting: number; failed: number } {
  return {
    done: shows.filter(s => s.state === 'done').length,
    waiting: shows.filter(s => s.state === 'waiting').length,
    failed: shows.filter(s => s.state === 'failed').length,
  }
}
