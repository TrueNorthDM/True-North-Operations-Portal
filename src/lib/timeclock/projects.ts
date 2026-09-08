// The project hours tracking sheet, as a report.
//
// This replaces a spreadsheet accounting keeps by hand: export from QuickBooks
// Time, run two pivot tables, type the totals into a sheet, once a month.
//
// WHAT THE FOUR PROJECTS ARE, established by checking against seven months of
// that sheet rather than by reading the field names:
//
//   AskAnAdventistFriend.com   "2 Project" = AAAF
//   Grants Pass Church         "2 Project" = GP church
//   Grants Pass School         "2 Project" = GP School
//   Hope for Africa            "2 Project" = Africa
//
// All four come from the same field. The process note says HFA is "under job
// code 1", and following that gave a number 120 to 190 hours short every single
// month: the work sits under two different job codes, Adventist Messengers/HFA
// and 1 - True North, joined only by the project value. Four of the seven
// months then matched to the hundredth, and the three that did not are all
// explained by the sheet being a snapshot: July is 87 hours light because it
// was saved on the 31st and entries kept arriving.
//
// MONEY. There is none, with one exception. These are donation funded and not
// billed. Church and School buy hours in advance at $90, which is what the
// balance columns track; see migration 062.

import type { SupabaseClient } from '@supabase/supabase-js'
import { PROJECT_CF } from '@/lib/tsheets/i7report'
import { loadCompensationByPerson } from '@/lib/hr/compensation'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

const PAGE = 1000

/** The four rows of the sheet, in the order accounting reads them. */
export const TRACKED_PROJECTS = [
  { label: 'AAAF', name: 'AskAnAdventistFriend.com', prepaid: false },
  { label: 'GP church', name: 'Grants Pass Church', prepaid: true },
  { label: 'GP School', name: 'Grants Pass School', prepaid: true },
  { label: 'Africa', name: 'Hope for Africa', prepaid: false },
] as const

export interface ProjectRow {
  label: string
  name: string
  prepaid: boolean
  /** Hours left at the end of the month before this one. Null when not prepaid. */
  carriedIn: number | null
  /** Hours bought during this month. Null when not prepaid. */
  boughtThisMonth: number | null
  /** carriedIn + bought − worked. Null when not prepaid. */
  remaining: number | null
  workedThisMonth: number
  byPerson: Record<string, number>
  yearToDate: number
  sameMonthLastYear: number
  /**
   * Hours × each person's break-even rate, split by whether they are on the
   * payroll. Attribution rather than outflow for an employee, who is paid the
   * same whether they logged ten hours or a hundred: the figure says what a
   * project consumed, not what left the bank.
   */
  employeeCostThisMonth: number
  contractorCostThisMonth: number
  totalCosts: number
  /**
   * Null, not zero. Donations are entered by hand and there is nowhere yet to
   * enter them, so every cell would read as "nothing was donated" when what is
   * true is "nobody has said". Zero is an answer; this is the absence of one.
   */
  donationsThisMonth: number | null
  donationsYtd: number | null
}

export interface ProjectTracking {
  month: string
  people: string[]
  rows: ProjectRow[]
  totals: {
    workedThisMonth: number
    byPerson: Record<string, number>
    yearToDate: number
    sameMonthLastYear: number
    employeeCostThisMonth: number
    contractorCostThisMonth: number
    totalCosts: number
  }
  /** Worked on a project this year with no break-even rate, so costing zero. */
  unratedPeople: string[]
}

