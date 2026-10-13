// Client Report, i7 Marketing.
//
// Renders the Project → Job code → Activity tree from tc_entries, the portal's
// own hours, which the Clocky import keeps fresh from QuickBooks Time and which
// hand-added hours also write to. No live TSheets calls, so it renders
// instantly. Data loading lives in report-data.ts, shared with the print/PDF
// page, and it reads privileged: access is decided on the Access levels page,
// not by row-level security on a time clock table.
//
// One client per page and per tool grant. This used to be one page with a tab
// per client, which meant one permission for all of them: whoever could see i7
// could see every client added later, without anyone deciding that. Grant Pass
// now lives at ./grant-pass with its own key.

import Link from 'next/link'
import { previewHref } from '@/lib/auth/view-as-server'
import { redirect } from 'next/navigation'
import { loadAccess, requireSurface } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadAllManualHours } from '@/lib/timeclock/manual-data'
import { loadTeamRoster } from '@/lib/directory/team-roster'
import { currentYearMonth, monthBounds } from '@/lib/tsheets/report'
import { resolveRange, spanWording, type Range } from '@/lib/tsheets/range'
import { availableMonths } from '@/lib/tsheets/retention'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { getTsheetsStatus } from '@/lib/tsheets/status'
import { getHoursImportStatus } from '@/lib/timeclock/import-status'
import { I7Report as I7ReportView } from '@/components/tsheets/I7Report'
import { ClientFullHistory } from '@/components/tsheets/ClientFullHistory'
import { ReportMeta } from '@/components/tsheets/ReportMeta'
import type { I7Report, I7TrendPoint } from '@/lib/tsheets/types'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ClientReportTabs } from '@/components/ClientReportTabs'
import { ROUTES } from '@/lib/nav/routes'

// Sample tree shown when no API token is configured, so the structure is visible.
const MOCK_I7: I7Report = {
  month: 'June 2026', startDate: '2026-06-01', endDate: '2026-06-30',
  totalHours: 46.5, totalCost: 4200, hasRates: true,
  people: ['Amy', 'Cheyenne', 'Jeannette', 'Kevin', 'Lana', 'Wendy'],
  projects: [
    { project: 'Bessemeter', hours: 10, cost: 950, byPerson: { Jeannette: 7, Kevin: 3 }, jobcodes: [
      { code: 'BE-MKTG', hours: 10, cost: 950, byPerson: { Jeannette: 7, Kevin: 3 }, activities: [
        { activity: 'SEO: Routine', hours: 7, cost: 665, byPerson: { Jeannette: 7 } },
        { activity: 'Social Media', hours: 3, cost: 285, byPerson: { Kevin: 3 } },
      ] },
    ] },
    { project: 'Moisture Meters (MME)', hours: 4.5, cost: 210, byPerson: { Lana: 4.5 }, jobcodes: [
      { code: 'MME-MKTG', hours: 4.5, cost: 210, byPerson: { Lana: 4.5 }, activities: [
        { activity: 'Content: Writing', hours: 4.5, cost: 210, byPerson: { Lana: 4.5 } },
      ] },
    ] },
    { project: 'Wagner Meters (WM)', hours: 32, cost: 3040, byPerson: { Amy: 7, Wendy: 17, Cheyenne: 8 }, jobcodes: [
      { code: 'WM-MKTG', hours: 20, cost: 1900, byPerson: { Amy: 7, Wendy: 5, Cheyenne: 8 }, activities: [
        { activity: 'Content: Writing', hours: 12, cost: 1140, byPerson: { Amy: 7, Wendy: 5 } },
        { activity: 'SEO: Routine', hours: 8, cost: 760, byPerson: { Cheyenne: 8 } },
      ] },
      { code: 'WM-WEBDVT', hours: 12, cost: 1140, byPerson: { Wendy: 12 }, activities: [
        { activity: 'WebDev', hours: 12, cost: 1140, byPerson: { Wendy: 12 } },
      ] },
    ] },
  ],
}

