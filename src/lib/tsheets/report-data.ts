// Shared loader for the i7 Budget Usage Report, used by both the interactive
// report page and the print/PDF page. Reads everything from the local cache
// (kept fresh by the background sync): the Project → Job code → Activity tree,
// the per-project budget-hours guide, the carryover balance, and the Jan→month
// trend series. No live TSheets calls.

import { createClient } from '@/lib/supabase/server'
import { loadI7EntriesHere, loadI7UniverseHere } from '@/lib/timeclock/report-source'
import { retentionFloorDate } from './retention'
import { loadAssignmentRates } from '@/lib/hr/compensation'
import { rateFor, standardI7Rate, type Assignment } from '@/lib/tsheets/rates'
import { monthBounds, monthsBetween } from '@/lib/tsheets/report'
import { DATA_START, retentionFloor } from '@/lib/tsheets/retention'
import { buildI7Report, mapCodeToProject, I7_PROJECTS, I7_PARENT_JOBCODE_ID } from '@/lib/tsheets/i7report'
import type { I7Report, I7Carryover, I7Entry, I7TrendPoint } from '@/lib/tsheets/types'

export interface I7ReportData {
  report: I7Report | null                 // null when the month has no hours
  /** Names with hours this month but no rate: their cost lands as zero. */
  unratedPeople: string[]
  projectHours: Record<string, number>
  carryover: I7Carryover | null
  stdRate: number
  personRates: Record<string, number>     // display name → this month's hourly rate (for per-person cost, e.g. CSV export)
  trend: I7TrendPoint[]
  note: string                            // optional per-month narrative
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * i7 entries for a date range, now read from the portal's own hours.
 *
 * Phase 5. The old source was tsheets_timesheets, a cache the sync filled with
 * only the i7 branch and only from January 2026: everything before that was
 * never there, so the report could not show it. tc_entries holds all 136,000
 * entries back to 2017, which is where the extra history in the month picker
 * comes from.
 *
 * Checked before switching, not after: for every month both sources held, the
 * seconds and the day-person-code-activity buckets were identical. The only
 * difference was a couple of zero-second rows, which contribute to nothing.
 */
async function loadCachedEntries(start: string, end: string): Promise<I7Entry[]> {
  const supabase = await createClient()
  return loadI7EntriesHere(supabase, start, end)
}

// Full universe of i7 job codes + people ever seen (the scaffold that keeps
// zero-hour projects and codes on screen), from the same source as the entries.
async function loadUniverse(): Promise<{ jobcodes: string[]; userIds: number[] }> {
  const supabase = await createClient()
  // The same window the month picker offers, which is what the old cache
  // effectively scanned: it was pruned to exactly this range.
  return loadI7UniverseHere(supabase, retentionFloorDate(new Date()))
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
  // hourly_rate is no longer readable by the `authenticated` role (migration
  // 054). The rates never leave this function: they are multiplied into the
  // costs the report already showed, which team leaders are meant to see.
  const rates = await loadAssignmentRates({ clientId: i7.id })
  return rates.map(a => ({ userId: a.tsheetsUserId, rate: a.hourlyRate, from: a.effectiveFrom ?? '', to: a.effectiveTo }))
}

export interface BudgetInputs {
  flat: Record<string, number>   // i7_monthly_budget: budget_amount + extra_amount per month
}

// The month's total $ budget (budget + extra) per month, the source of truth.
async function loadBudgetInputs(): Promise<BudgetInputs> {
  const supabase = await createClient()
  const { data } = await supabase.from('i7_monthly_budget').select('month, budget_amount, extra_amount')
  const flat: Record<string, number> = {}
  for (const b of data ?? []) flat[String(b.month).slice(0, 7)] = Number(b.budget_amount) + Number(b.extra_amount)
  return { flat }
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

// ── Clients / Projects / Job codes directory (Settings) ─────────────────────
export interface ProjectDirectoryRow {
  project: string
  jobCodes: string[]      // live TSheets codes, grouped by prefix
}

export interface ProjectDirectory {
  clientName: string
  month: string           // the YYYY-MM the rate was resolved for
  highestRate: number     // the highest Rate/client in People & rates, the uniform rate used ONLY to estimate allocatable hours
  rows: ProjectDirectoryRow[]
}

// Client → projects → live job codes listing for Settings. No rates or roster
// live here anymore: it's a pure catalogue. `highestRate` (the top Rate/client)
// rides along so the budget-hours grid can estimate how many hours the month's
// budget covers at the highest rate.
export async function loadProjectDirectory(ym: string): Promise<ProjectDirectory> {
  const supabase = await createClient()
  const { data: i7 } = await supabase.from('tr_clients').select('name').eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID).maybeSingle()

  const [universe, assignments] = await Promise.all([
    loadUniverse(),
    loadI7Assignments(),
  ])

  const codesByProject: Record<string, string[]> = {}
  for (const code of universe.jobcodes) (codesByProject[mapCodeToProject(code)] ??= []).push(code)
  for (const list of Object.values(codesByProject)) list.sort((a, b) => a.localeCompare(b))

  const userIds = [...new Set(assignments.map(a => a.userId))]
  const highestRate = userIds.reduce((mx, uid) => Math.max(mx, rateFor(assignments, uid, ym)), 0)

  const rows: ProjectDirectoryRow[] = I7_PROJECTS.map(project => ({ project, jobCodes: codesByProject[project] ?? [] }))

  return { clientName: i7?.name ?? 'i7', month: ym, highestRate, rows }
}

export async function loadI7ReportData(selectedMonth: string): Promise<I7ReportData> {
  const { startDate, endDate } = monthBounds(selectedMonth)
  const year = selectedMonth.slice(0, 4)
  const selM = Number(selectedMonth.slice(5, 7))
  // The balance rolls forward for as long as there is history, rather than
  // restarting every January (audit finding M3-3). January 2026 is the origin
  // because it is the first month ever pulled, so nothing precedes it.
  const carryStart = `${DATA_START}-01`

  const [entries, names, assignments, budgetInputs, projectHours, universe, note] = await Promise.all([
    loadCachedEntries(carryStart, endDate),
    loadNames(),
    loadI7Assignments(),
    loadBudgetInputs(),
    loadProjectHours(selectedMonth),
    loadUniverse(),
    loadReportNote(selectedMonth),
  ])

  // Monthly $ budget = the flat i7_monthly_budget (budget + extra). The total
  // budget for the month is the source of truth, NOT derived from hours × rate.
  // Budgeted hours per project are a separate planning estimate; actual usage is
  // per-person TSheets hours × their Rate/client (report.totalCost, below).
  const monthlyBudgets: Record<string, number> = { ...budgetInputs.flat }

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

  // Anyone who logged i7 time this month with no rate covering it. Their hours
  // are counted and their cost is zero, so the budget reads as less consumed
  // than it is, and nothing used to say so (audit finding M3-1).
  const unratedPeople = Object.entries(ratesSel)
    .filter(([, rate]) => rate === 0)
    .map(([uid]) => names[Number(uid)] ?? `User ${uid}`)
    .sort((a, b) => a.localeCompare(b))

  // Budget minus cost over a run of months, the shape both the opening balance
  // and the trend's running balance need.
  const accumulate = (months: string[]) => {
    let budget = 0, cost = 0
    for (const ym of months) {
      budget += monthlyBudgets[ym] ?? 0
      cost += entries
        .filter(e => e.date.slice(0, 7) === ym)
        .reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.user_id, ym), 0)
    }
    return { budget, cost }
  }

  const before = accumulate(monthsBetween(DATA_START, selectedMonth))
  const opening = round2(before.budget - before.cost)

  // The sync prunes timesheets older than 24 months, so from January 2028 the
  // earliest retained month moves past the origin and those hours are gone for
  // good. The balance would then quietly start from a later month and read
  // higher than it should. Flagged rather than silently shown, until the month
  // closings are stored somewhere the prune cannot reach.
  const openingComplete = retentionFloor(new Date()) <= DATA_START
  const monthBudget = monthlyBudgets[selectedMonth] ?? 0
  const monthUsed = report.totalCost
  const totalAvailable = round2(opening + monthBudget)
  const carryover: I7Carryover = {
    opening, monthBudget, monthUsed, totalAvailable,
    totalLeft: round2(totalAvailable - monthUsed),
    openingFrom: DATA_START,
    openingComplete,
  }

  // The chart still shows the selected year month by month, but its balance
  // line continues from what came before January instead of dropping to zero.
  const trend: I7TrendPoint[] = []
  const priorYears = accumulate(monthsBetween(DATA_START, `${year}-01`))
  let tB = priorYears.budget, tC = priorYears.cost
  for (let m = 1; m <= selM; m++) {
    const ym = `${year}-${String(m).padStart(2, '0')}`
    const me = entries.filter(e => e.date.slice(0, 7) === ym)
    const h = me.reduce((s, e) => s + e.duration / 3600, 0)
    const c = me.reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.user_id, ym), 0)
    const b = monthlyBudgets[ym] ?? 0
    tB += b; tC += c
    trend.push({ month: ym, hours: round2(h), cost: round2(c), budget: b, balance: round2(tB - tC) })
  }

  return { report: report.totalHours > 0 ? report : null, unratedPeople, projectHours, carryover, stdRate, personRates, trend, note }
}

// The optional narrative for a month (empty string when none).
export async function loadReportNote(month: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.from('i7_report_notes').select('note').eq('month', `${month}-01`).maybeSingle()
  return data?.note ?? ''
}