function monthEnd(month: string): string {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

/** Hours by project and person over a date range, from the "2 Project" field. */
interface Bucket { total: number; byPerson: Map<string, number>; byId: Map<string, number> }

async function hoursIn(
  supabase: Client,
  projectKey: number,
  labels: string[],
  start: string,
  end: string,
  firstNameById: Map<string, string>,
): Promise<Map<string, Bucket>> {
  const out = new Map<string, Bucket>()
  for (const label of labels) {
    // byPerson is keyed by first name, which is what the sheet's columns are.
    // byId is keyed by person, which is what a rate is keyed by: cost cannot be
    // worked out from a display name, and two Amys would share one.
    const bucket: Bucket = { total: 0, byPerson: new Map(), byId: new Map() }
    // One containment query per project, which the GIN index on `fields` can
    // answer. A scan of all 136,000 entries is what froze this page once.
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('tc_entries').select('person_id, duration_seconds')
        .contains('fields', { [String(projectKey)]: label })
        .gte('entry_date', start).lte('entry_date', end)
        .order('id', { ascending: true }).range(from, from + PAGE - 1)
      if (error) throw new Error(error.message)
      const rows = (data ?? []) as { person_id: string; duration_seconds: number }[]
      for (const r of rows) {
        const hours = r.duration_seconds / 3600
        bucket.total += hours
        const who = firstNameById.get(r.person_id) ?? 'Unknown'
        bucket.byPerson.set(who, (bucket.byPerson.get(who) ?? 0) + hours)
        bucket.byId.set(r.person_id, (bucket.byId.get(r.person_id) ?? 0) + hours)
      }
      if (rows.length < PAGE) break
    }
    out.set(label, bucket)
  }
  return out
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function loadProjectTracking(
  supabase: Client,
  month: string,
): Promise<ProjectTracking> {
  const [{ data: fieldRows }, { data: peopleRows }, { data: buyRows }, pay] = await Promise.all([
    supabase.from('tc_fields').select('id, external_id'),
    supabase.from('people').select('id, full_name, employment_type'),
    supabase.from('tc_project_purchases').select('project_label, month, hours'),
    // Break-even rates through the privileged reader: be_rate is out of the
    // `authenticated` column grant, for the same reason internal_rate is.
    loadCompensationByPerson(),
  ])

  const projectKey = ((fieldRows ?? []) as { id: number; external_id: number | null }[])
    .find(f => String(f.external_id) === PROJECT_CF)?.id
  if (!projectKey) {
    return { month, people: [], rows: [], unratedPeople: [], totals: { workedThisMonth: 0, byPerson: {}, yearToDate: 0, sameMonthLastYear: 0, employeeCostThisMonth: 0, contractorCostThisMonth: 0, totalCosts: 0 } }
  }

  // First names, because that is what the tracking sheet's columns are.
  const roster = (peopleRows ?? []) as { id: string; full_name: string; employment_type: string | null }[]
  const firstNameById = new Map(roster.map(p => [p.id, (p.full_name || '').split(' ')[0]]))
  const kindById = new Map(roster.map(p => [p.id, p.employment_type]))

  /**
   * Hours × break-even rate, split by whether the person is on the payroll.
   *
   * Somebody with no break-even rate contributes nothing, which is the same
   * silence the i7 report used to keep about a missing client rate. The names
   * come back with the totals so the screen can say who, rather than leaving a
   * project looking cheaper than it was.
   */
  const costOf = (byId: Map<string, number>) => {
    let employee = 0, contractor = 0
    const unrated: string[] = []
    for (const [id, hours] of byId) {
      const rate = pay.get(id)?.beRate ?? null
      if (rate == null) {
        if (hours > 0) unrated.push(firstNameById.get(id) ?? 'Unknown')
        continue
      }
      if (kindById.get(id) === 'contractor') contractor += hours * rate
      else employee += hours * rate
    }
    return { employee: round2(employee), contractor: round2(contractor), unrated }
  }

  const purchases = (buyRows ?? []) as { project_label: string; month: string; hours: number }[]
  const labels = TRACKED_PROJECTS.map(p => p.label)
  const year = month.slice(0, 4)
  const lastYearMonth = `${Number(year) - 1}-${month.slice(5, 7)}`

  const [thisMonth, ytd, lastYear] = await Promise.all([
    hoursIn(supabase, projectKey, labels, `${month}-01`, monthEnd(month), firstNameById),
    hoursIn(supabase, projectKey, labels, `${year}-01-01`, monthEnd(month), firstNameById),
    hoursIn(supabase, projectKey, labels, `${lastYearMonth}-01`, monthEnd(lastYearMonth), firstNameById),
  ])

  const unratedAll = new Set<string>()
  const rows: ProjectRow[] = TRACKED_PROJECTS.map(p => {
    const here = thisMonth.get(p.label)!
    const worked = round2(here.total)
    const monthCost = costOf(here.byId)
    const ytdCost = costOf(ytd.get(p.label)?.byId ?? new Map())
    for (const who of [...monthCost.unrated, ...ytdCost.unrated]) unratedAll.add(who)

    let carriedIn: number | null = null
    let bought: number | null = null
    let remaining: number | null = null

    if (p.prepaid) {
      // Replayed from the beginning rather than stored: every purchase and every
      // hour worked is already here, and a balance that is recomputed cannot
      // drift from the entries behind it the way a stored one does.
      let balance = 0
      for (const buy of purchases.filter(b => b.project_label === p.label && b.month < month)) {
        balance += Number(buy.hours)
      }
      // Work done before this month, drawn against those purchases.
      const workedBefore = round2((ytd.get(p.label)?.total ?? 0) - here.total)
      const priorYears = 0   // the sheet starts at January 2026, as the i7 report does
      balance -= workedBefore + priorYears
      carriedIn = round2(balance)

      bought = round2(purchases
        .filter(b => b.project_label === p.label && b.month === month)
        .reduce((s, b) => s + Number(b.hours), 0))
      remaining = round2(carriedIn + bought - worked)
    }

    return {
      label: p.label,
      name: p.name,
      prepaid: p.prepaid,
      carriedIn,
      boughtThisMonth: bought,
      remaining,
      workedThisMonth: worked,
      byPerson: Object.fromEntries([...here.byPerson].map(([k, v]) => [k, round2(v)])),
      yearToDate: round2(ytd.get(p.label)?.total ?? 0),
      sameMonthLastYear: round2(lastYear.get(p.label)?.total ?? 0),
      employeeCostThisMonth: monthCost.employee,
      contractorCostThisMonth: monthCost.contractor,
      totalCosts: round2(ytdCost.employee + ytdCost.contractor),
      donationsThisMonth: null,
      donationsYtd: null,
    }
  })

  // One column per person who worked on anything this month, sorted like the
  // sheet: alphabetically.
  const people = [...new Set(rows.flatMap(r => Object.keys(r.byPerson)))].sort((a, b) => a.localeCompare(b))

  const byPerson: Record<string, number> = {}
  for (const r of rows) for (const [who, h] of Object.entries(r.byPerson)) {
    byPerson[who] = round2((byPerson[who] ?? 0) + h)
  }

  return {
    month,
    people,
    rows,
    totals: {
      workedThisMonth: round2(rows.reduce((s, r) => s + r.workedThisMonth, 0)),
      byPerson,
      yearToDate: round2(rows.reduce((s, r) => s + r.yearToDate, 0)),
      sameMonthLastYear: round2(rows.reduce((s, r) => s + r.sameMonthLastYear, 0)),
      employeeCostThisMonth: round2(rows.reduce((s, r) => s + r.employeeCostThisMonth, 0)),
      contractorCostThisMonth: round2(rows.reduce((s, r) => s + r.contractorCostThisMonth, 0)),
      totalCosts: round2(rows.reduce((s, r) => s + r.totalCosts, 0)),
    },
    // Anyone who worked on one of these and has no break-even rate. Their hours
    // count and their cost is nothing, so the project reads cheaper than it was,
    // and this is what the screen says so instead of the total quietly shrinking.
    unratedPeople: [...unratedAll].sort((a, b) => a.localeCompare(b)),
  }
}
