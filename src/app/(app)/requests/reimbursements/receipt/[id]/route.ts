/**
 * GET /requests/reimbursements/receipt/<id>: a reimbursement's receipt, full
 * size. To its person, Super Admins, Admins and Finance, and to whoever decides
 * reimbursements. Read with the service role and sent from here: the file
 * never has an address of its own.
 */

import { NextResponse } from 'next/server'
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadInvoiceSettings, seesMoney } from '@/lib/timeclock/pay-terms'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSurface('rq-reimbursements')
  const { id } = await params
  const missing = () => new NextResponse('That receipt is not open to you.', { status: 404, headers: { 'Content-Type': 'text/plain' } })
  if (!/^\d+$/.test(id)) return missing()
  const c = createAdminClient()
  const { data: r } = await c.from('reimbursements').select('person_id, receipt_path, receipt_name').eq('id', Number(id)).maybeSingle()
  if (!r) return missing()
  if (!access.can('rq-decide') && !seesMoney(access, r.person_id, await loadInvoiceSettings())) return missing()
  const { data, error } = await c.storage.from('receipts').download(r.receipt_path)
  if (error || !data) return new NextResponse('The receipt could not be opened. Try again in a moment.', { status: 500, headers: { 'Content-Type': 'text/plain' } })
  const name = (r.receipt_name || 'receipt').replace(/[^A-Za-z0-9._-]/g, '-')
  return new NextResponse(data, { headers: { 'Content-Type': data.type || 'application/octet-stream', 'Content-Disposition': `inline; filename="${name}"`, 'Cache-Control': 'private, no-store' } })
}
