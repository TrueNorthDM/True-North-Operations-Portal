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
import { DATA as data } from './fixture'

const MONTHS = ['2026-09', '2026-08', '2026-07', '2026-06', '2026-05', '2026-04', '2026-03', '2026-02', '2026-01']
const TEAMS = [
  { id: 't-seo', name: 'SEO' },
  { id: 't-writing', name: 'Writing' },
  { id: 't-web', name: 'Web' },
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
              teams={TEAMS}
              basePath="/design-check/project-hours"
            />
            <div className="ml-auto flex items-center gap-2.5">
              <MoneyInDialog
                data={{
                  month: range.to,
                  donations: { AAAF: '2450', 'GP church': '', 'GP School': '', Africa: '', '': '6100' },
                  purchases: { 'GP church': { hours: '', amount: '' }, 'GP School': { hours: '11.25', amount: '1012.50' } },
                }}
                projects={TRACKED_PROJECTS}
              />
              <ManualHoursDialog rows={[]} options={NO_OPTIONS} month={range.to} blurb="" tone="secondary" />
              <ProjectExportMenu range={range} monthly={range.from === range.to} />
            </div>
          </div>

          <ProjectHoursReport data={data} teams={TEAMS.map(t => ({ ...t, members: [] }))} selectedTeam="" />
        </div>
      </div>
    </div>
  )
}
