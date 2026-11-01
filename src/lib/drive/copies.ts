/**
 * The Drive copies (owner, 31 October 2026): every approved invoice, every
 * approved reimbursement's receipt and every reimbursement document, written
 * into the folder a Super Admin picked, through office@ (drive.file). The
 * portal stays the record; Drive is Finance's copy.
 *
 * One pass (runCopyPass) works out what should be in Drive (copy-plan.ts)
 * against drive_copies (migration 145) and writes what is missing or out of
 * date, a few at a time, the oldest first: /api/cron/drive-copies every five
 * minutes, and "Copy the missing now" in Company settings. Each copy is
 * claimed before it is written, so two passes never write the same file. A
 * try that fails waits a little longer each time and shows as failed after
 * the fifth; Try again sends it back to waiting. Nothing happens while the new
 * Agenda is closed, office@ is not connected with Drive, or no folder is
 * picked.
 *
 * Invoices and RMB documents are printed with the same print as their PDF
 * downloads, through the Drive print page and its one-document pass
 * (lib/drive/print-token.ts): the pass has no user. Server only.
 */

import { agendaGoogleOpen } from '@/lib/agenda/google-lock'
import { driveReady, ensurePath, writeFile } from '@/lib/agenda/google-drive'
import { createAdminClient } from '@/lib/supabase/admin'
import { printSheet } from '@/lib/pdf/sheet-pdf'
import { allRows, loadDirectory } from '@/lib/timeclock/clocky-context'
import { dateLabel } from '@/lib/timeclock/format'
import { loadRmbDoc } from '@/lib/timeclock/pay-docs'
import { drawPdfReceipts, receiptBytes } from '@/lib/timeclock/receipt-files'
import { pageLabels } from '@/lib/timeclock/receipt-pages'
import { invoiceFileName, receiptFileName, rmbFileName } from './doc-names'
import { extOf, mimeOfExt } from './file-names'
import { printPass, PRINT_HEADER } from './print-token'
import {
  afterFailure, driveShow, folderPath, folderText, historyOf, isWant, keyOf, planCopies, wantInvoice, wantReceipt, wantRmb,
  type CopyRow, type DriveKind, type DriveShow, type InvoiceSrc, type NoWant, type ReceiptSrc, type RmbSrc, type Want,
} from './copy-plan'

const c = () => createAdminClient()
const ZONE = 'America/New_York'
/** Each pass writes this many at most: a PDF takes a few seconds to print. */
export const PASS_LIMIT = 8
const COPY_COLS = 'id, kind, ref_id, version_key, pending_key, state, drive_file_id, web_link, file_name, folder_path, attempts, last_error, next_at, claimed_at, history, copied_at, updated_at'

/** The first day copied (drive_copy_from), YYYY-MM-DD. */
export async function copyFrom(): Promise<string> {
  const { data, error } = await c().from('app_settings').select('drive_copy_from').eq('singleton_id', 1).maybeSingle()
  if (error) throw new Error(`The Drive settings could not be read: ${error.message}`)
  return data?.drive_copy_from ?? '2026-11-01'
}

/** Every drive_copies row of a kind (all kinds when none). */
export async function loadCopyRows(kind?: DriveKind): Promise<CopyRow[]> {
  return allRows<CopyRow>((a, b) => {
    const q = c().from('drive_copies').select(COPY_COLS)
    return (kind ? q.eq('kind', kind) : q).order('id').range(a, b)
  }, 'The Drive copies could not be read')
}

/** A day before the first day copied, as an instant: the reads below take a little more and copy-plan decides by the New York day. */
const sinceOf = (from: string) => new Date(Date.parse(`${from}T00:00:00Z`) - 86_400_000).toISOString()

type InvoiceItem = InvoiceSrc & { number: string; person_id: string }
type ReceiptItem = ReceiptSrc & { receipt_number: string | null; person_id: string }
type RmbItem = RmbSrc & { number: string; person_id: string }

/** What should be in Drive now, with the numbers the screens name them by. */
export async function loadWanted(from: string): Promise<{ wants: Want[]; label: Map<string, { code: string; personId: string }> }> {
  const since = sinceOf(from)
  const [invoices, receipts, docs] = await Promise.all([
    allRows<InvoiceItem>((a, b) => c().from('invoices').select('id, number, person_id, state, approved_at, paid_on').in('state', ['approved', 'paid']).gte('approved_at', since).order('id').range(a, b), 'Invoices could not be read'),
    allRows<ReceiptItem>((a, b) => c().from('reimbursements').select('id, person_id, state, decided_at, receipt_path, receipt_number').not('receipt_path', 'is', null).in('state', ['approved', 'on_invoice', 'paid']).gte('decided_at', since).order('id').range(a, b), 'Reimbursements could not be read'),
    allRows<RmbItem>((a, b) => c().from('reimbursement_documents').select('id, number, person_id, state, created_at, paid_on, total').gte('created_at', since).order('id').range(a, b), 'Reimbursement documents could not be read'),
  ])
  const wants: Want[] = []
  const label = new Map<string, { code: string; personId: string }>()
  const add = (w: Want | NoWant | null, code: string, personId: string) => {
    if (!isWant(w)) return
    wants.push(w)
    label.set(keyOf(w.kind, w.refId), { code, personId })
  }
  for (const i of invoices) add(wantInvoice(i, from), i.number, i.person_id)
  for (const r of receipts) add(wantReceipt(r, from), r.receipt_number ?? 'Receipt', r.person_id)
  for (const d of docs) add(wantRmb(d, from), d.number, d.person_id)
  return { wants, label }
}

