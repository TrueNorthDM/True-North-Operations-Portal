// Data loader for the Budget Usage Report settings (clients & budgets, people &
// rates, change history). Extracted from the old
// BudgetUsageSettings component so the Settings page can compose these into its
// own left-nav sections.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { RANGE_FLOOR } from '@/lib/tsheets/range'
import { getTsheetsStatus } from '@/lib/tsheets/status'
import { loadCompensationByPerson, loadAssignmentRates, loadAuditLog, type Compensation } from '@/lib/hr/compensation'
import { I7_PROJECTS } from '@/lib/tsheets/i7report'
import type { ClientWithBudget } from '@/components/tsheets/settings/ClientsTab'
import type { PersonWithAssignments, DirectoryOption } from '@/components/tsheets/settings/PeopleTab'
import type { AuditEntry } from '@/components/tsheets/settings/HistoryTab'

/** Change history entries about budgets, which carry no pay. */
const BUDGET_ENTITIES = new Set(['budget', 'monthly_budget', 'project_budget', 'project_month_hours', 'budget_history'])

export interface BudgetUsageData {
  clients: ClientWithBudget[]
  people: PersonWithAssignments[]
  auditLog: AuditEntry[]
  directoryOptions: DirectoryOption[]
  syncedAt: string | null
}

/**
 * `pay`: salaries, cost and break-even rates, client rates, and the change
 * history entries that repeat them. Only for a caller whose access has Rates &
 * Costs (d-rates); without it they are never read, and the history keeps only
 * the budget entries.
 */
