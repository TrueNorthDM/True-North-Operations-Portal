/**
 * A contractor sends their own invoice from the portal (leadership, 4 November
 * 2026; migration 152): their own PDF, or the lines they wrote in the invoice
 * builder. A route, not a server action: their PDF can be up to 10 MB.
 *
 * Multipart: `data` (JSON) and, for an own file, `own_pdf`. Only the person
 * themselves, for a period still waiting for their invoice
 * (send-invoice-data.ts). The confirmation sentence is made here from the way
 * and the period, never taken from the browser. So is a built invoice's rate
 * or fixed amount: the one on file (owner, 5 November 2026), whatever the
 * browser sends.
 */

import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { getSessionUser } from '@/lib/auth/session'
import { createUploadClient } from '@/lib/supabase/admin'
import { northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { builderProblem, confirmText, lineAmount, linesAtFileRate, payOnFile, writeSentInvoice, type BuilderLine, type MadeBy, type SendRecord } from '@/lib/timeclock/contractor-invoice'
import { loadInvoicesToSend } from '@/lib/timeclock/send-invoice-data'
import { announceInvoiceReceived, announceTimesheetSubmitted } from '@/lib/timeclock/clocky-notify'
import { loadDirectory, db } from '@/lib/timeclock/clocky-context'
import { loadRouteSettings, loadRoutes } from '@/lib/timeclock/pay-terms'
import { currentStep, invoiceApprover, type TimesheetState } from '@/lib/timeclock/routing'
import { usd } from '@/lib/timeclock/invoice-doc'

export const dynamic = 'force-dynamic'

const MAX_PDF = 10 * 1024 * 1024
const no = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v))
const text = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

interface Body {
  start: string
  madeBy: MadeBy
  confirmed: boolean
  theirNumber?: string
  statedHours?: number | string | null
  statedTotal?: number | string | null
  covers?: string
  lines?: { description?: string; client?: string | null; hours?: number | string | null; rate?: number | string | null; amount?: number | string | null }[]
  reimbursementIds?: number[]
}

