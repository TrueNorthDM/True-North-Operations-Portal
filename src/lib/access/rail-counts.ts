/**
 * The numbers on the rail (owner, 25 October 2026): every module icon shows a
 * counter whenever something in it needs this person's attention, and the
 * panel row it comes from shows the same number. Each count is the page's own
 * meaning, read by the function the page (or its rule) already uses:
 *
 *   approvals            Approvals' "Waiting for you" (clocky-approvals.ts countWaiting)
 *   my-late              My Work's "Late" filter on their own list (worklist/late.ts)
 *   integration-errors   Company settings > Integrations, the rows with Try again (company-settings.ts)
 *   monday-unlinked      Monday accounts' "Waiting on an answer" (worklist/links.ts)
 *   automations-down     the Automations header's problems, stale checks included (health/summary.ts)
 *   no-rate              contractors invoiceBlocker would refuse (invoices-data.ts)
 *   to-pay               Finance's invoices and reimbursement documents to pay, Home's To pay rows (invoices-data.ts countToPay)
 *
 * Read for what the person sees, so a View Stage preview shows the previewed
 * level's numbers (loadAccess, as the pages render). A count the person may
 * not open is 0 and never read; one that fails is logged and 0, so the rail
 * never breaks over a number.
 *
 * Not a "use server" file: app/(app)/rail-actions.ts serves it.
 */

import type { Access } from './resolve'
import { NAV_COUNTS, type NavCount } from '@/lib/nav/counts'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentPerson } from '@/lib/auth/session'
import { zoneDate } from '@/lib/notifications/schedule'
import { perfRun } from '@/lib/perf'
import { viewerFor } from '@/lib/timeclock/clocky-context'
import { countWaiting } from '@/lib/timeclock/clocky-approvals'
import { countRetryable } from '@/lib/timeclock/company-settings'
import { countMissingRates, countToPay } from '@/lib/timeclock/invoices-data'
import { countLate } from '@/lib/monday/worklist/late'
import { WORK_ZONE } from '@/lib/monday/worklist/list-view'
import { countWaitingOnAnswer } from '@/lib/monday/worklist/links'
import { latestHealth } from '@/lib/health/checks'
import { healthSummary } from '@/lib/health/summary'

/**
 * What a person needs to be shown each number: the page it leads to, and for
 * failed jobs the right to try them again (only Super Admins have the button).
 * Rates & Costs is money, so its count is for d-rates alone: never a Team Leader.
 * To pay sits on Invoices and is Finance's alone: the counter asks who is Finance.
 */
export const COUNT_NEEDS: Record<NavCount, readonly string[]> = {
  approvals: ['clocky-approvals'],
  'my-late': ['my-work'],
  'integration-errors': ['settings', 'cs-integrations', 'cs-integrations-edit'],
  'monday-unlinked': ['monday-accounts'],
  'automations-down': ['automations'],
  'no-rate': ['d-rates'],
  'to-pay': ['clocky-invoices'],
}

export const mayCount = (can: Access['can'], key: NavCount): boolean => COUNT_NEEDS[key].every(k => can(k))

const COUNTERS: Record<NavCount, (access: Access, now: Date) => Promise<number>> = {
  approvals: async access => {
    const v = await viewerFor(access)
    return v ? countWaiting(v) : 0
  },
  // The person My Work lists by default, and its New York day (my-work/page.tsx).
  'my-late': async (_access, now) => {
    const me = await getCurrentPerson()
    return me ? countLate(createAdminClient(), me.id, zoneDate(now, WORK_ZONE)) : 0
  },
  'integration-errors': (_access, now) => countRetryable(now),
  'monday-unlinked': () => countWaitingOnAnswer(createAdminClient()),
  // Unreadable results are not "all well", but not a number either: the page says so itself.
  'automations-down': async (_access, now) => {
    const { results, readError } = await latestHealth(createAdminClient())
    return readError ? 0 : healthSummary(results, now).problems.length
  },
  'no-rate': () => countMissingRates(),
  'to-pay': access => countToPay(access),
}

/** The asked counts, read side by side; one [perf] line says how long each took. */
export async function railCounts(access: Access, asked: readonly string[], now = new Date()): Promise<Partial<Record<NavCount, number>>> {
  const keys = NAV_COUNTS.filter(k => asked.includes(k))
  const perf = perfRun('rail-counts')
  const out: Partial<Record<NavCount, number>> = {}
  await Promise.all(keys.map(async k => {
    if (!mayCount(access.can, k)) { out[k] = 0; return }
    try {
      out[k] = Math.max(0, await perf.time(k, COUNTERS[k](access, now)))
    } catch (e) {
      console.error(`[rail counts] ${k}:`, e instanceof Error ? e.message : e)
      out[k] = 0
    }
  }))
  perf.done()
  return out
}
