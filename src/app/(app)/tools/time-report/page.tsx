// Client Report, i7 Marketing.
//
// Renders the Project → Job code → Activity tree from the LOCAL cache of i7
// timesheets (table tsheets_timesheets), which the background sync keeps fresh,
// so it makes no live TSheets calls and renders instantly (data loading lives
// in report-data.ts, shared with the print/PDF page).
//
// One client per page and per tool grant. This used to be one page with a tab
// per client, which meant one permission for all of them: whoever could see i7
// could see every client added later, without anyone deciding that. Grant Pass
// now lives at ./grant-pass with its own key.

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { loadAccess, requireSurface } from '@/lib/access/resolve'
import { createClient } from '@/lib/supabase/server'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { currentYearMonth, monthBounds } from '@/lib/tsheets/report'
import { availableMonths } from '@/lib/tsheets/retention'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { getTsheetsStatus } from '@/lib/tsheets/status'
import { I7Report as I7ReportView } from '@/components/tsheets/I7Report'
import { ClientFullHistory } from '@/components/tsheets/ClientFullHistory'
import { SyncStatus } from '@/components/tsheets/settings/SyncStatus'
import type { I7Report, I7TrendPoint } from '@/lib/tsheets/types'

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
  searchParams: Promise<{ month?: string }>
}

export default async function ClientsReportsPage({ searchParams }: Props) {
  // The area comes from the level, the report itself from the team tool grant.
  const access = await requireSurface('tools')
  if (!access.canTool('i7-budget')) redirect('/tools')
  const { month } = await searchParams

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <Link href="/" className="hover:text-tn-ink transition-colors">Home</Link>
            <span>/</span>
            <Link href="/tools" className="hover:text-tn-ink transition-colors">Tools</Link>
            <span>/</span>
            <span className="text-foreground font-semibold">Client Report · i7</span>
          </div>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Client Report · i7</h1>
          <p className="mt-1.5 text-muted leading-relaxed">
            Hours, cost and budget usage for i7 Marketing.
          </p>
        </div>
        <Link
          href="/settings"
          title="Manage rates & budgets in Settings"
          aria-label="Settings"
          className="shrink-0 w-11 h-11 rounded-full border border-slate-200 bg-white text-muted flex items-center justify-center transition-colors hover:text-tn-ink hover:border-tn-teal"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </Link>
      </div>

      <I7Tab month={month} />
    </div>
  )
}

/**
 * The first names of everyone on the viewer's own teams, which is what the
 * restricted view allows in the per-person columns.
 *
 * First names because that is what the report's columns are: loadNames() keys
 * them by the first word of full_name. Two Amys would both show, which is the
 * same collision the report already lives with and not worth solving twice.
 */
async function myTeammateFirstNames(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const me = await loadCurrentPerson(supabase, user)
  if (!me) return []

  const { data: mine } = await supabase.from('team_members').select('team_id').eq('person_id', me.id)
  const teamIds = (mine ?? []).map(m => m.team_id)
  // No team means no teammates, so no columns. Their own hours still show,
  // because they are on their own team; someone on no team sees none, which
  // matches the rest of the portal's "absent team = nothing" rule.
  if (teamIds.length === 0) return []

  const { data: peers } = await supabase.from('team_members').select('person_id').in('team_id', teamIds)
  const ids = [...new Set((peers ?? []).map(p => p.person_id))]
  if (ids.length === 0) return []

  const { data: rows } = await supabase.from('people').select('full_name').in('id', ids)
  return [...new Set((rows ?? []).map(r => (r.full_name || '').split(' ')[0]).filter(Boolean))]
}

