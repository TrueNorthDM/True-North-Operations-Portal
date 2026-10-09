// What the person drawer shows beyond their row: each step they delivered in
// the period, and their approved hours by timeclock code. Read by the server
// for a person the caller has already been allowed to see (report/actions.ts).

import { failed, loadSpans, reportDb } from './data'
import { periodStart, periodStartDay } from './clock'
import { personHoursByCode } from './hours'
import type { Delivery, LoggedHours, PersonDetail } from './drawer'
import type { Period } from './scope'

export type { PersonDetail }

export async function loadPersonDetail(personId: string, period: Period): Promise<PersonDetail> {
  const db = reportDb()
  const now = new Date()

  const { data: links, error } = await db.from('monday_user_links').select('monday_user_id').eq('person_id', personId)
  failed('their Monday accounts', error)
  const accounts = ((links ?? []) as { monday_user_id: number }[]).map(l => l.monday_user_id)

  const [spans, codes] = await Promise.all([
    loadSpans(accounts, periodStart(period, now)),
    personHoursByCode(personId, periodStartDay(period, now)),
  ])
  // Newest first: the drawer shows the most recent and says how many more.
  spans.sort((a, b) => b.doneAt.localeCompare(a.doneAt))

  const items = [...new Set(spans.map(s => s.item_id))]
  const [names, steps] = await Promise.all([itemNames(items), stepNames()])

  const deliveries: Delivery[] = spans.map(s => ({
    id: `${s.item_id}|${s.people_col}|${s.monday_user_id}`,
    item: names.get(s.item_id) ?? 'An item no longer on its board',
    step: steps.get(`${s.board_id}|${s.people_col}`) ?? s.people_col,
    heldDays: s.heldDays,
    lateDays: s.lateDays,
  }))

  const hours: LoggedHours[] = codes
    .map(c => ({ project: c.code ?? 'Unknown code', folder: c.folder, hours: Math.round((c.seconds / 3600) * 10) / 10 }))
    .filter(h => h.hours > 0)

  return { deliveries, hours, totalDeliveries: deliveries.length }
}

/** Item names from the current snapshot, which keeps finished items while they are on their board. */
async function itemNames(ids: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  // 100 items a read: an item has a row per step and person, and a read stops at 1,000 rows.
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await reportDb()
      .from('monday_assignments').select('item_id, item_name, parent_item_name').in('item_id', ids.slice(i, i + 100))
    failed('the item names', error)
    for (const r of (data ?? []) as { item_id: number; item_name: string; parent_item_name: string | null }[]) {
      out.set(r.item_id, r.parent_item_name ? `${r.parent_item_name}: ${r.item_name}` : r.item_name)
    }
  }
  return out
}

async function stepNames(): Promise<Map<string, string>> {
  const { data, error } = await reportDb().from('monday_board_steps').select('board_id, people_col, step_name')
  failed('the board steps', error)
  return new Map(((data ?? []) as { board_id: number; people_col: string; step_name: string }[])
    .map(s => [`${s.board_id}|${s.people_col}`, s.step_name]))
}
