/**
 * The Agenda (Clocky part 2, Agenda.dc.html 8A to 8F): one calendar for the
 * company, as plain data. Everything here is pure: the page, the Home card
 * and the design checks build their grids from a list of items and a day.
 *
 *   pto     approved time off ("Olivia Hale, out") with its type, for everyone
 *           (owner, 27 October 2026)
 *   bday    Directory birthdays, month and day only
 *   anni    work anniversaries from the start date
 *   event   company events (Super Admins, Admins) and team events (Team Leaders)
 *   ms      milestones
 *   hol     the company holidays
 */

import { addDays } from '@/lib/timeclock/periods'
import type { EventEdit } from './events'
import { typeOf, type EventType } from './event-rules'
import type { Repeat } from './recurrence'
import type { Weekday, WorkingHours } from './working-hours'

/** The drawer, filled from a stored event (Edit opens it with these). */
export interface DrawerEdit {
  id: number; type: EventType; when: 'time' | 'day' | 'range'; title: string; date: string; end: string; from: number; to: number
  how: 'online' | 'in_person'; place: string; audience: 'guests' | 'teams' | 'all'; teams: string[]
  guests: { personId: string | null; email: string }[]; client: string; description: string; accountId: number | null
  /** The series' rule, when it repeats. */
  repeat: Repeat | null
  /** Editing one occurrence of a series: its day, so Save asks This event, This and following, or All events. */
  occurrence: string | null
}

/** A guest's answer, as Google keeps it: accepted, declined, tentative, or none yet. */
export type Answer = 'yes' | 'no' | 'maybe' | 'waiting'
export interface DetailGuest { key: string; name: string; ini: string; color: string; sub: string; answer: Answer; zone: string | null; organizer: boolean }
/** What the open card shows of an event from the New event drawer (owner, 30 October 2026). */
export interface EventDetail {
  eventId: number
  how: 'online' | 'in_person' | null
  /** In person: where. */
  address: string | null
  audience: 'guests' | 'teams' | 'all'
  teams: { name: string; color: string; count: number }[]
  /** The organizer first, then everyone invited. */
  guests: DetailGuest[]
  /** The Google account it was sent from, and whether that is the team calendar (office@). */
  sentFrom: string | null
  teamCalendar: boolean
  /** The day it was created, YYYY-MM-DD. */
  created: string | null
  googleLink: string | null
  startsAt: string | null
  /** The viewer's own answer when they are a guest (not the organizer); null otherwise. */
  myAnswer: Answer | null
  onGoogle: boolean
  /** "Every Tuesday, until Dec 15" for a series; null for a single event. */
  repeat: string | null
  /** One occurrence of a series: the series' row and the occurrence's day (Delete asks which ones). */
  occurrence: { seriesId: number; day: string } | null
}

export const answerOf = (response: string | null | undefined): Answer =>
  response === 'accepted' ? 'yes' : response === 'declined' ? 'no' : response === 'tentative' ? 'maybe' : 'waiting'

/** "1 hour 30 minutes", from hours. */
export function durationLabel(hours: number): string {
  const m = Math.round(hours * 60), h = Math.floor(m / 60), r = m % 60
  const H = h ? `${h} hour${h === 1 ? '' : 's'}` : '', M = r ? `${r} minute${r === 1 ? '' : 's'}` : ''
  return [H, M].filter(Boolean).join(' ') || '0 minutes'
}

/** "3 yes · 1 no · 2 waiting": the guests' answers, the organizer left out. */
export function answerCounts(guests: readonly DetailGuest[]): Record<Answer, number> {
  const n: Record<Answer, number> = { yes: 0, no: 0, maybe: 0, waiting: 0 }
  for (const g of guests) if (!g.organizer) n[g.answer]++
  return n
}
export const countsLabel = (n: Record<Answer, number>): string =>
  ([['yes', 'yes'], ['no', 'no'], ['maybe', 'maybe'], ['waiting', 'waiting']] as const).filter(([k]) => n[k]).map(([k, l]) => `${n[k]} ${l}`).join(' · ')

/**
 * When the event starts for guests in other time zones than the viewer's:
 * "12:00 PM in São Paulo for Jonatas", "9:00 AM in Chicago for 3 people".
 * Two zones at most, then "+1 more time zone".
 */
export function otherZonesLabel(guests: readonly DetailGuest[], startsAt: string | null, viewerZone: string): string | null {
  if (!startsAt) return null
  const byZone = new Map<string, string[]>()
  for (const g of guests) if (g.zone && g.zone !== viewerZone) (byZone.get(g.zone) ?? byZone.set(g.zone, []).get(g.zone)!).push(g.name.split(' ')[0])
  if (!byZone.size) return null
  const t = Date.parse(startsAt)
  const at = (z: string) => new Intl.DateTimeFormat('en-US', { timeZone: z, hour: 'numeric', minute: '2-digit' }).format(t)
  const parts = [...byZone].slice(0, 2).map(([z, who]) => `${at(z)} in ${cityOf(z)} for ${who.length === 1 ? who[0] : `${who.length} people`}`)
  const more = byZone.size - 2
  return parts.join(', ') + (more > 0 ? `, +${more} more time zone${more === 1 ? '' : 's'}` : '')
}

