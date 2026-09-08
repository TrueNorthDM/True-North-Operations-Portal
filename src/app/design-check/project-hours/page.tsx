// Design check: Project Hours & Others, both views, without a login.
//
// The real page reads through the privileged client, so it cannot render
// anywhere that lacks the service-role key, and it sits behind the portal's
// auth. This renders the same component from a fixture, which is what
// design-check is for.
//
// The hours are September 2026's real ones. The costs are computed here from
// the break-even rates rather than typed in, so the columns add up and the
// unrated warning fires for somebody who genuinely has no rate.

import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { MoneyInDialog } from '@/components/tsheets/MoneyInDialog'
import { TRACKED_PROJECTS } from '@/lib/timeclock/projects'
import type { ProjectTracking, ProjectRow } from '@/lib/timeclock/projects'

/** Break-even rate and whether they are on the payroll. Joy has no rate. */
const WHO: Record<string, { rate: number | null; employee: boolean }> = {
  Alyssa: { rate: 57.40, employee: true },
  Cheyenne: { rate: 60.39, employee: true },
  Jeannette: { rate: 73.81, employee: true },
  Kevin: { rate: 77.77, employee: true },
  Lana: { rate: 59.12, employee: true },
  Olivia: { rate: 62.60, employee: true },
  Wendy: { rate: 69.14, employee: true },
  Joy: { rate: null, employee: true },
  Barack: { rate: 32.16, employee: false },
  Benjamin: { rate: 31.79, employee: false },
  Hosea: { rate: 30.36, employee: false },
  Justus: { rate: 31.53, employee: false },
  Samuel: { rate: 32.00, employee: false },
  Stephanie: { rate: 56.90, employee: false },
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
  Alyssa: 9.95, Cheyenne: 6.00, Hosea: 12.50, Jeannette: 6.25, Kevin: 0.75,
  Lana: 4.50, Olivia: 10.75, Samuel: 12.50, Stephanie: 3.75, Wendy: 1.00,
}
const HFA_PEOPLE = { Barack: 14.25, Benjamin: 2.00, Joy: 8.75, Justus: 10.00 }

function build(
  label: string, name: string, prepaid: boolean,
  byPerson: Record<string, number>,
  bal: { carriedIn: number | null; bought: number | null; remaining: number | null },
  yearToDate: number, sameMonthLastYear: number, ytdCost: number,
): ProjectRow {
  const c = costs(byPerson)
  return {
    label, name, prepaid,
    carriedIn: bal.carriedIn, boughtThisMonth: bal.bought, remaining: bal.remaining,
    workedThisMonth: r2(Object.values(byPerson).reduce((s, h) => s + h, 0)),
    byPerson, yearToDate, sameMonthLastYear,
    employeeCostThisMonth: c.employee,
    contractorCostThisMonth: c.contractor,
    totalCosts: ytdCost,
    // Only AAAF has restricted gifts in this fixture. The other three stay null
    // so the preview still shows what an un-entered month looks like.
    donationsThisMonth: name === 'AskAnAdventistFriend.com' ? 2450 : null,
    donationsYtd: name === 'AskAnAdventistFriend.com' ? 18730 : null,
  }
}

const NONE = { carriedIn: null, bought: null, remaining: null }

const rows: ProjectRow[] = [
  build('AAAF', 'AskAnAdventistFriend.com', false, AAAF_PEOPLE, NONE, 7702.28, 997.63, 392_441.18),
  build('GP church', 'Grants Pass Church', true, {}, { carriedIn: 5.25, bought: null, remaining: 5.25 }, 3.25, 0, 168.42),
  build('GP School', 'Grants Pass School', true, {}, { carriedIn: 10.81, bought: null, remaining: 10.81 }, 3.00, 1.00, 155.47),
  build('Africa', 'Hope for Africa', false, HFA_PEOPLE, NONE, 5485.30, 650.58, 176_203.90),
]

const people = [...new Set(rows.flatMap(r => Object.keys(r.byPerson)))].sort((a, b) => a.localeCompare(b))
const byPerson: Record<string, number> = {}
for (const r of rows) for (const [who, h] of Object.entries(r.byPerson)) byPerson[who] = r2((byPerson[who] ?? 0) + h)

const data: ProjectTracking = {
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
  unrestricted: { thisMonth: 6100, ytd: 41250 },
}

export default function ProjectHoursDesignCheck() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
            Client Report · Project Hours &amp; Others
          </h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            September 2026, real hours and computed costs. Switch between Costs and People below.
          </p>
        </div>
        {/* The real dialog on fixture figures, so the form can be looked at
            without a login. Saving from here reaches a server action that will
            refuse: this checks the shape, not the write. */}
        <MoneyInDialog
          data={{
            month: '2026-09',
            donations: { AAAF: '2450', 'GP church': '', 'GP School': '', Africa: '', '': '6100' },
            purchases: { 'GP church': { hours: '', amount: '' }, 'GP School': { hours: '11.25', amount: '1012.50' } },
          }}
          projects={TRACKED_PROJECTS}
        />
        <ProjectHoursReport data={data} />
      </div>
    </div>
  )
}
