// Shared loader for the i7 Budget Usage Report, used by both the interactive
// report page and the print/PDF page. Reads everything from the local cache
// (kept fresh by the background sync): the Project → Job code → Activity tree,
// the per-project budget-hours guide, the carryover balance, and the Jan→month
// trend series. No live TSheets calls.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadI7EntriesHere, loadI7UniverseHere } from '@/lib/timeclock/report-source'
import { retentionFloorDate } from './retention'
import { loadAssignmentRates } from '@/lib/hr/compensation'
import { rateFor, standardI7Rate, type Assignment } from '@/lib/tsheets/rates'
import { monthBounds, monthsBetween } from '@/lib/tsheets/report'
import { spanWording } from '@/lib/tsheets/range'
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
  // Privileged, and this is the whole reason the report was wrong.
  //
  // tc_entries is the time clock, so its row-level security answers the time
  // clock's question: you see your own hours, plus the hours of people you
  // approve. Reading a CLIENT report through that rule made the report mean
  // something different for each viewer. A team leader who approves nobody saw
  // no hours, therefore no cost, therefore a carried-in balance that had never
  // been spent against: the whole year's budget, intact, on a client report.
  //
  // Nothing about it was configured, nothing on screen said it was happening,
  // and the Access levels page said the opposite. Who may open this report is
  // decided by the tools surface plus the i7-budget team grant, and how much of
  // it they receive is decided by report-full, applied on the server. Both are
  // rules an admin can see and change, which the database rule never was.
  return loadI7EntriesHere(createAdminClient(), start, end)
}

// Full universe of i7 job codes ever seen (the scaffold that keeps
// zero-hour projects and codes on screen), from the same source as the entries.
async function loadUniverse(): Promise<{ jobcodes: string[] }> {
  // Privileged for the same reason as the entries: the scaffold of codes has to
  // be the company's, or a viewer's report loses whole columns of the tree
  // depending on whose hours they happen to be allowed to read.
  //
  // The same window the month picker offers, which is what the old cache
  // effectively scanned: it was pruned to exactly this range.
  return loadI7UniverseHere(createAdminClient(), retentionFloorDate(new Date()))
}

// tsheets_user_id → display (first) name, from the synced directory.
// person id → display (first) name. Every active person, not only the ones
// with a TSheets account: a contractor whose hours are added by hand has a
// name here and nowhere else.
async function loadNames(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('people').select('id, full_name')
  const out: Record<string, string> = {}
  for (const p of (data ?? []) as { id: string; full_name: string | null }[]) {
    out[p.id] = (p.full_name || '').split(' ')[0] || `Person ${p.id.slice(0, 8)}`
  }
  return out
}

export async function loadI7Assignments(): Promise<Assignment[]> {
  const supabase = await createClient()
  const { data: i7 } = await supabase.from('tr_clients').select('id').eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID).maybeSingle()
  if (!i7) return []
  // hourly_rate is no longer readable by the `authenticated` role (migration
  // 054). The rates never leave this function: they are multiplied into the
  // costs the report already showed, which team leaders are meant to see.
  const rates = await loadAssignmentRates({ clientId: i7.id })
  // A rate with no person is one whose TSheets account nobody has linked. It
  // is skipped rather than matched to a placeholder: an unlinked rate applied
  // to the wrong person is worse than a rate that goes unused.
  return rates
    .filter(a => a.personId)
    .map(a => ({ personId: a.personId as string, rate: a.hourlyRate, from: a.effectiveFrom ?? '', to: a.effectiveTo }))
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

// project → budgeted hours over a run of months, summed.
//
// The guide is planned a month at a time, so a range's guide is the months in
// it added together: what a quarter was meant to take is what its three months
// were meant to take.
async function loadProjectHours(from: string, to: string): Promise<Record<string, number>> {
  const supabase = await createClient()
  const { data: i7 } = await supabase.from('tr_clients').select('id').eq('tsheets_jobcode_id', I7_PARENT_JOBCODE_ID).maybeSingle()
  if (!i7) return {}
  const { data } = await supabase.from('i7_project_month_hours')
    .select('project, hours_allocated')
    .eq('client_id', i7.id)
    .gte('month', `${from}-01`)
    .lte('month', `${to}-01`)
  const out: Record<string, number> = {}
  for (const p of data ?? []) out[p.project] = (out[p.project] ?? 0) + Number(p.hours_allocated)
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

  const personIds = [...new Set(assignments.map(a => a.personId))]
  const highestRate = personIds.reduce((mx, pid) => Math.max(mx, rateFor(assignments, pid, ym)), 0)

  const rows: ProjectDirectoryRow[] = I7_PROJECTS.map(project => ({ project, jobCodes: codesByProject[project] ?? [] }))

  return { clientName: i7?.name ?? 'i7', month: ym, highestRate, rows }
}

