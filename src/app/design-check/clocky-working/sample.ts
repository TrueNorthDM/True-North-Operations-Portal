// Who's working with the prototype's own data (Design/design_handoff_clocky/
// Who's Working.dc.html, `people()` and `frame(k)`): Thu, Oct 15, 2026 at
// 10:59 AM New York, the same fifteen people, teams, zones, jobs and times.
// Day and week are the prototype's sums; the screen rounds them as it does.

import type { WhosWorkingData, WorkingPerson } from '@/lib/timeclock/clocky-types'
import { initials } from '@/lib/timeclock/format'
import type { WorkingApi } from '@/components/clocky/working/working-api'
import type { WorkingUi } from '@/components/clocky/working/WhosWorkingPanel'

/** An instant on Thu, Oct 15, 2026, as a New York (EDT) wall time. */
const et = (h: number, m = 0, s = 0) => new Date(Date.UTC(2026, 9, 15, h + 4, m, s)).toISOString()
const H = (h: number, m = 0, s = 0) => h * 3600 + m * 60 + s
const round = (iso: string) => new Date(Math.round(Date.parse(iso) / 900_000) * 900_000).toISOString()

/** The prototype's team order and colours. */
export const TEAM_ORDER = ['Africa', 'Web', 'Leadership', 'Operations', 'Fund Raising', 'Writers', 'Social Media', 'SEO', 'Graphics']
const COLOR: Record<string, string> = { Africa: '#F0A35E', Web: '#A99BD4', Leadership: '#1E40AF', Operations: '#92400E', 'Fund Raising': '#CA8A04', Writers: '#86C06A', 'Social Media': '#DC2626', SEO: '#F4C24A', Graphics: '#C026D3' }
const TZ: Record<string, { zone: string; abbr: string }> = {
  ET: { zone: 'America/New_York', abbr: 'EDT' }, EAT: { zone: 'Africa/Nairobi', abbr: 'EAT' },
  CT: { zone: 'America/Chicago', abbr: 'CDT' }, PT: { zone: 'America/Los_Angeles', abbr: 'PDT' },
}

interface Proto { n: string; t: string | null; tz: string; st: 'on' | 'off'; job: string; act: string; start?: number; sess?: number; day0: number; wk0: number; kept?: number; auto?: number; last?: string }

const PEOPLE: Proto[] = [
  { n: 'Justus Tsofa', t: 'Africa', tz: 'EAT', st: 'on', job: '2 - i7 Marketing › Content', act: 'Content: Writing', start: H(6, 18, 48), day0: H(3, 11), wk0: H(28, 20), kept: H(10, 48) },
  { n: 'Hosea Moturi', t: 'Africa', tz: 'EAT', st: 'on', job: '1 - True North › Project Management', act: 'Translation', start: H(9, 30), day0: H(4, 40), wk0: H(26, 5) },
  { n: 'Joy Inyele', t: 'Africa', tz: 'EAT', st: 'on', job: '2 - i7 Marketing › Content', act: 'Social Media', start: H(10, 52), day0: H(2, 30), wk0: H(27, 45) },
  { n: 'Wendy Cacka', t: 'Web', tz: 'CT', st: 'on', job: '2 - i7 Marketing › Web Dev', act: 'WebDev', start: H(10, 15), day0: H(5, 0), wk0: H(24, 30), auto: H(10) },
  { n: 'Samuel Manzi', t: 'Web', tz: 'ET', st: 'on', job: '1 - True North › Web Dev', act: 'WebDev', start: H(6, 30, 20), day0: 0, wk0: H(30, 10) },
  { n: 'Clarise Nixon', t: 'Social Media', tz: 'ET', st: 'on', job: '2 - i7 Marketing › Content', act: 'Social Media', start: H(9, 45), sess: H(7), day0: H(2, 45), wk0: H(25, 0) },
  { n: 'Stephanie Aguirre', t: 'Social Media', tz: 'ET', st: 'on', job: '2 - i7 Marketing › Marketing', act: 'Social Media', start: H(9, 5), day0: 0, wk0: H(26, 30) },
  { n: 'Cheyenne Wilson', t: 'Writers', tz: 'ET', st: 'on', job: '2 - i7 Marketing › Content', act: 'Content: Writing', start: H(7, 0), day0: 0, wk0: H(27, 15) },
  { n: 'Arnaldo Oliveira', t: 'Leadership', tz: 'ET', st: 'on', job: '2 - i7 Marketing › Web Dev', act: 'WebDev', start: H(10, 0), day0: H(1, 45), wk0: H(31, 20) },
  { n: 'Dave Sharpe', t: 'Leadership', tz: 'ET', st: 'off', job: '1 - True North › Management', act: 'Management', last: '9:30 AM', day0: H(1, 30), wk0: H(22, 10) },
  { n: 'Rock Kai', t: 'Operations', tz: 'ET', st: 'on', job: '1 - True North › Management', act: 'Management', start: H(8, 30), day0: 0, wk0: H(30, 0) },
  { n: 'Tina Gennette', t: 'Fund Raising', tz: 'PT', st: 'on', job: 'Adventist Messengers/HFA', act: 'Content: Review/Edit', start: H(10, 20), day0: 0, wk0: H(18, 40) },
  { n: 'Saheed Fidimaye', t: 'SEO', tz: 'ET', st: 'on', job: '1 - True North › SEO', act: 'SEO: Routine', start: H(8, 15), day0: 0, wk0: H(28, 50) },
  { n: 'Alyssa Sommerville', t: 'Graphics', tz: 'ET', st: 'off', job: '1 - True North › Marketing', act: 'Graphic creation', last: '10:20 AM', day0: H(2, 50), wk0: H(24, 0) },
  { n: 'Olivia Hale', t: null, tz: 'ET', st: 'off', job: '', act: '', last: 'Wed, 5:10 PM', day0: 0, wk0: H(32, 0) },
]

