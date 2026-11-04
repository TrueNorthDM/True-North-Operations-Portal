/**
 * The cards a person may take off their Home (leadership, 4 November 2026,
 * David's answers to the rules: "this must be optional, don't force a time
 * management solution, because one solution does not fit all people"). Each
 * person turns them on or off in Settings > Home and start; the choice is kept
 * in their account (person_settings.hidden_columns, under "home").
 *
 * The day banner (with the clock) and the annual review card always show: the
 * first is how people clock in, the second is a step HR waits for.
 *
 * Pure: Home and Settings ask the same questions.
 */

import { hiddenFor, type HiddenColumns } from '@/lib/settings/columns'

export type HomeCardKey = 'needs' | 'pay' | 'agenda' | 'goals' | 'i7' | 'publishing'

/** What decides which cards a person can have at all (the same gates Home uses). */
export interface HomeFacts {
  /** North Time is open and the person has the clock. */
  hasClock: boolean
  seesI7: boolean
  seesPublishing: boolean
}

export const HOME_CARDS: readonly { key: HomeCardKey; label: string; hint: string; shows: (f: HomeFacts) => boolean }[] = [
  { key: 'needs', label: 'Needs you', hint: 'What needs you today, your My Work tasks and your requests. Approvals still count on the rail when it is off.', shows: () => true },
  { key: 'pay', label: 'Pay period', hint: 'Your current timesheet period and when it closes.', shows: f => f.hasClock },
  { key: 'agenda', label: 'Agenda', hint: 'Today and the days ahead from the company calendar.', shows: () => true },
  { key: 'goals', label: 'My goals', hint: 'The goals your annual review agreed, once there are some.', shows: () => true },
  { key: 'i7', label: 'i7 budget', hint: 'How much of the i7 budget is used this month.', shows: f => f.seesI7 },
  { key: 'publishing', label: 'Publishing goals', hint: 'The publishing goals of the weeks around this one.', shows: f => f.seesPublishing },
]

/** The cards this person can have, for the Settings switches. */
export const homeCardsFor = (f: HomeFacts) => HOME_CARDS.filter(c => c.shows(f)).map(({ key, label, hint }) => ({ key, label, hint }))

/** Whether Home draws a card: the person can have it and has not turned it off. */
export function showsCard(key: HomeCardKey, f: HomeFacts, hidden: HiddenColumns): boolean {
  const card = HOME_CARDS.find(c => c.key === key)
  return !!card && card.shows(f) && !hiddenFor(hidden, 'home').includes(key)
}
