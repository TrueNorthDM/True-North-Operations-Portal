// Shared loader for the i7 Budget Usage Report — used by both the interactive
// report page and the print/PDF page. Reads everything from the local cache
// (kept fresh by the background sync): the Project → Job code → Activity tree,
// the per-project budget-hours guide, the carryover balance, and the Jan→month
// trend series. No live TSheets calls.

import { createClient } from '@/lib/supabase/server'
import { monthBounds } from '@/lib/tsheets/report'
import { buildI7Report, mapCodeToProject, I7_PROJECTS, I7_PARENT_JOBCODE_ID } from '@/lib/tsheets/i7report'
import type { I7Report, I7Carryover, I7Entry, I7TrendPoint } from '@/lib/tsheets/types'

export interface I7ReportData {
  report: I7Report | null                 // null when the month has no hours
  projectHours: Record<string, number>
  carryover: I7Carryover | null
  stdRate: number
  personRates: Record<string, number>     // display name → this month's hourly rate (for per-person cost, e.g. CSV export)
  trend: I7TrendPoint[]
  note: string                            // optional per-month narrative
}

interface Assignment { userId: number; rate: number; from: string; to: string | null }

const round2 = (n: number) => Math.round(n * 100) / 100

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

/** The "standard" i7 hourly rate for a month — the most common active rate. */
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

// Cached i7 timesheet entries for a date range (paginated past PostgREST's cap).
async function loadCachedEntries(start: string, end: string): Promise<I7Entry[]> {
  const supabase = await createClient()
  const out: I7Entry[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('tsheets_timesheets')
      .select('user_id, duration, date, i7_code, activity')
      .gte('date', start).lte('date', end)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    for (const r of rows) out.push({ user_id: r.user_id, duration: r.duration, date: r.date, i7Code: r.i7_code ?? '', activity: r.activity ?? '' })
    if (rows.length < PAGE) break
  }
  return out
}

// Full universe of i7 job codes + people ever seen in the cache (the scaffold).
async function loadUniverse(): Promise<{ jobcodes: string[]; userIds: number[] }> {
  const supabase = await createClient()
  const codes = new Set<string>()
  const userIds = new Set<number>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from('tsheets_timesheets').select('user_id, i7_code').order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    for (const r of rows) {
      if (r.user_id != null) userIds.add(r.user_id)
      const c = (r.i7_code ?? '').trim()
      if (c) codes.add(c)
    }
    if (rows.length < PAGE) break
  }
  return { jobcodes: [...codes], userIds: [...userIds] }
}

// tsheets_user_id → display (first) name, from the synced directory.
async function loadNames(): Promise<Record<number, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('people').select('tsheets_user_id, full_name').not('tsheets_user_id', 'is', null)
  const out: Record<number, string> = {}
  for (const p of data ?? []) if (p.tsheets_user_id != null) out[p.tsheets_user_id] = (p.full_name || '').split(' ')[0] || `User ${p.tsheets_user_id}`
  return out
}

async function loadI7Assignments(): Promise<Assignment[]> {
  const supabase = await createClient()
  const { data: i7 } = await supabase.from('tr_clients').select('id').eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID).maybeSingle()
  if (!i7) return []
  const { data } = await supabase.from('tr_assignments').select('tsheets_user_id, hourly_rate, effective_from, effective_to').eq('client_id', i7.id)
  return (data ?? []).map(a => ({ userId: a.tsheets_user_id, rate: Number(a.hourly_rate), from: a.effective_from, to: a.effective_to }))
}

// The budget "roster": which i7 projects each person works on (people.i7_projects)
// + their tsheets id (to look up the month's rate). Drives each project's AVERAGE
// billing rate.
async function loadRoster(): Promise<{ userId: number; projects: string[] }[]> {
  const supabase = await createClient()
  const { data } = await supabase.from('people').select('tsheets_user_id, i7_projects').not('tsheets_user_id', 'is', null)
  return (data ?? []).map(p => ({ userId: p.tsheets_user_id as number, projects: ((p as { i7_projects?: string[] | null }).i7_projects) ?? [] }))
}

export interface BudgetInputs {
  lines: { month: string; project: string; hours: number; storedRate: number | null }[]
  flat: Record<string, number>   // legacy flat i7_monthly_budget (fallback)
}

// Raw budget inputs: budgeted hours per project/month (+ any stored per-line rate),
// and the legacy flat i7_monthly_budget for the fallback. The actual $ budget is
// computed in loadI7ReportData as Σ(hours × the project's average roster rate).
async function loadBudgetInputs(): Promise<BudgetInputs> {
  const supabase = await createClient()
  const { data: i7 } = await supabase.from('tr_clients').select('id').eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID).maybeSingle()
  const [hrsRes, mbRes] = await Promise.all([
    i7 ? supabase.from('i7_project_month_hours').select('*').eq('client_id', i7.id) : Promise.resolve({ data: [] }),
    supabase.from('i7_monthly_budget').select('month, budget_amount, extra_amount'),
  ])
  const lines = (hrsRes.data ?? []).map(r => ({
    month: String((r as { month: string }).month).slice(0, 7),
    project: (r as { project: string }).project,
    hours: Number((r as { hours_allocated: number }).hours_allocated),
    storedRate: (r as { rate?: number | null }).rate ?? null,
  }))
  const flat: Record<string, number> = {}
  for (const b of mbRes.data ?? []) flat[String(b.month).slice(0, 7)] = Number(b.budget_amount) + Number(b.extra_amount)
  return { lines, flat }
}