/**
 * The report for a stretch of months, defaulting to one.
 *
 * `to` defaults to `from`, so every caller that wants a single month keeps
 * asking the way it always did. Over a longer range everything sums except the
 * balance, which is a walk rather than a total: what was left entering the
 * range, plus the range's budgets, minus what the range cost.
 */
export async function loadI7ReportData(from: string, to: string = from): Promise<I7ReportData> {
  const { startDate } = monthBounds(from)
  const { endDate } = monthBounds(to)
  const singleMonth = from === to
  const year = to.slice(0, 4)
  // The balance rolls forward for as long as there is history, rather than
  // restarting every January (audit finding M3-3). January 2026 is the origin
  // because it is the first month ever pulled, so nothing precedes it.
  const carryStart = `${DATA_START}-01`

  const [entries, names, assignments, budgetInputs, projectHours, universe, note] = await Promise.all([
    loadCachedEntries(carryStart, endDate),
    loadNames(),
    loadI7Assignments(),
    loadBudgetInputs(),
    loadProjectHours(from, to),
    loadUniverse(),
    // A note is written against one month. Over a range there is no single
    // month it would be about, and showing the last one's would put a sentence
    // about September over a year of numbers.
    singleMonth ? loadReportNote(from) : Promise.resolve(''),
  ])

  // Monthly $ budget = the flat i7_monthly_budget (budget + extra). The total
  // budget for the month is the source of truth, NOT derived from hours × rate.
  // Budgeted hours per project are a separate planning estimate; actual usage is
  // per-person TSheets hours × their Rate/client (report.totalCost, below).
  const monthlyBudgets: Record<string, number> = { ...budgetInputs.flat }

  const jobcodesByProject: Record<string, string[]> = {}
  const projSet = new Set<string>(I7_PROJECTS)
  for (const code of universe.jobcodes) {
    const proj = mapCodeToProject(code)
    projSet.add(proj)
    ;(jobcodesByProject[proj] ??= []).push(code)
  }
  const universeArg = { projects: [...projSet], jobcodesByProject }

  const inRange = (ym: string) => ym >= from && ym <= to
  const selEntries = entries.filter(e => inRange(e.date.slice(0, 7)))
  const rateAt = (pid: string, ym: string) => rateFor(assignments, pid, ym)
  const report = buildI7Report(
    selEntries, rateAt, names, startDate, universeArg,
    singleMonth ? undefined : { endDate, label: spanWording(from, to) },
  )
  const stdRate = standardI7Rate(assignments, to)

  // display name → hourly rate, so per-person cost can be derived (report
  // .byPerson only carries hours). Over a range a person can have had two
  // rates, so this is their hours-weighted average: the one number that makes
  // hours × rate come back to the cost the report already shows.
  const hoursByPerson: Record<string, number> = {}
  const costByPerson: Record<string, number> = {}
  for (const e of selEntries) {
    const name = names[e.personId] ?? `Person ${e.personId.slice(0, 8)}`
    const hours = e.duration / 3600
    hoursByPerson[name] = (hoursByPerson[name] ?? 0) + hours
    costByPerson[name] = (costByPerson[name] ?? 0) + hours * rateAt(e.personId, e.date.slice(0, 7))
  }
  const personRates: Record<string, number> = {}
  for (const [name, hours] of Object.entries(hoursByPerson)) {
    personRates[name] = hours > 0 ? round2(costByPerson[name] / hours) : 0
  }

  // Anyone who logged i7 time in the range with no rate covering any of it.
  // Their hours are counted and their cost is zero, so the budget reads as less
  // consumed than it is, and nothing used to say so (audit finding M3-1).
  const unratedPeople = Object.entries(hoursByPerson)
    .filter(([name, hours]) => round2(hours) > 0 && (costByPerson[name] ?? 0) === 0)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b))

  // Budget minus cost over a run of months, the shape both the opening balance
  // and the trend's running balance need.
  const accumulate = (months: string[]) => {
    let budget = 0, cost = 0
    for (const ym of months) {
      budget += monthlyBudgets[ym] ?? 0
      cost += entries
        .filter(e => e.date.slice(0, 7) === ym)
        .reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.personId, ym), 0)
    }
    return { budget, cost }
  }

  const before = accumulate(monthsBetween(DATA_START, from))
  const opening = round2(before.budget - before.cost)

  // The sync prunes timesheets older than 24 months, so from January 2028 the
  // earliest retained month moves past the origin and those hours are gone for
  // good. The balance would then quietly start from a later month and read
  // higher than it should. Flagged rather than silently shown, until the month
  // closings are stored somewhere the prune cannot reach.
  const openingComplete = retentionFloor(new Date()) <= DATA_START
  // Over a range this is the range's budget, every month in it added up, and
  // the balance below still reads as one sum: what was left coming in, plus
  // what was granted, minus what was spent.
  const monthBudget = monthsBetween(from, to).concat(to).reduce((sum, ym) => sum + (monthlyBudgets[ym] ?? 0), 0)
  const monthUsed = report.totalCost
  const totalAvailable = round2(opening + monthBudget)
  const carryover: I7Carryover = {
    opening, monthBudget, monthUsed, totalAvailable,
    totalLeft: round2(totalAvailable - monthUsed),
    openingFrom: DATA_START,
    openingComplete,
  }

  // The chart shows month by month, and its balance line continues from what
  // came before instead of dropping to zero at the start.
  //
  // For one month that is the year it falls in, January to it, which is the
  // shape a budget year is read in. For a longer range it is the range itself:
  // asked for two years, a chart of the second one only would answer a
  // different question than the table beside it.
  const chartMonths = singleMonth
    ? monthsBetween(`${year}-01`, to).concat(to)
    : monthsBetween(from, to).concat(to)
  const trend: I7TrendPoint[] = []
  const priorMonths = accumulate(monthsBetween(DATA_START, chartMonths[0]))
  let tB = priorMonths.budget, tC = priorMonths.cost
  for (const ym of chartMonths) {
    const me = entries.filter(e => e.date.slice(0, 7) === ym)
    const h = me.reduce((s, e) => s + e.duration / 3600, 0)
    const c = me.reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.personId, ym), 0)
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

