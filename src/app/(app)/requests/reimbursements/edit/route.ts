/**
 * POST /requests/reimbursements/edit: the person changes their own request
 * while every receipt of it is still waiting (owner, 5 November 2026, from
 * Tina's feedback). The New reimbursement form, filled in with the request,
 * sends it back whole, as one multipart form (a route, as new/route.ts, for the
 * receipt files):
 *
 *   target            "report:<id>" (a request with a name or several
 *                     receipts) or "item:<id>" (one receipt with no name)
 *   name, count       as a new request
 *   rid_<i>           the receipt it was (its id), or empty for one added
 *   keep_<i>          "yes": its stored file stays (no new one sent)
 *   receipt_<i> ...   the same fields as a new request, checked the same way
 *                     (readItem, reimbursement-form.ts)
 *
 * A receipt left out of the form is removed. A new file replaces the stored
 * one. Only their own, only while nothing in it is decided: every write is
 * also guarded by state = pending, so a decision made meanwhile wins. Every
 * change is kept with who, when and the values before and after
 * (reimbursement_changes, migration 153), and whoever decides hears of it in
 * the bell.
 *
 * The person really signed in, never a View Stage preview.
 */

import { NextResponse } from 'next/server'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { viewerFor, type Viewer } from '@/lib/timeclock/clocky-context'
import { closedRefusal } from '@/lib/timeclock/north-time-lock'
import { createAdminClient } from '@/lib/supabase/admin'
import { announceReimbursementChanged } from '@/lib/timeclock/clocky-notify'
import { allWaiting, reportTitle, totalsText } from '@/lib/timeclock/reimbursement-reports'
import { changedFields, snapshotOf, type RmbSnapshot } from '@/lib/timeclock/reimbursement-form'
import { dropReceipts, itemRules, logRmbChanges, nextReceiptNumber, no, readItems, rmbDeciderNames, badReceipt, storeReceipt, uncommitted, type RmbChange } from '@/lib/timeclock/reimbursement-store'

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

const DECIDED = 'This request is no longer waiting: part of it has been decided. Reload the page to see where it is.'
const NOT_SAVED = 'Not saved. Try again in a moment.'

