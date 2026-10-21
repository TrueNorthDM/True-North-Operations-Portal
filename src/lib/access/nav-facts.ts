/**
 * The facts about a person that some rail rows need beyond their level
 * (nav.ts NavFact). Today one: `invoices`, for contractors, Super Admins,
 * Admins and Finance (Invoices.dc.html: an employee gets no invoice, so
 * Invoices is not in their Clocky menu).
 */

import { cache } from 'react'
import type { Access } from './resolve'
import type { NavFact } from './nav'
import { isFinance, loadInvoiceSettings, loadRoutes } from '@/lib/timeclock/pay-terms'

export const loadNavFacts = cache(async function loadNavFacts(access: Pick<Access, 'personId' | 'isAdmin'>): Promise<ReadonlySet<NavFact>> {
  const facts = new Set<NavFact>()
  try {
    if (access.isAdmin) facts.add('invoices')
    else if (access.personId) {
      const [settings, routes] = await Promise.all([loadInvoiceSettings(), loadRoutes([access.personId])])
      if (isFinance(access, settings) || routes.get(access.personId)?.isContractor) facts.add('invoices')
    }
  } catch (e) {
    // The rail never breaks on it: without the fact the row is simply not there.
    console.error('[nav facts]', e instanceof Error ? e.message : e)
  }
  return facts
})