export type AgendaKind = 'pto' | 'bday' | 'anni' | 'event' | 'ms' | 'hol'
export type AgendaView = 'month' | 'week' | 'list'

export interface AgendaWho { id: string; name: string; teamId: string | null; teamName: string | null; color: string }

export interface AgendaItem {
  id: string
  k: AgendaKind
  /** First and last day, in the viewer's zone. */
  a: string
  b: string
  who?: AgendaWho
  /** The PTO type (Vacation, Sick): only for a Super Admin and the person. */
  type?: string | null
  title?: string
  /** Work anniversary: years at True North. */
  yrs?: number
  /** A timed event: start and end, hours in the viewer's zone (10.5 is 10:30 AM). */
  s?: number
  e?: number
  place?: string | null
  /** "Join the call" or "Open in Google Calendar". */
  link?: string | null
  /** "Everyone", or the teams that see it. */
  teams?: string
  /** A team event: its team. */
  team?: { id: string; name: string; color: string } | null
  by?: string | null
  desc?: string | null
  client?: string | null
  /** On the team Google Calendar (sent and confirmed). */
  onGoogle?: boolean
  /** The teams an event is for; empty is everyone. */
  audience?: string[]
  /** A holiday: its country (ISO code). US ones are the company holidays. */
  country?: string | null
  /** An event the viewer may edit and delete (lib/agenda/events.ts): the form 8E opens with. */
  edit?: EventEdit
  /** An event made in the New event drawer: its type, and the drawer's form when the viewer may change it. */
  evType?: EventType
  drawerEdit?: DrawerEdit
  /** The open card's details of a drawer event. */
  detail?: EventDetail
}

export const KIND: Record<AgendaKind, { label: string; swatch: string }> = {
  pto: { label: 'PTO', swatch: '#A99BD4' },
  bday: { label: 'Birthdays', swatch: '#F2C40A' },
  anni: { label: 'Anniversaries', swatch: '#1E7D7F' },
  event: { label: 'Events', swatch: '#012358' },
  ms: { label: 'Milestones', swatch: '#1E9E6A' },
  hol: { label: 'Holidays', swatch: '#a3aebb' },
}
export const KINDS = Object.keys(KIND) as AgendaKind[]

export const AG_ICON = {
  gift: 'M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  flag: 'M4 22V4M4 4h13l-2 4 2 4H4',
  cal: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  clock: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2',
  undo: 'M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  video: 'M3 6h12v12H3zM15 10l6-4v12l-6-4',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  agenda: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4M8 14h2M14 14h2M8 17h2',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
} as const

