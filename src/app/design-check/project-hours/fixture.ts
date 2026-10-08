// The fixture both project-hours design checks read, so the screen and the
// printed sheet cannot drift into showing different numbers.

// Design check: Project Hours & Others, both views, without a login.
//
// The real page reads through the privileged client, so it cannot render
// anywhere that lacks the service-role key, and it sits behind the portal's
// auth. This renders the same component from a fixture, which is what
// design-check is for.
//
// Every name and figure here is invented: this file lives in the repository,
// so it never carries real people, hours or rates. The costs are computed from
// the invented rates rather than typed in, so the columns add up and the
// unrated warning fires for somebody who has no rate.

import type { ProjectTracking, ProjectRow } from '@/lib/timeclock/projects'

/** Break-even rate and whether they are on the payroll. Harper has no rate. */
const WHO: Record<string, { rate: number | null; employee: boolean }> = {
  Avery: { rate: 55, employee: true },
  Blake: { rate: 60, employee: true },
  Casey: { rate: 70, employee: true },
  Dana: { rate: 75, employee: true },
  Eden: { rate: 58, employee: true },
  Finley: { rate: 62, employee: true },
  Gray: { rate: 68, employee: true },
  Harper: { rate: null, employee: true },
  Indigo: { rate: 30, employee: false },
  Jules: { rate: 30, employee: false },
  Kai: { rate: 30, employee: false },
  Logan: { rate: 30, employee: false },
  Morgan: { rate: 30, employee: false },
  Noel: { rate: 55, employee: false },
}

const r2 = (n: number) => Math.round(n * 100) / 100

function costs(byPerson: Record<string, number>) {
  let employee = 0, contractor = 0
  const unrated: string[] = []
  for (const [who, hours] of Object.entries(byPerson)) {
    const p = WHO[who]
    if (!p || p.rate == null) { if (hours > 0) unrated.push(who); continue }
    if (p.employee) employee += hours * p.rate
    else contractor += hours * p.rate
  }
  return { employee: r2(employee), contractor: r2(contractor), unrated }
}

const AAAF_PEOPLE = {
  Avery: 10.00, Blake: 6.00, Indigo: 12.50, Casey: 6.25, Dana: 0.75,
  Eden: 4.50, Finley: 10.75, Morgan: 12.50, Noel: 3.75, Gray: 1.00,
}
const HFA_PEOPLE = { Jules: 14.25, Kai: 2.00, Harper: 8.75, Logan: 10.00 }

function build(
  label: string, name: string, prepaid: boolean,
  byPerson: Record<string, number>,
  bal: { carriedIn: number | null; bought: number | null; remaining: number | null },
  yearToDate: number, sameMonthLastYear: number, ytdCost: number,
): ProjectRow {
  const c = costs(byPerson)
  return {
    label, name, prepaid, billed: false,
    carriedIn: bal.carriedIn, boughtThisMonth: bal.bought, remaining: bal.remaining,
    workedThisMonth: r2(Object.values(byPerson).reduce((s, h) => s + h, 0)),
    byPerson, yearToDate, sameMonthLastYear,
    employeeCostThisMonth: c.employee,
    contractorCostThisMonth: c.contractor,
    totalCosts: ytdCost,
    // Only AAAF has restricted gifts in this fixture. The other three stay null
    // so the preview still shows what an un-entered month looks like.
    donationsThisMonth: prepaid ? null : name === 'AskAnAdventistFriend.com' ? 2450 : 1200,
    donationsYtd: prepaid ? null : name === 'AskAnAdventistFriend.com' ? 39429 : 6800,
    netThisMonth: prepaid ? null : r2((name === 'AskAnAdventistFriend.com' ? 2450 : 1200) - (c.employee + c.contractor)),
  }
}

const NONE = { carriedIn: null, bought: null, remaining: null }

const rows: ProjectRow[] = [
  build('AAAF', 'AskAnAdventistFriend.com', false, AAAF_PEOPLE, NONE, 7400, 950, 380_000),
  build('GP church', 'Grants Pass Church', true, {}, { carriedIn: 5.25, bought: null, remaining: 5.25 }, 3.25, 0, 168.42),
  build('GP School', 'Grants Pass School', true, {}, { carriedIn: 10.81, bought: null, remaining: 10.81 }, 3.00, 1.00, 155.47),
  build('Africa', 'Hope for Africa', false, HFA_PEOPLE, NONE, 5200, 600, 170_000),
]

const people = [...new Set(rows.flatMap(r => Object.keys(r.byPerson)))].sort((a, b) => a.localeCompare(b))
const byPerson: Record<string, number> = {}
for (const r of rows) for (const [who, h] of Object.entries(r.byPerson)) byPerson[who] = r2((byPerson[who] ?? 0) + h)

export const DATA: ProjectTracking = {
  from: '2026-09',
  month: '2026-09',
  people,
  rows,
  totals: {
    workedThisMonth: r2(rows.reduce((s, r) => s + r.workedThisMonth, 0)),
    byPerson,
    yearToDate: r2(rows.reduce((s, r) => s + r.yearToDate, 0)),
    sameMonthLastYear: r2(rows.reduce((s, r) => s + r.sameMonthLastYear, 0)),
    employeeCostThisMonth: r2(rows.reduce((s, r) => s + r.employeeCostThisMonth, 0)),
    contractorCostThisMonth: r2(rows.reduce((s, r) => s + r.contractorCostThisMonth, 0)),
    totalCosts: r2(rows.reduce((s, r) => s + r.totalCosts, 0)),
  },
  unratedPeople: [...new Set(rows.flatMap(r => costs(r.byPerson).unrated))].sort(),
}
