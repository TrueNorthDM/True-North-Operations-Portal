// The invoice form (owner, 1 November 2026, forms mockup v3): one public
// link from Company settings > Invoices, for the people who send True North
// invoices. No portal login: they prove their email with a code, and this
// device remembers it for 30 days. While North Time is closed the page says
// so and sends nothing; a link that was replaced is not found.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { loadClients } from '@/lib/timeclock/requests-data'
import { toAddressForm } from '@/lib/address'
import { provedEmail } from '@/lib/invoice-form/device'
import { companyRates, findSender, formToday, ownRates, tokenOk } from '@/lib/invoice-form/data'
import { lastMonth, ratesFor } from '@/lib/invoice-form/rules'
import { SendClosed, SendInvoice, type SendContext } from '@/components/invoice-form/SendInvoice'
import { checkCode, checkLine, checkMonth, forgetDevice, requestCode } from '../actions'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Send an invoice', robots: { index: false, follow: false } }

export default async function SendPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!(await northTimeOpen())) return <SendClosed />
  if (!(await tokenOk(token))) notFound()
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
    }
  }
  return <SendInvoice token={token} ctx={ctx} api={{ requestCode, checkCode, forgetDevice, checkLine, checkMonth }} />
}
