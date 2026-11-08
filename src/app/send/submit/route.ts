/**
 * POST /send/submit: "Send invoice" on the public invoice form
 * (owner, 1 November 2026, forms mockup v3). A route and not a server action,
 * because receipts and their own PDF are bigger than an action takes. One
 * multipart form: `data` (the fields, as JSON), receipt_<n> for each receipt,
 * own_pdf for their own invoice.
 *
 * Every invoice is the contractor's own (leadership, 4 November 2026): their
 * own PDF (required then, with the total on it) or the lines they fill in
 * here, and the box "This is my invoice..." ticked. The sentence kept on the
 * invoice is built here from the way and the month, never taken from the page.
 *
 * No session on purpose: North Time is open (the form follows its lock), and
 * the email was proved with a code (the signed cookie). Every field is checked again here (lib/invoice-form/rules.ts), the
 * rates and the amounts are worked out here, never taken from the page.
 *
 *   In the Directory   the invoice is made at once, numbered INV, routed by
 *                      the invoice rule, and a copy goes to them by email.
 *   Not in it          it is kept for the default approver to link to a
 *                      person (Invoices, "New sender, not in the Directory");
 *                      the number comes by email then.
 *
 * Files go to the private receipts bucket through createUploadClient (the
 * firewall refuses binary uploads on the public database address).
 */

import { FORM_SLACK, bodyTooBig } from '@/lib/http/body-size'
import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createUploadClient } from '@/lib/supabase/admin'
import { allCountries } from '@/lib/countries'
import { northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { loadClients } from '@/lib/timeclock/requests-data'
import { periodLabel } from '@/lib/timeclock/periods'
import { usd } from '@/lib/timeclock/invoice-doc'
import { confirmText } from '@/lib/timeclock/contractor-invoice'
import { provedEmail } from '@/lib/invoice-form/device'
import {
  companyRates, findSender, formToday, mailSender, monthFor, ownRates, sentBefore, storeSubmission, tellApprover, writeBackAddress, writeFormInvoice,
  type StoredFile,
} from '@/lib/invoice-form/data'
import {
  MAX_FILE, MAX_RECEIPTS, MAX_TOTAL_FILES, RECEIPT_TYPES, SNIFF_BYTES, checkSubmission, firstDuplicate, formInvoice, formRecord, itemKey, monthBounds, monthTakenText, ratesFor, sniffReceipt,
  type RawSubmission,
} from '@/lib/invoice-form/rules'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status, headers: { 'Cache-Control': 'no-store' } })
const TRY_AGAIN = 'Not sent. Try again in a moment.'
const COUNTRIES = new Set(allCountries().map(c => c.code))

