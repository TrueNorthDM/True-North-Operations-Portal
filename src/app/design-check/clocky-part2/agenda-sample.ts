// Agenda.dc.html's sample, for frames 8A to 8F: its EV list, its people and
// team colours, seen by Arnaldo Oliveira (Super Admin) on Tue, Nov 3, 2026.

import { thisWeek, type AgendaItem, type ThisWeek } from '@/lib/agenda/model'
import type { AgendaData } from '@/components/agenda/AgendaView'

const TEAMC: Record<string, string> = { 'Admin Assistants': '#9CA3AF', Africa: '#F0A35E', 'Fund Raising': '#CA8A04', Graphics: '#C026D3', Leadership: '#1E40AF', Marketing: '#047857', Operations: '#92400E', SEO: '#F4C24A', 'Social Media': '#DC2626', 'Special Projects': '#6D5EF5', Translation: '#14B8A6', Web: '#A99BD4', Writers: '#86C06A' }
const TEAM: Record<string, string> = { 'Arnaldo Oliveira': 'Leadership', 'Dave Sharpe': 'Leadership', 'Rock Kai': 'Social Media', 'Tina Gennette': 'Operations', 'Wendy Cacka': 'Web', 'Samuel Manzi': 'Web', 'Justus Tsofa': 'Africa', 'Hosea Moturi': 'Africa', 'Joy Inyele': 'Africa', 'Clarise Nixon': 'Social Media', 'Cheyenne Wilson': 'Writers', 'Stephanie Aguirre': 'Social Media', 'Olivia Hale': 'SEO', 'Amy Prindle': 'Writers' }
const who = (name: string) => ({ id: name, name, teamId: TEAM[name], teamName: TEAM[name], color: TEAMC[TEAM[name]] })
const team = (name: string) => ({ id: name, name, color: TEAMC[name] })

const TODAY = '2026-11-03'