// Sample month-by-month series for the no-token preview (mirrors MOCK_I7).
const MOCK_TREND: I7TrendPoint[] = [
  { month: '2026-01', hours: 300, cost: 34000, budget: 50000, balance: 16000 },
  { month: '2026-02', hours: 280, cost: 31000, budget: 45000, balance: 30000 },
  { month: '2026-03', hours: 320, cost: 38000, budget: 45000, balance: 37000 },
  { month: '2026-04', hours: 360, cost: 42000, budget: 45000, balance: 40000 },
  { month: '2026-05', hours: 300, cost: 36000, budget: 45000, balance: 49000 },
  { month: '2026-06', hours: 340, cost: 41000, budget: 45000, balance: 53000 },
]


interface Props {
  // `month` is the old single-month link, still honoured: it lands as a range of
  // one, which is the same report it always was.
  searchParams: Promise<{ month?: string; from?: string; to?: string; team?: string }>
}

const MANUAL_BLURB =
  'Every hour added by hand this month, whichever client it belongs to. They count in the client reports exactly like an imported hour, which is why they are listed here rather than only totalled.'

export default async function ClientsReportsPage({ searchParams }: Props) {
  // The area comes from the level, the report itself from the team tool grant.
  const access = await requireSurface('tools')
  if (!access.canTool('i7-budget')) redirect(await previewHref('/'))
  const { month, from, to, team } = await searchParams

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Breadcrumb parents={[ROUTES.clientReports]} self={ROUTES.i7} />
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Client Report · i7</h1>
          <p className="mt-1.5 text-muted leading-relaxed">
            Hours, cost and budget usage for i7 Marketing.
          </p>
        </div>
        <Link
          href="/admin/settings"
          title="Manage rates & budgets in Settings"
          aria-label="Settings"
          className="shrink-0 w-11 h-11 rounded-full border border-slate-200 bg-white text-muted flex items-center justify-center transition-colors hover:text-tn-ink hover:border-tn-teal"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </Link>
      </div>

      <ClientReportTabs active="i7-budget" canTool={access.canTool} />

      <I7Tab month={month} from={from} to={to} team={team} />
    </div>
  )
}

// The report body, still its own function: the month resolution and the sync
// status only make sense for the cached i7 data.
async function I7Tab({ month, from, to, team }: { month?: string; from?: string; to?: string; team?: string }) {
  const months = availableMonths(new Date())      // Jan 2026 … current (rolling 24-mo window)
  const newest = months.includes(currentYearMonth()) ? currentYearMonth() : months[0]
  // No parameters is the current month, which is what the report opens on and
  // the only range a PDF can be made from.
  const range = resolveRange(from ?? month, to ?? month, newest)

  // Two different questions, and they used to be answered by one timestamp.
  // Whether TSheets is connected at all comes from app_settings; how fresh the
  // HOURS are comes from the Clocky import, which is the pipeline this report
  // actually reads. The old badge showed the clients-and-people sync, so it
  // described a pipeline the report does not use: if the import died, the page
  // would have kept saying "last synced an hour ago" forever.
  const [{ configured }, hours, access] = await Promise.all([
    getTsheetsStatus(),
    getHoursImportStatus(),
    // Memoised per request, so asking here costs nothing: the guard above and
    // ReportView below already resolved it.
    loadAccess(),
  ])

  // The panel that takes hand-added hours is admin only, so only an admin is
  // told about it. Pointing everybody else at something "below" that is not
  // there is the kind of small lie that makes people stop reading the rest.
  //
  // One string, not a sentence stitched out of JSX. Wrapping a line to fit the
  // margin eats the space beside an expression, and this file has lost that
  // argument five times.
  const sourceLine = access.isAdmin
    ? 'The hours come from QuickBooks Time, imported into the portal, plus any added by hand in the panel below.'
    : 'The hours come from QuickBooks Time, imported into the portal.'

  return (
    <div className="space-y-5">
      <ReportMeta
        sourceLine={sourceLine}
        guideHref={access.can('i7-guide') ? `${ROUTES.i7}/guide` : null}
        syncedAt={hours.syncedAt}
        failed={hours.failed}
      />

      {!configured ? (
        <>
          <I7ReportView
            data={MOCK_I7}
            range={{ from: '2026-06', to: '2026-06' }}
            availableMonths={months}
            projectHours={{ 'Wagner Meters (WM)': 221, 'Bessemeter': 188, 'Moisture Meters (MME)': 5, 'i7 Marketing': 40 }}
            carryover={{ opening: -2500, monthBudget: 50000, monthUsed: 4200, totalAvailable: 47500, totalLeft: 43300, openingFrom: '2026-01', openingComplete: true }}
            stdRate={95}
            preview
          />
          <ClientFullHistory trend={MOCK_TREND} currentMonth="2026-06" />
        </>
      ) : (
        <ReportView range={range} availableMonths={months} team={team} />
      )}
    </div>
  )
}

