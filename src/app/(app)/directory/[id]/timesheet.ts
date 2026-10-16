/**
 * The Work tab's Timesheet section (design handoff of 16 October 2026,
 * Timesheet Periods.dc.html frames 5B and 5B2): how the person submits their
 * hours, monthly or every 2 weeks, and their current period. Shown to whoever
 * sees the Work tab; changed by whoever holds cs-periods-edit (Super Admins)
 * with Edit work.
 *
 * Read on the server with the privileged client, as the rest of the person's
 * page is (lib/directory/person-page-data.ts): who sees it is decided by the
 * page's own rights. Not a "use server" file.
 */

import { db, loadCadenceChanges, loadClockySettings, loadDirectory, rulesFor } from '@/lib/timeclock/clocky-context'
import { cadenceNow } from '@/lib/timeclock/clocky-periods-data'
import { gridPeriod, periodContaining, periodLabel, type Cadence } from '@/lib/timeclock/periods'
import { localDate, monthYear } from '@/lib/timeclock/format'

export interface PersonTimesheet {
  /** How they submit; the one scheduled to follow, when there is one (what the pill shows). */
  cadence: Cadence
  /** Their current period, "October 2026" / "Oct 4 to 17, 2026". */
  currentPeriod: string
  /** The current period on each cadence, for the row while Edit work picks one (5B2). */
  periodIf: Record<Cadence, string>
  canEdit: boolean
}

export async function loadPersonTimesheet(personId: string, canEdit: boolean, now = new Date()): Promise<PersonTimesheet | null> {
  try {
    const [dir, settings, changes] = await Promise.all([loadDirectory(), loadClockySettings(), loadCadenceChanges(db(), [personId])])
    if (!dir.people.has(personId)) return null
    const today = localDate(now, dir.zoneOf(personId))
    const rules = rulesFor(personId, changes, settings)
    const cn = cadenceNow(today, rules.changes, rules.fallback)
    const pay = gridPeriod(today, rules.anchors)
    return {
      cadence: cn.scheduled?.cadence ?? cn.now,
      currentPeriod: periodLabel(periodContaining(today, rules)).full,
      periodIf: { monthly: monthYear(today), biweekly: pay ? periodLabel(pay).full : '-' },
      canEdit,
    }
  } catch (e) {
    // The section is left out rather than the page failing (migration 112 not run yet).
    console.error('[person timesheet]', e instanceof Error ? e.message : e)
    return null
  }
}
