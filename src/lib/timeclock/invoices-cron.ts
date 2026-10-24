/**
 * Day 1 (Clocky part 2, README_PART2 "Fixed, no timesheet"): the invoices of
 * the contractors paid a fixed amount who track no time, for the month that
 * just ended, made by themselves and sent straight to their approver.
 *
 * Once per person and month (the invoices_fixed_once index): a second run the
 * same month makes nothing. Someone without an amount a month in Rates &
 * Costs is reported, not invoiced at $0.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { announceInvoiceMade, announceTimesheetSubmitted } from './clocky-notify'
import { localDate } from './format'
import { usd } from './invoice-doc'
import { writeInvoice } from './invoices-data'
import { loadPayTerms, loadRouteSettings } from './pay-terms'
import { periodLabel } from './periods'
import { invoiceApprover } from './routing'

/** The company's zone for "the 1st" (README_PART2: 06:00 New York). */
const ZONE = 'America/New_York'

export interface FixedInvoicesReport { month: string; made: string[]; skipped: string[]; errors: string[] }

/** The month before the one `now` is in, in New York: its first and last day. */
export function previousMonth(now: Date): { start: string; end: string } {
  const [y, m] = localDate(now, ZONE).split('-').map(Number)
  const start = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10)
  const end = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10)
  return { start, end }
}

export async function runFixedInvoices(now = new Date()): Promise<FixedInvoicesReport> {
  const { start, end } = previousMonth(now)
  const month = periodLabel({ start, end }).full
  const report: FixedInvoicesReport = { month, made: [], skipped: [], errors: [] }
  const c = createAdminClient()
  const { data: people, error } = await c.from('people').select('id, full_name, status').eq('employment_type', 'contractor')
  if (error) throw new Error(`People could not be read: ${error.message}`)
  const active = (people ?? []).filter(p => !p.status || p.status === 'active')
  const [terms, settings] = await Promise.all([loadPayTerms(active.map(p => p.id)), loadRouteSettings()])
  const fixed = active.filter(p => terms.get(p.id)?.paysAs === 'fixed_no_timesheet')
  if (!fixed.length) return report
  const { data: had, error: hErr } = await c.from('invoices').select('person_id').eq('kind', 'fixed_no_timesheet').eq('period_start', start).in('person_id', fixed.map(p => p.id))
  if (hErr) throw new Error(`Invoices could not be read: ${hErr.message}`)
  const done = new Set((had ?? []).map(r => r.person_id))
  for (const p of fixed) {
    if (done.has(p.id)) { report.skipped.push(`${p.full_name}: already made`); continue }
    const t = terms.get(p.id)!
    if (!(t.fixedAmount && t.fixedAmount > 0)) { report.errors.push(`${p.full_name}: no amount a month in Rates & Costs`); continue }
    try {
      const id = await writeInvoice({ personId: p.id, submissionId: null, start, end, paysAs: 'fixed_no_timesheet', hourlyRate: null, fixedAmount: t.fixedAmount, now })
      const { data: inv } = await c.from('invoices').select('number, total').eq('id', id).maybeSingle()
      const at = now.toISOString()
      await c.from('tc_approval_events').insert({ submission_id: null, invoice_id: id, step: 'submit', action: 'submit', by_person: null, at, note: 'Made by itself on the 1st' })
      if (inv) {
        await announceInvoiceMade({ invoiceId: id, at, personId: p.id, number: inv.number, month: periodLabel({ start, end }).label, total: usd(Number(inv.total)), withHours: false })
        const ib = invoiceApprover(t.route, settings)
        if (ib) await announceTimesheetSubmitted({ submissionId: -id, sentAt: at, personId: p.id, to: [ib], period: month, seconds: 0, text: `${inv.number} (${p.full_name}, ${usd(Number(inv.total))}) was made by itself for ${month}. It waits for your approval.` })
      }
      report.made.push(`${p.full_name}: ${inv?.number ?? id}`)
    } catch (e) {
      report.errors.push(`${p.full_name}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }
  return report
}