/** Each item's Drive cell, by id, for a list (the Invoices and Documents lists, the invoice's box). */
export async function driveShows<T extends { id: number }>(kind: DriveKind, items: readonly T[], want: (x: T, from: string) => Want | NoWant | null): Promise<Map<number, DriveShow>> {
  if (!items.length) return new Map()
  const [from, rows] = await Promise.all([copyFrom(), loadCopyRows(kind)])
  const byRef = new Map(rows.map(r => [r.ref_id, r]))
  return new Map(items.map(x => [x.id, driveShow(want(x, from), byRef.get(x.id))]))
}

/** One item's copy row, for the invoice's Drive box. */
export async function copyRow(kind: DriveKind, refId: number): Promise<CopyRow | null> {
  const { data, error } = await c().from('drive_copies').select(COPY_COLS).eq('kind', kind).eq('ref_id', refId).maybeSingle()
  if (error) throw new Error(`The Drive copy could not be read: ${error.message}`)
  return data as CopyRow | null
}

// ── Company settings: "How the copies are doing" ──────────────────────────

export interface DriveStatus {
  /** "Nov 1, 2026" */
  from: string
  counts: { done: number; waiting: number; failed: number }
  failed: { id: number; what: string; error: string; when: string }[]
  /** The picked folder in Drive. */
  folderLink: string | null
}

const KIND_WORD: Record<DriveKind, string> = { invoice: 'Invoice', receipt: 'Receipt', rmb: 'Reimbursement document' }

export async function loadDriveStatus(folderId: string | null, stamp: (t: string) => string): Promise<DriveStatus> {
  const from = await copyFrom()
  const [{ wants, label }, rows, dir] = await Promise.all([loadWanted(from), loadCopyRows(), loadDirectory()])
  const byKey = new Map(rows.map(r => [keyOf(r.kind, r.ref_id), r]))
  const shows = wants.map(w => ({ w, row: byKey.get(keyOf(w.kind, w.refId)), show: driveShow(w, byKey.get(keyOf(w.kind, w.refId))) }))
  return {
    from: dateLabel(from),
    counts: {
      done: shows.filter(s => s.show.state === 'done').length,
      waiting: shows.filter(s => s.show.state === 'waiting').length,
      failed: shows.filter(s => s.show.state === 'failed').length,
    },
    failed: shows.filter(s => s.show.state === 'failed' && s.row).slice(0, 20).map(s => {
      const l = label.get(keyOf(s.w.kind, s.w.refId))
      return {
        id: s.row!.id,
        what: `${KIND_WORD[s.w.kind]} ${l?.code ?? ''}${l ? `, ${dir.nameOf(l.personId)}` : ''}`.replace(/\s+,/, ','),
        error: s.row!.last_error ?? 'No detail',
        when: stamp(s.row!.updated_at),
      }
    }),
    folderLink: folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null,
  }
}

/** Failed copies, for the rail's count of what waits for Try again. */
export async function countFailedCopies(): Promise<number> {
  const { count, error } = await c().from('drive_copies').select('id', { count: 'exact', head: true }).eq('state', 'failed')
  if (error) throw new Error(`The Drive copies could not be counted: ${error.message}`)
  return count ?? 0
}