export async function getBudgetUsageData({ pay }: { pay: boolean }): Promise<BudgetUsageData> {
  const supabase = await createClient()

  // This function also feeds /directory, which is not admin-only, so the
  // timestamp comes from the narrow reader rather than the user's client.
  // That is what lets app_settings be admin-only (migration 052).
  const { syncedAt } = await getTsheetsStatus()
  // Pay per person, read privileged and merged in below (migration 054).
  const compensation = pay ? await loadCompensationByPerson() : new Map<string, Compensation>()

  const [
    { data: clientsRaw },
    { data: budgets },
    { data: peopleRaw },
    { data: assignments },
    { data: auditRaw },
    { data: directoryRaw },
    { data: memberRows },
    { data: teamRows },
    { data: projBudgetsRaw },
    { data: monthlyRaw },
    { data: projMonthRaw },
    { data: allPeopleRaw },
  ] = await Promise.all([
    supabase.from('tr_clients').select('id, name, active').is('parent_id', null).order('name'),
    supabase
      .from('tr_budgets')
      .select('id, client_id, hours_allocated, budget_amount, extra_budget, start_date, budget_end_date, extra_start_date, extra_end_date')
      .is('end_date', null),
    // internal_rate and monthly_salary are gone from this select: the
    // `authenticated` role can no longer read them (migration 054). They come
    // back from loadCompensationByPerson() below and get merged in by id.
    //
    // Still resilient in two tiers, because hire_date arrives with migration
    // 029 and selecting a missing column makes PostgREST drop the WHOLE query,
    // which used to render People & rates as "No people linked yet".
    (async () => {
      const WITH_HIRE = 'id, full_name, title, tsheets_user_id, tsheets_only, manager_id, hire_date, i7_projects, employment_type'
      const BASE = 'id, full_name, title, tsheets_user_id, tsheets_only, manager_id, i7_projects, employment_type'
      // Everybody active, not only the ones with a TSheets account. The tab
      // says "everyone who logs time on i7", and the query used to say
      // "everyone with a TSheets account". They agreed until the first
      // contractor whose hours are added by hand: no account, no row here, and
      // nowhere to put the rate their invoice is priced at.
      const withHire = await supabase.from('people').select(WITH_HIRE).eq('status', 'active').order('full_name')
      const active = withHire.error
        ? await supabase.from('people').select(BASE).eq('status', 'active').order('full_name')
        : withHire
      // And anyone inactive who still logged time since the rates began: their
      // hours are in the reports, so their rates have to be settable. Tina could
      // not give Kim and Lauren a break-even rate in September 2026 because the
      // tab listed only active people, and their cost counted as nothing.
      const inactive = (await withLoggedTime(supabase, WITH_HIRE, BASE)) as unknown as NonNullable<typeof active.data>
      return { ...active, data: [...(active.data ?? []), ...inactive] }
    })(),
    // Rates likewise: privileged read, merged back in below.
    (pay ? loadAssignmentRates({ activeOnly: true }) : Promise.resolve([] as Awaited<ReturnType<typeof loadAssignmentRates>>)).then(rows => ({
      data: rows.map(r => ({
        id: r.id, tsheets_user_id: r.tsheetsUserId, person_id: r.personId,
        client_id: r.clientId, hourly_rate: r.hourlyRate, effective_from: r.effectiveFrom ?? '',
      })),
    })),
    // The change history repeats the pay values it recorded, so it is a
    // privileged read for the same reason the columns are.
    loadAuditLog(100).then(data => ({ data })),
    supabase
      .from('people')
      .select('id, full_name, title')
      .is('tsheets_user_id', null)
      .eq('tsheets_only', false)
      .order('full_name'),
    supabase.from('team_members').select('person_id, team_id'),
    supabase.from('teams').select('id, name, color'),
    supabase.from('tr_project_budgets').select('client_id, project, hours_allocated').is('effective_to', null),
    supabase.from('i7_monthly_budget').select('month, budget_amount, extra_amount').order('month'),
    supabase.from('i7_project_month_hours').select('project, month, hours_allocated').order('month'),
    supabase.from('people').select('id, full_name'),
  ])

  // Name lookup for "report to" (managers may not be TSheets-linked).
  const nameById = new Map((allPeopleRaw ?? []).map(p => [p.id, p.full_name]))

  const monthlyBudgets = (monthlyRaw ?? []).map(r => ({
    month: String(r.month).slice(0, 7),
    budget: Number(r.budget_amount),
    extra: Number(r.extra_amount),
  }))
  const projectMonthHours = (projMonthRaw ?? []).map(r => ({
    project: r.project,
    month: String(r.month).slice(0, 7),
    hours: Number(r.hours_allocated),
  }))

  const projHoursByClient = new Map<number, Map<string, number>>()
  for (const pb of (projBudgetsRaw ?? [])) {
    const m = projHoursByClient.get(pb.client_id) ?? new Map<string, number>()
    m.set(pb.project, Number(pb.hours_allocated))
    projHoursByClient.set(pb.client_id, m)
  }

  const teamNameById = new Map((teamRows ?? []).map(t => [t.id, t.name]))
  // Each team's own colour (teams.color), for the team chip in Rates & Costs.
  const teamColorByName = new Map((teamRows ?? []).map(t => [t.name, (t as { color?: string | null }).color ?? null]))
  const teamsByPerson = new Map<string, string[]>()
  for (const m of (memberRows ?? [])) {
    const name = teamNameById.get(m.team_id)
    if (!name) continue
    const list = teamsByPerson.get(m.person_id) ?? []
    list.push(name)
    teamsByPerson.set(m.person_id, list)
  }

  const directoryOptions = (directoryRaw ?? []).map(p => ({ id: p.id, name: p.full_name, title: p.title ?? null }))

  const budgetMap = new Map((budgets ?? []).map(b => [b.client_id, b]))
  const clients: ClientWithBudget[] = (clientsRaw ?? []).map(c => {
    const b = budgetMap.get(c.id)
    const isI7 = /i7/i.test(c.name)
    const saved = projHoursByClient.get(c.id)
    const projectBudgets = isI7 ? I7_PROJECTS.map(p => ({ project: p, hours: saved?.get(p) ?? null })) : []
    return {
      id: c.id,
      name: c.name,
      active: c.active,
      budget: b
        ? {
            id: b.id,
            hoursAllocated: b.hours_allocated != null ? Number(b.hours_allocated) : null,
            budgetAmount: b.budget_amount != null ? Number(b.budget_amount) : null,
            extraBudget: Number(b.extra_budget ?? 0),
            startDate: b.start_date,
            budgetEndDate: b.budget_end_date,
            extraStartDate: b.extra_start_date,
            extraEndDate: b.extra_end_date,
          }
        : null,
      projectBudgets,
      monthlyBudgets: isI7 ? monthlyBudgets : undefined,
      projectMonthHours: isI7 ? projectMonthHours : undefined,
    }
  })

  const clientNameMap = new Map(clients.map(c => [c.id, c.name]))

  // Keyed by person. A rate whose TSheets account nobody has linked has no
  // person yet and is skipped rather than shown against a guess.
  const assignmentsByPerson = new Map<string, NonNullable<typeof assignments>[number][]>()
  for (const a of (assignments ?? [])) {
    if (!a.person_id) continue
    const list = assignmentsByPerson.get(a.person_id) ?? []
    list.push(a)
    assignmentsByPerson.set(a.person_id, list)
  }

  const people: PersonWithAssignments[] = (peopleRaw ?? []).map(p => {
    const managerId = (p as { manager_id?: string | null }).manager_id ?? null
    const teams = teamsByPerson.get(p.id) ?? []
    const pay = compensation.get(p.id)
    const internalRate = pay?.internalRate ?? null
    const monthlySalary = pay?.monthlySalary ?? null
    return {
      id: p.id,
      name: p.full_name,
      title: p.title ?? null,
      teams,
      teamName: teams[0] ?? null,
      teamColor: teams[0] ? teamColorByName.get(teams[0]) ?? null : null,
      managerName: managerId ? nameById.get(managerId) ?? null : null,
      managerTeam: managerId ? teamsByPerson.get(managerId)?.[0] ?? null : null,
      hireDate: (p as { hire_date?: string | null }).hire_date ?? null,
      employmentType: (p as { employment_type?: string | null }).employment_type ?? null,
      costRate: internalRate != null ? Number(internalRate) : null,
      beRate: pay?.beRate ?? null,
      monthlySalary: monthlySalary != null ? Number(monthlySalary) : null,
      projects: (p as { i7_projects?: string[] | null }).i7_projects ?? [],
      tsheetsUserId: (p.tsheets_user_id as number | null) ?? null,
      tsheetsOnly: p.tsheets_only ?? false,
      inactive: (p as { inactive?: boolean }).inactive === true,
      assignments: (assignmentsByPerson.get(p.id) ?? []).map(a => ({
        id: a.id,
        clientId: a.client_id,
        clientName: clientNameMap.get(a.client_id) ?? 'Unknown',
        hourlyRate: Number(a.hourly_rate),
        effectiveFrom: a.effective_from,
      })),
    }
  })

  // Resolve who changed each row (changed_by → profiles.full_name) and which
  // client it was (entity_id → client name for budget-family entities).
  const actorIds = [...new Set((auditRaw ?? []).filter(e => pay || BUDGET_ENTITIES.has(e.entity_type)).map(e => (e as { changed_by?: string | null }).changed_by).filter(Boolean))] as string[]
  const { data: actorProfiles } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const actorNameById = new Map((actorProfiles ?? []).map(p => [p.id, p.full_name]))

  // Without pay, only the budget entries: the others carry pay before and after.
  const auditVisible = (auditRaw ?? []).filter(e => pay || BUDGET_ENTITIES.has(e.entity_type))
  const auditLog: AuditEntry[] = auditVisible.map(e => {
    const changedBy = (e as { changed_by?: string | null }).changed_by ?? null
    return {
      id: e.id,
      entityType: e.entity_type,
      entityId: e.entity_id,
      action: e.action,
      beforeData: e.before_data as Record<string, unknown> | null,
      afterData: e.after_data as Record<string, unknown>,
      justification: e.justification,
      changedAt: e.changed_at,
      actorName: changedBy ? actorNameById.get(changedBy) ?? null : null,
      entityLabel: e.entity_type === 'person_cost' || e.entity_type === 'person_salary'
        ? ((e.after_data as { person_name?: string })?.person_name ?? null)
        : BUDGET_ENTITIES.has(e.entity_type) ? clientNameMap.get(e.entity_id) ?? null : null,
    }
  })

  return {
    clients,
    people,
    auditLog,
    directoryOptions: directoryOptions as DirectoryOption[],
    syncedAt,
    // action is insert, update or delete by the column's CHECK constraint.
  }
}

/**
 * Inactive people with at least one time entry since the rates began
 * (RANGE_FLOOR), for the Rates & Costs tab. Marked `inactive: true`.
 *
 * The existence check reads tc_entries with the privileged client: the time
 * clock's own rule would show an admin only the hours they approve, and this
 * asks "did this person log anything", not "what may I see".
 */
async function withLoggedTime(
  supabase: Awaited<ReturnType<typeof createClient>>,
  withHire: string,
  base: string,
): Promise<Record<string, unknown>[]> {
  let res = await supabase.from('people').select(withHire).eq('status', 'inactive').order('full_name')
  if (res.error) res = await supabase.from('people').select(base).eq('status', 'inactive').order('full_name')
  const rows = (res.data ?? []) as unknown as ({ id: string } & Record<string, unknown>)[]
  if (!rows.length) return []
  const { data: logged } = await createAdminClient()
    .from('tc_entries').select('person_id')
    .in('person_id', rows.map(r => r.id))
    .gte('entry_date', `${RANGE_FLOOR}-01`)
    .limit(20000)
  const ids = new Set(((logged ?? []) as { person_id: string }[]).map(r => r.person_id))
  return rows.filter(r => ids.has(r.id)).map(r => ({ ...r, inactive: true }))
}
