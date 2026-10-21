// The page the document PDF route renders headless (Company Settings.dc.html
// 10P): a payroll summary (kind payroll, a submission id) or a reimbursement
// document (kind rmb). Open to the person, Super Admins, Admins and Finance
// (lib/timeclock/pay-docs.ts); never Team Leaders.

import { notFound } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { loadDoc } from '@/lib/timeclock/pay-docs'
import { DocSheet } from '@/components/clocky/invoices/DocSheet'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Document' }

export default async function DocPrintPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params
  // Clocky first, then the money rule (pay-docs.ts) for this document.
  const access = await requireSurface('clocky-hours')
  if ((kind !== 'payroll' && kind !== 'rmb') || !/^\d+$/.test(id)) notFound()
  const v = await viewerFor(access)
  const doc = await loadDoc(access, kind, Number(id), v?.zone ?? 'America/New_York')
  if (!doc) notFound()
  // A4 is 620 by 877 at the preview's width: the sheet fills it, the footer at the bottom.
  return (
    <div className="print-doc bg-white w-[620px] [&>div]:min-h-[877px]">
      <DocSheet doc={doc} />
    </div>
  )
}
