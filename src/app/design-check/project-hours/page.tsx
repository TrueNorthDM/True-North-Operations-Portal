// Design check: Project Hours & Others, the whole page, without a login.
//
// The toolbar is here on purpose. It only exists on a page behind auth, so
// every change to it went out on a reading of the markup rather than on a
// look at it, and a negative margin that overlapped the buttons shipped that
// way. The real components are used, on fixture data, so the next layout
// change can be seen before it is deployed.
//
// What is real: the components, their spacing, and the period filter, which
// navigates to this page rather than the report's. What is not: saving, and
// the Export links, which reach routes that want a session.

import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { MoneyInDialog } from '@/components/tsheets/MoneyInDialog'
import { ManualHoursDialog } from '@/components/tsheets/ManualHoursDialog'
import { ProjectExportMenu } from '@/components/tsheets/ProjectExportMenu'
import { ProjectPeriodFilter } from '@/components/tsheets/ProjectPeriodFilter'
import { ProjectHoursNotes } from '@/components/tsheets/ProjectHoursNotes'
import { LastUpdatedBadge } from '@/components/tsheets/LastUpdatedBadge'
import { TRACKED_PROJECTS } from '@/lib/timeclock/projects'
import type { ManualOptions } from '@/components/tsheets/ManualHours'
import { resolveRange } from '@/lib/tsheets/range'
import { ProjectFullHistory } from '@/components/tsheets/ProjectFullHistory'
import type { ProjectHistoryBlock } from '@/lib/timeclock/projects'
import { DATA as data } from './fixture'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

// Tina's own January to July figures, so the table can be checked against the
// sheet it is copying. Donations are her "Ed & other Donations" row; the Grants
// Pass lines are deliberately absent, being prepaid income on other rows.
const AAAF: [number, number, number, number][] = [
  // hours, employee, contractor, donations
  [914.13, 35382.46, 8235.38, 12104], [921.40, 33215.07, 10707.10, 425],
  [1042.70, 35908.31, 12470.92, 467], [841.05, 29223.48, 9902.07, 385],
  [905.78, 35739.50, 9167.09, 2936], [1075.63, 43869.02, 10580.08, 22482],
  [907.08, 33411.66, 10127.28, 630],
  // August to December, so the check runs a full year. Seven months fitted the
  // screen and never scrolled, which meant the month table's scrolling was
  // never once looked at here.
  [978.70, 37012.89, 14638.45, 0], [289.17, 9760.75, 4801.17, 0],
  [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0],
]
const HFA: [number, number, number, number | null][] = [
  [548.00, 10818.47, 3952.99, null], [456.00, 9458.99, 3066.53, null],
  [467.27, 9304.00, 3219.56, null], [463.89, 8252.67, 3996.28, null],
  [561.85, 9721.23, 4248.67, null], [580.23, 9077.19, 4648.64, null],
  [472.96, 5910.44, 4068.03, null],
  [512.40, 8140.22, 4390.11, null], [201.25, 1762.58, 4366.49, null],
  [0, 0, 0, null], [0, 0, 0, null], [0, 0, 0, null],
]
const MONTHS_2026 = [
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
  '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12',
]

const block = (
  label: string, name: string, prepaid: boolean,
  rows: [number, number, number, number | null][],
): ProjectHistoryBlock => ({
  label, name, prepaid,
  months: MONTHS_2026.map((month, i) => {
    const [hours, employeeCost, contractorCost, donations] = rows[i] ?? [0, 0, 0, null]
    return {
      month, hours, employeeCost, contractorCost, donations,
      net: prepaid ? null : Math.round(((donations ?? 0) - (employeeCost + contractorCost)) * 100) / 100,
    }
  }),
})

const HISTORY: ProjectHistoryBlock[] = [
  block('AAAF', 'AskAnAdventistFriend.com', false, AAAF),
  block('GP church', 'Grants Pass Church', true, MONTHS_2026.map(() => [0, 0, 0, null] as [number, number, number, number | null])),
  block('GP School', 'Grants Pass School', true, MONTHS_2026.map(() => [0, 0, 0, null] as [number, number, number, number | null])),
  block('Africa', 'Hope for Africa', false, HFA),
]

const MONTHS = ['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']
// With members from the fixture, so choosing a team on the People tab visibly
// takes columns away here, as it does on the real page. Empty member lists made
// every team hide every person, which is not a thing the real roster does.
const TEAMS = [
  { id: 't-seo', name: 'SEO', members: ['Alyssa', 'Cheyenne', 'Kevin'] },
  { id: 't-writing', name: 'Writing', members: ['Jeannette', 'Lana', 'Olivia', 'Wendy'] },
  { id: 't-web', name: 'Web', members: ['Barack', 'Benjamin', 'Hosea', 'Justus'] },
]

// Enough for the closed button. Opening the hand-entry form is checked elsewhere.
const NO_OPTIONS: ManualOptions = {
  people: [], tops: [], jobsByTop: {}, i7Codes: [],
  companies: [], projects: [], activities: [], billable: [],
}

// Module scope, not render: Date.now() in a render body is impure.
const THREE_HOURS_AGO = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()

export default async function ProjectHoursDesignCheck(
  { searchParams }: { searchParams: Promise<{ from?: string; to?: string; team?: string }> },
) {
  const { from, to, team } = await searchParams
  const range = resolveRange(from, to, '2026-09')
  const selectedTeam = TEAMS.some(t => t.id === team) ? team! : ''

  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
            Client Report · Project Hours &amp; Others
          </h1>
          <p className="mt-1.5 text-muted leading-relaxed m-0">
            September 2026, real hours and computed costs. The toolbar is the real one; the figures are a fixture.
          </p>
        </div>

        {/* Laid out exactly as the report page lays it out, including the
            space-y-5 that keeps the badge row off the buttons. */}
        <div className="space-y-5">
          <div className="flex items-center justify-end gap-2.5">
            <LastUpdatedBadge status={{ at: THREE_HOURS_AGO, source: 'money', importFailed: false }} />
            <ProjectHoursNotes lastYear="2025" />
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <span className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Period</span>
            <ProjectPeriodFilter
              range={range}
              availableMonths={MONTHS}
              team={selectedTeam}
              basePath="/design-check/project-hours"
            />
            {/* Wraps as well as the row around it. The outer row wrapped and this
                  group did not, so on a phone the four buttons stayed on one line
                  and pushed the whole page sideways. */}
            <div className="ml-auto flex items-center gap-2.5 flex-wrap">
              <MoneyInDialog
                data={{
                  month: range.to,
                  donations: { AAAF: '2450', Africa: '1200' },
                  purchases: { 'GP church': { hours: '', amount: '' }, 'GP School': { hours: '11.25', amount: '1012.50' } },
                }}
                projects={TRACKED_PROJECTS}
              />
              {/* The real page shows this to the same tier that gets the dialog
                  above. Here it always shows: a check whose toolbar is missing
                  a control is the drift this page exists to catch. */}
              <a href="/design-check/donation-records" className={`${BTN.white} whitespace-nowrap`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                Donation records
              </a>
              <ManualHoursDialog rows={[]} options={NO_OPTIONS} month={range.to} blurb="" tone="secondary" />
              <ProjectExportMenu range={range} monthly={range.from === range.to} />
            </div>
          </div>

          <ProjectHoursReport data={data} teams={TEAMS} selectedTeam={selectedTeam} />
          <ProjectFullHistory blocks={HISTORY} year="2026" />
        </div>
      </div>
    </div>
  )
}
