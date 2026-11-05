/**
 * Who sees the money that can be traced back to one person in the client
 * reports (owner, 5 November 2026): Super Admins (ck-money) and Finance.
 *
 * The i7 report shows the hours of each person beside the cost of every
 * project, job code and activity, and the i7 rates differ by person. Where one
 * person worked a line, its cost divided by its hours is their rate; with a
 * few lines, a spreadsheet solves the rest. Project Hours' Costs are worked
 * out from what people are paid. So everyone else gets the hours, the budget
 * and the month's totals, and none of the costs by line.
 *
 * Decided on the server, before anything is sent: a hidden column that still
 * arrives in the page is not closed.
 */

import { cache } from 'react'
import { loadAccess } from '@/lib/access/resolve'
import { loadInvoiceSettings, MONEY_KEY, seesAllMoney } from '@/lib/timeclock/pay-terms'
import type { I7Report } from './types'

/** Super Admins and Finance. When Finance cannot be read, only ck-money passes: closed, not open. */
export const seesReportMoney = cache(async function seesReportMoney(): Promise<boolean> {
  const access = await loadAccess()
  if (access.can(MONEY_KEY)) return true
  try {
    return seesAllMoney(access, await loadInvoiceSettings())
  } catch (e) {
    console.error('[report money] invoice settings', e instanceof Error ? e.message : e)
    return false
  }
})

/** The 403 an export answers with when the file carries costs by line. */
export async function requireReportMoney(): Promise<Response | null> {
  if (await seesReportMoney()) return null
  return new Response('Not authorized. This file carries costs by person, which only Super Admins and Finance see.', {
    status: 403,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/**
 * The i7 tree without a cost on any line, nor the total under them. Hours and
 * the people columns stay; the month's budget, used and left come from the
 * carryover, which is one figure for everyone and names nobody. Pure.
 */
export function withoutLineCosts(report: I7Report): I7Report {
  return {
    ...report,
    totalCost: 0,
    projects: report.projects.map(p => ({
      ...p,
      cost: 0,
      jobcodes: p.jobcodes.map(jc => ({
        ...jc,
        cost: 0,
        activities: jc.activities.map(a => ({ ...a, cost: 0 })),
      })),
    })),
  }
}
