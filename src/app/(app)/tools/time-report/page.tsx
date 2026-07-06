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
import type { I7Report, I7Carryover } from '@/lib/tsheets/types'

// The carryover fetches Jan → the selected month, so give the route headroom.
export const maxDuration = 60

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
        <I7ReportView
          data={MOCK_I7}
          selectedMonth={selectedMonth}
          availableMonths={availableMonths}
          projectHours={{ 'Wagner Meters (WM)': 221, 'Bessemeter': 188, 'Moisture Meters (MME)': 5, 'i7 Marketing': 40 }}
          carryover={{ opening: -2500, monthBudget: 50000, monthUsed: 4200, totalAvailable: 47500, totalLeft: 43300 }}
          stdRate={95}
          preview
        />
      ) : (
        <ReportView token={token} selectedMonth={selectedMonth} availableMonths={availableMonths} />
      )}
    </div>
  )
}

interface Assignment { userId: number; rate: number; from: string; to: string | null }

/** The rate for a user during a given month (YYYY-MM), honoring rate history. */
function rateFor(assignments: Assignment[], userId: number, ym: string): number {
  const ms = `${ym}-01`, me = `${ym}-31`
  let best: Assignment | null = null
  for (const a of assignments) {
    if (a.userId !== userId) continue
    if (a.from > me) continue
    if (a.to && a.to < ms) continue
    if (!best || a.from > best.from) best = a
  }
  return best ? best.rate : 0
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * The "standard" i7 hourly rate for a month — the most common rate across the
 * people who have an i7 assignment active that month (ties break to the higher
 * rate). Auto-adapts to rate history: $120 in Jan 2026, $95 from Feb on, with
 * the handful of foreign rates ($60) staying the minority. Used to value the
 * per-project "Budget avail." column = hours available × this rate.
 */
function standardI7Rate(assignments: Assignment[], ym: string): number {
  const userIds = [...new Set(assignments.map(a => a.userId))]
  const counts = new Map<number, number>()
  for (const uid of userIds) {
    const r = rateFor(assignments, uid, ym)
    if (r > 0) counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  let best = 0, bestCount = -1
  for (const [rate, c] of counts) {
    if (c > bestCount || (c === bestCount && rate > best)) { best = rate; bestCount = c }
  }
  return best
}

async function ReportView({ token, selectedMonth, availableMonths }: {
  token: string
  selectedMonth: string
  availableMonths: string[]
}) {
  const { startDate, endDate } = monthBounds(selectedMonth)
  const year = selectedMonth.slice(0, 4)
  const selM = Number(selectedMonth.slice(5, 7))
  const carryStart = `${year}-01-01`   // carryover runs from January of the selected year

  let report: I7Report | null = null
  let projectHours: Record<string, number> = {}
  let carryover: I7Carryover | null = null
  let stdRate = 0
  let fetchError: string | null = null

  try {
    // Need the i7 job code ids before fetching, so we pull ONLY i7 timesheets
    // (a fraction of the whole account) across Jan … selected month — one range
    // fetch that feeds both the tree and the carryover.
    const [users, jobcodes] = await Promise.all([fetchUsers(token), fetchJobcodes(token)])
    const i7Ids = i7JobcodeIds(jobcodes)
    const [i7ts, assignments, monthlyBudgets, projHours] = await Promise.all([
      fetchTimesheets(token, carryStart, endDate, [...i7Ids]),
      loadI7Assignments(),
      loadMonthlyBudgets(),
      loadProjectHours(),
    ])
    projectHours = projHours
    const namesByUser = Object.fromEntries(users.map(u => [u.id, u.first_name]))

    // Selected month's tree (using that month's rates)
    const selTs = i7ts.filter(t => t.date.slice(0, 7) === selectedMonth)
    const ratesSel: Record<number, number> = Object.fromEntries(users.map(u => [u.id, rateFor(assignments, u.id, selectedMonth)]))
    report = buildI7Report(selTs, ratesSel, namesByUser, startDate)
    stdRate = standardI7Rate(assignments, selectedMonth)

    // Carryover: cumulative budget − cost for the months before the selected one
    let cumBudget = 0, cumCost = 0
    for (let m = 1; m < selM; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`
      const cost = i7ts.filter(t => t.date.slice(0, 7) === ym)
        .reduce((s, t) => s + (t.duration / 3600) * rateFor(assignments, t.user_id, ym), 0)
      cumBudget += monthlyBudgets[ym] ?? 0
      cumCost += cost
    }
    const opening = round2(cumBudget - cumCost)
    const monthBudget = monthlyBudgets[selectedMonth] ?? 0
    const monthUsed = report.totalCost
    const totalAvailable = round2(opening + monthBudget)
    carryover = { opening, monthBudget, monthUsed, totalAvailable, totalLeft: round2(totalAvailable - monthUsed) }
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

  return <I7ReportView data={report} selectedMonth={selectedMonth} availableMonths={availableMonths} projectHours={projectHours} carryover={carryover} stdRate={stdRate} />
}

// All i7 rate assignments (for month-by-month rate resolution across the year).
async function loadI7Assignments(): Promise<Assignment[]> {
  const supabase = await createClient()
  const { data: i7 } = await supabase.from('tr_clients').select('id').eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID).maybeSingle()
  if (!i7) return []
  const { data } = await supabase.from('tr_assignments').select('tsheets_user_id, hourly_rate, effective_from, effective_to').eq('client_id', i7.id)
  return (data ?? []).map(a => ({ userId: a.tsheets_user_id, rate: Number(a.hourly_rate), from: a.effective_from, to: a.effective_to }))
}

// ym → this month's total $ budget (base + extra).
async function loadMonthlyBudgets(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data } = await supabase.from('i7_monthly_budget').select('month, budget_amount, extra_amount')
  const out: Record<string, number> = {}
  for (const b of data ?? []) out[String(b.month).slice(0, 7)] = Number(b.budget_amount) + Number(b.extra_amount)
  return out
}

// project → active budgeted hours (the guide).
async function loadProjectHours(): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data: i7 } = await supabase.from('tr_clients').select('id').eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID).maybeSingle()
  if (!i7) return {}
  const { data } = await supabase.from('tr_project_budgets').select('project, hours_allocated').eq('client_id', i7.id).is('effective_to', null)
  const out: Record<string, number> = {}
  for (const p of data ?? []) out[p.project] = Number(p.hours_allocated)
  return out
}
