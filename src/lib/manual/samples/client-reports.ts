/**
 * The System manual's Client Reports pictures (owner, 4 November 2026: the
 * guides show the real screens with made-up data). Every person, project,
 * hour, rate, budget and dollar figure here is invented; none is a real
 * client's number. October 2026 is the month on screen.
 */

import type { I7Carryover, I7Project, I7Report, I7TrendPoint } from '@/lib/tsheets/types'
import type { ManualOptions, ManualRow } from '@/components/tsheets/ManualHours'
import type { ProjectHistoryBlock, ProjectRow, ProjectTracking } from '@/lib/timeclock/projects'
import type { MoneyInMonth } from '@/lib/timeclock/money-in-data'

export const SAMPLE_MONTH = '2026-10'
export const SAMPLE_MONTHS = ['2026-10', '2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']

const r2 = (n: number) => Math.round(n * 100) / 100
const sum = (xs: number[]) => r2(xs.reduce((s, n) => s + n, 0))

// ── i7 ───────────────────────────────────────────────────────────────────────

/** Invented client rates, $ an hour. */
const I7_RATE: Record<string, number> = { Alex: 80, Jordan: 85, Sam: 80, Maria: 75, Chris: 90, Priya: 70 }
const I7_STD_RATE = 80

type Hours = Record<string, number>
const costOf = (h: Hours) => sum(Object.entries(h).map(([p, n]) => n * (I7_RATE[p] ?? 0)))
const merge = (hs: Hours[]) => {
  const out: Hours = {}
  for (const h of hs) for (const [p, n] of Object.entries(h)) out[p] = r2((out[p] ?? 0) + n)
  return out
}

function project(name: string, codes: { code: string; activities: { activity: string; byPerson: Hours }[] }[]): I7Project {
  const jobcodes = codes.map(c => {
    const activities = c.activities.map(a => ({ ...a, hours: sum(Object.values(a.byPerson)), cost: costOf(a.byPerson) }))
    const byPerson = merge(activities.map(a => a.byPerson))
    return { code: c.code, activities, byPerson, hours: sum(activities.map(a => a.hours)), cost: sum(activities.map(a => a.cost)) }
  })
  const byPerson = merge(jobcodes.map(j => j.byPerson))
  return { project: name, jobcodes, byPerson, hours: sum(jobcodes.map(j => j.hours)), cost: sum(jobcodes.map(j => j.cost)) }
}

const I7_PROJECTS: I7Project[] = [
  project('Brand Site', [
    { code: 'BRAND-WEBDVT', activities: [
      { activity: 'WebDev', byPerson: { Jordan: 24.75 } },
      { activity: 'Project Management', byPerson: { Chris: 6 } },
    ] },
  ]),
  project('Product Line A', [
    { code: 'PLA-MKTG', activities: [
      { activity: 'Content: Writing', byPerson: { Alex: 22.5, Priya: 10 } },
      { activity: 'SEO: Routine', byPerson: { Sam: 18.25 } },
      { activity: 'Social Media', byPerson: { Maria: 12 } },
    ] },
  ]),
  project('Product Line B', [
    { code: 'PLB-MKTG', activities: [
      { activity: 'Content: Writing', byPerson: { Alex: 8 } },
      { activity: 'SEO: Routine', byPerson: { Sam: 9.5 } },
    ] },
  ]),
]

export const i7Sample: I7Report = {
  month: 'October 2026', startDate: '2026-10-01', endDate: '2026-10-31',
  projects: I7_PROJECTS,
  people: ['Alex', 'Chris', 'Jordan', 'Maria', 'Priya', 'Sam'],
  totalHours: sum(I7_PROJECTS.map(p => p.hours)),
  totalCost: sum(I7_PROJECTS.map(p => p.cost)),
  hasRates: true,
}

/** Each project's budgeted hours for the month. */
export const i7BudgetHours: Record<string, number> = { 'Brand Site': 40, 'Product Line A': 120, 'Product Line B': 60 }
export const i7StdRate = I7_STD_RATE

const MONTH_BUDGET = 18000
const OPENING = 3200
export const i7Carryover: I7Carryover = {
  opening: OPENING,
  monthBudget: MONTH_BUDGET,
  monthUsed: i7Sample.totalCost,
  totalAvailable: OPENING + MONTH_BUDGET,
  totalLeft: r2(OPENING + MONTH_BUDGET - i7Sample.totalCost),
  openingFrom: '2026-01',
  openingComplete: true,
}

