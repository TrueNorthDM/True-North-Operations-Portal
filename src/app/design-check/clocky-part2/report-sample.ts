// Reports.dc.html's sample, for frames 12A, 12B, 12C and 12U: October 2026,
// its hours by person and client (minutes), allowances, invoices and time off.

import { buildReport, type ReportPerson, type ReportRow } from '@/lib/timeclock/reports'
import type { ReportPage } from '@/lib/timeclock/reports-data'

const TEAMC: Record<string, string> = { Africa: '#F0A35E', Graphics: '#C026D3', Leadership: '#1E40AF', Operations: '#92400E', SEO: '#F4C24A', 'Social Media': '#DC2626', Translation: '#14B8A6', Web: '#A99BD4', Writers: '#86C06A' }
const P: Record<string, [string, 'con' | 'emp']> = { 'Arnaldo Oliveira': ['Leadership', 'con'], 'Dave Sharpe': ['Leadership', 'emp'], 'Rock Kai': ['Social Media', 'con'], 'Tina Gennette': ['Operations', 'emp'], 'Wendy Cacka': ['Web', 'emp'], 'Samuel Manzi': ['Web', 'con'], 'Justus Tsofa': ['Africa', 'con'], 'Hosea Moturi': ['Africa', 'con'], 'Joy Inyele': ['Africa', 'con'], 'Clarise Nixon': ['Social Media', 'con'], 'Cheyenne Wilson': ['Writers', 'con'], 'Stephanie Aguirre': ['Social Media', 'con'], 'Olivia Hale': ['SEO', 'con'], 'Amy Prindle': ['Writers', 'con'], 'Alyssa Sommerville': ['Graphics', 'con'], 'Saheed Fidimaye': ['Translation', 'con'] }
const CLC: Record<string, string> = { '1 - True North': '#012358', '2 - i7 Marketing': '#1E7D7F', 'Adventist Messengers/HFA': '#F2C40A', GNA: '#1E9E6A', 'A.org Job': '#6D5EF5', DDI: '#F0A35E' }
const OCT: Record<string, [string, number][]> = {
  'Justus Tsofa': [['2 - i7 Marketing', 7200], ['1 - True North', 1830], ['A.org Job', 720]], 'Hosea Moturi': [['2 - i7 Marketing', 6000], ['Adventist Messengers/HFA', 2400], ['1 - True North', 1200]],
  'Joy Inyele': [['Adventist Messengers/HFA', 5400], ['2 - i7 Marketing', 2295], ['1 - True North', 1200]], 'Clarise Nixon': [['2 - i7 Marketing', 4800], ['1 - True North', 2340], ['DDI', 780]],
  'Cheyenne Wilson': [['2 - i7 Marketing', 5760], ['1 - True North', 2475], ['Adventist Messengers/HFA', 840]], 'Stephanie Aguirre': [['2 - i7 Marketing', 4800], ['GNA', 1680], ['1 - True North', 1200]],
  'Olivia Hale': [['2 - i7 Marketing', 4500], ['1 - True North', 1905], ['GNA', 720]], 'Amy Prindle': [['2 - i7 Marketing', 4200], ['GNA', 2790], ['1 - True North', 1200]],
  'Alyssa Sommerville': [['2 - i7 Marketing', 3000], ['DDI', 1680], ['1 - True North', 1200]], 'Saheed Fidimaye': [['Adventist Messengers/HFA', 4800], ['1 - True North', 1800]],
  'Arnaldo Oliveira': [['1 - True North', 7200], ['2 - i7 Marketing', 2400]], 'Dave Sharpe': [['1 - True North', 6600], ['2 - i7 Marketing', 2400]], 'Rock Kai': [['2 - i7 Marketing', 4200], ['1 - True North', 3000], ['GNA', 1200]],
  'Tina Gennette': [['1 - True North', 8400]], 'Wendy Cacka': [['1 - True North', 5400], ['2 - i7 Marketing', 4200]], 'Samuel Manzi': [['1 - True North', 5760], ['2 - i7 Marketing', 3840]],
}
const ALLOW: Record<string, [number, number]> = { 'Cheyenne Wilson': [8400, 480], 'Clarise Nixon': [8400, 0], 'Stephanie Aguirre': [7800, 0], 'Amy Prindle': [8400, 0], 'Olivia Hale': [7200, 0] }
const INVT: Record<string, number> = { 'Samuel Manzi': 3200, 'Rock Kai': 2800, 'Alyssa Sommerville': 1862, 'Clarise Nixon': 2376, 'Olivia Hale': 1800, 'Cheyenne Wilson': 3357.5, 'Justus Tsofa': 2310, 'Joy Inyele': 1779, 'Hosea Moturi': 1920, 'Amy Prindle': 2730, 'Stephanie Aguirre': 2304 }
const TSST: Record<string, [string, boolean]> = { 'Clarise Nixon': ['Waiting for you', false], 'Stephanie Aguirre': ['Approved', true], 'Rock Kai': ['With Dave Sharpe', false] }
// The chart's months: July to October at these shares of October.
const F: [string, number][] = [['2026-07-15', 0.94], ['2026-08-15', 0.97], ['2026-09-15', 0.99], ['2026-10-15', 1]]

