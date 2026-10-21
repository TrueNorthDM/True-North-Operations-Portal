/**
 * The Work tab's "Approvals" and "Pay and hours" (Clocky part 2, frame 10A-1),
 * read on the server. Approvals carries no money and follows the Work tab;
 * Pay and hours is money and only reaches the person, Super Admins, Admins and
 * Finance (seesMoney), never a Team Leader. Not a "use server" file.
 */

import type { Access } from '@/lib/access/resolve'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { loadInvoiceSettings, loadPayTerms, seesMoney } from '@/lib/timeclock/pay-terms'
import { hoursApprover, invoiceApprover, isRecordedOnly, oneStep } from '@/lib/timeclock/routing'
import type { ApprovalsView, PayView } from '@/components/person/PayApprovalsSections'

export interface PersonPay {
  approvals: ApprovalsView
  /** Null unless the viewer sees money. */
  pay: PayView | null
  /** The Timesheet section's "Invoices" line, for whoever sees money. */
  invoicesLine: string | null
}

export async function loadPersonPay(personId: string, access: Access): Promise<PersonPay | null> {
  try {
    const [settings, terms, dir] = await Promise.all([loadInvoiceSettings(), loadPayTerms([personId]), loadDirectory()])
    const t = terms.get(personId)
    if (!t) return null
    const p = t.route
    const name = (id: string | null) => (id ? dir.nameOf(id) : 'Nobody yet')
    const hb = hoursApprover(p, settings)
    const ib = invoiceApprover(p, settings)
    const others = settings.invoiceApprovers.filter(id => id !== settings.defaultApprover).map(id => dir.nameOf(id))

    const rows: ApprovalsView['rows'] = [{ k: 'Reports to', v: name(p.reportsTo), sub: 'Work tab' }]
    let note: string
    if (isRecordedOnly(p, settings)) {
      note = 'Deputy Director: their own timesheet is recorded without approval.'
    } else if (!p.isContractor) {
      rows.push({ k: 'Hours approved by', v: name(hb), sub: p.reportsTo ? 'The person they report to' : 'Nobody to report to yet' })
      note = `No invoice: ${name(hb)} approves the hours and they go to Rippling.`
    } else if (p.paysAs === 'fixed_no_timesheet') {
      rows.push({ k: 'Invoice approved by', v: name(ib), sub: ib && ib === p.reportsTo && ib !== settings.defaultApprover ? `They report to ${name(ib)}` : others.length ? `Everyone not reporting to ${others.join(' or ')}` : 'Everyone' })
      note = `No timesheet: the invoice is made on the 1st and goes straight to ${name(ib)}.`
    } else {
      rows.push({ k: 'Hours approved by', v: name(hb), sub: p.reportsTo ? 'The person they report to' : 'Nobody to report to yet' })
      rows.push({ k: 'Invoice approved by', v: name(ib), sub: ib && ib === p.reportsTo && ib !== settings.defaultApprover ? `They report to ${name(ib)}` : others.length ? `Everyone not reporting to ${others.join(' or ')}` : 'Everyone' })
      note = oneStep(p, settings) ? 'Same person: one step, Approve both.' : `Two steps: ${name(hb)} approves the hours, then ${name(ib)} the invoice.`
    }

    const money = seesMoney(access, personId, settings)
    return {
      approvals: { rows, note },
      pay: money ? {
        isContractor: p.isContractor, paysAs: t.paysAs, hourlyRate: t.hourlyRate, fixedAmount: t.fixedAmount, allowance: t.allowance,
        canEdit: access.can('directory') && access.can('d-rates'),
      } : null,
      invoicesLine: money ? (!p.isContractor ? 'None, paid through Rippling' : p.paysAs === 'fixed_no_timesheet' ? 'Made on the 1st, no timesheet' : 'Made when they submit') : null,
    }
  } catch (e) {
    // The sections are left out rather than the page failing (migration 115 not run yet).
    console.error('[person pay]', e instanceof Error ? e.message : e)
    return null
  }
}
