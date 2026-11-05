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
 * the form) and needs no receipt; the request's name is its event or trip.
 * Each receipt is checked by readItem (reimbursement-form.ts), as an edit is.
 *
 * One approval for the same event (owner, 5 November 2026): a request whose
 * event or trip has the name of one the person still has entirely waiting
 * (case and spaces ignored) joins it, so its decider approves the whole event
 * at once. One already partly decided gets a new request, as before, also
 * when it was decided while the receipts were joining it (checked again after).
 *
 * Each receipt gets its number (RCT-2026-005, migration 145), the name of its
 * file in downloads and in Google Drive; the name it was sent with is kept.
 * Anyone may ask: employees and contractors alike. Anyone on the
 * Reimbursements list decides (Company settings, Who approves what); the
 * answer's toast names them.
 *
 * The person really signed in, never a View Stage preview.
 */

import { NextResponse } from 'next/server'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { allRows, viewerFor, type Viewer } from '@/lib/timeclock/clocky-context'
import { closedRefusal } from '@/lib/timeclock/north-time-lock'
import { createAdminClient } from '@/lib/supabase/admin'
import { announceReimbursementChanged, announceReimbursementReportRequested, announceReimbursementRequested } from '@/lib/timeclock/clocky-notify'
import { allWaiting, joinableReport, joinedToast, reportTitle, totalsText } from '@/lib/timeclock/reimbursement-reports'
import { snapshotOf } from '@/lib/timeclock/reimbursement-form'
import { dropReceipts, itemRules, logRmbChanges, nextReceiptNumber, no, readItems, rmbDeciderNames, storeReceipt } from '@/lib/timeclock/reimbursement-store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The person really signed in, never a View Stage preview, while North Time is open; or the refusal. */
async function writer(): Promise<Viewer | NextResponse> {
  if (await getViewAs()) return no('View Stage is only a preview. Close it to send a request.', 403)
  const closed = await closedRefusal(e => no(e, 409))
  if (closed) return closed
  const access = await writerAccess()
  if (!access) return no('Sign in again to save.', 401)
  if (!access.can('rq-reimbursements')) return no('Requests is not open to your access.', 403)
  return (await viewerFor(access)) ?? no('Your login is not linked to anyone in the Directory.', 403)
}