async function ReportView({ range, availableMonths, team }: { range: Range; availableMonths: string[]; team?: string }) {
  let data: Awaited<ReturnType<typeof loadI7ReportData>> | null = null
  let fetchError: string | null = null
  try {
    data = await loadI7ReportData(range.from, range.to)
  } catch (e) {
    // The detail goes to the server log; the page says what to do.
    console.error('[i7 report]', e instanceof Error ? e.message : e)
    fetchError = 'read'
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-2">
        <p className="font-semibold text-red-700">The report could not be read just now</p>
        <p className="text-sm text-red-600 m-0">
          Nothing is shown rather than a figure that could be wrong. Reload the page in a moment. If it keeps happening, look at the integrations on <Link href="/admin/automations" className="underline">Automations</Link>.
        </p>
      </div>
    )
  }

  const access = await loadAccess()

  // Whoever opens the report sees all of it, budget included (owner's
  // decision, 7 October 2026): the i7 tool's level and team list decide who
  // that is. Until then a level without "See the whole report" got a cut
  // version, and Home showed the same people the budget it hid.
  // In Numbers and In Graphics are items of their own.
  const views = (['numbers', 'graphics'] as const).filter(v => access.can(v === 'numbers' ? 'i7-numbers' : 'i7-graphics'))

  // The teams the filter offers.
  const { teams } = await loadTeamRoster()
  const selectedTeam = teams.some(t => t.id === team) ? team! : ''

  // A month with no logged hours still shows the full report (month picker,
  // budget/carryover, charts), just with an empty hours table, instead of a
  // dead-end message. This keeps the report reachable and the month filter
  // usable even before the current month has any hours, matching the dashboard
  // widget, which already shows the budget for such months.
  const full = data?.report ?? emptyReport(range, (data?.stdRate ?? 0) > 0)

  // Admins only: these hours reach a client invoice. Loaded here so the dialog
  // in the toolbar opens with its lists already in hand.
  // The hand-entry panel is a month's business, so over a range it lists the
  // last month in it: adding an hour means adding it to a month, and the newest
  // one in view is the one somebody is adding to.
  const manual = access.can('i7-manual')
    ? { ...(await loadAllManualHours(createAdminClient(), range.to)), blurb: MANUAL_BLURB }
    : undefined

  const unratedPeople = data?.unratedPeople ?? []

  // A team's members as this report names them, matched by person id: by first
  // name, a team holding one Ana would lose her column the moment the report
  // has to call her "Ana S." (audit, 13 October 2026).
  const labels = data?.personLabels ?? {}
  const teamLabels = (ids: readonly string[]) => ids.flatMap(id => (labels[id] ? [labels[id]] : []))

  return (
    <>
      <I7ReportView
        data={full}
        unratedPeople={unratedPeople}
        range={range}
        availableMonths={availableMonths}
        projectHours={data?.projectHours ?? {}}
        // The carryover panel is In Numbers' alone.
        carryover={views.includes('numbers') ? data?.carryover ?? null : null}
        stdRate={data?.stdRate ?? 0}
        views={views}
        manual={manual}
        canExport={access.can('i7-export')}
        canTeamUpdate={access.can('report-team-update')}
        teams={teams.map(t => ({ id: t.id, name: t.name, members: teamLabels(t.memberIds) }))}
        selectedTeam={selectedTeam}
      />
      <ClientFullHistory
        trend={data?.trend ?? []}
        currentMonth={currentYearMonth()}
        canExport={access.can('i7-export')}
      />
    </>
  )
}

// A zero-hours report for a month with nothing cached yet, so the page still
// renders its shell (picker, budget) with an empty hours table.
function emptyReport(range: Range, hasRates: boolean): I7Report {
  const { startDate } = monthBounds(range.from)
  const { endDate } = monthBounds(range.to)
  return {
    month: spanWording(range.from, range.to),
    startDate, endDate,
    projects: [], people: [], totalHours: 0, totalCost: 0, hasRates,
  }
}