/**
 * The month-by-month history over an arbitrary range, for the CSV.
 *
 * Same shape as the Full history table: budget, what came in from the month
 * before, what was used, and the hours behind it. Carry-in is the previous
 * month's closing balance, so a range that starts mid-year still opens with the
 * balance it really had rather than at zero.
 *
 * `from` is clamped to DATA_START. Months before it have hours in tc_entries
 * going back to 2017 but no budget and no rate, so they would come out with real
 * hours beside zero money: a row that is arithmetically true and reads as a
 * month where nothing was spent.
 */
export interface HistoryRow {
  month: string
  budget: number
  carryIn: number
  used: number
  hours: number
  balance: number
}

export async function loadI7History(from: string, to: string): Promise<HistoryRow[]> {
  const start = from < DATA_START ? DATA_START : from
  if (to < start) return []

  const { endDate } = monthBounds(to)
  const [entries, assignments, budgetInputs] = await Promise.all([
    loadCachedEntries(`${DATA_START}-01`, endDate),
    loadI7Assignments(),
    loadBudgetInputs(),
  ])
  const monthlyBudgets: Record<string, number> = { ...budgetInputs.flat }

  const rows: HistoryRow[] = []
  let balance = 0
  // Walked from DATA_START even when the range starts later: the carry-in of
  // the first row is the whole history before it, not zero.
  for (const ym of [...monthsBetween(DATA_START, to), to]) {
    const carryIn = balance
    const me = entries.filter(e => e.date.slice(0, 7) === ym)
    const hours = me.reduce((s, e) => s + e.duration / 3600, 0)
    const used = me.reduce((s, e) => s + (e.duration / 3600) * rateFor(assignments, e.personId, ym), 0)
    const budget = monthlyBudgets[ym] ?? 0
    balance = round2(carryIn + budget - used)
    if (ym >= start) {
      rows.push({
        month: ym,
        budget,
        carryIn: round2(carryIn),
        used: round2(used),
        hours: round2(hours),
        balance,
      })
    }
  }
  return rows
}
