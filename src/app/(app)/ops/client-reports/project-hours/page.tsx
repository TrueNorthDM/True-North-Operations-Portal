// Client Report, Project Hours & Others.
//
// This page was "Grant Pass" while nobody knew what it was for. Accounting's own
// tracking sheet settled it: Grants Pass is two rows of a four-project sheet,
// beside AskAnAdventistFriend.com and Hope for Africa, and what it tracks is
// hours rather than money. So the page is that sheet.
//
// It keeps the 'grant-pass-report' tool grant. The key is what permissions are
// stored against, and renaming it would silently revoke access for whoever has
// it today.

import { redirect } from 'next/navigation'
import { requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentYearMonth } from '@/lib/tsheets/report'
import { availableMonths } from '@/lib/tsheets/retention'
import { loadProjectTracking, loadProjectHistory } from '@/lib/timeclock/projects'
import { narrowHistory, narrowProjects } from '@/lib/timeclock/project-narrow'
import { ProjectHoursReport } from '@/components/tsheets/ProjectHoursReport'
import { ProjectPeriodFilter } from '@/components/tsheets/ProjectPeriodFilter'
import { ProjectExportMenu } from '@/components/tsheets/ProjectExportMenu'
import { ProjectHoursNotes } from '@/components/tsheets/ProjectHoursNotes'
import { ProjectFullHistory } from '@/components/tsheets/ProjectFullHistory'
import { loadTeamRoster } from '@/lib/directory/team-roster'
import { loadLastUpdated } from '@/lib/timeclock/last-updated'
import { LastUpdatedBadge } from '@/components/tsheets/LastUpdatedBadge'
import { resolveRange } from '@/lib/tsheets/range'
import { ManualHoursDialog } from '@/components/tsheets/ManualHoursDialog'
import { loadAllManualHours } from '@/lib/timeclock/manual-data'
import { loadMoneyIn } from '@/lib/timeclock/money-in-data'
import { MoneyInDialog } from '@/components/tsheets/MoneyInDialog'
import { TRACKED_PROJECTS } from '@/lib/timeclock/projects'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ClientReportTabs } from '@/components/ClientReportTabs'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import Link from 'next/link'
import { ROUTES } from '@/lib/nav/routes'

export const metadata = { title: 'Client Report · Project Hours & Others' }
export const dynamic = 'force-dynamic'

const MANUAL_BLURB =
  'Every hour added by hand this month, whichever client it belongs to. They count in the client reports exactly like an imported hour, which is why they are listed here rather than only totalled.'