/** Try again: a failed copy goes back to waiting, its tries counted afresh. */
export async function retryCopy(id: number): Promise<boolean> {
  const { data, error } = await c().from('drive_copies').update({ state: 'waiting', attempts: 0, next_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).eq('state', 'failed').select('id')
  if (error) throw new Error(error.message)
  return !!data?.length
}

// ── One pass ────────────────────────────────────────────────────────────────

export interface PassReport { copied: number; failed: number; skipped?: string; errors: string[] }

/** Where the server reaches itself: the Drive print page is opened there. */
export function selfOrigin(): string {
  const internal = process.env.INTERNAL_ORIGIN
  return internal ? new URL(internal).origin : `http://127.0.0.1:${process.env.PORT || 3000}`
}

const SERVER = { personId: null, isAdmin: true }

/** The file of one copy: its name, type and bytes. */
async function fileFor(w: Want, origin: string): Promise<{ name: string; mime: string; bytes: Uint8Array }> {
  if (w.kind === 'receipt') {
    const { data: r, error } = await c().from('reimbursements').select('person_id, receipt_path, receipt_name, receipt_number').eq('id', w.refId).maybeSingle()
    if (error) throw new Error(`The reimbursement could not be read: ${error.message}`)
    if (!r?.receipt_path) throw new Error('This reimbursement has no receipt any more.')
    const bytes = await receiptBytes(r.receipt_path)
    if (!bytes) throw new Error('The receipt file could not be read from the portal\'s storage.')
    return { name: await receiptFileName(r), mime: mimeOfExt(extOf(r.receipt_path)), bytes }
  }
  const kind = w.kind
  const target = new URL(`/api/cron/drive-print/${kind}/${w.refId}`, origin)
  const headers = { [PRINT_HEADER]: printPass(kind, w.refId) }
  if (kind === 'invoice') {
    const name = await invoiceFileName(w.refId)
    if (!name) throw new Error('The invoice is not there any more.')
    const done = await printSheet(target, headers)
    if (!done) throw new Error('The invoice could not be printed: its print page answered "not found".')
    return { name, mime: 'application/pdf', bytes: done.pdf }
  }
  const name = await rmbFileName(w.refId)
  if (!name) throw new Error('The reimbursement document is not there any more.')
  // The PDF receipts' bytes, drawn into the boxes their pages leave, as the download does.
  const files = new Map<number, Uint8Array>()
  const doc = await loadRmbDoc(SERVER, w.refId, ZONE, files)
  if (!doc) throw new Error('The reimbursement document could not be read.')
  const done = await printSheet(target, headers, {
    width: 620, landscape: false,
    paged: { labels: n => pageLabels(n, doc.receipts), draw: (pdf, boxes, pxToPt) => drawPdfReceipts(pdf, boxes, files, pxToPt) },
  })
  if (!done) throw new Error('The reimbursement document could not be printed: its print page answered "not found".')
  return { name, mime: 'application/pdf', bytes: done.pdf }
}

/** Takes the copy for this pass; null when another pass holds it. */
async function claim(w: Want, now: Date): Promise<CopyRow | null> {
  const db = c()
  const { error: insErr } = await db.from('drive_copies').upsert({ kind: w.kind, ref_id: w.refId, pending_key: w.key }, { onConflict: 'kind,ref_id', ignoreDuplicates: true })
  if (insErr) throw new Error(`The copy could not be started: ${insErr.message}`)
  const stale = new Date(now.getTime() - 10 * 60_000).toISOString()
  const { data, error } = await db.from('drive_copies').update({ claimed_at: now.toISOString() })
    .eq('kind', w.kind).eq('ref_id', w.refId).or(`claimed_at.is.null,claimed_at.lt.${stale}`).select(COPY_COLS)
  if (error) throw new Error(`The copy could not be started: ${error.message}`)
  return (data?.[0] as CopyRow | undefined) ?? null
}

/**
 * One pass: what is missing or out of date, `limit` at most. Says why it did
 * nothing when the new Agenda is closed or Drive is not ready.
 */
export async function runCopyPass(opts: { origin?: string; limit?: number; now?: Date } = {}): Promise<PassReport> {
  const report: PassReport = { copied: 0, failed: 0, errors: [] }
  if (!(await agendaGoogleOpen())) return { ...report, skipped: 'the new Agenda is closed' }
  const ready = await driveReady()
  if (!ready.ok) return { ...report, skipped: ready.why }
  const now = opts.now ?? new Date()
  const from = await copyFrom()
  const [{ wants }, rows] = await Promise.all([loadWanted(from), loadCopyRows()])
  const todo = planCopies(wants, rows, now.getTime(), opts.limit ?? PASS_LIMIT)
  const folders = new Map<string, string>()
  const origin = opts.origin ?? selfOrigin()
  for (const w of todo) {
    const row = await claim(w, now)
    if (!row) continue
    // A new version wanted counts its tries afresh.
    const attempts = row.pending_key === w.key ? row.attempts : 0
    try {
      const f = await fileFor(w, origin)
      const parent = await ensurePath(ready.token, ready.root.id, folderPath(w.kind, ready.root.name), folders)
      const done = await writeFile(ready.token, parent, f, row.drive_file_id)
      const at = new Date().toISOString()
      const { error } = await c().from('drive_copies').update({
        state: 'done', version_key: w.key, pending_key: w.key, drive_file_id: done.id, web_link: done.link, file_name: f.name,
        folder_path: folderText(w.kind), attempts: 0, last_error: null, claimed_at: null, next_at: at,
        history: [...historyOf(row.history), { key: w.key, at }], copied_at: row.copied_at ?? at, updated_at: at,
      }).eq('id', row.id)
      if (error) throw new Error(`Written to Drive, but not recorded: ${error.message}`)
      report.copied++
    } catch (e) {
      const text = (e instanceof Error ? e.message : String(e)).slice(0, 500)
      const tries = attempts + 1
      const next = afterFailure(tries, Date.now())
      await c().from('drive_copies').update({ ...next, pending_key: w.key, attempts: tries, last_error: text, claimed_at: null, updated_at: new Date().toISOString() }).eq('id', row.id)
      report.failed++
      report.errors.push(`${w.kind} ${w.refId}: ${text}`)
    }
  }
  return report
}
