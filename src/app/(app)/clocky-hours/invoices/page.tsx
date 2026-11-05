// Clocky, Invoices (Clocky part 2, Invoices.dc.html 6E): a contractor's own
// invoices, or every invoice for Super Admins, Admins and Finance. Who gets
// which list is lib/timeclock/invoices-view.ts.

import { requireSurface } from '@/lib/access/resolve'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { invoiceViewer, loadInvoiceList } from '@/lib/timeclock/invoices-view'
import { InvoicesListLive } from '@/components/clocky/invoices/InvoicesLive'
import { requireNorthTimeOpen } from '@/lib/timeclock/north-time-gate'
import { loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadWaitingSenders } from '@/lib/invoice-form/data'
import { newSenderRights } from '@/lib/invoice-form/rules'
import { NewSenders } from '@/components/clocky/invoices/NewSenders'
import { linkFormSender } from './actions'
import Link from 'next/link'
import { loadInvoicesToSend } from '@/lib/timeclock/send-invoice-data'
import { BTN } from '@/lib/ui/buttons'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Invoices' }

const STATES = ['all', 'wait', 'appr', 'paid', 'draft'] as const

/** ?state=appr opens on the approved ones: Home's "Invoices to pay" line links here (owner, 25 October 2026). */
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  await requireNorthTimeOpen()
  const { state } = await searchParams
  const access = await requireSurface('clocky-invoices')
  const v = await viewerFor(access)
  const data = await loadInvoiceList(invoiceViewer(access, v?.zone ?? 'America/New_York'))
  // Try again on a failed Drive copy is a Super Admin's, as on the Google Drive card.
  if (data.drive) data.drive.retry = access.can('cs-integrations-edit')
  // The invoice form's new senders (migration 147): for the default approver, Admins, Super Admins and Finance.
  const rights = newSenderRights(access, await loadInvoiceSettings())
  let senders: Awaited<ReturnType<typeof loadWaitingSenders>> | null = null
  let people: { value: string; label: string }[] = []
  if (rights.see) {
    try {
      senders = await loadWaitingSenders()
      if (senders.length && rights.link) {
        people = ((await createAdminClient().from('people').select('id, full_name, status').order('full_name')).data ?? [])
          .map(p => ({ value: p.id as string, label: `${p.full_name}${p.status && p.status !== 'active' ? ' (inactive)' : ''}` }))
      }
    } catch (e) {
      console.error('[invoices] new senders:', e instanceof Error ? e.message : e)
    }
  }
  // A contractor's own invoices still to send (4 November 2026: they make and send their own).
  const owed = access.personId ? await loadInvoicesToSend(access.personId, new Date(), { hours: false }).then(d => d?.toSend ?? []).catch(() => []) : []
  const today = new Date().toISOString().slice(0, 10)
  const toSend = owed.filter(x => x.kind !== 'fixed_no_timesheet' || x.end < today)
  const extra = (
    <>
      {toSend.length > 0 && (
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-white px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Send your invoice for {toSend.map(x => x.label).join(', ')}</div>
            <p className="m-0 mt-0.5 text-[13px] text-muted">You make it and send it: your own file, or the invoice builder.</p>
          </div>
          <Link href={`/clocky-hours/invoices/new?start=${toSend[0].start}`} className={BTN.navy}>Send your invoice</Link>
        </div>
      )}
      {senders && <NewSenders senders={senders} people={people} link={rights.link ? linkFormSender : null} />}
    </>
  )
  return <InvoicesListLive data={data} st={STATES.find(x => x === state)} extra={extra} />
}