// Per-project $ rate for a month: the AVERAGE i7 billing rate of the people assigned
// to the project (roster) — else the stored per-line rate — else the standard rate.
export function projectRateFor(
  project: string, ym: string,
  roster: { userId: number; projects: string[] }[],
  assignments: Assignment[],
  lines: BudgetInputs['lines'],
): number {
  const rates = roster.filter(r => r.projects.includes(project)).map(r => rateFor(assignments, r.userId, ym)).filter(r => r > 0)
  if (rates.length) return rates.reduce((s, r) => s + r, 0) / rates.length
  return lines.find(l => l.project === project && l.month === ym)?.storedRate ?? standardI7Rate(assignments, ym)
}

// project → budgeted hours for the given month.
async function loadProjectHours(month: string): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data: i7 } = await supabase.from('tr_clients').select('id').eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID).maybeSingle()
  if (!i7) return {}
  const { data } = await supabase.from('i7_project_month_hours').select('project, hours_allocated').eq('client_id', i7.id).eq('month', `${month}-01`)
  const out: Record<string, number> = {}
  for (const p of data ?? []) out[p.project] = Number(p.hours_allocated)
  return out
}

export async function loadI7ReportData(selectedMonth: string): Promise<I7ReportData> {
  const { startDate, endDate } = monthBounds(selectedMonth)
  const year = selectedMonth.slice(0, 4)
  const selM = Number(selectedMonth.slice(5, 7))
  const carryStart = `${year}-01-01`

  const [entries, names, assignments, budgetInputs, roster, projectHours, universe, note] = await Promise.all([
    loadCachedEntries(carryStart, endDate),
    loadNames(),
    loadI7Assignments(),
    loadBudgetInputs(),
    loadRoster(),
    loadProjectHours(selectedMonth),
    loadUniverse(),
    loadReportNote(selectedMonth),
  ])

  // Monthly $ budget = Σ(project budgeted hours × the project's AVERAGE roster
  // rate). Falls back to the flat i7_monthly_budget when there are no per-project
  // hours rows at all.
  const monthlyBudgets: Record<string, number> = {}
  if (budgetInputs.lines.length) {
    for (const l of budgetInputs.lines) monthlyBudgets[l.month] = (monthlyBudgets[l.month] ?? 0) + l.hours * projectRateFor(l.project, l.month, roster, assignments, budgetInputs.lines)
  } else {
    Object.assign(monthlyBudgets, budgetInputs.flat)
  }

  const rosterIds = new Set<number>([...universe.userIds, ...assignments.map(a => a.userId)])
  const jobcodesByProject: Record<string, string[]> = {}
  const projSet = new Set<string>(I7_PROJECTS)
  for (const code of universe.jobcodes) {
    const proj = mapCodeToProject(code)
    projSet.add(proj)
    ;(jobcodesByProject[proj] ??= []).push(code)
  }
  const universeArg = {
    projects: [...projSet],
    jobcodesByProject,
    people: [...new Set([...rosterIds].map(id => names[id] ?? `User ${id}`))],
  }

  const selEntries = entries.filter(e => e.date.slice(0, 7) === selectedMonth)
  const ratesSel: Record<number, number> = {}
  for (const uid of new Set(selEntries.map(e => e.user_id))) ratesSel[uid] = rateFor(assignments, uid, selectedMonth)
  const report = buildI7Report(selEntries, ratesSel, names, startDate, universeArg)
  const stdRate = standardI7Rate(assignments, selectedMonth)
  // display name → hourly rate for the month, so per-person cost can be derived
  // (report.byPerson only carries hours). Keyed the same way as report.people.
  const personRates: Record<string, number> = {}
  for (const [uid, r] of Object.entries(ratesSel)) personRates[names[Number(uid)] ?? `User ${uid}`] = r

  let cumBudget = 0, cumCost = 0
  for (let m = 1; m < selM; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    const cost = entries.filter(e => e.date.slice(0, 7) === ym).reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.user_id, ym), 0)
    cumBudget += monthlyBudgets[ym] ?? 0
    cumCost += cost
  }
  const opening = round2(cumBudget - cumCost)
  const monthBudget = monthlyBudgets[selectedMonth] ?? 0
  const monthUsed = report.totalCost
  const totalAvailable = round2(opening + monthBudget)
  const carryover: I7Carryover = { opening, monthBudget, monthUsed, totalAvailable, totalLeft: round2(totalAvailable - monthUsed) }

  const trend: I7TrendPoint[] = []
  let tB = 0, tC = 0
  for (let m = 1; m <= selM; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    const me = entries.filter(e => e.date.slice(0, 7) === ym)
    const h = me.reduce((s, e) => s + e.duration / 3600, 0)
    const c = me.reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.user_id, ym), 0)
    const b = monthlyBudgets[ym] ?? 0
    tB += b; tC += c
    trend.push({ month: ym, hours: round2(h), cost: round2(c), budget: b, balance: round2(tB - tC) })
  }

  return { report: report.totalHours > 0 ? report : null, projectHours, carryover, stdRate, personRates, trend, note }
}

// The optional narrative for a month (empty string when none).
async function loadReportNote(month: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.from('i7_report_notes').select('note').eq('month', `${month}-01`).maybeSingle()
  return data?.note ?? ''
}
