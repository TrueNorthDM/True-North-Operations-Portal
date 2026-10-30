/**
 * POST /requests/reimbursements/new (Requests.dc.html 9A): a reimbursement
 * request with its receipts, as one multipart form. A route and not a server
 * action, because receipts (phone photos, PDFs) are bigger than a server action
 * takes. Each receipt goes to the private "receipts" bucket (migration 117).
 *
 * One request can carry several receipts (owner, 2026-10-23: a trip's flight,
 * hotel, Ubers and meals): the fields are numbered (receipt_0, date_0, ...
 * receipt_1, ...) with `count`, and the request may have a name. Several
 * receipts, or a name, make a report (migration 122) that groups them; each
 * receipt stays its own reimbursement, decided and paid on its own. All are
 * checked before any is stored, and either all are saved or none.
 *
 * Tina's review (29 October 2026): a Mileage line has miles instead of an
 * amount (miles times the company's rate, worked out here, never taken from
 * the form) and needs no receipt; a meal while travelling is $25 at most; the
 * request's name is its event or trip.
 *
 * The person really signed in, never a View Stage preview.
 */

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient, createUploadClient } from '@/lib/supabase/admin'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { announceReimbursementReportRequested, announceReimbursementRequested } from '@/lib/timeclock/clocky-notify'
import { localDate } from '@/lib/timeclock/format'
import { loadClients } from '@/lib/timeclock/requests-data'
import { loadInvoiceSettings, loadRoutes } from '@/lib/timeclock/pay-terms'
import { CATEGORIES, MEAL_HINT, MILEAGE, mileageAmount, mileageNote, milesOf, needsReceipt, overMealCap } from '@/lib/timeclock/reimbursement-rules'
import { closedRefusal } from '@/lib/timeclock/north-time-lock'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const MAX = 10 * 1024 * 1024
/** The server takes bodies up to 50 MB; a request stays under it. */
const MAX_TOTAL = 45 * 1024 * 1024
const MAX_RECEIPTS = 20
const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

interface Item { file: File | null; ext: string; spentOn: string; category: string; amount: number; currency: string; purpose: string; client: string | null; billable: boolean; miles: number | null; rate: number | null }

