/**
 * Hours before one's North Time start date, in the pay period running now
 * (owner, 26 November 2026). Jônatas sent his hours in a spreadsheet, never in
 * TSheets, and started North Time on November 8: his November (he is paid
 * monthly) began on the 1st, so the days from the 1st to the 7th had nowhere
 * to go. The start-date gate (waves.ts entryStartGate) exists so hours TSheets
 * already holds are not typed in twice, which cannot happen to someone with no
 * TSheets hours at all. So, for them alone, the days of the current pay period
 * before the start date open too, and in the 2026 structure (owner: "quero
 * que ele use a estrutura nova"), even before the structure's switch date.
 *
 * Earlier pay periods stay closed for everyone.
 */

import { db, loadCadenceChanges, loadClockySettings, loadDirectory, rulesFor } from './clocky-context'
import { localDate } from './format'
import { periodContaining, type Period } from './periods'
import { earlyFromOf } from './waves'

export { earlyFromOf, switchFor } from './waves'

/** The person's current pay period, in their own time zone. */
export async function currentPeriodOf(personId: string, now = new Date()): Promise<Period> {
  const [dir, settings, changes] = await Promise.all([loadDirectory(), loadClockySettings(), loadCadenceChanges(db(), [personId])])
  return periodContaining(localDate(now, dir.zoneOf(personId)), rulesFor(personId, changes, settings))
}

/** Whether TSheets ever held hours of this person (their imported entries). */
export async function usedTSheets(personId: string): Promise<boolean> {
  const { data, error } = await db().from('tc_entries').select('id').eq('person_id', personId).eq('source', 'tsheets').limit(1)
  if (error) throw new Error(`TSheets hours could not be checked: ${error.message}`)
  return (data ?? []).length > 0
}

/** earlyFromOf for one person, read. Throws on a failed read (callers fail closed: no early days). */
export async function loadEarlyFrom(personId: string, startsOn: string | null, now = new Date()): Promise<{ earlyFrom: string | null; period: Period | null }> {
  if (!startsOn) return { earlyFrom: null, period: null }
  const period = await currentPeriodOf(personId, now)
  if (period.start >= startsOn) return { earlyFrom: null, period }
  return { earlyFrom: earlyFromOf({ startsOn, period, usedTSheets: await usedTSheets(personId) }), period }
}