// ── Days ─────────────────────────────────────────────────────────────────────

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const D = (iso: string) => new Date(`${iso}T00:00:00Z`)
export const dow = (iso: string): number => D(iso).getUTCDay()
const isWeekend = (iso: string) => dow(iso) % 6 === 0
/** "Tue, Nov 3" */
export const fday = (iso: string): string => { const d = D(iso); return `${WD[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}` }
/** "Nov 3, 2026" */
export const fdate = (iso: string): string => { const d = D(iso); return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}` }
/** "Nov 1 to 7, 2026", "Nov 29 to Dec 12, 2026" */
export function rng(a: string, b: string): string {
  if (a === b) return fdate(a)
  const A = D(a), B = D(b)
  return A.getUTCMonth() === B.getUTCMonth()
    ? `${MON[A.getUTCMonth()]} ${A.getUTCDate()} to ${B.getUTCDate()}, ${B.getUTCFullYear()}`
    : `${MON[A.getUTCMonth()]} ${A.getUTCDate()} to ${MON[B.getUTCMonth()]} ${B.getUTCDate()}, ${B.getUTCFullYear()}`
}
/** "Wed, Nov 25 to Fri, Nov 27" */
export const drng = (a: string, b: string): string => (a === b ? fday(a) : `${fday(a)} to ${fday(b)}`)
/** 10.5 -> "10:30 AM" */
export function hourLabel(h: number): string {
  const H = Math.floor(h), M = Math.round((h - H) * 60), ap = H >= 12 && H < 24 ? 'PM' : 'AM'
  return `${H % 12 || 12}:${String(M).padStart(2, '0')} ${ap}`
}
const monthFirst = (iso: string) => `${iso.slice(0, 8)}01`
const monthLast = (iso: string) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
const shiftMonth = (iso: string, n: number) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10) }
const covers = (x: AgendaItem, d: string) => d >= x.a && d <= x.b

/** The days a view shows, first to last. */
export function viewDays(view: AgendaView, anchor: string): { from: string; to: string } {
  if (view === 'month') {
    const f = monthFirst(anchor), l = monthLast(anchor)
    return { from: addDays(f, -dow(f)), to: addDays(l, 6 - dow(l)) }
  }
  if (view === 'week') { const w0 = addDays(anchor, -dow(anchor)); return { from: w0, to: addDays(w0, 6) } }
  return { from: anchor, to: addDays(anchor, 13) }
}

/** The week's number, US count (owner, 2026-10-23): weeks run Sunday to Saturday, and week 1 is the one with Jan 1. */
export function weekNumber(iso: string): number {
  const sun = addDays(iso, -dow(iso)), sat = addDays(sun, 6)
  const jan1 = `${sat.slice(0, 4)}-01-01`
  const start = addDays(jan1, -dow(jan1))
  return Math.round((D(sun).getTime() - D(start).getTime()) / (7 * 86400000)) + 1
}

export function rangeTitle(view: AgendaView, anchor: string): string {
  if (view === 'month') { const [y, m] = anchor.split('-').map(Number); return `${MONL[m - 1]} ${y}` }
  const { from, to } = viewDays(view, anchor)
  return rng(from, to)
}

export function stepAnchor(view: AgendaView, anchor: string, dir: 1 | -1): string {
  if (view === 'month') return shiftMonth(anchor, dir)
  return addDays(anchor, dir * (view === 'week' ? 7 : 14))
}

/** "meet.google.com/abc-defg" in a place, as a link to open; nothing when the place has none. */
export function linkIn(place: string | null | undefined): string | null {
  const m = /(https?:\/\/\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\.[a-z]{2,}\/\S*|\b(?:meet\.google\.com|zoom\.us|teams\.microsoft\.com)\/\S+)/i.exec(place ?? '')
  if (!m) return null
  return /^https?:\/\//i.test(m[0]) ? m[0] : `https://${m[0]}`
}

// ── How an item reads and looks ───────────────────────────────────────────────

export function label(x: AgendaItem): string {
  if (x.k === 'pto') return `${x.who?.name ?? 'Someone'}, out`
  if (x.k === 'bday') return `${x.who?.name ?? 'Someone'}'s birthday`
  if (x.k === 'anni') return `${x.who?.name ?? 'Someone'}, ${x.yrs} ${x.yrs === 1 ? 'year' : 'years'} at True North`
  return x.title ?? ''
}