export async function POST(request: Request) {
  if (await getViewAs()) return no('View Stage is only a preview. Close it to send a request.', 403)
  const closed = await closedRefusal(e => no(e, 409))
  if (closed) return closed
  const access = await writerAccess()
  if (!access) return no('Sign in again to save.', 401)
  if (!access.can('rq-reimbursements')) return no('Requests is not open to your access.', 403)
  const v = await viewerFor(access)
  if (!v) return no('Your login is not linked to anyone in the Directory.', 403)
  let form: FormData
  try { form = await request.formData() } catch { return no('The request could not be read. Try again.') }

  // One receipt with plain field names (as before), or `count` numbered ones.
  const numbered = form.has('count')
  const count = numbered ? Number(form.get('count')) : 1
  if (!Number.isInteger(count) || count < 1) return no('Add at least one receipt.')
  if (count > MAX_RECEIPTS) return no(`Send up to ${MAX_RECEIPTS} receipts at a time.`)
  const field = (k: string, i: number) => form.get(numbered ? `${k}_${i}` : k)
  const today = localDate(new Date(), v.zone)
  // A contractor's receipts go on a USD invoice, so they come in dollars (owner, 24 October 2026).
  const [clients, routes, settings] = await Promise.all([loadClients(), loadRoutes([v.personId]), loadInvoiceSettings()])
  const contractor = routes.get(v.personId)?.isContractor ?? false
  const items: Item[] = []
  let total = 0
  for (let i = 0; i < count; i++) {
    const n = count > 1 ? `Receipt ${i + 1}: ` : ''
    const category = String(field('category', i) ?? '')
    if (!CATEGORIES.includes(category)) return no(`${n}pick a category.`)
    // Every category needs its receipt but Mileage, where a receipt is optional.
    const sent = field('receipt', i)
    const file = sent instanceof File && sent.size ? sent : null
    if (!file && needsReceipt(category)) return no(`${n}add the receipt: a photo or a PDF.`)
    let ext = ''
    if (file) {
      if (file.size > MAX) return no(`${n}the receipt is over 10 MB. Send a smaller photo or PDF.`)
      ext = TYPES[file.type] ?? ''
      if (!ext) return no(`${n}the receipt must be a photo (JPG, PNG, HEIC) or a PDF.`)
      total += file.size
    }
    const spentOn = String(field('date', i) ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || Number.isNaN(Date.parse(`${spentOn}T00:00:00Z`))) return no(`${n}write the date of the expense, like Oct 31, 2026.`)
    if (spentOn > today) return no(`${n}the expense date cannot be after today.`)
    // A Mileage line keeps room for the miles and rate added to it.
    let purpose = String(field('purpose', i) ?? '').trim().slice(0, category === MILEAGE ? 440 : 500)
    if (!purpose) return no(`${n}say what it was for.`)
    let amount: number, currency: string, miles: number | null = null, rate: number | null = null
    if (category === MILEAGE) {
      // The amount is worked out here from the miles and the company's rate, in dollars.
      miles = milesOf(String(field('miles', i) ?? ''))
      if (miles == null) return no(`${n}write the miles, like 120.`)
      rate = settings.mileageRate
      amount = mileageAmount(miles, rate)
      currency = 'USD'
      purpose += mileageNote(miles, rate)
    } else {
      amount = Number(String(field('amount', i) ?? '').replace(/,/g, ''))
      if (!(amount > 0 && amount < 100_000)) return no(`${n}write the amount, like 35.00.`)
      currency = String(field('currency', i) ?? 'USD').toUpperCase()
      if (!/^[A-Z]{3}$/.test(currency)) return no(`${n}pick the currency.`)
      if (contractor && currency !== 'USD') return no(`${n}write the amount in US dollars: your invoice is in USD.`)
      if (overMealCap(category, amount, currency)) return no(`${n}${MEAL_HINT}`)
    }
    const clientRaw = String(field('client', i) ?? '').trim()
    const client = clientRaw && clientRaw !== 'None' ? clientRaw : null
    if (client && !clients.includes(client)) return no(`${n}pick a client or project from the list.`)
    items.push({ file, ext, spentOn, category, amount: Math.round(amount * 100) / 100, currency, purpose, client, billable: !!client && field('billable', i) === 'yes', miles, rate })
  }
  if (total > MAX_TOTAL) return no('The receipts are over 45 MB together. Send smaller photos, or split the request.')
  const name = String(form.get('name') ?? '').trim().slice(0, 120) || null

  const c = createAdminClient()
  const files = createUploadClient()
  const paths: string[] = []
  // Each item's stored receipt, or null (a Mileage line sent without one).
  const pathOf: (string | null)[] = []
  const undo = async (reportId: number | null) => {
    if (paths.length) await files.storage.from('receipts').remove(paths)
    if (reportId) await c.from('reimbursement_reports').delete().eq('id', reportId)
  }
  for (const it of items) {
    if (!it.file) { pathOf.push(null); continue }
    const path = `${v.personId}/${randomUUID()}.${it.ext}`
    const { error } = await files.storage.from('receipts').upload(path, Buffer.from(await it.file.arrayBuffer()), { contentType: it.file.type, upsert: false })
    if (error) { console.error('[reimbursement] upload:', error.message); await undo(null); return no('The receipts were not saved. Try again in a moment.', 500) }
    paths.push(path)
    pathOf.push(path)
  }
  let reportId: number | null = null
  if (items.length > 1 || name) {
    const { data: rep, error } = await c.from('reimbursement_reports').insert({ person_id: v.personId, name }).select('id').single()
    if (error) { console.error('[reimbursement] report:', error.message); await undo(null); return no('Not saved. Try again in a moment.', 500) }
    reportId = rep.id
  }
  const { data, error } = await c.from('reimbursements').insert(items.map((it, i) => ({
    person_id: v.personId, spent_on: it.spentOn, category: it.category, amount: it.amount, currency: it.currency, purpose: it.purpose,
    client: it.client, billable: it.billable, receipt_path: pathOf[i],
    receipt_name: it.file ? it.file.name.slice(0, 200) || `receipt.${it.ext}` : null, receipt_size: it.file?.size ?? null,
    miles: it.miles, mileage_rate: it.rate, state: 'pending', report_id: reportId,
  }))).select('id').order('id')
  if (error || !data?.length) {
    console.error('[reimbursement] insert:', error?.message)
    await undo(reportId)
    return no('Not saved. Try again in a moment.', 500)
  }
  if (reportId) {
    await announceReimbursementReportRequested({ firstId: data[0].id, personId: v.personId, name, items: items.map(it => ({ amount: it.amount, currency: it.currency })) })
  } else {
    const it = items[0]
    await announceReimbursementRequested({ id: data[0].id, personId: v.personId, category: it.category, amount: it.amount, currency: it.currency, purpose: it.purpose })
  }
  return NextResponse.json({ ok: true })
}
