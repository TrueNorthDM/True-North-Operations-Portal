/**
 * The file names of an invoice, a reimbursement document and a receipt, read
 * from the database (owner, 31 October 2026): the code and the person's full
 * name from the Directory (lib/drive/file-names.ts). Used by the downloads
 * and by the Drive copy, so both give the same name. Names only: who may
 * have the file is decided where it is sent. Server only.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { docFileName, extOf } from './file-names'

const fullName = async (personId: string) => (await loadDirectory()).people.get(personId)?.name ?? null

/** "INV-2026-010-Arnaldo Oliveira.pdf", or null when there is no such invoice. */
export async function invoiceFileName(id: number): Promise<string | null> {
  const { data } = await createAdminClient().from('invoices').select('number, person_id').eq('id', id).maybeSingle()
  return data ? docFileName(data.number, await fullName(data.person_id), 'pdf') : null
}

/** "RMB-2026-002-Arnaldo Oliveira.pdf", or null. */
export async function rmbFileName(id: number): Promise<string | null> {
  const { data } = await createAdminClient().from('reimbursement_documents').select('number, person_id').eq('id', id).maybeSingle()
  return data ? docFileName(data.number, await fullName(data.person_id), 'pdf') : null
}

/**
 * "RCT-2026-005-Arnaldo Oliveira.jpg": the receipt's number, the person, the
 * extension of the file as it was sent. A receipt from before the numbers
 * (none should be left after migration 145) keeps its uploaded name.
 */
export async function receiptFileName(r: { person_id: string; receipt_number: string | null; receipt_name: string | null; receipt_path: string | null }): Promise<string> {
  const ext = extOf(r.receipt_name) || extOf(r.receipt_path)
  if (!r.receipt_number) return r.receipt_name || `receipt${ext ? `.${ext}` : ''}`
  return docFileName(r.receipt_number, await fullName(r.person_id), ext)
}