export function reportFrame(frame: string): ReportPage {
  const lead = frame === '12B', user = frame === '12U'
  const me = lead ? 'Rock Kai' : user ? 'Justus Tsofa' : 'Arnaldo Oliveira'
  let names = Object.keys(OCT)
  if (lead) names = names.filter(n => P[n][0] === P[me][0])
  if (user) names = [me]
  const rows: ReportRow[] = names.flatMap(n => F.flatMap(([date, f]) => OCT[n].map(([client, min]) => ({ personId: n, client, billable: client !== '1 - True North', seconds: Math.round(min * f) * 60, date }))))
  const people: ReportPerson[] = names.map(n => ({
    id: n, name: n, teamId: P[n][0], teamName: P[n][0], teamColor: TEAMC[P[n][0]], contractor: P[n][1] === 'con',
    allowance: ALLOW[n] ? { hours: ALLOW[n][0] / 60, period: 'month' } : null, extraSeconds: (ALLOW[n]?.[1] ?? 0) * 60,
    invoice: lead ? null : INVT[n] ?? null, timesheet: lead ? TSST[n]?.[0] ?? '-' : null, timesheetApproved: !!TSST[n]?.[1],
  }))
  const scope = lead ? 'team' as const : user ? 'own' as const : 'all' as const
  const pto = names.filter(n => n === 'Wendy Cacka' || n === 'Dave Sharpe').length
  const view = buildReport({ kind: 'month', from: '2026-10-01', to: '2026-10-31', label: 'October 2026', rows, people, scope, money: !lead, ptoDays: pto, clientColor: c => CLC[c] ?? '#a3aebb', clientOrder: Object.keys(CLC), filters: { team: 'all', person: 'all', client: 'all', bill: 'all' } })
  return {
    query: { kind: 'month', from: '2026-10-01', to: '2026-10-31', team: 'all', person: 'all', client: 'all', bill: 'all' }, view, scope, from: '2026-10-01', to: '2026-10-31',
    scopeLine: user ? 'Your own hours only.' : lead ? 'Your team only: Social Media. Hours only: invoices are not shown to Team Leaders.' : 'Everyone. Totals in multiples of 15 minutes.',
    file: 'clocky-report-october-2026',
    scopeText: `October 2026 · ${user ? me : lead ? 'Social Media team' : 'All teams'}`,
    options: {
      teams: [{ value: 'all', label: 'All teams' }, ...[...new Set(Object.values(P).map(p => p[0]))].sort().map(t => ({ value: t, label: t }))],
      people: [{ value: 'all', label: 'Everyone' }, ...names.sort().map(n => ({ value: n, label: n }))],
      clients: [{ value: 'all', label: 'All clients' }, ...Object.keys(CLC).map(c => ({ value: c, label: c }))],
    },
  }
}
