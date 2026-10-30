/**
 * The Agenda card on Home (design_handoff_home, section 4): who is out today,
 * then the next 5 events. Pure: the card, its loader (home-data.ts) and the
 * design check build it from the Agenda's own items, so Home and /agenda agree.
 *
 *   Out today   approved time off covering today, working days only (as the
 *               Agenda draws it), with its type
 *   Today       today's all-day items ("Today, birthday"), then the timed ones
 *               not over yet ("Today, 30 min")
 *   Coming up   the days after, in date order, until there are 5
 *
 * Shown as events: company and team events, milestones, birthdays, work
 * anniversaries and the company holidays. The Good News Calendar and other
 * countries' national holidays stay on /agenda: they would crowd five rows.
 */

import { addDays } from '@/lib/timeclock/periods'
import { WD, dow, hourLabel, look, type AgendaItem, type Look } from './model'

export interface HomeOut { id: string; personId: string; name: string; avatarUrl: string | null; reason: string; until: string }
export interface HomeEvent {
  id: string
  section: 'today' | 'later'
  /** Above the figure: AM / PM on a timed event today, else the weekday ("Tue"). */
  top: string
  /** "11:00" on a timed event today, else the day of the month ("27"). */
  big: string
  /** The big figure is a time (17px) rather than a day (22px). */
  time: boolean
  title: string
  sub: string
  /** The Agenda's icon for its kind (owner, 29 October 2026: the same tile as the Agenda's List view). */
  look: Look
}
export interface HomeAgenda { out: HomeOut[]; events: HomeEvent[] }

export const HOME_EVENTS = 5

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const isWeekend = (iso: string) => dow(iso) % 6 === 0
// The Agenda's own order within a day (model.ts SORT), less the kinds left out here.
const ORDER: Partial<Record<AgendaItem['k'], number>> = { hol: 0, event: 1, ms: 2, bday: 3, anni: 4 }
const shown = (x: AgendaItem) => x.k in ORDER && !(x.k === 'hol' && x.country && x.country !== 'US')

/** "today only", "until Wed" within the week, "until Nov 9" past it. */
export function untilLabel(end: string, today: string): string {
  if (end <= today) return 'today only'
  if (end <= addDays(today, 6)) return `until ${WD[dow(end)]}`
  return `until ${MON[Number(end.slice(5, 7)) - 1]} ${Number(end.slice(8))}`
}

/** "Tina Gennette, 3 years", "Saheed Fidimaye", "Veterans Day". */
function titleOf(x: AgendaItem): string {
  const name = x.who?.name ?? 'Someone'
  if (x.k === 'anni') return `${name}, ${x.yrs} ${x.yrs === 1 ? 'year' : 'years'}`
  if (x.k === 'bday') return name
  return x.title ?? ''
}

/** "Work anniversary", "Birthday", "Company holiday", "10:00 AM, everyone". */
function kindSub(x: AgendaItem): string {
  if (x.k === 'anni') return 'Work anniversary'
  if (x.k === 'bday') return 'Birthday'
  if (x.k === 'hol') return 'Company holiday'
  if (x.k === 'ms') return x.client ? `Milestone, ${x.client}` : 'Milestone'
  const teams = !x.teams || x.teams === 'Everyone' ? 'everyone' : x.teams
  return `${x.s != null ? hourLabel(x.s) : 'All day'}, ${teams}`
}

/**
 * @param now      the hour now in the viewer's zone (10.75 is 10:45 AM): a timed event
 *                 today shows until it ends
 * @param avatarOf the person's photo, from the Directory
 */
export function homeAgenda(items: readonly AgendaItem[], today: string, now: number, avatarOf: (personId: string) => string | null = () => null): HomeAgenda {
  // One row a person, even when two approved requests overlap: the one that runs longer.
  const outBy = new Map<string, AgendaItem>()
  if (!isWeekend(today)) {
    for (const x of items) {
      if (x.k !== 'pto' || !x.who || x.a > today || x.b < today) continue
      const had = outBy.get(x.who.id)
      if (!had || x.b > had.b) outBy.set(x.who.id, x)
    }
  }
  const out = [...outBy.values()]
    .sort((p, q) => p.b.localeCompare(q.b) || p.who!.name.localeCompare(q.who!.name))
    .map(x => ({
      id: x.id, personId: x.who!.id, name: x.who!.name, avatarUrl: avatarOf(x.who!.id),
      // The type, as the Agenda shows it to everyone (data.ts); Unavailable when it has none.
      reason: x.type || 'Unavailable', until: untilLabel(x.b, today),
    }))

  const byTime = (p: AgendaItem, q: AgendaItem) => ((p.s ?? -1) - (q.s ?? -1)) || (ORDER[p.k]! - ORDER[q.k]!)
  const todays = items.filter(x => shown(x) && x.a <= today && x.b >= today && (x.s == null || (x.e ?? x.s + 1) > now)).sort(byTime)
  const later = items.filter(x => shown(x) && x.a > today)
    .sort((p, q) => p.a.localeCompare(q.a) || (ORDER[p.k]! - ORDER[q.k]!) || ((p.s ?? -1) - (q.s ?? -1)))

  const events: HomeEvent[] = [
    ...todays.map((x): HomeEvent => {
      if (x.s == null) return { id: x.id, section: 'today', top: WD[dow(today)], big: String(Number(today.slice(8))), time: false, title: titleOf(x), sub: `Today, ${kindSub(x).replace(/^\w/, c => c.toLowerCase())}`, look: look(x) }
      const [clock, ap] = hourLabel(x.s).split(' ')
      return { id: x.id, section: 'today', top: ap, big: clock, time: true, title: titleOf(x), sub: `Today, ${Math.round(((x.e ?? x.s + 1) - x.s) * 60)} min`, look: look(x) }
    }),
    ...later.map((x): HomeEvent => ({ id: x.id, section: 'later', top: WD[dow(x.a)], big: String(Number(x.a.slice(8))), time: false, title: titleOf(x), sub: kindSub(x), look: look(x) })),
  ].slice(0, HOME_EVENTS)

  return { out, events }
}
