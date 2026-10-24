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
 * The person really signed in, never a View Stage preview.
 */

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { announceReimbursementReportRequested, announceReimbursementRequested } from '@/lib/timeclock/clocky-notify'
import { localDate } from '@/lib/timeclock/format'
import { loadClients } from '@/lib/timeclock/requests-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CATEGORIES = ['Internet', 'Software', 'Equipment', 'Travel', 'Meals with a client', 'Other']
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const MAX = 10 * 1024 * 1024
/** The server takes bodies up to 50 MB; a request stays under it. */
const MAX_TOTAL = 45 * 1024 * 1024
const MAX_RECEIPTS = 20
const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

interface Item { file: File; ext: string; spentOn: string; category: string; amount: number; currency: string; purpose: string; client: string | null; billable: boolean }

export async function POST(request: Request) {
  if (await getViewAs()) return no('View Stage is only a preview. Close it to send a request.', 403)
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
  const clients = await loadClients()
  const items: Item[] = []
  let total = 0
  for (let i = 0; i < count; i++) {
    const n = count > 1 ? `Receipt ${i + 1}: ` : ''
    const file = field('receipt', i)
    if (!(file instanceof File) || !file.size) return no(`${n}add the receipt: a photo or a PDF.`)
    if (file.size > MAX) return no(`${n}the receipt is over 10 MB. Send a smaller photo or PDF.`)
    const ext = TYPES[file.type]
    if (!ext) return no(`${n}the receipt must be a photo (JPG, PNG, HEIC) or a PDF.`)
    total += file.size
    const spentOn = String(field('date', i) ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || Number.isNaN(Date.parse(`${spentOn}T00:00:00Z`))) return no(`${n}write the date of the expense, like Oct 31, 2026.`)
    if (spentOn > today) return no(`${n}the expense date cannot be after today.`)
    const category = String(field('category', i) ?? '')
    if (!CATEGORIES.includes(category)) return no(`${n}pick a category.`)
    const amount = Number(String(field('amount', i) ?? '').replace(/,/g, ''))
    if (!(amount > 0 && amount < 100_000)) return no(`${n}write the amount, like 35.00.`)
    const currency = String(field('currency', i) ?? 'USD').toUpperCase()
    if (!/^[A-Z]{3}$/.test(currency)) return no(`${n}pick the currency.`)
    const purpose = String(field('purpose', i) ?? '').trim().slice(0, 500)
    if (!purpose) return no(`${n}say what it was for.`)
    const clientRaw = String(field('client', i) ?? '').trim()
    const client = clientRaw && clientRaw !== 'None' ? clientRaw : null
    if (client && !clients.includes(client)) return no(`${n}pick a client or project from the list.`)
    items.push({ file, ext, spentOn, category, amount: Math.round(amount * 100) / 100, currency, purpose, client, billable: !!client && field('billable', i) === 'yes' })
  }
  if (total > MAX_TOTAL) return no('The receipts are over 45 MB together. Send smaller photos, or split the request.')
  const name = String(form.get('name') ?? '').trim().slice(0, 120) || null

  const c = createAdminClient()
  const paths: string[] = []
  const undo = async (reportId: number | null) => {
    if (paths.length) await c.storage.from('receipts').remove(paths)
    if (reportId) await c.from('reimbursement_reports').delete().eq('id', reportId)
  }
  for (const it of items) {
    const path = `${v.personId}/${randomUUID()}.${it.ext}`
    const { error } = await c.storage.from('receipts').upload(path, Buffer.from(await it.file.arrayBuffer()), { contentType: it.file.type, upsert: false })
    if (error) { console.error('[reimbursement] upload:', error.message); await undo(null); return no('The receipts were not saved. Try again in a moment.', 500) }
    paths.push(path)
  }
  let reportId: number | null = null
  if (items.length > 1 || name) {
    const { data: rep, error } = await c.from('reimbursement_reports').insert({ person_id: v.personId, name }).select('id').single()
    if (error) { console.error('[reimbursement] report:', error.message); await undo(null); return no('Not saved. Try again in a moment.', 500) }
    reportId = rep.id
  }
  const { data, error } = await c.from('reimbursements').insert(items.map((it, i) => ({
    person_id: v.personId, spent_on: it.spentOn, category: it.category, amount: it.amount, currency: it.currency, purpose: it.purpose,
    client: it.client, billable: it.billable, receipt_path: paths[i], receipt_name: it.file.name.slice(0, 200) || `receipt.${it.ext}`,
    receipt_size: it.file.size, state: 'pending', report_id: reportId,
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