/** January to October: invented costs against an invented monthly budget. */
export const i7Trend: I7TrendPoint[] = (() => {
  const costs = [16400, 17250, 15900, 18800, 17100, 16650, 18200, 17400, 18350, i7Sample.totalCost]
  const hours = [198, 210, 192, 231, 207, 201, 222, 212, 224, i7Sample.totalHours]
  let balance = 0
  return costs.map((cost, i) => {
    balance = r2(balance + MONTH_BUDGET - cost)
    return { month: `2026-${String(i + 1).padStart(2, '0')}`, hours: hours[i], cost, budget: MONTH_BUDGET, balance }
  })
})()

/** The Team filter beside the period, with members as the report labels them. */
export const sampleTeams = [
  { id: 'web', name: 'Web', members: ['Jordan'] },
  { id: 'seo', name: 'SEO', members: ['Sam'] },
  { id: 'writers', name: 'Writers', members: ['Alex', 'Priya'] },
]

export const MANUAL_BLURB =
  'Every hour added by hand this month, whichever client it belongs to. They count in the client reports exactly like an imported hour, which is why they are listed here rather than only totalled.'

export const manualOptions: ManualOptions = {
  people: [
    { id: 'p1', name: 'Ben Carter', hasRate: true },
    { id: 'p2', name: 'Maria Gomez', hasRate: true },
  ],
  tops: [
    { id: 'top-i7', name: 'i7', branch: 'i7' },
    { id: 'top-tn', name: 'True North', branch: 'project' },
  ],
  jobsByTop: { 'top-i7': [{ id: 1, name: 'Content' }, { id: 2, name: 'SEO' }], 'top-tn': [{ id: 3, name: 'Web Dev' }] },
  i7Codes: [
    { code: 'PLA-MKTG', project: 'Product Line A' },
    { code: 'PLB-MKTG', project: 'Product Line B' },
    { code: 'BRAND-WEBDVT', project: 'Brand Site' },
  ],
  companies: ['Sample Client'],
  projects: ['AAAF', 'Africa'],
  activities: ['Content: Writing', 'SEO: Routine', 'WebDev'],
  billable: ['Yes', 'No'],
}

export const manualRows: ManualRow[] = [
  { id: 1, personName: 'Ben Carter', entryDate: '2026-10-08', hours: 3.5, jobcodeName: 'Content', tag: 'PLA-MKTG', activity: 'Content: Writing', notes: 'Invoice 1042', addedBy: 'Chris Taylor' },
  { id: 2, personName: 'Ben Carter', entryDate: '2026-10-22', hours: 2, jobcodeName: 'SEO', tag: 'PLB-MKTG', activity: 'SEO: Routine', notes: 'Invoice 1057', addedBy: 'Chris Taylor' },
]

/** The month's note, as Company settings shows it. */
export const sampleNote =
  'October focused on the Product Line A launch: twelve new articles, a refreshed category page and the first month of the new social calendar.'

// ── Project Hours & Others ──────────────────────────────────────────────────

/** Invented break-even rates; Priya and Ben are contractors. */
const BREAK_EVEN: Record<string, { rate: number; employee: boolean }> = {
  Alex: { rate: 45, employee: true }, Jordan: { rate: 50, employee: true }, Sam: { rate: 42, employee: true },
  Maria: { rate: 40, employee: true }, Chris: { rate: 55, employee: true },
  Priya: { rate: 28, employee: false }, Ben: { rate: 30, employee: false },
}
const CLIENT_RATE = 80

function costsOf(byPerson: Hours) {
  let employee = 0, contractor = 0
  for (const [p, h] of Object.entries(byPerson)) {
    const b = BREAK_EVEN[p]
    if (!b) continue
    if (b.employee) employee += h * b.rate; else contractor += h * b.rate
  }
  return { employee: r2(employee), contractor: r2(contractor) }
}

function row(
  label: string, name: string, byPerson: Hours,
  o: { prepaid?: { carriedIn: number; bought: number }; billed?: boolean; donations?: number | null; donationsYtd?: number | null; ytd: number; lastYear: number; costsYtd: number },
): ProjectRow {
  const worked = sum(Object.values(byPerson))
  const c = costsOf(byPerson)
  const billedAmount = o.billed ? r2(worked * CLIENT_RATE) : null
  const donations = o.prepaid ? null : o.billed ? billedAmount : o.donations ?? null
  return {
    label, name, prepaid: !!o.prepaid, billed: !!o.billed,
    carriedIn: o.prepaid?.carriedIn ?? null,
    boughtThisMonth: o.prepaid?.bought ?? null,
    remaining: o.prepaid ? r2(o.prepaid.carriedIn + o.prepaid.bought - worked) : null,
    workedThisMonth: worked, byPerson,
    yearToDate: o.ytd, sameMonthLastYear: o.lastYear,
    employeeCostThisMonth: c.employee, contractorCostThisMonth: c.contractor,
    totalCosts: o.costsYtd,
    donationsThisMonth: donations,
    donationsYtd: o.prepaid ? null : o.donationsYtd ?? donations,
    netThisMonth: o.prepaid || donations == null ? null : r2(donations - c.employee - c.contractor),
  }
}