export async function POST(request: Request) {
  if (!(await northTimeOpen())) return no('The invoice form is not open yet.', 409)
  const email = await provedEmail()
  if (!email) return no('Confirm your email first: your device no longer remembers it.', 401)

  let form: FormData
  if (bodyTooBig(request, MAX_TOTAL_FILES + FORM_SLACK)) return no('The files are over 45 MB together. Send smaller photos or PDFs.')
  try { form = await request.formData() } catch { return no('The invoice could not be read. Try again.') }
  const dataRaw = form.get('data')
  if (typeof dataRaw !== 'string' || dataRaw.length > 300_000) return no('The invoice could not be read. Try again.')
  let raw: RawSubmission
  try { raw = JSON.parse(dataRaw) as RawSubmission } catch { return no('The invoice could not be read. Try again.') }

  // The files: each receipt and their PDF, checked before anything is stored.
  const receiptFiles = new Map<number, { file: File; type: string; ext: string }>()
  let totalSize = 0
  for (let i = 0; i < MAX_RECEIPTS; i++) {
    const f = form.get(`receipt_${i}`)
    if (!(f instanceof File) || !f.size) continue
    const notReceipt = `Receipt ${i + 1}: send a photo (JPG, PNG, HEIC) or a PDF.`
    if (!RECEIPT_TYPES[f.type]) return no(notReceipt)
    if (f.size > MAX_FILE) return no(`Receipt ${i + 1}: the file is over 10 MB. Send a smaller photo or PDF.`)
    // The type the browser declared is never trusted alone: the first bytes must be a photo or a PDF, and the file is kept as what they show.
    const type = sniffReceipt(new Uint8Array(await f.slice(0, SNIFF_BYTES).arrayBuffer()))
    if (!type) return no(notReceipt)
    receiptFiles.set(i, { file: f, type, ext: RECEIPT_TYPES[type] })
    totalSize += f.size
  }
  const pdfRaw = form.get('own_pdf')
  const pdf = pdfRaw instanceof File && pdfRaw.size ? pdfRaw : null
  if (pdf) {
    if (pdf.type !== 'application/pdf' || pdf.size > MAX_FILE) return no('Your own invoice must be a PDF of up to 10 MB.')
    const head = Buffer.from(await pdf.slice(0, 5).arrayBuffer()).toString('latin1')
    if (head !== '%PDF-') return no('Your own invoice must be a PDF of up to 10 MB.')
    totalSize += pdf.size
  }
  if (totalSize > MAX_TOTAL_FILES) return no('The files are over 45 MB together. Send smaller photos or PDFs.')

  let checked: ReturnType<typeof checkSubmission>
  let settings: Awaited<ReturnType<typeof loadInvoiceSettings>>
  let sender: Awaited<ReturnType<typeof findSender>>
  try {
    const [s, clients, who] = await Promise.all([loadInvoiceSettings(), loadClients(), findSender(email)])
    settings = s
    sender = who
    checked = checkSubmission(raw, { today: formToday(), clients, mileageRate: s.mileageRate, files: new Set(receiptFiles.keys()), countryOk: code => COUNTRIES.has(code), ownPdf: !!pdf })
  } catch (e) {
    console.error('[invoice form] read:', e instanceof Error ? e.message : e)
    return no(TRY_AGAIN, 500)
  }
  if (!checked.ok) return no(checked.error)
  const sub = checked.value
  const monthName = periodLabel(monthBounds(sub.month)).full
  // The sentence they ticked, word for word as the page showed it, built here.
  const confirmed = confirmText(sub.madeBy, monthName)
  const now = new Date()

  const files = createUploadClient()
  const stored: string[] = []
  const removeStored = async () => { if (stored.length) await files.storage.from('receipts').remove(stored).catch(() => null) }
  try {
    const rates = ratesFor(companyRates(settings), sender ? await ownRates(sender.personId) : null)
    const month = await monthFor(email, sender?.personId ?? null, sub.month)
    if (month.kind === 'taken') return no(monthTakenText(monthName, settings.billingEmail), 409)
    if (sub.work.kind === 'deliverables') {
      const sent = await sentBefore(sub.work.items.map(i => itemKey(i.name)), month.kind === 'again' ? month.invoiceId : null)
      const dup = firstDuplicate(sub.work.items, sent, formToday())
      if (dup) return no(dup.error, 409)
    }

    // Stored under the person, as the portal's own receipts are, or under form/ until a new sender is linked.
    const folder = sender ? sender.personId : 'form'
    const receipts = new Map<number, StoredFile>()
    for (const [i, { file, type, ext }] of receiptFiles) {
      if (!sub.reimbursements.some(r => r.file === i)) continue
      const path = `${folder}/${randomUUID()}.${ext}`
      const { error } = await files.storage.from('receipts').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: type, upsert: false })
      if (error) throw new Error(`upload: ${error.message}`)
      stored.push(path)
      receipts.set(i, { path, name: file.name.slice(0, 200) || `receipt.${ext}`, size: file.size })
    }
    // Their PDF only goes with their own file; filled in here, the portal makes the PDF.
    let ownPdf: StoredFile | null = null
    if (pdf && sub.madeBy === 'own_file') {
      const path = `${folder}/${randomUUID()}.pdf`
      const { error } = await files.storage.from('receipts').upload(path, Buffer.from(await pdf.arrayBuffer()), { contentType: 'application/pdf', upsert: false })
      if (error) throw new Error(`upload: ${error.message}`)
      stored.push(path)
      ownPdf = { path, name: pdf.name.slice(0, 200) || 'invoice.pdf', size: pdf.size }
    }

    const { lines, total } = formInvoice(sub, rates)
    const mailLines = lines.map(l => ({ text: l.kind === 'reimbursement' ? `Reimbursement: ${l.client}, ${l.description}` : l.description, amount: usd(l.amount) }))
    if (sender) {
      const record = formRecord(sub, { rates, sentBy: sender.personId, email, confirmed, ownPdf })
      const made = await writeFormInvoice({ personId: sender.personId, email, sub, rates, receipts, ownPdf, againId: month.kind === 'again' ? month.invoiceId : null, record, sentAt: now, now })
      if (sub.saveToRecord) await writeBackAddress(sender.personId, sub.sender)
      await tellApprover({ invoiceId: made.id, submissionId: null, personId: sender.personId, text: `${made.number} (${sub.sender.name}, ${usd(total)}) came from the invoice form for ${monthName}. It waits for your approval.`, plain: `${made.number} (${sub.sender.name}) came from the invoice form for ${monthName}. It waits for your approval.` })
      await mailSender(email, { kind: 'received', number: made.number, month: monthName, total: usd(total), lines: mailLines }, `received:${made.id}:${Date.now()}`)
      return NextResponse.json({ ok: true, number: made.number, email, madeBy: sub.madeBy, sentAt: now.toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const id = await storeSubmission({ email, sub, rates, receipts, ownPdf, confirmed })
    await tellApprover({ invoiceId: null, submissionId: id, personId: null, text: `${sub.sender.name} (${email}) sent an invoice for ${monthName} through the invoice form and is not in the Directory. Link it to a person in Invoices.` })
    await mailSender(email, { kind: 'received', number: null, month: monthName, total: usd(total), lines: mailLines }, `received:s${id}`)
    return NextResponse.json({ ok: true, number: null, email, madeBy: sub.madeBy, sentAt: now.toISOString() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('[invoice form] send:', e instanceof Error ? e.message : e)
    await removeStored()
    // Two sends of the same month at once: the database's one-a-month index refuses the second.
    if (e instanceof Error && /invoices_form_once|invoice_form_submissions_once/.test(e.message)) return no(monthTakenText(monthName, settings.billingEmail), 409)
    return no(TRY_AGAIN, 500)
  }
}
