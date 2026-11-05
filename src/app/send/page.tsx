// The invoice form (owner, 1 November 2026, forms mockup v3): one public
// link, /send, the same for everyone and for good (owner: "um link unico que
// nao muda"), shown in Company settings > Invoices. No portal login: they
// prove their email with a code, and this device remembers it for 30 days.
// While North Time is closed the page says so and sends nothing.

import type { Metadata } from 'next'
import { northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { loadClients } from '@/lib/timeclock/requests-data'
import { toAddressForm } from '@/lib/address'
import { confirmText } from '@/lib/timeclock/contractor-invoice'
import { provedEmail } from '@/lib/invoice-form/device'
import { companyRates, findSender, formToday, ownRates } from '@/lib/invoice-form/data'
import { MONTH_SLOT, lastMonth, ratesFor } from '@/lib/invoice-form/rules'
import { SendClosed, SendInvoice, type SendContext } from '@/components/invoice-form/SendInvoice'
import { checkCode, checkLine, checkMonth, forgetDevice, requestCode } from './actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Send an invoice', robots: { index: false, follow: false } }

export default async function SendPage() {
  if (!(await northTimeOpen())) return <SendClosed />
  const email = await provedEmail()
  let ctx: SendContext | null = null
  if (email) {
    const [settings, clients, sender] = await Promise.all([loadInvoiceSettings(), loadClients(), findSender(email)])
    const rates = ratesFor(companyRates(settings), sender ? await ownRates(sender.personId) : null)
    const address = toAddressForm(sender?.address)
    const today = formToday()
    ctx = {
      email,
      // Only what is theirs: their own name and address, never anyone else's.
      found: sender ? { name: sender.name, address } : null,
      rates,
      mileageRate: settings.mileageRate,
      clients,
      billTo: { name: settings.billingName ?? 'True North Digital Marketing', address: settings.billingAddress ?? '', email: settings.billingEmail ?? '' },
      paymentDays: settings.paymentDays,
      today,
      defaultMonth: lastMonth(today),
      // The sentence they tick (leadership, 4 November 2026), from its one source; the page puts the month in.
      confirm: { own_file: confirmText('own_file', MONTH_SLOT), builder: confirmText('builder', MONTH_SLOT) },
    }
  }
  return <SendInvoice ctx={ctx} api={{ requestCode, checkCode, forgetDevice, checkLine, checkMonth }} />
}