export default async function ProjectHoursPage({
  searchParams,
}: { searchParams: Promise<{ month?: string; from?: string; to?: string; team?: string }> }) {
  // The area comes from the level, the report from its own team tool grant.
  const access = await requireSurface('tools')
  if (!access.canTool('grant-pass-report')) redirect('/')

  const months = availableMonths(new Date())
  const { month, from, to, team } = await searchParams
  const newest = months.includes(currentYearMonth()) ? currentYearMonth() : months[0]
  // `month` still works: an old link is a range of one, which is the report it
  // always was. No parameters is the current month, which is what it opens on.
  const range = resolveRange(from ?? month, to ?? month, newest)
  const selected = range.to

  // Privileged, for the reason the i7 report was wrong until 2026-09-01.
  //
  // tc_entries carries the time clock's row-level security: you read your own
  // hours plus the hours of people you approve. A client report read through
  // that rule means a different thing for every viewer, and it fails silently,
  // as a smaller number rather than an error. Who may open this page is the
  // tools surface plus the grant-pass-report team grant, checked right above,
  // and that is the rule an admin can actually see.
  // Cut to the person's access before anything is sent (project-narrow.ts):
  // costs, money in and hours per person are items of their own.
  const rights = { costs: access.can('ph-costs'), money: access.can('ph-money'), people: access.can('ph-people') }
  const data = narrowProjects(await loadProjectTracking(createAdminClient(), range.from, range.to), rights)
  const views = (['costs', 'people'] as const).filter(v => rights[v])

  // The same roster the i7 report filters by, so "Team" means one thing across
  // both reports rather than two.
  const { teams } = await loadTeamRoster()
  const lastUpdated = await loadLastUpdated(createAdminClient(), range.from, range.to)
  // The history is a table of costs and money by month: Costs (ph-costs) only.
  const history = rights.costs
    ? narrowHistory(await loadProjectHistory(createAdminClient(), `${range.to.slice(0, 4)}-01`, range.to), rights)
    : null
  const selectedTeam = teams.some(t => t.id === team) ? team! : ''

  // Donations and prepaid hours, for whoever may edit them (the access item
  // "Money in and donation records").
  const moneyIn = access.can('ph-money')
    ? await loadMoneyIn(createAdminClient(), selected)
    : null

  // Admins only: these hours reach a client report.
  const manual = access.can('ph-manual')
    ? { ...(await loadAllManualHours(createAdminClient(), selected)), blurb: MANUAL_BLURB }
    : undefined

  return (
    <div className="space-y-6">
      <div className="min-w-0">
        <Breadcrumb parents={[ROUTES.clientReports]} self={ROUTES.projectHours} />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">
          Client Report · Project Hours &amp; Others
        </h1>
        <p className="mt-1.5 text-muted leading-relaxed">
          AskAnAdventistFriend.com, Grants Pass Church and School, and Hope for Africa. Hours by
          person and by month, the same shape as the tracking sheet.
        </p>
      </div>

      <ClientReportTabs active="grant-pass-report" canTool={access.canTool} />

      {/* space-y-5 from here down, which is the gap the i7 report puts between
          its own badge row and its toolbar. This had a -mb-2 pulling the two
          together, and at the badge's height that was not tight, it overlapped. */}
      <div className="space-y-5">
        {/* The badge and the "i" sit above the buttons, where the i7 report keeps
            its own. "Last updated" rather than "Last synced": a sync is one of the
            three things that can change this page. */}
        <div className="flex items-center justify-end gap-2.5">
          <LastUpdatedBadge status={lastUpdated} />
          <ProjectHoursNotes lastYear={String(Number(range.to.slice(0, 4)) - 1)} />
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <span className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted">Period</span>
          <ProjectPeriodFilter range={range} availableMonths={months} team={selectedTeam} />
          {/* One group, right of the month, the way the i7 toolbar carries its
              own. justify-between had pushed these to opposite ends of the row. */}
          {/* Wraps as well as the row around it. The outer row wrapped and this
              group did not, so on a phone the four buttons stayed on one line
              and pushed the whole page sideways. */}
          <div className="ml-auto flex items-center gap-2.5 flex-wrap">
            {moneyIn && <MoneyInDialog data={moneyIn} projects={TRACKED_PROJECTS} />}
            {/* Beside the button that enters them, because "where did that
                figure come from" is asked in the same breath as entering one.
                Same tier as the dialog: the page redirects anyone else. */}
            {moneyIn && (
              <Link href={`${ROUTES.projectHours}/donations`} className={`${BTN.white} whitespace-nowrap`}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h10" /></svg>
                Donation records
              </Link>
            )}
            {manual && (
              <ManualHoursDialog
                rows={manual.rows} options={manual.options} month={selected} blurb={manual.blurb}
                tone="secondary"
              />
            )}
            {/* The file exports, on the same grant the i7 ones use: this carries
                the same figures and, for the internal one, the same names. */}
            {access.can('ph-export') && (
              <ProjectExportMenu range={range} monthly={range.from === range.to} />
            )}
          </div>
        </div>
        {/* The Team filter is inside, on the People tab: the only place it does anything. */}
        <ProjectHoursReport data={data} teams={teams} selectedTeam={selectedTeam} views={views} />

        {/* January to the month on screen, which is what her tracking sheet
            covers and what the report's own year columns run to. */}
        {history && <ProjectFullHistory blocks={history} year={range.to.slice(0, 4)} />}
        </div>
    </div>
  )
}
