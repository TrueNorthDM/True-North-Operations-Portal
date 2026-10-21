// The sample data of Timesheet Periods.dc.html (frames 5A to 5C): fifteen
// people, the pay period start Sunday, Oct 4, 2026, "today" Thu, Oct 15, 2026.
// Worked out with the real rules (lib/timeclock/periods.ts), in the shapes the
// actions return. Development only.

import { anchorMove, cadenceChange, companyPayPeriods, periodContaining, periodLabel, rangeText, type Cadence, type CadenceRules } from '@/lib/timeclock/periods'
import { dayLabel, longDateLabel } from '@/lib/timeclock/format'
import type { CadencePerson, Result, TimesheetPeriodsData } from '@/lib/timeclock/clocky-types'
import type { AnchorPreview, CadencePreview } from '@/lib/timeclock/clocky-periods-data'
import type { PersonWithAssignments } from '@/components/tsheets/settings/PeopleTab'
import type { DialogItem } from '@/components/clocky/periods/ui'

export const TODAY = '2026-10-15'
export const ANCHOR = '2026-10-04'

export const TEAMS: Record<string, string> = { Africa: '#F0A35E', Web: '#A99BD4', Leadership: '#1E40AF', Operations: '#92400E', 'Fund Raising': '#CA8A04', Writers: '#86C06A', 'Social Media': '#DC2626', SEO: '#F4C24A', Graphics: '#C026D3' }

// name, team, title, reports to, joined, client, cost, break-even, salary, cadence
export const SEED: [string, string, string, string, string, string, string, string, string, Cadence][] = [
  ['Alyssa Sommerville', 'Graphics', 'Graphic Designer', 'Dave Sharpe', '2024-03-11', '65.00', '28.00', '38.00', '', 'biweekly'],
  ['Arnaldo Oliveira', 'Leadership', 'Operations Director', 'Dave Sharpe', '2021-06-01', '95.00', '48.00', '62.00', '', 'monthly'],
  ['Cheyenne Wilson', 'Writers', 'Senior Writer', 'Dave Sharpe', '2023-01-16', '70.00', '30.00', '41.00', '', 'biweekly'],
  ['Clarise Nixon', 'Social Media', 'Social Media Specialist', 'Rock Kai', '2024-08-05', '60.00', '26.00', '35.00', '', 'biweekly'],
  ['Dave Sharpe', 'Leadership', 'Founder', '', '2015-02-02', '120.00', '', '', '', 'monthly'],
  ['Hosea Moturi', 'Africa', 'Translator', 'Justus Tsofa', '2022-11-07', '45.00', '15.00', '22.00', '2400.00', 'monthly'],
  ['Joy Inyele', 'Africa', 'Social Media Assistant', 'Justus Tsofa', '2025-02-10', '40.00', '12.00', '19.00', '1900.00', 'monthly'],
  ['Justus Tsofa', 'Africa', 'Africa Team Leader', 'Arnaldo Oliveira', '2020-09-14', '55.00', '20.00', '29.00', '3200.00', 'monthly'],
  ['Olivia Hale', '', 'Translator', 'Tina Gennette', '2025-05-19', '50.00', '22.00', '31.00', '', 'monthly'],
  ['Rock Kai', 'Operations', 'Operations Manager', 'Arnaldo Oliveira', '2019-04-22', '80.00', '38.00', '50.00', '', 'monthly'],
  ['Saheed Fidimaye', 'SEO', 'SEO Specialist', 'Rock Kai', '2023-07-03', '68.00', '29.00', '39.00', '', 'biweekly'],
  ['Samuel Manzi', 'Web', 'Web Developer', 'Wendy Cacka', '2024-01-08', '72.00', '31.00', '42.00', '', 'biweekly'],
  ['Stephanie Aguirre', 'Social Media', 'Social Media Specialist', 'Rock Kai', '2025-03-03', '60.00', '26.00', '35.00', '', 'biweekly'],
  ['Tina Gennette', 'Fund Raising', 'Fund Raising Lead', 'Dave Sharpe', '2018-10-01', '75.00', '34.00', '45.00', '', 'monthly'],
  ['Wendy Cacka', 'Web', 'Web Team Leader', 'Arnaldo Oliveira', '2021-03-15', '85.00', '40.00', '52.00', '', 'biweekly'],
]

/** A stable id per sample person. */
export const idOf = (name: string) => `p-${name.toLowerCase().replace(/\s+/g, '-')}`
const nameOf = (id: string) => SEED.find(r => idOf(r[0]) === id)?.[0] ?? id

const anchors = (anchor: string) => [{ anchor, effectiveFrom: null }]
const rulesFor = (cadence: Cadence, anchor = ANCHOR): CadenceRules => ({ changes: [], fallback: cadence, anchors: anchors(anchor) })

export function currentPeriod(cadence: Cadence): string {
  return periodLabel(periodContaining(TODAY, rulesFor(cadence))).full
}

export function people(cadences: Record<string, Cadence> = {}): CadencePerson[] {
  return SEED.map(r => {
    const cadence = cadences[r[0]] ?? r[9]
    return { personId: idOf(r[0]), name: r[0], cadence, scheduled: null, notSet: false, currentPeriod: currentPeriod(cadence) }
  })
}

