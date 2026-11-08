/**
 * GET /requests/reimbursements/receipt/<id>: a reimbursement's receipt, full
 * size. To its person, Super Admins and Finance (seesMoney; rq-decide is
 * Super Admin only). Read with the service role and sent from here: the file
 * never has an address of its own. Named as its copy in Google Drive:
 * "RCT-2026-005-Arnaldo Oliveira.jpg" (owner, 31 October 2026); the name it
 * was sent with stays on the request, as information.
 */

import { NextResponse } from 'next/server'
import { loadAccess } from '@/lib/access/resolve'
import { receiptFileName } from '@/lib/drive/doc-names'
import { contentDisposition } from '@/lib/drive/file-names'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoiceSettings, seesMoney } from '@/lib/timeclock/pay-terms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await loadAccess()
  const { id } = await params
  const missing = () => new NextResponse('That receipt is not open to you.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  // A file, not a page: a 404 rather than a redirect Home whose HTML would come back as the receipt.
  if (!access.can('rq-reimbursements') || !/^\d+$/.test(id)) return missing()
  const c = createAdminClient()
  const { data: r } = await c.from('reimbursements').select('person_id, receipt_path, receipt_name, receipt_number').eq('id', Number(id)).maybeSingle()
  // A Mileage line may come without a receipt (Tina's review, 29 October 2026).
  if (!r || !r.receipt_path) return missing()
  if (!access.can('rq-decide') && !seesMoney(access, r.person_id, await loadInvoiceSettings())) return missing()
  const { data, error } = await c.storage.from('receipts').download(r.receipt_path)
  if (error || !data) return new NextResponse('The receipt could not be opened. Try again in a moment.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  const name = await receiptFileName(r)
  return new NextResponse(data, { headers: { 'Content-Type': data.type || 'application/octet-stream', 'Content-Disposition': contentDisposition(name, 'inline'), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
}