const EV: AgendaItem[] = [
  { id: 'o1', k: 'pto', who: who('Tina Gennette'), type: 'Vacation', a: '2026-11-09', b: '2026-11-10', onGoogle: true },
  { id: 'o2', k: 'pto', who: who('Dave Sharpe'), type: 'Vacation', a: '2026-11-06', b: '2026-11-06', onGoogle: true },
  { id: 'o3', k: 'pto', who: who('Wendy Cacka'), type: 'Vacation', a: '2026-11-25', b: '2026-11-27', onGoogle: true },
  { id: 'o4', k: 'pto', who: who('Dave Sharpe'), type: 'Vacation', a: '2026-12-21', b: '2026-12-23', onGoogle: true },
  { id: 'o5', k: 'pto', who: who('Tina Gennette'), type: 'Vacation', a: '2026-12-28', b: '2026-12-31', onGoogle: true },
  { id: 'o6', k: 'pto', who: who('Dave Sharpe'), type: 'Sick', a: '2026-10-29', b: '2026-10-29', onGoogle: true },
  { id: 'o7', k: 'pto', who: who('Wendy Cacka'), type: 'Vacation', a: '2026-10-16', b: '2026-10-16', onGoogle: true },
  { id: 'b1', k: 'bday', who: who('Joy Inyele'), a: '2026-11-03', b: '2026-11-03' },
  { id: 'b2', k: 'bday', who: who('Amy Prindle'), a: '2026-11-12', b: '2026-11-12' },
  { id: 'b3', k: 'bday', who: who('Hosea Moturi'), a: '2026-11-19', b: '2026-11-19' },
  { id: 'b4', k: 'bday', who: who('Olivia Hale'), a: '2026-11-30', b: '2026-11-30' },
  { id: 'a1', k: 'anni', who: who('Justus Tsofa'), yrs: 4, a: '2026-11-09', b: '2026-11-09' },
  { id: 'a2', k: 'anni', who: who('Joy Inyele'), yrs: 3, a: '2026-11-16', b: '2026-11-16' },
  { id: 'a3', k: 'anni', who: who('Cheyenne Wilson'), yrs: 2, a: '2026-11-20', b: '2026-11-20' },
  { id: 'e1', k: 'event', title: 'All-hands', a: '2026-11-05', b: '2026-11-05', s: 11, e: 12, place: 'Google Meet · meet.google.com/tnd-allh-ands', link: 'https://meet.google.com/tnd-allh-ands', teams: 'Everyone', by: 'Arnaldo Oliveira', desc: 'October numbers, the North Time part 2 launch, and Q4 priorities. Bring one win from your team.', onGoogle: true, audience: [] },
  { id: 'e2', k: 'event', title: 'Q4 planning', a: '2026-11-17', b: '2026-11-17', s: 10, e: 12, place: 'Google Meet', teams: 'Leadership', by: 'Arnaldo Oliveira', desc: 'Budgets and hiring for Q1.', onGoogle: true, audience: ['Leadership'] },
  { id: 'e3', k: 'event', title: 'Thanksgiving gratitude call', a: '2026-11-24', b: '2026-11-24', s: 13, e: 13.75, place: 'Google Meet', teams: 'Everyone', by: 'Dave Sharpe', desc: 'Fifteen minutes to thank each other before the holiday.', onGoogle: true, audience: [] },
  { id: 't1', k: 'event', team: team('Writers'), title: 'Writers sync', a: '2026-11-10', b: '2026-11-10', s: 14, e: 15, place: 'Google Meet', teams: 'Writers', by: 'Amy Prindle', desc: 'Editorial calendar for December.', audience: ['Writers'] },
  { id: 't2', k: 'event', team: team('Web'), title: 'Web sprint review', a: '2026-11-13', b: '2026-11-13', s: 15, e: 16, place: 'Google Meet', teams: 'Web', by: 'Wendy Cacka', desc: 'Demo of the portal changes. Shared with Leadership.', audience: ['Web'] },
  { id: 't3', k: 'event', team: team('Social Media'), title: 'Content calendar review', a: '2026-11-18', b: '2026-11-18', s: 9, e: 10, place: 'Google Meet', teams: 'Social Media', by: 'Rock Kai', desc: 'December posts for i7 and GNA.', audience: ['Social Media'] },
  { id: 'm1', k: 'ms', title: 'i7 site launch', a: '2026-11-13', b: '2026-11-13', client: '2 - i7 Marketing', by: 'Arnaldo Oliveira', desc: 'The new i7 site goes live. Web and SEO on call that day.', audience: [] },
  { id: 'm2', k: 'ms', title: 'GNA campaign goes live', a: '2026-11-30', b: '2026-11-30', client: 'GNA', by: 'Dave Sharpe', desc: 'Christmas campaign for GNA and GYC.', audience: [] },
  { id: 'g1', k: 'gn', title: 'Pathfinder camporee recap', a: '2026-11-07', b: '2026-11-07', desc: 'Photos and stories from the camporee weekend.', link: 'https://calendar.google.com/' },
  { id: 'g2', k: 'gn', title: 'Community food drive, Nairobi', a: '2026-11-14', b: '2026-11-14', desc: 'The Africa team joins the food drive.', link: 'https://calendar.google.com/' },
  { id: 'g3', k: 'gn', title: 'Hope for Africa radio special', a: '2026-11-21', b: '2026-11-21', desc: 'Live broadcast, 4:00 PM EAT.', link: 'https://calendar.google.com/' },
  { id: 'h1', k: 'hol', title: 'Thanksgiving', a: '2026-11-26', b: '2026-11-26', country: 'US' },
  { id: 'h2', k: 'hol', title: 'Day after Thanksgiving', a: '2026-11-27', b: '2026-11-27', country: 'US' },
  { id: 'h3', k: 'hol', title: 'Christmas Eve', a: '2026-12-24', b: '2026-12-24', country: 'US' },
  { id: 'h4', k: 'hol', title: 'Christmas Day', a: '2026-12-25', b: '2026-12-25', country: 'US' },
  // Other countries' public holidays (date-holidays), as a Super Admin sees them: Brazil and Kenya.
  { id: 'h5', k: 'hol', title: "All Souls' Day", a: '2026-11-02', b: '2026-11-02', country: 'BR' },
  { id: 'h6', k: 'hol', title: 'Republic Day', a: '2026-11-15', b: '2026-11-15', country: 'BR' },
  { id: 'h7', k: 'hol', title: 'Black Awareness Day', a: '2026-11-20', b: '2026-11-20', country: 'BR' },
  { id: 'h8', k: 'hol', title: 'Jamhuri Day', a: '2026-12-12', b: '2026-12-12', country: 'KE' },
]

export function agendaFrame(frame: string): AgendaData {
  const teams = Object.keys(TEAMC).map(team)
  return {
    view: frame === '8B' ? 'week' : frame === '8C' ? 'list' : 'month',
    anchor: frame === '8B' ? '2026-11-24' : TODAY,
    today: TODAY, items: EV, teams,
    me: { id: 'Arnaldo Oliveira', superAdmin: true, zone: 'America/New_York' },
    holidays: ['2026-11-26', '2026-11-27', '2026-12-24', '2026-12-25'],
    create: {
      mode: 'company', teams, zone: 'America/New_York', today: TODAY,
      clients: ['1 - True North', '2 - i7 Marketing', 'A.org Job', 'Adventist Messengers/HFA', 'DDI', 'GNA', 'Rwanda-Incidental'],
      calendar: 'True North Team (set in Company settings › Integrations)',
      sample: { title: 'Year-end celebration', kind: 'event', when: 'time', date: '2026-12-11', from: '15:00', to: '16:30', zone: 'America/New_York', place: 'Google Meet · meet.google.com/tnd-year-end', teams: [], desc: 'Thank-yous, a few awards and a first look at 2027.', google: true },
    },
    startCard: ({ '8D1': 'o3', '8D2': 'b1', '8D3': 'e1', '8D4': 'g2' } as Record<string, string>)[frame],
    startNew: frame === '8E',
  }
}

export const thisWeekFrame = (): ThisWeek => thisWeek(EV, TODAY)
