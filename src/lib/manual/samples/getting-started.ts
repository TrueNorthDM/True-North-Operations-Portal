/**
 * The System manual's Getting started pictures (owner, 4 November 2026: the
 * guides show the real screens with made-up data). Everyone here is invented;
 * the client names are generic. Seen by Jordan Lee, a Team Leader on the Web
 * team, on Tue, Nov 10, 2026, at 10:20 AM in New York.
 */

import type { NotificationItem } from '@/components/NotificationDrawer'
import { buildRail, type ResolvedEntry } from '@/lib/access/nav'
import { canAs, rulesWithTools } from '@/lib/access/simulate'
import type { AgendaItem } from '@/lib/agenda/model'
import { homeAgenda, type HomeAgenda } from '@/lib/agenda/home'
import type { PublishingBoardWeeks, PublishingWeek } from '@/lib/boards/publishing-weeks'
import { pageRights } from '@/lib/directory/page-rights'
import type { PersonPageData } from '@/lib/directory/person-page-data'
import type { HomeRow, NeedsYouData } from '@/lib/home/needs-you-model'
import type { NavCount } from '@/lib/nav/counts'
import { NOTIFICATION_TYPES, reaches } from '@/lib/notifications/catalogue'
import { DEFAULT_SETTINGS, type PersonSettings } from '@/lib/settings/person'
import { formatTenure, milestoneOf, tenureSince } from '@/lib/tenure'
import type { I7Carryover } from '@/lib/tsheets/types'

export const NOW = '2026-11-10T15:20:00.000Z'
export const TODAY = '2026-11-10'
export const ZONE = 'America/New_York'
export const FIRST_NAME = 'Jordan'
export const EMAIL = 'jordan.lee@truenorthdigitalmarketing.com'
export const NAME = 'Jordan Lee'

// ── The rail ────────────────────────────────────────────────────────────────

/** A Team Leader's rail, with the tools a typical team holds, North Time open. */
const can = canAs('team_leader', { teams: [['web', true]], rules: rulesWithTools(['publishing', 'href-links', 'i7-budget']) })

export function railSample(): ResolvedEntry[] {
  return buildRail({ can, canTool: can })
}

/** The notifications that can reach Jordan, as Settings lists them (faded ones included). */
export const notificationTypesSample = () => NOTIFICATION_TYPES.filter(t => !t.available || reaches(t, { isAdmin: false, leads: true, canTool: can }))

/** What the rail counts: 3 late steps in My Work, 2 decisions in Approvals. */
export const RAIL_COUNTS: Partial<Record<NavCount, number>> = { 'my-late': 3, approvals: 2 }

// ── The bell ────────────────────────────────────────────────────────────────

export const BELL: Record<string, NotificationItem[]> = {
  tools: [
    { id: 'n1', who: 'A step of yours is due tomorrow', what: 'Publish on WordPress: Ten tips for a faster site. Due Nov 11.', when: '09:12', src: 'My Work', icon: 'my-work', href: '/my-work', unread: true },
    { id: 'n2', who: 'A new step was assigned to you', what: 'Review: Sample Client landing page. Due Nov 13.', when: '08:40', src: 'My Work', icon: 'my-work', href: '/my-work', unread: true },
    { id: 'n3', who: 'Publishing Goals behind pace', what: 'Sample Client: 6 of 10 published this week, 8 expected by now.', when: 'Yesterday', src: 'Operations', icon: 'publishing-goals', href: '/ops/publishing', unread: false, summary: true },
  ],
  system: [
    { id: 'n4', who: 'Your access changed', what: 'Report was added to your level.', when: 'Mon', src: 'Portal', icon: 'admin', href: '/', unread: false },
  ],
}

// ── Home ────────────────────────────────────────────────────────────────────

const facts = (rows: [string, string][]) => rows.map(([k, v]) => ({ k, v }))

function task(key: string, title: string, board: string, due: HomeRow['due']): HomeRow {
  const sub = `My Work · ${board}`
  return {
    key, kind: 'work', title, sub, due, button: 'Open',
    panel: {
      title, sub, facts: facts([['Board', board], ['Step', 'Owner'], ['Status', 'Working on it'], ['Due', due!.label]]), note: null,
      link: { label: 'Open in My Work', href: '/my-work' },
      primary: { label: 'Open in Monday', href: 'https://monday.com', external: true, icon: 'arrow' },
      secondary: { label: 'Close' },
    },
  }
}

