/**
 * The System manual's Agenda pictures (owner, 4 November 2026: the guides
 * show the real screens with made-up data). Everyone here is invented; the
 * teams are True North's. Seen by Alex Rivera, a writer, on Tue, Nov 10, 2026.
 */

import type { AgendaData } from '@/components/agenda/AgendaView'
import type { AgendaItem } from '@/lib/agenda/model'
import type { AgendaSettingsData } from '@/lib/agenda/settings-data'
import { DEFAULT_HOURS } from '@/lib/agenda/working-hours'

const ZONE = 'America/New_York'
const TODAY = '2026-11-10'

const TEAMC: Record<string, string> = { Graphics: '#C026D3', Leadership: '#1E40AF', SEO: '#F4C24A', 'Social Media': '#DC2626', Translation: '#14B8A6', Web: '#A99BD4', Writers: '#86C06A' }
const TEAM: Record<string, string> = { 'Alex Rivera': 'Writers', 'Jordan Lee': 'Web', 'Sam Patel': 'SEO', 'Maria Gomez': 'Social Media', 'Chris Taylor': 'Leadership', 'Priya Nair': 'Translation', 'Ben Carter': 'Graphics' }
const who = (name: string) => ({ id: name, name, teamId: TEAM[name], teamName: TEAM[name], color: TEAMC[TEAM[name]] })
const team = (name: string) => ({ id: name, name, color: TEAMC[name] })

const ITEMS: AgendaItem[] = [
  { id: 'o1', k: 'pto', who: who('Jordan Lee'), a: '2026-11-12', b: '2026-11-13', onGoogle: true },
  { id: 'o2', k: 'pto', who: who('Priya Nair'), a: '2026-11-19', b: '2026-11-20', onGoogle: true },
  { id: 'o3', k: 'pto', who: who('Chris Taylor'), a: '2026-11-30', b: '2026-11-30', onGoogle: true },
  { id: 'b1', k: 'bday', who: who('Maria Gomez'), a: '2026-11-10', b: '2026-11-10' },
  { id: 'b2', k: 'bday', who: who('Ben Carter'), a: '2026-11-24', b: '2026-11-24' },
  { id: 'a1', k: 'anni', who: who('Sam Patel'), yrs: 3, a: '2026-11-17', b: '2026-11-17' },
  { id: 'e1', k: 'event', title: 'All-hands', a: '2026-11-12', b: '2026-11-12', s: 11, e: 12, place: 'Google Meet', link: 'https://meet.google.com/', teams: 'Everyone', by: 'Chris Taylor', desc: 'News from every team and the plans for December.', onGoogle: true, audience: [] },
  { id: 't1', k: 'event', team: team('Writers'), title: 'Writers sync', a: '2026-11-16', b: '2026-11-16', s: 14, e: 15, place: 'Google Meet', teams: 'Writers', by: 'Alex Rivera', desc: 'The December editorial calendar.', audience: ['Writers'] },
  { id: 't2', k: 'event', team: team('Web'), title: 'Web sprint review', a: '2026-11-18', b: '2026-11-18', s: 15, e: 16, place: 'Google Meet', teams: 'Web', by: 'Jordan Lee', desc: 'A demo of what the Web team finished.', audience: ['Web'] },
  { id: 'm1', k: 'ms', title: 'Sample Client site launch', a: '2026-11-20', b: '2026-11-20', client: 'Sample Client', by: 'Chris Taylor', desc: 'The new site goes live.', audience: [] },
  { id: 'h1', k: 'hol', title: 'Thanksgiving', a: '2026-11-26', b: '2026-11-26', country: 'US' },
  { id: 'h2', k: 'hol', title: 'Day after Thanksgiving', a: '2026-11-27', b: '2026-11-27', country: 'US' },
]

/** The Agenda as Alex sees it: month, week or list. */
export function agendaSample(view: AgendaData['view'] = 'month'): AgendaData {
  const teams = Object.keys(TEAMC).map(team)
  return {
    view, anchor: TODAY, today: TODAY, items: ITEMS, teams,
    me: { id: 'Alex Rivera', superAdmin: false, zone: ZONE, hours: DEFAULT_HOURS },
    holidays: ['2026-11-26', '2026-11-27'],
    create: { mode: 'company', teams, zone: ZONE, today: TODAY, clients: ['Sample Client'], calendar: 'True North Team' },
  }
}

const TN = 'truenorthdigitalmarketing.com'

/** Agenda settings as Alex sees them, with two Google accounts connected. */
export function agendaSettingsSample(): AgendaSettingsData {
  return {
    superAdmin: false,
    googleReady: true,
    zoom: { ready: true, account: null, preferred: 'meet' },
    teamCalendar: { id: 1, email: `office@${TN}`, sample: false, needsReconnect: false, connectedAt: '2026-10-30T15:00:00Z', by: 'Chris Taylor' },
    accounts: [
      { id: 2, email: `alex.rivera@${TN}`, sample: false, needsReconnect: false, connectedAt: '2026-11-02T14:00:00Z' },
      { id: 3, email: 'alex.rivera@goodnewsadvocates.org', sample: false, needsReconnect: false, connectedAt: '2026-11-02T14:05:00Z' },
    ],
    workEmail: `alex.rivera@${TN}`,
    inviteAccountId: 2,
    hours: DEFAULT_HOURS,
    zone: { name: 'Eastern Time (New York)', versus: 'Same as Washington DC', isDc: true, profileHref: '#' },
    country: null,
    allLevels: [],
    link: { url: 'https://truenorthportal.online/meet/alex-rivera', slug: 'alex-rivera', on: true, lengths: [30, 60], gap: 15, noticeMin: 1440, windowDays: 30, accountId: 2 },
  }
}
