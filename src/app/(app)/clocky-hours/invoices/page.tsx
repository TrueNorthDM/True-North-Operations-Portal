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
  const extra = senders ? <NewSenders senders={senders} people={people} link={rights.link ? linkFormSender : null} /> : null
  return <InvoicesListLive data={data} st={STATES.find(x => x === state)} extra={extra} />
}
