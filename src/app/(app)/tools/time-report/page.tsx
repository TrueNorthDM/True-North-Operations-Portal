// i7 Budget Usage Report — pulls hours from QuickBooks Time (TSheets) and
// renders the Project → Job code → Activity tree. The client dimension lives in
// the timesheet custom fields (see i7report.ts). Cost = hours × each person's
// i7 rate. The token is read server-side only.

import { createClient } from '@/lib/supabase/server'
import { fetchUsers, fetchJobcodes, fetchTimesheets } from '@/lib/tsheets/client'
import { monthBounds, currentYearMonth } from '@/lib/tsheets/report'
import { buildI7Report, i7JobcodeIds, I7_PARENT_JOBCODE_ID } from '@/lib/tsheets/i7report'
import { I7Report as I7ReportView } from '@/components/tsheets/I7Report'
import { SyncStatus } from '@/components/tsheets/settings/SyncStatus'
import type { I7Report } from '@/lib/tsheets/types'

// Sample tree shown when no API token is configured, so the structure is visible.
const MOCK_I7: I7Report = {
  month: 'June 2026', startDate: '2026-06-01', endDate: '2026-06-30',
  totalHours: 46.5, totalCost: 4200, hasRates: true,
  projects: [
    { project: 'Wagner Meters (WM)', hours: 32, cost: 3040, jobcodes: [
      { code: 'WM-MKTG', hours: 20, cost: 1900, activities: [
        { activity: 'Content: Writing', hours: 12, cost: 1140, people: [{ name: 'Amy', hours: 7, cost: 665 }, { name: 'Wendy', hours: 5, cost: 475 }] },
        { activity: 'SEO: Routine', hours: 8, cost: 760, people: [{ name: 'Cheyenne', hours: 8, cost: 760 }] },
      ] },
      { code: 'WM-WEBDVT', hours: 12, cost: 1140, activities: [
        { activity: 'WebDev', hours: 12, cost: 1140, people: [{ name: 'Wendy', hours: 12, cost: 1140 }] },
      ] },
    ] },
    { project: 'Bessemeter', hours: 10, cost: 950, jobcodes: [
      { code: 'BE-MKTG', hours: 10, cost: 950, activities: [
        { activity: 'SEO: Routine', hours: 7, cost: 665, people: [{ name: 'Jeannette', hours: 7, cost: 665 }] },
        { activity: 'Social Media', hours: 3, cost: 285, people: [{ name: 'Kevin', hours: 3, cost: 285 }] },
      ] },
    ] },
    { project: 'Moisture Meters (MME)', hours: 4.5, cost: 210, jobcodes: [
      { code: 'MME-MKTG', hours: 4.5, cost: 210, activities: [
        { activity: 'Content: Writing', hours: 4.5, cost: 210, people: [{ name: 'Lana', hours: 4.5, cost: 210 }] },
      ] },
    ] },
  ],
}

// Last 24 months as YYYY-MM (newest first)
function recentMonths(): string[] {
  const now = new Date()
  return Array.from({ length: 24 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
}

interface Props {
  searchParams: Promise<{ month?: string }>
}

export default async function TimeReportPage({ searchParams }: Props) {
  const { month } = await searchParams
  const selectedMonth = month ?? currentYearMonth()
  const availableMonths = recentMonths()

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
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/tools" className="hover:text-slate-800">Tools</a>
          <span>/</span>
          <span>i7 Budget Usage Report</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">i7 Budget Usage Report</h1>
        <p className="mt-1 text-slate-500">
          Hours, cost and budget usage for the i7 Marketing client — pulled directly from QuickBooks Time.{' '}
          <a href="/settings" className="text-slate-600 underline underline-offset-2 hover:text-slate-900">
            Manage rates &amp; budgets in Settings →
          </a>
        </p>
        <div className="mt-3">
          <SyncStatus syncedAt={syncedAt} />
        </div>
      </div>

      {!token ? (
        <I7ReportView data={MOCK_I7} selectedMonth={selectedMonth} availableMonths={availableMonths} preview />
      ) : (
        <ReportView token={token} selectedMonth={selectedMonth} availableMonths={availableMonths} />
      )}
    </div>
  )
}

async function ReportView({ token, selectedMonth, availableMonths }: {
  token: string
  selectedMonth: string
  availableMonths: string[]
}) {
  const { startDate, endDate } = monthBounds(selectedMonth)

  let report: I7Report | null = null
  let fetchError: string | null = null

  try {
    const [users, jobcodes, timesheets] = await Promise.all([
      fetchUsers(token),
      fetchJobcodes(token),
      fetchTimesheets(token, startDate, endDate),
    ])
    const i7Ids = i7JobcodeIds(jobcodes)
    const i7Timesheets = timesheets.filter(t => i7Ids.has(t.jobcode_id))
    const namesByUser = Object.fromEntries(users.map(u => [u.id, u.first_name]))
    const rates = await loadI7Rates(startDate, endDate)
    report = buildI7Report(i7Timesheets, rates, namesByUser, startDate)
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Unknown error fetching from TSheets.'
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-2">
        <p className="font-semibold text-red-700">Failed to fetch from QuickBooks Time</p>
        <p className="text-sm text-red-600 font-mono">{fetchError}</p>
        <p className="text-sm text-red-500">
          Check that your API token in <a href="/settings" className="underline">Settings</a> is valid and hasn&apos;t expired.
        </p>
      </div>
    )
  }

  if (!report || report.totalHours === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="font-semibold text-slate-700">No approved i7 time entries found</p>
        <p className="text-sm text-slate-500">
          There are no approved i7 timesheets for {selectedMonth}. Try a different month or check that entries have been approved in TSheets.
        </p>
      </div>
    )
  }

  return <I7ReportView data={report} selectedMonth={selectedMonth} availableMonths={availableMonths} />
}

// Per-person i7 hourly rate in effect during the period (respects rate history).
async function loadI7Rates(startDate: string, endDate: string): Promise<Record<number, number>> {
  const supabase = await createClient()
  const { data: i7 } = await supabase
    .from('tr_clients')
    .select('id')
    .eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID)
    .maybeSingle()
  if (!i7) return {}

  const { data: rows } = await supabase
    .from('tr_assignments')
    .select('tsheets_user_id, hourly_rate, effective_from, effective_to')
    .eq('client_id', i7.id)

  const best = new Map<number, { from: string; rate: number }>()
  for (const a of rows ?? []) {
    if (a.effective_from > endDate) continue
    if (a.effective_to && a.effective_to < startDate) continue
    const cur = best.get(a.tsheets_user_id)
    if (!cur || a.effective_from > cur.from) best.set(a.tsheets_user_id, { from: a.effective_from, rate: Number(a.hourly_rate) })
  }
  const out: Record<number, number> = {}
  for (const [u, v] of best) out[u] = v.rate
  return out
}
