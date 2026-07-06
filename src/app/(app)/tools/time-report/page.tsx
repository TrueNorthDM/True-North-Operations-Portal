// i7 Budget Usage Report — renders the Project → Job code → Activity tree from
// the LOCAL cache of i7 timesheets (table tsheets_timesheets), which the
// background sync keeps fresh. The page makes no live TSheets calls, so it
// renders instantly. The client dimension lives in the timesheet custom fields
// (see i7report.ts). Cost = hours × each person's i7 rate.

import { createClient } from '@/lib/supabase/server'
import { monthBounds, currentYearMonth } from '@/lib/tsheets/report'
import { buildI7Report, I7_PARENT_JOBCODE_ID } from '@/lib/tsheets/i7report'
import { availableMonths } from '@/lib/tsheets/retention'
import { I7Report as I7ReportView } from '@/components/tsheets/I7Report'
import { SyncStatus } from '@/components/tsheets/settings/SyncStatus'
import type { I7Report, I7Carryover, I7Entry } from '@/lib/tsheets/types'

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
  // Clamp the selection to a month we actually offer (default = current).
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
          availableMonths={months}
          projectHours={{ 'Wagner Meters (WM)': 221, 'Bessemeter': 188, 'Moisture Meters (MME)': 5, 'i7 Marketing': 40 }}
          carryover={{ opening: -2500, monthBudget: 50000, monthUsed: 4200, totalAvailable: 47500, totalLeft: 43300 }}
          stdRate={95}
          preview
        />
      ) : (
        <ReportView selectedMonth={selectedMonth} availableMonths={months} />
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

async function ReportView({ selectedMonth, availableMonths }: {
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
    // Everything reads from the local cache (kept fresh by the background sync) —
    // no live TSheets calls, so this renders in milliseconds. One range read of
    // Jan(year) … selected month feeds both the tree and the carryover.
    const [entries, names, assignments, monthlyBudgets, projHours] = await Promise.all([
      loadCachedEntries(carryStart, endDate),
      loadNames(),
      loadI7Assignments(),
      loadMonthlyBudgets(),
      loadProjectHours(),
    ])
    projectHours = projHours

    // Selected month's tree (using that month's rates)
    const selEntries = entries.filter(e => e.date.slice(0, 7) === selectedMonth)
    const ratesSel: Record<number, number> = {}
    for (const uid of new Set(selEntries.map(e => e.user_id))) ratesSel[uid] = rateFor(assignments, uid, selectedMonth)
    report = buildI7Report(selEntries, ratesSel, names, startDate)
    stdRate = standardI7Rate(assignments, selectedMonth)

    // Carryover: cumulative budget − cost for the months before the selected one
    let cumBudget = 0, cumCost = 0
    for (let m = 1; m < selM; m++) {
      const ym = `${year}-${String(m).padStart(2, '0')}`
      const cost = entries.filter(e => e.date.slice(0, 7) === ym)
        .reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.user_id, ym), 0)
      cumBudget += monthlyBudgets[ym] ?? 0
      cumCost += cost
    }
    const opening = round2(cumBudget - cumCost)
    const monthBudget = monthlyBudgets[selectedMonth] ?? 0
    const monthUsed = report.totalCost
    const totalAvailable = round2(opening + monthBudget)
    carryover = { opening, monthBudget, monthUsed, totalAvailable, totalLeft: round2(totalAvailable - monthUsed) }
  } catch (e) {
    fetchError = e instanceof Error ? e.message : 'Unknown error reading the report.'
  }

  if (fetchError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 space-y-2">
        <p className="font-semibold text-red-700">Couldn&apos;t load the report</p>
        <p className="text-sm text-red-600 font-mono">{fetchError}</p>
        <p className="text-sm text-red-500">
          The report reads from the synced cache. If this persists, run a sync from <a href="/settings" className="underline">Settings</a>.
        </p>
      </div>
    )
  }

  if (!report || report.totalHours === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center space-y-2">
        <p className="font-semibold text-slate-700">No i7 hours for {selectedMonth} yet</p>
        <p className="text-sm text-slate-500">
          Nothing is cached for this month. New data is pulled from QuickBooks Time automatically in the background — or run a sync now from <a href="/settings" className="underline">Settings</a>.
        </p>
      </div>
    )
  }

  return <I7ReportView data={report} selectedMonth={selectedMonth} availableMonths={availableMonths} projectHours={projectHours} carryover={carryover} stdRate={stdRate} />
}

// Cached i7 timesheet entries for a date range. Paginates because PostgREST caps
// a single response (usually 1000 rows) — a multi-month range easily exceeds it,
// and a silent truncation would undercount the totals.
async function loadCachedEntries(start: string, end: string): Promise<I7Entry[]> {
  const supabase = await createClient()
  const out: I7Entry[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('tsheets_timesheets')
      .select('user_id, duration, date, i7_code, activity')
      .gte('date', start)
      .lte('date', end)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    for (const r of rows) {
      out.push({ user_id: r.user_id, duration: r.duration, date: r.date, i7Code: r.i7_code ?? '', activity: r.activity ?? '' })
    }
    if (rows.length < PAGE) break
  }
  return out
}

// tsheets_user_id → display (first) name, from the synced directory.
async function loadNames(): Promise<Record<number, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('people').select('tsheets_user_id, full_name').not('tsheets_user_id', 'is', null)
  const out: Record<number, string> = {}
  for (const p of data ?? []) {
    if (p.tsheets_user_id != null) out[p.tsheets_user_id] = (p.full_name || '').split(' ')[0] || `User ${p.tsheets_user_id}`
  }
  return out
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
