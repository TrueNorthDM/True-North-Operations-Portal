// i7 Budget Usage Report — renders the Project → Job code → Activity tree from
// the LOCAL cache of i7 timesheets (table tsheets_timesheets), which the
// background sync keeps fresh. The page makes no live TSheets calls, so it
// renders instantly. All the data loading lives in report-data.ts (shared with
// the print/PDF page).

import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { currentYearMonth } from '@/lib/tsheets/report'
import { availableMonths } from '@/lib/tsheets/retention'
import { loadI7ReportData } from '@/lib/tsheets/report-data'
import { I7Report as I7ReportView } from '@/components/tsheets/I7Report'
import { SyncStatus } from '@/components/tsheets/settings/SyncStatus'
import type { I7Report } from '@/lib/tsheets/types'

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

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function TimeReportPage({ searchParams }: Props) {
  const { month } = await searchParams
  const months = availableMonths(new Date())      // Jan 2026 … current (rolling 24-mo window)
  const requested = month ?? currentYearMonth()
  const selectedMonth = months.includes(requested) ? requested : months[0]

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()

  const token = settings?.tsheets_api_token ?? null
  const syncedAt = settings?.tsheets_synced_at ?? null

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted mb-1">
            <Link href="/" className="hover:text-tn-ink transition-colors">Home</Link>
            <span>/</span>
            <Link href="/tools" className="hover:text-tn-ink transition-colors">Tools</Link>
            <span>/</span>
            <span className="text-foreground font-semibold">i7 Budget Usage Report</span>
          </div>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">i7 Budget Usage Report</h1>
          <p className="mt-1.5 text-muted leading-relaxed">
            Hours, cost and budget usage for the <span className="font-semibold text-tn-ink">i7 Marketing</span> client — pulled directly from QuickBooks Time.
          </p>
          <div className="mt-3">
            <SyncStatus syncedAt={syncedAt} />
          </div>
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

      {!token ? (
        <I7ReportView
          data={MOCK_I7}
          selectedMonth={selectedMonth}
          availableMonths={months}
          projectHours={{ 'Wagner Meters (WM)': 221, 'Bessemeter': 188, 'Moisture Meters (MME)': 5, 'i7 Marketing': 40 }}
          carryover={{ opening: -2500, monthBudget: 50000, monthUsed: 4200, totalAvailable: 47500, totalLeft: 43300 }}
          stdRate={95}
          trend={[
            { month: '2026-01', hours: 300, cost: 34000, budget: 50000, balance: 16000 },
            { month: '2026-02', hours: 280, cost: 31000, budget: 45000, balance: 30000 },
            { month: '2026-03', hours: 320, cost: 38000, budget: 45000, balance: 37000 },
            { month: '2026-04', hours: 360, cost: 42000, budget: 45000, balance: 40000 },
            { month: '2026-05', hours: 300, cost: 36000, budget: 45000, balance: 49000 },
            { month: '2026-06', hours: 340, cost: 41000, budget: 45000, balance: 53000 },
          ]}
          preview
        />
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

  if (!data?.report) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="font-semibold text-slate-700">No i7 hours for {selectedMonth} yet</p>
        <p className="text-sm text-slate-500">
          Nothing is cached for this month. New data is pulled from QuickBooks Time automatically in the background — or run a sync now from <Link href="/settings" className="underline">Settings</Link>.
        </p>
      </div>
    )
  }

  const canEditNote = await isCurrentUserAdmin()

  return (
    <I7ReportView
      data={data.report}
      selectedMonth={selectedMonth}
      availableMonths={availableMonths}
      projectHours={data.projectHours}
      carryover={data.carryover}
      stdRate={data.stdRate}
      trend={data.trend}
      note={data.note}
      canEditNote={canEditNote}
    />
  )
}
