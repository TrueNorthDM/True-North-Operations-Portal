/**
 * The facts about a person that some rail rows need beyond their level
 * (nav.ts NavFact):
 *
 *   invoices   contractors, Super Admins, Admins and Finance (Invoices.dc.html:
 *              an employee gets no invoice, so Invoices is not in their menu)
 *   employee   US employees (Requests.dc.html: time off is theirs; contractors
 *              are not paid for days off, so Time off is not in their menu),
 *              and Super Admins and Admins, who see everyone's time off there
 *              whatever their own type (audit, 24 October 2026)
 */

import { cache } from 'react'
import type { Access } from './resolve'
import type { NavFact } from './nav'
import { isFinance, loadInvoiceSettings, loadRoutes } from '@/lib/timeclock/pay-terms'

export const loadNavFacts = cache(async function loadNavFacts(access: Pick<Access, 'personId' | 'isAdmin'>): Promise<ReadonlySet<NavFact>> {
  const facts = new Set<NavFact>()
  try {
    const [settings, routes] = access.personId ? await Promise.all([loadInvoiceSettings(), loadRoutes([access.personId])]) : [null, null]
    const route = access.personId ? routes?.get(access.personId) : undefined
    if (access.isAdmin || (settings && isFinance(access, settings)) || route?.isContractor) facts.add('invoices')
    if (access.isAdmin || (route && !route.isContractor)) facts.add('employee')
  } catch (e) {
    // The rail never breaks on it: without the fact the row is simply not there.
    console.error('[nav facts]', e instanceof Error ? e.message : e)
  }
  return facts
})
