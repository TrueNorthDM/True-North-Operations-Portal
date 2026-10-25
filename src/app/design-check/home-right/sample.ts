// The prototype's sample for the Agenda and i7 cards, shared by its check and the full Home check.

import type { AgendaItem, AgendaWho } from '@/lib/agenda/model'
import type { I7Carryover } from '@/lib/tsheets/types'

export const TODAY = '2026-10-26'
const who = (id: string, name: string): AgendaWho => ({ id, name, teamId: null, teamName: null, color: '#9CA3AF' })

// Home Final.dc.html: OUT, the Super Admin's MEETS and UPCOMING.
export const ITEMS: AgendaItem[] = [
  { id: 'pto:1', k: 'pto', a: '2026-10-23', b: '2026-10-28', who: who('hm', 'Hosea Moturi'), type: null },
  { id: 'pto:2', k: 'pto', a: TODAY, b: TODAY, who: who('ap', 'Amy Prindle'), type: null },
  { id: 'ev:1', k: 'event', a: TODAY, b: TODAY, s: 11, e: 11.5, title: 'Leadership sync', teams: 'Everyone' },
  { id: 'ev:2', k: 'event', a: TODAY, b: TODAY, s: 14, e: 15, title: 'i7 monthly review', teams: 'Everyone' },
  { id: 'ev:3', k: 'event', a: '2026-10-27', b: '2026-10-27', s: 10, e: 11, title: 'All-hands', teams: 'Everyone' },
  { id: 'anni:1', k: 'anni', a: '2026-10-29', b: '2026-10-29', who: who('tg', 'Tina Gennette'), yrs: 3 },
  { id: 'bday:1', k: 'bday', a: '2026-10-30', b: '2026-10-30', who: who('sf', 'Saheed Fidimaye') },
  { id: 'hol:1', k: 'hol', a: '2026-11-11', b: '2026-11-11', title: 'Veterans Day', country: 'US' },
  { id: 'hol:2', k: 'hol', a: '2026-11-26', b: '2026-11-26', title: 'Thanksgiving', country: 'US' },
]

// The prototype's figures: $3,568.75 used of $85,712.38.
export const NORMAL: I7Carryover = { opening: 712.38, monthBudget: 85000, monthUsed: 3568.75, totalAvailable: 85712.38, totalLeft: 82143.63, openingFrom: '2025-01', openingComplete: true }
export const OVER: I7Carryover = { opening: -2400, monthBudget: 12000, monthUsed: 11250.5, totalAvailable: 9600, totalLeft: -1650.5, openingFrom: '2025-01', openingComplete: true }