/** A colour at an opacity, as the prototype writes it ("#047857" + "40"). */
export const tint = (hex: string, alpha: string): string => (/^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${alpha}` : hex)

/** A country's flag from its ISO code (regional indicators), as the phone numbers show it. */
export const flagOf = (cc: string | null | undefined): string => (cc && /^[A-Za-z]{2}$/.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '')
/** "KE" -> "Kenya" */
export const countryName = (cc: string): string => { try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(cc.toUpperCase()) ?? cc } catch { return cc } }

/** `flag`: a holiday shows its country's flag where the others show their icon; `yrs`: a work
 * anniversary shows the HR tenure badge (TenureBadge) with its years (owner, 2026-10-23). */
export interface Look { bg: string; fg: string; d: string; c: string; flag: string; yrs?: number }
/** The New event drawer's types (owner, 30 October 2026): an icon each; the colour says who it is for. */
const TYPE_ICON: Record<EventType, string> = {
  meeting: 'M3 6h12v12H3zM15 10l6-4v12l-6-4',
  training: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5',
  deadline: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M5 3L2 6M19 3l3 3',
  milestone: 'M4 22V4M4 4h13l-2 4 2 4H4',
  company: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  celebration: 'M5.8 11.3L2 22l10.7-3.8M11 13c1.9 1.9 2.8 4.2 2 5s-3.1-.1-5-2-2.8-4.2-2-5 3.1.1 5 2zM15 2h.01M22 8h.01M22 20h.01M4 3h.01',
}
const TYPE_LOOK: Record<EventType, { bg: string; fg: string; c: string }> = {
  meeting: { bg: '#e8edf6', fg: '#012358', c: '#012358' },
  training: { bg: '#efe9fb', fg: '#5b3fb0', c: '#5b3fb0' },
  deadline: { bg: '#fdecea', fg: '#b2412f', c: '#b2412f' },
  milestone: { bg: '#e6f6ee', fg: '#0d7a4f', c: '#1E9E6A' },
  company: { bg: '#012358', fg: '#ffffff', c: '#012358' },
  celebration: { bg: '#fdf3c4', fg: '#7a5c00', c: '#c99a00' },
}

export function look(x: AgendaItem): Look {
  if (x.k === 'pto') { const c = x.who?.color ?? '#9CA3AF'; return { bg: tint(c, '40'), fg: '#012358', d: '', c, flag: '' } }
  if (x.k === 'bday') return { bg: '#fdf3c4', fg: '#7a5c00', d: AG_ICON.gift, c: '#F2C40A', flag: '' }
  if (x.k === 'anni') return { bg: '#eaf4f4', fg: '#1E7D7F', d: AG_ICON.star, c: '#1E7D7F', flag: '', yrs: x.yrs }
  if (x.evType && x.evType !== 'milestone') {
    const d = TYPE_ICON[x.evType]
    if (x.team) return { bg: tint(x.team.color, '38'), fg: '#012358', d, c: x.team.color, flag: '' }
    return { ...TYPE_LOOK[x.evType], d, flag: '' }
  }
  if (x.k === 'event' && x.team) return { bg: tint(x.team.color, '38'), fg: '#012358', d: AG_ICON.people, c: x.team.color, flag: '' }
  if (x.k === 'event') return { bg: '#012358', fg: '#fff', d: AG_ICON.cal, c: '#012358', flag: '' }
  if (x.k === 'ms') return { bg: '#e6f6ee', fg: '#0d7a4f', d: AG_ICON.flag, c: '#1E9E6A', flag: '' }
  return { bg: '#f1f3f6', fg: '#5b6b82', d: '', c: '#a3aebb', flag: flagOf(x.country) }
}

const SORT: Record<AgendaKind, number> = { hol: 0, event: 1, ms: 2, bday: 3, anni: 4, pto: 9 }
const byKind = (a: AgendaItem, b: AgendaItem) => (SORT[a.k] - SORT[b.k]) || ((a.s ?? 0) - (b.s ?? 0))

// ── Filters ───────────────────────────────────────────────────────────────────

export const ALL_TEAMS = 'all'

/** The chips and the team filter (8A): a team keeps its people, its team events and what is for everyone. */
export function filterItems(items: readonly AgendaItem[], on: ReadonlySet<AgendaKind>, teamId: string): AgendaItem[] {
  return items.filter(x => {
    if (!on.has(x.k)) return false
    if (teamId === ALL_TEAMS) return true
    const t = x.who ? x.who.teamId : x.team?.id ?? null
    if (t) return t === teamId
    if (x.k === 'hol') return true
    return (x.k === 'event' || x.k === 'ms') && (!x.audience?.length || x.audience.includes(teamId))
  })
}

// ── 8A Month ──────────────────────────────────────────────────────────────────

export interface CellItem { id: string; label: string; title: string; look: Look; meet: boolean }
export interface MonthCell {
  day: string; n: number; inMonth: boolean; today: boolean
  out: { id: string; ini: string; color: string }[]; outTip: string
  items: CellItem[]; more: number
}

const ini = (name: string) => name.split(/\s+/).filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase()
/** "11am", "10:30am": the time in front of a timed event in a month cell. */
const cellTime = (h: number) => hourLabel(h).replace(':00', '').replace(' ', '').toLowerCase()

export function monthCells(items: readonly AgendaItem[], anchor: string, today: string): MonthCell[] {
  const { from, to } = viewDays('month', anchor), cells: MonthCell[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const outs = items.filter(x => x.k === 'pto' && covers(x, d) && !isWeekend(d))
    const its = items.filter(x => x.k !== 'pto' && covers(x, d)).sort(byKind)
    cells.push({
      day: d, n: Number(d.slice(8)), inMonth: d.slice(0, 7) === anchor.slice(0, 7), today: d === today,
      out: outs.slice(0, 3).map(x => ({ id: x.id, ini: ini(x.who?.name ?? ''), color: x.who?.color ?? '#9CA3AF' })),
      outTip: outs.map(label).join(' · '),
      items: its.slice(0, 3).map(x => ({ id: x.id, label: (x.s != null ? `${cellTime(x.s)} ` : '') + label(x), title: label(x), look: look(x), meet: !!meetOf(x) })),
      more: Math.max(0, its.length - 3),
    })
  }
  return cells
}

// ── 8B Week ───────────────────────────────────────────────────────────────────

export interface WeekBar { id: string; col: string; row: number; label: string; title: string; look: Look }
/**
 * A timed event in the week grid. `lane` of `lanes`: events at the same time
 * share the day's width side by side, as Google Calendar does (owner, 31
 * October 2026). `short`: too low for two lines, so title and start share one.
 */
export interface WeekEvent { id: string; title: string; time: string; start: string; top: number; height: number; look: Look; meet: boolean; lane: number; lanes: number; short: boolean }

/** Side-by-side lanes for overlapping events: each takes the first lane free, and a group of overlapping events shares one lane count. */
export function lanesOf(evs: readonly { s: number; e: number }[]): { lane: number; lanes: number }[] {
  const order = evs.map((x, i) => i).sort((p, q) => evs[p].s - evs[q].s || evs[q].e - evs[p].e)
  const out: { lane: number; lanes: number }[] = evs.map(() => ({ lane: 0, lanes: 1 }))
  let group: number[] = [], groupEnd = -Infinity, ends: number[] = []
  const close = () => { const n = Math.max(1, ends.length); for (const i of group) out[i].lanes = n; group = []; ends = [] }
  for (const i of order) {
    const { s, e } = evs[i]
    if (s >= groupEnd) { close(); groupEnd = -Infinity }
    let lane = ends.findIndex(end => end <= s)
    if (lane < 0) { lane = ends.length; ends.push(e) } else ends[lane] = e
    out[i].lane = lane
    group.push(i)
    groupEnd = Math.max(groupEnd, e)
  }
  close()
  return out
}
export interface WeekModel {
  heads: { d: string; n: number; today: boolean }[]
  bars: WeekBar[]
  hours: string[]
  cols: { weekend: boolean; events: WeekEvent[] }[]
  /** The week's days and the first and last hour drawn, for the line at the current time. */
  days: string[]
  first: number
  last: number
}

/**
 * The parts of a day outside a person's working hours (Agenda settings), as
 * [top, height] in pixels of the week, for the shading (owner, 31 October
 * 2026). A day with no blocks is shaded whole. Hours are in the viewer's own
 * zone, the one the week is drawn in. Pure.
 */
export function offHours(day: string, hours: WorkingHours): [number, number][] {
  const d = dow(day), blocks = hours[String(d === 0 ? 7 : d) as Weekday] ?? []
  const out: [number, number][] = []
  let at = 0
  for (const [a, b] of blocks) {
    if (a > at) out.push([at, a])
    at = Math.max(at, b)
  }
  if (at < 1440) out.push([at, 1440])
  return out.map(([a, b]) => [a / 60 * WEEK_ROW, (b - a) / 60 * WEEK_ROW])
}

/**
 * Where the line at the current time goes in the week (owner, 31 October 2026):
 * the column of today and the height of this minute, or null when today is
 * not in the week or the hour is not drawn. `now` is in the viewer's zone. Pure.
 */
export function nowLine(wk: Pick<WeekModel, 'days' | 'first' | 'last'>, now: { date: string; minutes: number }): { col: number; top: number } | null {
  const col = wk.days.indexOf(now.date), h = now.minutes / 60
  if (col < 0 || h < wk.first || h > wk.last + 1) return null
  return { col, top: (h - wk.first) * WEEK_ROW }
}

/** One hour of the week, in pixels: seven of them fill the box, so cards read larger (owner, 31 October 2026). */
export const WEEK_ROW = 80
export const WEEK_SHOWN_HOURS = 7

export function weekModel(items: readonly AgendaItem[], anchor: string, today: string, seesType: (x: AgendaItem) => boolean): WeekModel {
  const { from } = viewDays('week', anchor), days = [...Array(7)].map((_, i) => addDays(from, i))
  const timed = items.filter(x => x.k === 'event' && x.s != null && x.a >= days[0] && x.a <= days[6])
  // The whole day, as Google Calendar draws it, in a box that scrolls and opens
  // on the morning or the current hour (owner, 31 October 2026): 8 AM to 5 PM
  // only left nothing to scroll to.
  const first = 0, last = 23
  const hours = [...Array(last - first + 1)].map((_, i) => hourLabel(first + i).replace(':00', ''))
  const allDay = items.filter(x => x.s == null && x.a <= days[6] && x.b >= days[0])
    .sort((p, q) => ((p.k === 'pto' ? 0 : 1) - (q.k === 'pto' ? 0 : 1)) || p.a.localeCompare(q.a))
  // Each bar takes the first row free on all its days, so bars on different days share a row.
  const taken: boolean[][] = []
  const bars = allDay.map(x => {
    const s0 = days.indexOf(x.a < days[0] ? days[0] : x.a), e0 = days.indexOf(x.b > days[6] ? days[6] : x.b)
    let r = 0
    while (taken[r]?.slice(s0, e0 + 1).some(Boolean)) r++
    taken[r] ??= Array(7).fill(false)
    for (let i = s0; i <= e0; i++) taken[r][i] = true
    return { id: x.id, col: `${s0 + 2} / ${e0 + 3}`, row: r + 1, label: label(x) + (x.k === 'pto' && x.type && seesType(x) ? ` (${x.type})` : ''), title: label(x), look: look(x) }
  })
  return {
    heads: days.map(d => ({ d: WD[dow(d)], n: Number(d.slice(8)), today: d === today })),
    bars, hours, days, first, last,
    cols: days.map(d => ({
      weekend: isWeekend(d),
      events: (() => {
        const day = timed.filter(x => x.a === d)
        const ln = lanesOf(day.map(x => ({ s: x.s!, e: Math.max(x.e ?? x.s! + 1, x.s! + 0.5) })))
        return day.map((x, i) => {
          const height = Math.max(22, ((x.e ?? x.s! + 1) - x.s!) * WEEK_ROW - 4)
          return {
            id: x.id, title: x.title ?? '', time: `${hourLabel(x.s!)} to ${hourLabel(x.e ?? x.s! + 1)}`, start: hourLabel(x.s!),
            top: (x.s! - first) * WEEK_ROW + 2, height, look: look(x), meet: !!meetOf(x), ...ln[i], short: height < 44,
          }
        })
      })(),
    })),
  }
}

// ── 8C List ───────────────────────────────────────────────────────────────────

export interface ListRow { id: string; label: string; sub: string; time: string; bg: string; fg: string; d: string; flag: string; yrs?: number; meet: boolean }
/** The kinds on a day, in the chips' order: the dots of the month on a phone. PTO skips weekends, as the list does. */
export function dayKinds(items: readonly AgendaItem[], d: string): AgendaKind[] {
  return KINDS.filter(k => items.some(x => x.k === k && covers(x, d) && !(k === 'pto' && isWeekend(d))))
}

export interface ListDay { day: string; title: string; sub: string; today: boolean; rows: ListRow[] }

export function listDays(items: readonly AgendaItem[], start: string, today: string, seesType: (x: AgendaItem) => boolean): ListDay[] {
  const out: ListDay[] = []
  for (let i = 0; i < 14; i++) {
    const d = addDays(start, i)
    const its = items.filter(x => covers(x, d) && !(x.k === 'pto' && isWeekend(d))).sort((p, q) => SORT[p.k] - SORT[q.k])
    if (!its.length) continue
    out.push({
      day: d, title: fday(d), sub: d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : '', today: d === today,
      rows: its.map(x => {
        const L = look(x), company = x.k === 'event' && !x.team
        const sub = x.k === 'pto' ? `${x.type && seesType(x) ? `${x.type} · ` : ''}${drng(x.a, x.b)}`
          : x.k === 'event' ? `${x.teams ?? 'Everyone'}${x.place ? ` · ${x.place.split(' · ')[0]}` : ''}`
          : x.k === 'ms' ? `Milestone${x.client ? ` · ${x.client}` : ''}`
          : x.k === 'hol' ? (x.country && x.country !== 'US' ? `National holiday · ${countryName(x.country)}` : 'Company holiday')
          : x.k === 'anni' ? 'Anniversary' : KIND[x.k].label.replace(/s$/, '')
        return {
          id: x.id, label: label(x), sub, time: x.s != null ? hourLabel(x.s) : 'All day',
          bg: company ? '#012358' : L.bg, fg: company ? '#F2C40A' : L.fg,
          d: x.k === 'pto' ? AG_ICON.cal : x.k === 'event' ? AG_ICON.clock : x.k === 'hol' ? AG_ICON.flag : L.d || AG_ICON.star,
          flag: L.flag, yrs: L.yrs, meet: !!meetOf(x),
        }
      }),
    })
  }
  return out
}

// ── Coming up (the side panel, next 14 days) ─────────────────────────────────

export interface ComingGroup { title: string; items: { id: string; label: string; when: string; c: string; yrs?: number; d: string; bg: string; fg: string }[] }

export function comingUp(items: readonly AgendaItem[], today: string): ComingGroup[] {
  const until = addDays(today, 13), soon = items.filter(x => x.a <= until && x.b >= today)
  const grp = (title: string, ks: AgendaKind[]): ComingGroup => ({
    title,
    items: soon.filter(x => ks.includes(x.k)).sort((p, q) => p.a.localeCompare(q.a)).map(x => {
      const L = look(x)
      return {
        id: x.id, label: label(x).replace(', out', ''),
        when: x.k === 'pto' ? drng(x.a < today ? today : x.a, x.b).replace(/^(\w+), /, '') : fday(x.a),
        c: L.c, yrs: L.yrs, d: L.d, bg: L.bg, fg: L.fg,
      }
    }),
  })
  return [grp('Who is out', ['pto']), grp('Birthdays and anniversaries', ['bday', 'anni']), grp('Events and milestones', ['event', 'ms'])].filter(g => g.items.length)
}

// ── 8D The card ───────────────────────────────────────────────────────────────

export interface CardRow { d: string; b: string; t: string; bold: boolean; sub?: string }
export interface AgendaCard {
  band: string; kind: string; kindFg: string; title: string
  ini: string | null; d: string; flag: string; yrs?: number; icBg: string; icFg: string; round: boolean
  rows: CardRow[]; desc: string | null; foot: string
  /** An event's Google Meet link: the card shows it as the "Join with Google Meet" box instead of a button. */
  meet: string | null
  /** A drawer event: the card draws its people, place and Google lines from this. */
  detail: EventDetail | null
  button: { label: string; href: string } | null
}

/** The next working day after time off: weekends and company holidays skipped. */
export function backOn(end: string, holidays: ReadonlySet<string>): string {
  let d = addDays(end, 1)
  while (isWeekend(d) || holidays.has(d)) d = addDays(d, 1)
  return d
}

/** The Google Meet link of an event, when it has one: the card shows the Meet icon for it. */
export const meetOf = (x: AgendaItem): string | null => (x.k === 'event' && x.link && /^https:\/\/meet\.google\.com\//.test(x.link) ? x.link : null)

/** "America/New_York" -> "New York" */
export const cityOf = (zone: string): string => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')

export function cardOf(x: AgendaItem, v: { meId: string; superAdmin: boolean; today: string; zone: string; holidays: ReadonlySet<string> }): AgendaCard {
  const L = look(x)
  const kind = x.k === 'event' && x.team ? `Team event · ${x.team.name}` : x.k === 'event' ? 'Company event' : x.k === 'ms' ? 'Milestone'
    : x.k === 'pto' ? 'Time off' : x.k === 'bday' ? 'Birthday' : x.k === 'anni' ? 'Work anniversary'
    : x.country && x.country !== 'US' ? `National holiday · ${countryName(x.country)}` : 'Company holiday'
  const base: AgendaCard = { band: L.c, kind, kindFg: '#8593a4', title: label(x), ini: null, d: L.d || AG_ICON.cal, flag: L.flag, yrs: L.yrs, icBg: L.bg, icFg: L.fg, round: false, rows: [], desc: x.desc || null, foot: '', meet: null, detail: null, button: null }
  const team = x.who?.teamName ?? ''
  const day = (iso: string, t = '') => ({ d: AG_ICON.cal, b: fday(iso), t, bold: true })
  const when = () => (x.a === x.b ? day(x.a, x.s == null ? ', all day' : '') : { d: AG_ICON.cal, b: drng(x.a, x.b), t: '', bold: true })
  if (x.k === 'pto') {
    const mine = x.who?.id === v.meId
    return {
      ...base, ini: ini(x.who?.name ?? ''), icBg: x.who?.color ?? '#9CA3AF', icFg: '#012358', round: true,
      rows: [
        { d: AG_ICON.cal, b: drng(x.a, x.b), t: '', bold: true },
        { d: AG_ICON.undo, b: '', t: `Back on ${fday(backOn(x.b, v.holidays))}`, bold: false },
        ...(x.type ? [{ d: AG_ICON.clock, b: x.type, t: '', bold: true }] : []),
        ...(team ? [{ d: AG_ICON.people, b: '', t: team, bold: false }] : []),
      ],
      foot: `From approved time off, by itself.${x.onGoogle ? ' It is also on the team Google Calendar.' : ''}`,
    }
  }
  if (x.k === 'bday') {
    return { ...base, rows: [{ d: AG_ICON.cal, b: fday(x.a).split(', ')[1], t: x.a === v.today ? ', today' : '', bold: true }, ...(team ? [{ d: AG_ICON.people, b: '', t: team, bold: false }] : [])],
      foot: `From the Directory: month and day only, never the year. ${(x.who?.name ?? '').split(' ')[0]} can hide it in their settings.` }
  }
  if (x.k === 'anni') return { ...base, rows: [day(x.a), ...(team ? [{ d: AG_ICON.people, b: '', t: team, bold: false }] : [])], foot: 'From the Directory (Work tab, start date).' }
  if (x.k === 'event' && x.detail) {
    const dt = x.detail, meet = meetOf(x)
    const timed = x.s != null
    const sub = timed ? [durationLabel((x.e ?? x.s! + 1) - x.s!), otherZonesLabel(dt.guests, dt.startsAt, v.zone)].filter(Boolean).join(' · ') : x.a === x.b ? 'All day' : `${Math.round((Date.parse(x.b) - Date.parse(x.a)) / 864e5) + 1} days, all day`
    return {
      ...base,
      kind: x.team ? `Team event · ${x.team.name}` : x.evType ? typeOf(x.evType).label : base.kind,
      rows: [
        timed ? { d: AG_ICON.clock, b: `${fday(x.a)}, ${hourLabel(x.s!)} to ${hourLabel(x.e ?? x.s! + 1)}`, t: ` in your time zone (${cityOf(v.zone)})`, bold: true, sub }
          : { d: AG_ICON.cal, b: x.a === x.b ? fday(x.a) : drng(x.a, x.b), t: '', bold: true, sub },
        ...(dt.repeat ? [{ d: AG_ICON.repeat, b: '', t: dt.repeat, bold: false }] : []),
        ...(x.client ? [{ d: AG_ICON.link, b: '', t: `Tied to ${x.client}`, bold: false }] : []),
      ],
      foot: '',
      meet,
      detail: dt,
      button: x.link && !meet ? { label: 'Join the call', href: x.link } : null,
    }
  }
  if (x.k === 'event') {
    const meet = meetOf(x)
    return {
      ...base,
      rows: [
        x.s != null ? { d: AG_ICON.clock, b: `${fday(x.a)}, ${hourLabel(x.s)} to ${hourLabel(x.e ?? x.s + 1)}`, t: ` in your time zone (${cityOf(v.zone)})`, bold: true } : when(),
        // A Meet link shows as its own box, so "Google Meet" is not said twice.
        ...(x.place && !(meet && x.place === 'Google Meet') ? [{ d: AG_ICON.video, b: '', t: x.place, bold: false }] : []),
        { d: AG_ICON.people, b: '', t: `Who sees it: ${x.teams ?? 'Everyone'}`, bold: false },
        ...(x.by ? [{ d: AG_ICON.edit, b: '', t: `Created by ${x.by}`, bold: false }] : []),
      ],
      // An event from the New event drawer goes to the Send from account's own calendar, not the team one.
      foot: x.onGoogle ? (x.evType ? 'Also on Google Calendar.' : 'Also on the team Google Calendar.') : x.team ? `A ${x.team.name} team event.` : '',
      meet,
      button: x.link && !meet ? { label: 'Join the call', href: x.link } : null,
    }
  }
  if (x.k === 'ms') {
    return {
      ...base,
      rows: [when(), ...(x.client ? [{ d: AG_ICON.link, b: '', t: `Tied to ${x.client}`, bold: false }] : []), ...(x.audience?.length ? [{ d: AG_ICON.people, b: '', t: `Who sees it: ${x.teams}`, bold: false }] : []), ...(x.by ? [{ d: AG_ICON.edit, b: '', t: `Created by ${x.by}`, bold: false }] : [])],
      foot: x.audience?.length ? '' : 'Everyone sees milestones.',
    }
  }
  if (x.country && x.country !== 'US') {
    return { ...base, rows: [day(x.a)], foot: `A public holiday in ${countryName(x.country)}, shown for information: it does not change time off or work days. Holiday data: the date-holidays project (CC BY 3.0).` }
  }
  return { ...base, rows: [day(x.a)], foot: 'From the company holiday list. Nobody asks for it as time off.' }
}

// ── 8F Home, This week ────────────────────────────────────────────────────────

export interface ThisWeek {
  range: string
  out: { id: string; ini: string; color: string; name: string; when: string }[]
  celebrations: { id: string; name: string; when: string; today: boolean; d: string; bg: string; fg: string; yrs?: number }[]
  next: { dow: string; n: number; title: string; sub: string } | null
}

export function thisWeek(items: readonly AgendaItem[], today: string): ThisWeek {
  const { from, to } = viewDays('week', today)
  const inWeek = (x: AgendaItem) => x.a <= to && x.b >= from
  const next = items.filter(x => x.k === 'event' && x.a >= today).sort((p, q) => p.a.localeCompare(q.a) || (p.s ?? 0) - (q.s ?? 0))[0]
  return {
    range: rng(from, to).replace(/, \d{4}$/, ''),
    out: items.filter(x => x.k === 'pto' && inWeek(x)).sort((p, q) => p.a.localeCompare(q.a))
      .map(x => ({ id: x.id, ini: ini(x.who?.name ?? ''), color: x.who?.color ?? '#9CA3AF', name: x.who?.name ?? '', when: drng(x.a, x.b).replace(/(\w+), /g, '') })),
    // The same Sunday to Saturday as the title and Who is out (owner, 2026-10-23; the prototype looked 7 days ahead).
    celebrations: items.filter(x => (x.k === 'bday' || x.k === 'anni') && inWeek(x)).sort((p, q) => p.a.localeCompare(q.a))
      .map(x => { const L = look(x); return { id: x.id, name: label(x), when: x.a === today ? 'Today' : fday(x.a), today: x.a === today, d: L.d, bg: L.bg, fg: L.fg, yrs: L.yrs } }),
    next: next ? {
      dow: WD[dow(next.a)], n: Number(next.a.slice(8)), title: next.title ?? '',
      sub: [next.s != null ? `${hourLabel(next.s)} to ${hourLabel(next.e ?? next.s + 1)}` : next.a === next.b ? 'All day' : drng(next.a, next.b), next.place?.split(' · ')[0]].filter(Boolean).join(' · '),
    } : null,
  }
}
