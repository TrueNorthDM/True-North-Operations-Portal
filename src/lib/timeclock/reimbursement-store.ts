/**
 * What the two reimbursement routes share (new/route.ts and edit/route.ts,
 * owner, 5 November 2026): who may write, the rules a receipt is checked
 * against, the receipts bucket, receipt numbers, who decides, and the change
 * history (migration 153). Not a "use server" file. Each route asks who may
 * write itself (its own writer()), so the access and the North Time lock are
 * seen where the write is.
 */

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createUploadClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types/database.generated'
import { db, loadDirectory, type Viewer } from './clocky-context'
import { localDate } from './format'
import { loadInvoiceSettings, loadRequestDeciders, loadRoutes } from './pay-terms'
import { loadClients } from './requests-data'
import { orList } from './routing'
import { MAX_RECEIPTS, MAX_TOTAL, readItem, type ItemRules, type RmbItem, type RmbSnapshot, type StoredLine } from './reimbursement-form'

export const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

/** What this person's receipts are checked against. */
export async function itemRules(v: Viewer): Promise<ItemRules> {
  const [clients, routes, settings] = await Promise.all([loadClients(), loadRoutes([v.personId]), loadInvoiceSettings()])
  return { clients, contractor: routes.get(v.personId)?.isContractor ?? false, mileageRate: settings.mileageRate, today: localDate(new Date(), v.zone) }
}

/**
 * The numbered receipts of a form (count, then receipt_0, date_0, ...), or one
 * with plain field names (as before). `stored(i)`: receipt i already has a
 * file kept (an edit); `prevOf(i)`: the receipt it was, as stored (an edit:
 * a Mileage line whose miles did not change keeps its rate). The refusal's
 * words when any is wrong: all are checked before any is stored.
 */
export function readItems(form: FormData, rules: ItemRules, stored: (i: number) => boolean = () => false, prevOf: (i: number) => StoredLine | null = () => null): { items: RmbItem[]; count: number } | string {
  const numbered = form.has('count')
  const count = numbered ? Number(form.get('count')) : 1
  if (!Number.isInteger(count) || count < 1) return 'Add at least one receipt.'
  if (count > MAX_RECEIPTS) return `Send up to ${MAX_RECEIPTS} receipts at a time.`
  const items: RmbItem[] = []
  let total = 0
  for (let i = 0; i < count; i++) {
    const it = readItem(k => form.get(numbered ? `${k}_${i}` : k), count > 1 ? `Receipt ${i + 1}: ` : '', rules, stored(i), prevOf(i))
    if (typeof it === 'string') return it.charAt(0).toUpperCase() + it.slice(1)
    total += it.file?.size ?? 0
    items.push(it)
  }
  if (total > MAX_TOTAL) return 'The receipts are over 45 MB together. Send smaller photos, or split the request.'
  return { items, count }
}

/** The receipts bucket (migration 117), through the internal address (upload firewall, 25 October 2026). */
export const receiptFiles = () => createUploadClient().storage.from('receipts')

/** Stores one receipt file; its path, or null when the bucket refused it. */
export async function storeReceipt(personId: string, file: File, ext: string): Promise<string | null> {
  const path = `${personId}/${randomUUID()}.${ext}`
  const { error } = await receiptFiles().upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) { console.error('[reimbursement] upload:', error.message); return null }
  return path
}

/** Files no longer used (a failed save, a replaced or removed receipt); a failure is only logged. */
export async function dropReceipts(paths: readonly (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p)
  if (!list.length) return
  const { error } = await receiptFiles().remove(list)
  if (error) console.error('[reimbursement] remove files:', error.message)
}

/** The new files a failed edit leaves unused: every one stored but those already written into a row. */
export const uncommitted = (stored: readonly string[], committed: ReadonlySet<string>): string[] => stored.filter(p => !committed.has(p))

/**
 * A receipt's own number (owner, 31 October 2026): RCT-2026-005, under the
 * settings row's lock (next_document_number), as invoices and RMB documents
 * get theirs. Null when it could not be given.
 */
export async function nextReceiptNumber(): Promise<string | null> {
  const { data, error } = await db().rpc('next_document_number', { p_kind: 'receipt' })
  if (error || !data) { console.error('[reimbursement] receipt number:', error?.message); return null }
  return data as string
}

/** "David Sharpe", "Arnaldo Oliveira or David Sharpe": who decides this person's reimbursements; '' when it cannot be read. */
export async function rmbDeciderNames(personId: string): Promise<string> {
  return Promise.all([loadDirectory(), loadRequestDeciders([personId])])
    .then(([dir, deciders]) => orList(deciders('rmb', personId).map(id => dir.nameOf(id))))
    .catch(e => { console.error('[reimbursement] who decides:', (e as Error).message); return '' })
}

export interface RmbChange {
  action: 'edited' | 'receipt_added' | 'receipt_removed' | 'joined' | 'withdrawn'
  reimbursementId: number | null
  reportId: number | null
  before?: RmbSnapshot | null
  after?: RmbSnapshot | null
  reason?: string | null
}

/**
 * Keeps who changed a waiting request, when and what (reimbursement_changes,
 * migration 153). The change itself is already saved: a history row that
 * cannot be written is logged, never undone.
 */
export async function logRmbChanges(personId: string, at: string, changes: readonly RmbChange[]): Promise<void> {
  if (!changes.length) return
  const { error } = await db().from('reimbursement_changes').insert(changes.map(ch => ({
    person_id: personId, changed_by: personId, changed_at: at, action: ch.action,
    report_id: ch.reportId, reimbursement_id: ch.reimbursementId,
    before: (ch.before ?? null) as unknown as Json, after: (ch.after ?? null) as unknown as Json, reason: ch.reason ?? null,
  })))
  if (error) console.error('[reimbursement] history:', error.message)
}