const SYNC: HomeRow = {
  key: 's1', kind: 'system', title: 'Monday sync failed twice', sub: 'Last good sync Mon, 11:40 PM. My Work may be out of date.',
  due: { label: 'Since 6:00', tone: 'late', at: '2026-11-10T11:00:00Z' }, button: 'Open Automations',
  panel: {
    title: 'Monday sync failed twice', sub: 'Last good sync Mon, 11:40 PM. My Work may be out of date.',
    facts: facts([['Service', 'Monday'], ['Last good sync', 'Mon, 11:40 PM'], ['Failed', '6:00 and 7:00 AM']]),
    note: null, link: { label: 'Open Automations', href: '/admin/automations' },
    primary: { label: 'Run checks now', op: { do: 'run-checks' }, icon: 'arrow' }, secondary: { label: 'Close' },
  },
}
const INVITE: HomeRow = {
  key: 'a1', kind: 'access', title: 'Sam Patel has not accepted the invitation', sub: 'Sent Tue, Nov 3. Access level: User.',
  due: { label: 'Today', tone: 'today', at: TODAY }, button: 'Resend',
  panel: {
    title: 'Sam Patel has not accepted the invitation', sub: 'Sent Tue, Nov 3. Access level: User.',
    facts: facts([['Person', 'Sam Patel'], ['Team', 'Web'], ['Access level', 'User'], ['Sent', 'Tue, Nov 3']]),
    note: null, link: { label: 'Open in Directory', href: '/directory' },
    primary: { label: 'Resend invitation', op: { do: 'resend-invite', id: 'sam' }, icon: 'arrow' }, secondary: { label: 'Close' },
  },
}

/** Needs you, My Work and Requests, as the server builds them. */
export const NEEDS_YOU: NeedsYouData = {
  needs: { rows: [SYNC, INVITE], errors: [] },
  work: {
    rows: [
      task('w1', 'Fix the menu on the Sample Client site', 'Web', { label: 'Was due Fri', tone: 'late', at: '2026-11-06' }),
      task('w2', 'Review: Sample Client landing page', 'Web', { label: 'Today', tone: 'today', at: TODAY }),
      task('w3', 'Ten tips for a faster site: publish', 'Web', { label: 'Wed, Nov 11', tone: 'later', at: '2026-11-11' }),
    ],
    errors: [],
  },
  mine: {
    rows: [{ key: 'r1', kind: 'mine', title: 'Time off, Dec 28 to 31', sub: 'Waiting on Chris Taylor', due: null, button: 'Open', panel: null, href: '/requests/time-off', mine: { state: 'wait', icon: 'requests' } }],
    errors: [],
  },
  today: TODAY,
}

const who = (id: string, name: string, color: string) => ({ id, name, teamId: null, teamName: null, color })
const AGENDA_ITEMS: AgendaItem[] = [
  { id: 'pto:1', k: 'pto', a: '2026-11-09', b: '2026-11-12', who: who('pn', 'Priya Nair', '#14B8A6'), type: null },
  { id: 'ev:1', k: 'event', a: TODAY, b: TODAY, s: 11, e: 11.5, title: 'Web standup', teams: 'Web' },
  { id: 'ev:2', k: 'event', a: TODAY, b: TODAY, s: 14, e: 15, title: 'Sample Client review', teams: 'Everyone' },
  { id: 'bday:1', k: 'bday', a: '2026-11-12', b: '2026-11-12', who: who('mg', 'Maria Gomez', '#DC2626') },
  { id: 'ev:3', k: 'event', a: '2026-11-12', b: '2026-11-12', s: 11, e: 12, title: 'All-hands', teams: 'Everyone' },
  { id: 'anni:1', k: 'anni', a: '2026-11-17', b: '2026-11-17', who: who('sp', 'Sam Patel', '#F4C24A'), yrs: 3 },
  { id: 'hol:1', k: 'hol', a: '2026-11-26', b: '2026-11-26', title: 'Thanksgiving', country: 'US' },
]

