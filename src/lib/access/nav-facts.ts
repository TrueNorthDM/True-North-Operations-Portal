/**
 * The facts about a person that some rail rows need beyond their level
 * (nav.ts NavFact):
 *
 *   invoices   contractors, whoever sees everyone's invoices (ck-inv-all with
 *              everyone's money: Super Admins) and Finance (Invoices.dc.html:
 *              an employee gets no invoice, so Invoices is not in their menu;
 *              an Admin who is not Finance sees no one else's, owner, 5
 *              November 2026)
 *   employee   US employees (Requests.dc.html: time off is theirs; contractors
 *              are not paid for days off, so Time off is not in their menu),
 *              and whoever sees everyone's time off (rq-off-all: Super Admins
 *              and Admins by default) whatever their own type
 *   finance    Finance (Company settings > Invoices): reads Rates & Costs
 */

import { cache } from 'react'
import type { Access } from './resolve'
import type { NavFact } from './nav'
import { isFinance, loadInvoiceSettings, loadRoutes, seesAllMoney } from '@/lib/timeclock/pay-terms'

export const loadNavFacts = cache(async function loadNavFacts(access: Pick<Access, 'personId' | 'can'>): Promise<ReadonlySet<NavFact>> {
  const facts = new Set<NavFact>()
  try {
    const [settings, routes] = access.personId ? await Promise.all([loadInvoiceSettings(), loadRoutes([access.personId])]) : [null, null]
    const route = access.personId ? routes?.get(access.personId) : undefined
    const finance = !!settings && isFinance(access, settings)
    const allInvoices = access.can('ck-inv-all') && (settings ? seesAllMoney(access, settings) : access.can('ck-money'))
    if (allInvoices || finance || route?.isContractor) facts.add('invoices')
    if (access.can('rq-off-all') || (route && !route.isContractor)) facts.add('employee')
    if (finance) facts.add('finance')
  } catch (e) {
    // The rail never breaks on it: without the fact the row is simply not there.
    console.error('[nav facts]', e instanceof Error ? e.message : e)
  }
  return facts
})