export async function POST(request: Request) {
  const v = await writer()
  if (v instanceof NextResponse) return v
  let form: FormData
  try { form = await request.formData() } catch { return no('The request could not be read. Try again.') }

  const read = readItems(form, await itemRules(v))
  if (typeof read === 'string') return no(read)
  const { items } = read
  const name = String(form.get('name') ?? '').trim().slice(0, 120) || null

  const c = createAdminClient()
  // The same event still entirely waiting: the receipts join that request.
  let joinId: number | null = null
  if (name) {
    try {
      const reports = await allRows<{ id: number; name: string | null }>((a, b) => c.from('reimbursement_reports').select('id, name').eq('person_id', v.personId).not('name', 'is', null).order('id').range(a, b), 'Reimbursement requests could not be read')
      const ids = reports.map(r => r.id)
      const rows = ids.length ? await allRows<{ report_id: number | null; state: string }>((a, b) => c.from('reimbursements').select('report_id, state').eq('person_id', v.personId).in('report_id', ids).order('id').range(a, b), 'Reimbursements could not be read') : []
      joinId = joinableReport(reports, rows, name)
    } catch (e) {
      // Not read: a new request, as before, rather than none.
      console.error('[reimbursement] same event:', (e as Error).message)
    }
  }

  const paths: string[] = []
  // Each item's stored receipt, or null (a Mileage line sent without one).
  const pathOf: (string | null)[] = []
  const undo = async (reportId: number | null) => {
    await dropReceipts(paths)
    if (reportId) await c.from('reimbursement_reports').delete().eq('id', reportId)
  }
  for (const it of items) {
    if (!it.file) { pathOf.push(null); continue }
    const path = await storeReceipt(v.personId, it.file, it.ext)
    if (!path) { await undo(null); return no('The receipts were not saved. Try again in a moment.', 500) }
    paths.push(path)
    pathOf.push(path)
  }
  // Each receipt's own number, in the order sent; its file is named by it.
  const numberOf: (string | null)[] = []
  for (const p of pathOf) {
    if (!p) { numberOf.push(null); continue }
    const n = await nextReceiptNumber()
    if (!n) { await undo(null); return no('Not saved. Try again in a moment.', 500) }
    numberOf.push(n)
  }
  let reportId: number | null = joinId
  let made: number | null = null
  if (!reportId && (items.length > 1 || name)) {
    const { data: rep, error } = await c.from('reimbursement_reports').insert({ person_id: v.personId, name }).select('id').single()
    if (error) { console.error('[reimbursement] report:', error.message); await undo(null); return no('Not saved. Try again in a moment.', 500) }
    reportId = made = rep.id
  }
  const rows = items.map((it, i) => ({
    person_id: v.personId, spent_on: it.spentOn, category: it.category, amount: it.amount, currency: it.currency, purpose: it.purpose,
    client: it.client, billable: it.billable, receipt_path: pathOf[i], receipt_number: numberOf[i],
    receipt_name: it.file ? it.file.name.slice(0, 200) || `receipt.${it.ext}` : null, receipt_size: it.file?.size ?? null,
    miles: it.miles, mileage_rate: it.rate, state: 'pending', report_id: reportId,
  }))
  const { data, error } = await c.from('reimbursements').insert(rows).select('id').order('id')
  if (error || !data?.length) {
    console.error('[reimbursement] insert:', error?.message)
    await undo(made)
    return no('Not saved. Try again in a moment.', 500)
  }

  // Joined, then checked again (audit, 5 November 2026): a request decided between the read above and the
  // insert is no longer all waiting, and the new receipts could never be edited there. They become their own.
  if (joinId) {
    const { data: after, error: aErr } = await c.from('reimbursements').select('id, state').eq('report_id', joinId)
    if (aErr) console.error('[reimbursement] same event, again:', aErr.message)
    if (aErr || !allWaiting(after ?? [])) {
      const ids = data.map(d => d.id)
      const { data: rep, error: rErr } = await c.from('reimbursement_reports').insert({ person_id: v.personId, name }).select('id').single()
      const moved = rErr ? null : await c.from('reimbursements').update({ report_id: rep.id }).in('id', ids).eq('state', 'pending').select('id')
      if (rErr || !moved || moved.error) {
        console.error('[reimbursement] own request:', (rErr ?? moved?.error)?.message)
        await c.from('reimbursements').delete().in('id', ids).eq('state', 'pending')
        await undo(rErr ? null : rep.id)
        return no('Not saved. Try again in a moment.', 500)
      }
      joinId = null
      reportId = rep.id
    }
  }

  if (joinId) {
    // The whole request now, for the bell and the toast; what joined is kept in its history.
    const at = new Date().toISOString()
    const { data: all } = await c.from('reimbursements').select('id, amount, currency').eq('report_id', joinId).eq('state', 'pending').order('id')
    const list = all ?? []
    await logRmbChanges(v.personId, at, data.map((d, i) => ({ action: 'joined' as const, reimbursementId: d.id, reportId: joinId, after: snapshotOf(rows[i]) })))
    const { data: rep } = await c.from('reimbursement_reports').select('name').eq('id', joinId).maybeSingle()
    const shown = rep?.name ?? name ?? ''
    await announceReimbursementChanged({
      firstId: list[0]?.id ?? data[0].id, personId: v.personId, what: 'joined', added: data.length, at,
      title: reportTitle(shown, list.length), total: totalsText(list.map(x => ({ amount: Number(x.amount), currency: x.currency }))),
    })
    return NextResponse.json({ ok: true, toast: joinedToast(shown, list.length) })
  }
  if (reportId) {
    await announceReimbursementReportRequested({ firstId: data[0].id, personId: v.personId, name, items: items.map(it => ({ amount: it.amount, currency: it.currency })) })
  } else {
    const it = items[0]
    await announceReimbursementRequested({ id: data[0].id, personId: v.personId, category: it.category, amount: it.amount, currency: it.currency, purpose: it.purpose })
  }
  // "Sent. David Sharpe decides; you hear back in the bell." Saved either way: a name not read is no failure.
  const names = await rmbDeciderNames(v.personId)
  return NextResponse.json({ ok: true, toast: names ? `Sent. ${names} decides; you hear back in the bell.` : 'Sent. You hear back in the bell.' })
}