/** The Agenda card: who is out, today, and what is coming up. 10:20 AM. */
export const homeAgendaSample = (): HomeAgenda => homeAgenda(AGENDA_ITEMS, TODAY, 10 + 20 / 60)

/** The i7 budget card: invented figures. */
export const I7_SAMPLE: I7Carryover = { opening: 540.25, monthBudget: 40000, monthUsed: 12480.5, totalAvailable: 40540.25, totalLeft: 28059.75, openingFrom: '2025-01', openingComplete: true }
export const I7_MONTH = '2026-11'

const MONDAYS = ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02']

/** A weekly board from [language, target, five weeks done], English first. */
function weekly(boardId: string, name: string, langs: [string, number, number[]][]): PublishingBoardWeeks {
  const weeks: PublishingWeek[] = MONDAYS.map((start, i) => {
    const rows = langs.map(([lang, target, done]) => ({ lang, done: done[i], target }))
    const en = rows.find(l => l.lang === 'English')
    return {
      start, label: start, untargeted: 0, langs: rows,
      done: rows.reduce((s, l) => s + l.done, 0),
      target: rows.reduce((s, l) => s + l.target, 0),
      en: en ? { done: en.done, target: en.target } : null,
    }
  })
  return {
    boardId, name, cycleWeeks: 1, weeks,
    langHits: Object.fromEntries(langs.map(([lang, t, done]) => [lang, done.filter(d => d >= t).length])),
    perPeriod: weeks[weeks.length - 1].target, enPerPeriod: weeks[weeks.length - 1].en?.target ?? 0,
    hits: weeks.filter(w => w.done >= w.target).length,
    enHits: weeks.filter(w => w.en && w.en.done >= w.en.target).length,
    firstCycleEnds: null, firstCycle: null,
  }
}

/** Publishing goals: two invented boards. */
export const PUBLISHING_SAMPLE = {
  boards: [
    weekly('sample-1', 'Sample Client', [['English', 3, [3, 2, 3, 3, 3]], ['Spanish', 2, [2, 2, 1, 2, 2]], ['Portuguese', 2, [2, 1, 2, 2, 2]]]),
    weekly('sample-2', 'Second Client', [['English', 2, [2, 2, 2, 1, 2]], ['French', 1, [1, 1, 0, 1, 1]]]),
  ],
  updatedAt: '2026-11-10T07:04:00Z',
}

// ── Settings and the profile ────────────────────────────────────────────────

/** Jordan's choices: Chicago time, the summary at 8:00, three favourites. */
export const SETTINGS_SAMPLE: PersonSettings = { ...DEFAULT_SETTINGS, timeZone: 'America/Chicago', ownZone: true, summaryHour: 8, favourites: ['publishing', 'my-team', 'directory'] }

const TEAMS = [{ teamId: 't-web', teamName: 'Web', color: '#A99BD4', position: 'lead' as const, primary: true }]

/** Jordan's own page in the Directory, as Jordan sees it. */
export function profileSample(): PersonPageData {
  const rights = pageRights(canAs('team_leader'), 'own')!
  const hire = '2023-03-06'
  const t = tenureSince(hire, new Date(NOW))
  return {
    id: '00000000-0000-4000-8000-00000000a001', name: NAME, title: 'Web Developer', avatarUrl: null, color: '#A99BD4', active: true, rights,
    cover: {
      teams: TEAMS, hireDate: hire,
      tenure: { text: formatTenure(t), milestone: milestoneOf(t), next: null },
      location: 'Austin, Texas, USA', localTime: '9:20 AM', email: null, whatsapp: null,
    },
    personal: {
      lastName: 'Lee', personalEmail: 'jordan.lee@example.com', phone: '+1 512 555 0147', whatsappSame: 'yes',
      dateOfBirth: '1990-07-21', location: 'Austin, Texas, USA',
      address: { country: 'US', zip: '78701', city: 'Austin', line1: '400 Example St', line2: null, state: 'TX' },
    },
    work: null, hr: null, reports: null, options: null, rates: null,
  }
}