const PH_ROWS: ProjectRow[] = [
  row('AAAF', 'AskAnAdventistFriend.com', { Alex: 42.5, Sam: 30, Maria: 18.25, Ben: 12 }, { donations: 2400, donationsYtd: 21800, ytd: 1012.5, lastYear: 96.75, costsYtd: 41250 }),
  row('GP church', 'Grants Pass Church', { Jordan: 6.5 }, { prepaid: { carriedIn: 14.5, bought: 10 }, ytd: 61.25, lastYear: 5, costsYtd: 3050 }),
  row('GP School', 'Grants Pass School', { Jordan: 3.25, Priya: 2 }, { prepaid: { carriedIn: 8, bought: 0 }, ytd: 44, lastYear: 6.5, costsYtd: 1980 }),
  row('Africa', 'Hope for Africa', { Priya: 22, Chris: 8.5, Maria: 10 }, { donations: 1150, donationsYtd: 9400, ytd: 402.75, lastYear: 38, costsYtd: 14600 }),
  row('i7', 'i7', { Alex: 30.5, Sam: 27.75 }, { billed: true, ytd: 590.5, lastYear: 61, costsYtd: 26100 }),
  row('MME', 'MME', { Sam: 4 }, { billed: true, ytd: 41.5, lastYear: 3.5, costsYtd: 1750 }),
]

export const projectHoursSample: ProjectTracking = {
  from: SAMPLE_MONTH,
  month: SAMPLE_MONTH,
  people: ['Alex', 'Ben', 'Chris', 'Jordan', 'Maria', 'Priya', 'Sam'],
  rows: PH_ROWS,
  totals: {
    workedThisMonth: sum(PH_ROWS.map(r => r.workedThisMonth)),
    byPerson: merge(PH_ROWS.map(r => r.byPerson)),
    yearToDate: sum(PH_ROWS.map(r => r.yearToDate)),
    sameMonthLastYear: sum(PH_ROWS.map(r => r.sameMonthLastYear)),
    employeeCostThisMonth: sum(PH_ROWS.map(r => r.employeeCostThisMonth)),
    contractorCostThisMonth: sum(PH_ROWS.map(r => r.contractorCostThisMonth)),
    totalCosts: sum(PH_ROWS.map(r => r.totalCosts)),
  },
  unratedPeople: [],
}

/** The People tab's team filter, by the first names the report uses. */
export const projectTeams = [
  { id: 'writers', name: 'Writers', members: ['Alex', 'Priya'] },
  { id: 'seo', name: 'SEO', members: ['Sam'] },
  { id: 'web', name: 'Web', members: ['Jordan'] },
]

/** January to October, month by month, for the four tracked projects. */
export const projectHistorySample: ProjectHistoryBlock[] = (() => {
  const months = [...SAMPLE_MONTHS].reverse()
  const block = (label: string, name: string, prepaid: boolean, base: number, gift: number | null): ProjectHistoryBlock => ({
    label, name, prepaid, billed: false,
    months: months.map((month, i) => {
      const hours = r2(base * (0.9 + ((i * 7) % 5) / 20))
      const employeeCost = r2(hours * 38)
      const contractorCost = r2(hours * 9)
      const donations = prepaid ? null : gift == null ? null : gift + ((i * 3) % 4) * 150
      return { month, hours, employeeCost, contractorCost, donations, net: donations == null ? null : r2(donations - employeeCost - contractorCost) }
    }),
  })
  return [
    block('AAAF', 'AskAnAdventistFriend.com', false, 100, 1800),
    block('GP church', 'Grants Pass Church', true, 6, null),
    block('GP School', 'Grants Pass School', true, 4.5, null),
    block('Africa', 'Hope for Africa', false, 40, 900),
  ]
})()

/** What Money in opens with for the month. */
export const moneyInSample: MoneyInMonth = {
  month: SAMPLE_MONTH,
  donations: { AAAF: '2400', Africa: '1150' },
  purchases: { 'GP church': { hours: '10', amount: '' }, 'GP School': { hours: '', amount: '' } },
}