const at = (sec: number) => et(Math.floor(sec / 3600), Math.floor((sec % 3600) / 60), sec % 60)

function person(p: Proto, now: number, superAdmin: boolean): WorkingPerson {
  const on = p.st === 'on' && p.start != null
  const day = p.day0 + (on ? now - p.start! : 0)
  const session = on ? (p.sess ?? p.start!) : null
  return {
    personId: p.n.toLowerCase().replace(/\s+/g, '-'),
    name: p.n,
    initials: initials(p.n),
    avatarUrl: null,
    team: p.t ? { id: p.t, name: p.t, color: COLOR[p.t] } : null,
    zone: TZ[p.tz].zone,
    zoneAbbr: TZ[p.tz].abbr,
    status: on ? 'on' : 'off',
    autoOutToday: p.auto != null ? { at: at(p.auto) } : null,
    clockedOutBy: null,
    current: on ? { entryId: 1, path: p.job, activity: p.act, timerFrom: at(p.start!), startedAt: round(at(p.start!)), sessionStartedAt: at(session!) } : null,
    lastOut: on ? null : p.last ?? null,
    daySeconds: day,
    weekSeconds: p.wk0 + day,
    over: on && now - session! >= H(4, 30),
    keptGoingAt: p.kept != null ? at(p.kept) : null,
    canClockOut: superAdmin && on,
  }
}

function data(o: { lead?: boolean; now?: number; allOff?: boolean } = {}): WhosWorkingData {
  const now = o.now ?? H(10, 59)
  let ppl = PEOPLE
  if (o.lead) ppl = ppl.filter(p => p.t === 'Web')
  if (o.allOff) ppl = ppl.map(p => (p.st === 'off' ? p : { ...p, st: 'off', last: p.n === 'Justus Tsofa' ? '6:40 PM EAT' : '7:30 PM', day0: p.day0 + 4 * 3600 }))
  const people = ppl.map(p => person(p, now, !o.lead))
  return {
    viewer: o.lead
      ? { zone: 'America/Chicago', zoneAbbr: 'CDT', scope: 'team', teamNames: ['Web'] }
      : { zone: 'America/New_York', zoneAbbr: 'EDT', scope: 'all', teamNames: [] },
    now: at(now),
    onTheClock: people.filter(p => p.status === 'on').length,
    people,
  }
}

export interface WorkingFrame { code: string; title: string; data: WhosWorkingData; ui?: Partial<WorkingUi>; meName: string; page?: boolean }

export const FRAMES: WorkingFrame[] = [
  { code: '2A', title: 'Super Admin, all teams', data: data(), meName: 'Arnaldo Oliveira' },
  { code: '2Am', title: 'Row menu', data: data(), ui: { menu: 'justus-tsofa' }, meName: 'Arnaldo Oliveira' },
  { code: '2B', title: 'Team Leader, Web', data: data({ lead: true }), meName: 'Wendy Cacka' },
  { code: '2C', title: 'Everyone today', data: data(), ui: { filter: 'all' }, meName: 'Arnaldo Oliveira' },
  { code: '2D', title: 'Empty', data: data({ allOff: true, now: H(20, 12) }), meName: 'Arnaldo Oliveira' },
  { code: '2E', title: 'Clock out for them', data: data(), ui: { dialog: 'justus-tsofa' }, meName: 'Arnaldo Oliveira' },
  { code: '2P', title: 'Full page', data: data(), meName: 'Arnaldo Oliveira', page: true },
]

/** A stand-in for the server, with the prototype's words. */
export function sampleApi(d: WhosWorkingData): WorkingApi {
  return {
    load: () => Promise.resolve({ ok: true as const, data: d }),
    count: () => Promise.resolve({ ok: true as const, count: d.onTheClock }),
    clockOutFor: input => {
      const p = d.people.find(x => x.personId === input.personId)
      return Promise.resolve({ ok: true as const, toast: `${p?.name ?? ''} clocked out at 10:59 AM. Marked "Clocked out by Arnaldo Oliveira".` })
    },
  }
}
