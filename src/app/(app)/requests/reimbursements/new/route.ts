/**
 * POST /requests/reimbursements/new (Requests.dc.html 9A): a reimbursement
 * with its receipt, as one multipart form. A route and not a server action,
 * because a receipt (a phone photo, a PDF) is bigger than a server action
 * takes. The receipt goes to the private "receipts" bucket (migration 117).
 *
 * The person really signed in, never a View Stage preview.
 */

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { announceReimbursementRequested } from '@/lib/timeclock/clocky-notify'
import { localDate } from '@/lib/timeclock/format'
import { loadClients } from '@/lib/timeclock/requests-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CATEGORIES = ['Internet', 'Software', 'Equipment', 'Travel', 'Meals with a client', 'Other']
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/heic': 'heic', 'image/heif': 'heif', 'image/webp': 'webp', 'application/pdf': 'pdf' }
const MAX = 10 * 1024 * 1024
const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

export async function POST(request: Request) {
  if (await getViewAs()) return no('View Stage is only a preview. Close it to send a request.', 403)
  const access = await writerAccess()
  if (!access) return no('Sign in again to save.', 401)
  if (!access.can('rq-reimbursements')) return no('Requests is not open to your access.', 403)
  const v = await viewerFor(access)
  if (!v) return no('Your login is not linked to anyone in the Directory.', 403)
  let form: FormData
  try { form = await request.formData() } catch { return no('The request could not be read. Try again.') }

  const file = form.get('receipt')
  if (!(file instanceof File) || !file.size) return no('Add the receipt: a photo or a PDF.')
  if (file.size > MAX) return no('The receipt is over 10 MB. Send a smaller photo or PDF.')
  const ext = TYPES[file.type]
  if (!ext) return no('The receipt must be a photo (JPG, PNG, HEIC) or a PDF.')
  const spentOn = String(form.get('date') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn) || Number.isNaN(Date.parse(`${spentOn}T00:00:00Z`))) return no('Write the date of the expense, like Oct 31, 2026.')
  if (spentOn > localDate(new Date(), v.zone)) return no('The expense date cannot be after today.')
  const category = String(form.get('category') ?? '')
  if (!CATEGORIES.includes(category)) return no('Pick a category.')
  const amount = Number(String(form.get('amount') ?? '').replace(/,/g, ''))
  if (!(amount > 0 && amount < 100_000)) return no('Write the amount, like 35.00.')
  const currency = String(form.get('currency') ?? 'USD').toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) return no('Pick the currency.')
  const purpose = String(form.get('purpose') ?? '').trim().slice(0, 500)
  if (!purpose) return no('Say what it was for.')
  const clientRaw = String(form.get('client') ?? '').trim()
  const client = clientRaw && clientRaw !== 'None' ? clientRaw : null
  if (client && !(await loadClients()).includes(client)) return no('Pick a client or project from the list.')
  const billable = !!client && form.get('billable') === 'yes'

  const c = createAdminClient()
  const path = `${v.personId}/${randomUUID()}.${ext}`
  const { error: upErr } = await c.storage.from('receipts').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (upErr) { console.error('[reimbursement] upload:', upErr.message); return no('The receipt was not saved. Try again in a moment.', 500) }
  const { data, error } = await c.from('reimbursements').insert({
    person_id: v.personId, spent_on: spentOn, category, amount: Math.round(amount * 100) / 100, currency, purpose, client, billable,
    receipt_path: path, receipt_name: file.name.slice(0, 200) || `receipt.${ext}`, receipt_size: file.size, state: 'pending',
  }).select('id').single()
  if (error) {
    await c.storage.from('receipts').remove([path])
    console.error('[reimbursement] insert:', error.message)
    return no('Not saved. Try again in a moment.', 500)
  }
  await announceReimbursementRequested({ id: data.id, personId: v.personId, category, amount, currency, purpose })
  return NextResponse.json({ ok: true })
}