export async function POST(request: Request) {
  const v = await writer()
  if (v instanceof NextResponse) return v
  let form: FormData
  try { form = await request.formData() } catch { return no('The request could not be read. Try again.') }

  const target = /^(report|item):(\d+)$/.exec(String(form.get('target') ?? ''))
  if (!target) return no('Pick the request to change.')
  const c = createAdminClient()
  const cols = 'id, person_id, report_id, state, spent_on, category, amount, currency, purpose, client, billable, miles, mileage_rate, receipt_path, receipt_name, receipt_number'
  const read = target[1] === 'report'
    ? await c.from('reimbursements').select(cols).eq('report_id', Number(target[2])).order('id')
    : await c.from('reimbursements').select(cols).eq('id', Number(target[2])).is('report_id', null)
  if (read.error) { console.error('[reimbursement edit] read:', read.error.message); return no(NOT_SAVED, 500) }
  const old = read.data ?? []
  // Someone else's, or gone: the same answer, so nothing is learnt about other people's requests.
  if (!old.length || old.some(r => r.person_id !== v.personId)) return no('That request is not yours to change.', 404)
  if (!allWaiting(old)) return no(DECIDED, 409)
  const byId = new Map(old.map(r => [r.id, r]))

  // Which stored receipt each line was, before any is checked: a line keeps its file only when it was one of these.
  const count = Number(form.get('count'))
  const ridOf: (number | null)[] = []
  for (let i = 0; i < (Number.isInteger(count) && count > 0 ? count : 0); i++) {
    const raw = String(form.get(`rid_${i}`) ?? '').trim()
    if (!raw) { ridOf.push(null); continue }
    const id = Number(raw)
    if (!byId.has(id) || ridOf.includes(id)) return no('That receipt is not part of this request. Reload the page and try again.')
    ridOf.push(id)
  }
  const keeps = (i: number) => ridOf[i] != null && form.get(`keep_${i}`) === 'yes' && !!byId.get(ridOf[i]!)?.receipt_path
  // A Mileage line whose miles did not change keeps its stored rate and amount; new or changed ones use today's rate.
  const checked = readItems(form, await itemRules(v), keeps, i => (ridOf[i] != null ? byId.get(ridOf[i]!) ?? null : null))
  if (typeof checked === 'string') return no(checked)
  const { items } = checked
  const name = String(form.get('name') ?? '').trim().slice(0, 120) || null

  // Each receipt's bytes must be a photo or a PDF, whatever the browser called it.
  const bad = await badReceipt(items)
  if (bad) return no(bad)

  // New files first: nothing is changed until every one is stored and numbered.
  const stored: string[] = []
  const fileOf: ({ path: string; number: string | null } | null)[] = []
  for (const it of items) {
    if (!it.file) { fileOf.push(null); continue }
    const path = await storeReceipt(v.personId, it.file)
    if (!path) { await dropReceipts(stored); return no('The receipts were not saved. Try again in a moment.', 500) }
    stored.push(path)
    fileOf.push({ path, number: null })
  }
  for (const f of fileOf) {
    if (!f) continue
    f.number = await nextReceiptNumber()
    if (!f.number) { await dropReceipts(stored); return no(NOT_SAVED, 500) }
  }

  const at = new Date().toISOString()
  // One receipt with no name that gets a name or more receipts becomes a request with a report (migration 122).
  let reportId: number | null = target[1] === 'report' ? Number(target[2]) : null
  let madeReport: number | null = null
  if (reportId == null && (items.length > 1 || name)) {
    const { data: rep, error } = await c.from('reimbursement_reports').insert({ person_id: v.personId, name }).select('id').single()
    if (error) { console.error('[reimbursement edit] report:', error.message); await dropReceipts(stored); return no(NOT_SAVED, 500) }
    reportId = madeReport = rep.id
  }

  const changes: RmbChange[] = []
  if (madeReport) changes.push({ action: 'edited', reimbursementId: null, reportId: madeReport, reason: name ? `Named "${name}"` : 'More receipts: now one request' })
  const dropLater: (string | null)[] = []
  // New files written into a row (updated or added): those stay on a later failure, as their row does.
  const committed = new Set<string>()
  const fail = async (msg: string, e?: { message: string } | null) => {
    if (e) console.error('[reimbursement edit]', e.message)
    // Only the new files no row took; and the old files of rows already changed or removed, which nothing uses now.
    await dropReceipts([...uncommitted(stored, committed), ...dropLater])
    // A report made for this edit goes (its receipts' report_id goes empty with it); what was saved before stays, with its history.
    if (madeReport) { await c.from('reimbursements').update({ report_id: null }).eq('report_id', madeReport); await c.from('reimbursement_reports').delete().eq('id', madeReport) }
    await logRmbChanges(v.personId, at, madeReport ? changes.slice(1) : changes)
    return no(msg, e ? 500 : 409)
  }

  type Receipt = { receipt_path: string | null; receipt_number: string | null; receipt_name: string | null; receipt_size: number | null }
  const NONE: Receipt = { receipt_path: null, receipt_number: null, receipt_name: null, receipt_size: null }
  // Each line: the receipt it was, changed; or a new one.
  const kept = new Set<number>()
  for (const [i, it] of items.entries()) {
    const rid = ridOf[i]
    const f = fileOf[i]
    const prev = rid != null ? byId.get(rid)! : null
    // A new file replaces the stored one; a kept one stays; else none (a Mileage line, which needs none).
    const receipt: Receipt | null = f
      ? { receipt_path: f.path, receipt_number: f.number, receipt_name: it.file!.name.slice(0, 200) || `receipt.${it.ext}`, receipt_size: it.file!.size }
      : prev && keeps(i) ? null : NONE
    const values = {
      spent_on: it.spentOn, category: it.category, amount: it.amount, currency: it.currency, purpose: it.purpose,
      client: it.client, billable: it.billable, miles: it.miles, mileage_rate: it.rate, report_id: reportId,
    }
    if (prev) {
      kept.add(prev.id)
      const before = snapshotOf(prev)
      const after: RmbSnapshot = snapshotOf({ ...prev, ...values, ...(receipt ?? {}) })
      const differs = changedFields(before, after).length > 0 || (!!receipt && receipt.receipt_path !== prev.receipt_path)
      if (!differs && prev.report_id === reportId) continue
      const { data, error } = await c.from('reimbursements').update({ ...values, ...(receipt ?? {}) }).eq('id', prev.id).eq('person_id', v.personId).eq('state', 'pending').select('id')
      if (error) return fail(NOT_SAVED, error)
      if (!data?.length) return fail(DECIDED)
      if (f) committed.add(f.path)
      if (receipt && receipt.receipt_path !== prev.receipt_path) dropLater.push(prev.receipt_path)
      if (differs) changes.push({ action: 'edited', reimbursementId: prev.id, reportId, before, after })
    } else {
      const row = { ...values, ...(receipt ?? NONE), person_id: v.personId, state: 'pending' }
      const { data, error } = await c.from('reimbursements').insert(row).select('id').single()
      if (error) return fail(NOT_SAVED, error)
      if (f) committed.add(f.path)
      changes.push({ action: 'receipt_added', reimbursementId: data.id, reportId, after: snapshotOf(row) })
    }
  }
  // Receipts left out of the form: removed. Their values stay in the history; their files go.
  for (const r of old.filter(x => !kept.has(x.id))) {
    const { data, error } = await c.from('reimbursements').delete().eq('id', r.id).eq('person_id', v.personId).eq('state', 'pending').select('id')
    if (error) return fail(NOT_SAVED, error)
    if (!data?.length) return fail(DECIDED)
    dropLater.push(r.receipt_path)
    changes.push({ action: 'receipt_removed', reimbursementId: r.id, reportId: r.report_id, before: snapshotOf(r) })
  }
  // The request's name (its event or trip).
  if (reportId != null && !madeReport) {
    const { data: rep } = await c.from('reimbursement_reports').select('name').eq('id', reportId).maybeSingle()
    if ((rep?.name ?? null) !== name) {
      const { error } = await c.from('reimbursement_reports').update({ name }).eq('id', reportId).eq('person_id', v.personId)
      if (error) return fail(NOT_SAVED, error)
      changes.push({ action: 'edited', reimbursementId: null, reportId, reason: `Name: "${rep?.name ?? ''}" to "${name ?? ''}"` })
    }
  }
  await logRmbChanges(v.personId, at, changes)
  await dropReceipts(dropLater)
  if (!changes.length) return NextResponse.json({ ok: true, toast: 'Nothing changed. Your request waits as it was.' })

  const { data: now } = reportId != null
    ? await c.from('reimbursements').select('id, amount, currency, category').eq('report_id', reportId).eq('state', 'pending').order('id')
    : await c.from('reimbursements').select('id, amount, currency, category').eq('id', Number(target[2]))
  const list = now ?? []
  const total = totalsText(list.map(x => ({ amount: Number(x.amount), currency: x.currency })))
  await announceReimbursementChanged({
    firstId: list[0]?.id ?? old[0].id, personId: v.personId, what: 'edited', at, total,
    title: reportId != null ? reportTitle(name, list.length) : list[0]?.category ?? 'Reimbursement',
  })
  const names = await rmbDeciderNames(v.personId)
  return NextResponse.json({ ok: true, toast: names ? `Saved. ${names} sees the change in the bell.` : 'Saved. It still waits for a decision.' })
}
