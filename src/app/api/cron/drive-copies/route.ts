/**
 * GET /api/cron/drive-copies, every 5 minutes (owner, 31 October 2026): copies
 * into Google Drive what should be there and is not yet, a few at a time:
 * approved and paid invoices, approved reimbursements' receipts, reimbursement
 * documents, from drive_copy_from on. See src/lib/drive/copies.ts. Does
 * nothing while the new Agenda is closed, office@ is not connected with Drive
 * or no folder is picked.
 */

import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { isCronRequest } from '@/lib/auth/cron-auth'
import { internalOrigin } from '@/lib/auth/public-origin'
import { runCopyPass } from '@/lib/drive/copies'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isCronRequest(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const report = await runCopyPass({ origin: internalOrigin(request.url) })
    if (report.errors.length) console.error('[drive copies]', report.errors.slice(0, 5).join(' | '))
    if (report.copied || report.failed) { revalidatePath('/clocky-hours/invoices'); revalidatePath('/requests/reimbursements'); revalidatePath('/admin/settings') }
    return NextResponse.json({ ok: true, ...report, errors: report.errors.slice(0, 5) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