export function periodsData(access: 'edit' | 'read' = 'edit'): TimesheetPeriodsData {
  const list = people()
  return {
    access,
    anchor: ANCHOR,
    anchorLabel: longDateLabel(ANCHOR),
    defaultCadence: 'monthly',
    counts: { monthly: list.filter(p => p.cadence === 'monthly').length, biweekly: list.filter(p => p.cadence === 'biweekly').length, notSet: 0 },
    periods: companyPayPeriods(TODAY, anchors(ANCHOR)).map(p => ({ start: p.start, end: p.end, state: p.state, label: `${dayLabel(p.start)} to ${dayLabel(p.end)}, ${p.end.slice(0, 4)}` })),
    people: list,
  }
}

/** The prototype's dropdown: Sep 13 to Oct 31, 2026. */
export const ANCHOR_OPTIONS = (() => {
  const out: string[] = []
  for (let d = new Date('2026-09-13T00:00:00Z'); d <= new Date('2026-10-31T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10))
  return out
})()

// ── The actions, answered from the sample ───────────────────────────────────

export async function previewAnchorMove({ anchor }: { anchor: string }): Promise<Result<{ data: AnchorPreview }>> {
  const plan = anchorMove(TODAY, anchors(ANCHOR), anchor, null)
  const oldR = plan.oldCurrent ? rangeText(plan.oldCurrent.start, plan.oldCurrent.end) : ''
  const newR = rangeText(plan.newCurrent.start, plan.newCurrent.end)
  const biweekly = people().filter(p => p.cadence === 'biweekly').length
  return {
    ok: true,
    data: {
      ...plan,
      movedText: plan.moves && plan.oldCurrent ? `The current period moves from ${oldR} to ${newR}. Periods already submitted keep their dates; the new dates start with the first period nobody has submitted yet.` : '',
      dialog: {
        title: 'Move the pay periods?',
        intro: `Pay periods will start ${longDateLabel(anchor)} and every 2 weeks from it. This changes the dates for the ${biweekly} people who submit every 2 weeks.`,
        items: [{ name: 'Current period', change: plan.oldCurrent ? `${oldR} → ${newR}` : newR, eff: 'Periods already submitted keep their dates. The new dates start with the first period nobody has submitted yet; the days in between close as one period.' }],
        button: 'Move the pay periods',
      },
    },
  }
}

export const setPayPeriodAnchor = async (): Promise<Result<{ effectiveFrom: string | null }>> => ({ ok: true, effectiveFrom: TODAY })

const LABEL: Record<Cadence, string> = { monthly: 'Monthly', biweekly: 'Every 2 weeks' }

export async function previewCadenceChange({ personIds, cadence }: { personIds: string[]; cadence: Cadence }): Promise<Result<{ data: CadencePreview[] }>> {
  return {
    ok: true,
    data: personIds.map(id => {
      const from = SEED.find(r => idOf(r[0]) === id)?.[9] ?? 'monthly'
      return { personId: id, name: nameOf(id), from, to: cadence, change: `${LABEL[from]} → ${LABEL[cadence]}`, plan: cadenceChange(TODAY, cadence, rulesFor(from)) }
    }),
  }
}

export async function setCadence({ personIds }: { personIds: string[]; cadence: Cadence }): Promise<Result<{ changed: { personId: string; effectiveFrom: string | null; text: string }[] }>> {
  return { ok: true, changed: personIds.map(personId => ({ personId, effectiveFrom: null, text: '' })) }
}

// ── Rates & Costs (5C) ──────────────────────────────────────────────────────

const num = (v: string) => (v === '' ? null : Number(v))

// The prototype's team colours (Timesheet Periods.dc.html TEAMS), as teams.color holds them.
const TEAM_COLORS: Record<string, string> = { Africa: '#F0A35E', Web: '#A99BD4', Leadership: '#1E40AF', Operations: '#92400E', 'Fund Raising': '#CA8A04', Writers: '#86C06A', 'Social Media': '#DC2626', SEO: '#F4C24A', Graphics: '#C026D3' }

export function ratesPeople(): PersonWithAssignments[] {
  return SEED.map(([name, team, title, mgr, joined, client, cost, be, salary], i) => ({
    id: idOf(name), name, title, teams: team ? [team] : [], teamName: team || null, teamColor: team ? TEAM_COLORS[team] ?? null : null, managerName: mgr || null, managerTeam: null,
    hireDate: joined, costRate: num(cost), beRate: num(be), monthlySalary: num(salary), projects: [],
    tsheetsUserId: i + 1, tsheetsOnly: false,
    assignments: [{ id: i + 1, clientId: 1, clientName: 'i7 Marketing', hourlyRate: Number(client), effectiveFrom: '2026-01-01' }],
  }))
}

/** 5C2 and 5C3: Clarise to monthly, Hosea to every 2 weeks. */
export const CHANGED: Record<string, Cadence> = { [idOf('Clarise Nixon')]: 'monthly', [idOf('Hosea Moturi')]: 'biweekly' }

/** "Change how these people submit?": each change with its dates, in the list's order. */
export function changedItems(): DialogItem[] {
  return SEED.filter(r => CHANGED[idOf(r[0])]).map(r => {
    const to = CHANGED[idOf(r[0])]
    return { name: r[0], change: `${LABEL[r[9]]} → ${LABEL[to]}`, eff: cadenceChange(TODAY, to, rulesFor(r[9])).text }
  })
}