export async function POST(req: Request) {
  if (await getViewAs()) return no('View Stage is only a preview. Close it to send.')
  if (!(await northTimeOpen())) return no('North Time is not open yet.')
  const access = await writerAccess()
  if (!access?.personId) return no('Sign in again to send your invoice.', 401)
  // Invoices must be open to them, as on the page (audit, 5 November 2026).
  if (!access.can('clocky-invoices')) return no('Invoices is not open to your access.', 403)
  const me = access.personId

  let form: FormData
  try { form = await req.formData() } catch { return no('That could not be read. Try again.') }
  let b: Body
  try { b = JSON.parse(String(form.get('data') ?? '')) as Body } catch { return no('That could not be read. Try again.') }
  if (b.madeBy !== 'own_file' && b.madeBy !== 'builder') return no('Choose how you send your invoice.')

  const data = await loadInvoicesToSend(me).catch(() => null)
  if (!data) return no('Only contractors send invoices.', 403)
  const period = data.toSend.find(p => p.start === b.start)
  if (!period) return no('There is no invoice waiting for that period. Reload the page.')
  if (!b.confirmed) return no('Tick "This is my invoice" to send it.')

  // Reimbursements: only their own approved ones still waiting for an invoice.
  const rIds = [...new Set((b.reimbursementIds ?? []).map(Number))].filter(id => data.reimbursements.some(r => r.id === id))
  const rTotal = data.reimbursements.filter(r => rIds.includes(r.id)).reduce((n, r) => n + r.amount, 0)

  let lines: BuilderLine[] = []
  let total: number
  let statedHours: number | null = null
  let statedTotal: number | null = null
  const pdf = form.get('own_pdf')
  let file: File | null = null
  if (b.madeBy === 'builder') {
    // Only the descriptions, clients and hours are theirs: the rate or amount is the one on file.
    const typed: BuilderLine[] = (b.lines ?? []).slice(0, 61).map(l => ({
      description: text(l.description, 200) ?? '', client: text(l.client, 120), hours: num(l.hours), rate: null, amount: null,
    }))
    const billed = linesAtFileRate(typed, payOnFile(period.kind, data.rate, data.fixedAmount))
    if ('error' in billed) return no(billed.error)
    lines = billed.lines
    const problem = builderProblem(lines)
    if (problem) return no(problem)
    total = Math.round((lines.reduce((n, l) => n + (lineAmount(l) ?? 0), 0) + rTotal) * 100) / 100
  } else {
    if (!(pdf instanceof File) || !pdf.size) return no('Choose the PDF of your invoice.')
    if (pdf.type !== 'application/pdf' || pdf.size > MAX_PDF) return no('Your invoice must be a PDF of up to 10 MB.')
    const head = Buffer.from(await pdf.slice(0, 5).arrayBuffer()).toString('latin1')
    if (head !== '%PDF-') return no('Your invoice must be a PDF of up to 10 MB.')
    file = pdf
    statedTotal = num(b.statedTotal)
    if (statedTotal == null || !(statedTotal > 0) || statedTotal > 1_000_000) return no('Write the total on your invoice.')
    statedHours = num(b.statedHours)
    if (period.kind === 'hourly' && (statedHours == null || !(statedHours > 0) || statedHours > 744)) return no('Write the hours on your invoice.')
    total = statedTotal
  }

  // Their file goes to the private receipts bucket, as the invoice form's do.
  let ownPdf: SendRecord['ownPdf'] = null
  const files = createUploadClient()
  if (file) {
    const path = `${me}/${randomUUID()}.pdf`
    const { error } = await files.storage.from('receipts').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: 'application/pdf', upsert: false })
    if (error) { console.error('[send invoice] upload:', error.message); return no('Your file could not be saved. Try again in a moment.', 500) }
    ownPdf = { path, name: file.name.slice(0, 200) || 'Invoice.pdf' }
  }

  const dir = await loadDirectory()
  const record: SendRecord = {
    madeBy: b.madeBy, sentFrom: 'portal', sentBy: me, sentEmail: (await getSessionUser())?.email ?? null,
    confirmed: confirmText(b.madeBy, period.label), theirNumber: text(b.theirNumber, 60),
    statedHours, statedTotal, covers: text(b.covers, 500), ownPdf, lines, total,
  }
  const now = new Date()
  let sent: { id: number; number: string; total: number }
  try {
    sent = await writeSentInvoice({ personId: me, submissionId: period.submissionId, start: period.start, end: period.end, kind: period.kind, record, reimbursementIds: rIds, now })
  } catch (e) {
    if (ownPdf) await files.storage.from('receipts').remove([ownPdf.path]).catch(() => null)
    console.error('[send invoice]', e instanceof Error ? e.message : e)
    return no(e instanceof Error && /already/.test(e.message) ? e.message : 'Your invoice was not sent. Try again in a moment.', 500)
  }

  const at = now.toISOString()
  const c = db()
  await c.from('tc_approval_events').insert({ submission_id: period.submissionId, invoice_id: sent.id, step: 'invoice', action: 'sent', by_person: me, at, note: b.madeBy === 'own_file' ? `Own file: ${ownPdf?.name ?? ''}` : 'Invoice builder' })
  await announceInvoiceReceived({ invoiceId: sent.id, at, personId: me, number: sent.number, month: period.label, total: usd(sent.total) })
  // Whoever decides the invoice now hears it arrived (the hours approver first, on two steps).
  try {
    const [settings, routes] = await Promise.all([loadRouteSettings(), loadRoutes([me])])
    const route = routes.get(me)
    let to: string | null = null
    if (route && period.submissionId) {
      const { data: sub } = await c.from('tc_submissions').select('state').eq('id', period.submissionId).maybeSingle()
      const step = sub ? currentStep(route, settings, sub.state as TimesheetState, true) : null
      to = step && step.step !== 'hours' ? step.owner : null
    } else if (route) to = invoiceApprover(route, settings)
    if (to) await announceTimesheetSubmitted({ submissionId: period.submissionId ?? -sent.id, sentAt: at, personId: me, to: [to], period: period.label, seconds: 0, text: `${dir.nameOf(me)} sent their invoice for ${period.label} (${sent.number}, ${usd(sent.total)}).`, plain: `${dir.nameOf(me)} sent their invoice for ${period.label} (${sent.number}).` })
  } catch (e) {
    console.error('[send invoice] tell approver:', e instanceof Error ? e.message : e)
  }
  revalidatePath('/clocky-hours/invoices')
  revalidatePath('/clocky-hours/approvals')
  revalidatePath('/')
  return NextResponse.json({ ok: true, id: sent.id, number: sent.number })
}