// The report body, still its own function: the month resolution and the sync
// status only make sense for the cached i7 data.
async function I7Tab({ month }: { month?: string }) {
  const months = availableMonths(new Date())      // Jan 2026 … current (rolling 24-mo window)
  const requested = month ?? currentYearMonth()
  const selectedMonth = months.includes(requested) ? requested : months[0]

  // Only "is TSheets connected" and "when did it last sync" are needed here,
  // never the token itself, so this goes through the narrow reader instead of
  // the user's client. See lib/tsheets/status.ts.
  const { configured, syncedAt } = await getTsheetsStatus()

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 flex-wrap">
        <p className="text-sm text-muted leading-relaxed m-0 mr-1">
          Hours, cost and budget usage for the <span className="font-semibold text-tn-ink">i7 Marketing</span> client, pulled directly from QuickBooks Time.
        </p>
        <Link
          href="/tools/time-report/guide"
          title="How the report works"
          aria-label="How the report works"
          className="shrink-0 w-9 h-9 rounded-full bg-tn-primary text-white flex items-center justify-center shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-0.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        </Link>
        <SyncStatus syncedAt={syncedAt} />
      </div>

      {!configured ? (
        <>
          <I7ReportView
            data={MOCK_I7}
            selectedMonth={selectedMonth}
            availableMonths={months}
            projectHours={{ 'Wagner Meters (WM)': 221, 'Bessemeter': 188, 'Moisture Meters (MME)': 5, 'i7 Marketing': 40 }}
            carryover={{ opening: -2500, monthBudget: 50000, monthUsed: 4200, totalAvailable: 47500, totalLeft: 43300, openingFrom: '2026-01', openingComplete: true }}
            stdRate={95}
            trend={MOCK_TREND}
            preview
          />
          <ClientFullHistory trend={MOCK_TREND} currentMonth="2026-06" />
        </>
      ) : (
        <ReportView selectedMonth={selectedMonth} availableMonths={months} />
      )}
    </div>
  )
}

async function ReportView({ selectedMonth, availableMonths }: { selectedMonth: string; availableMonths: string[] }) {
  let data: Awaited<ReturnType<typeof loadI7ReportData>> | null = null
  let fetchError: string | null = null
  try {
    data = await loadI7ReportData(selectedMonth)
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Unknown error reading the report.'
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-2">
        <p className="font-semibold text-red-700">Couldn&apos;t load the report</p>
        <p className="text-sm text-red-600 font-mono">{fetchError}</p>
        <p className="text-sm text-red-500">
          The report reads from the synced cache. If this persists, run a sync from <Link href="/settings" className="underline">Settings</Link>.
        </p>
      </div>
    )
  }

  const access = await loadAccess()

  // Without 'report-full' the report still opens: budget and money columns are
  // hidden and the per-person columns narrow to the viewer's own teammates.
  // Only resolved when it is actually needed, so the full view costs nothing.
  const restricted = !access.can('report-full')
  const visiblePeople = restricted ? await myTeammateFirstNames() : undefined

  // A month with no logged hours still shows the full report (month picker,
  // budget/carryover, charts), just with an empty hours table, instead of a
  // dead-end message. This keeps the report reachable and the month filter
  // usable even before the current month has any hours, matching the dashboard
  // widget, which already shows the budget for such months.
  const report = data?.report ?? emptyReport(selectedMonth, (data?.stdRate ?? 0) > 0)

  return (
    <>
      <I7ReportView
        data={report}
        unratedPeople={data?.unratedPeople ?? []}
        selectedMonth={selectedMonth}
        availableMonths={availableMonths}
        projectHours={data?.projectHours ?? {}}
        carryover={data?.carryover ?? null}
        stdRate={data?.stdRate ?? 0}
        trend={data?.trend ?? []}
        canExport={access.can('report-export')}
        restricted={restricted}
        visiblePeople={visiblePeople}
      />
      <ClientFullHistory trend={data?.trend ?? []} currentMonth={currentYearMonth()} />
    </>
  )
}

// A zero-hours report for a month with nothing cached yet, so the page still
// renders its shell (picker, budget) with an empty hours table.
function emptyReport(ym: string, hasRates: boolean): I7Report {
  const { startDate, endDate } = monthBounds(ym)
  const [y, m] = ym.split('-').map(Number)
  const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  return { month, startDate, endDate, projects: [], people: [], totalHours: 0, totalCost: 0, hasRates }
}
