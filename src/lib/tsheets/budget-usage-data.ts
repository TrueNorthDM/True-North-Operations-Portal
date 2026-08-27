// Data loader for the Budget Usage Report settings (clients & budgets, people &
// rates, change history, publishing targets). Extracted from the old
// BudgetUsageSettings component so the Settings page can compose these into its
// own left-nav sections.

import { createClient } from '@/lib/supabase/server'
import { getTsheetsStatus } from '@/lib/tsheets/status'
import { loadCompensationByPerson, loadAssignmentRates, loadAuditLog } from '@/lib/hr/compensation'
import { getCurrentProfile } from '@/lib/auth/role'
import { I7_PROJECTS } from '@/lib/tsheets/i7report'
import type { ClientWithBudget } from '@/components/tsheets/settings/ClientsTab'
import type { PersonWithAssignments, DirectoryOption } from '@/components/tsheets/settings/PeopleTab'
import type { AuditEntry } from '@/components/tsheets/settings/HistoryTab'
import type { PublishingTargetRow, AuditLogRow } from '@/lib/types/database.types'

export interface BudgetUsageData {
  clients: ClientWithBudget[]
  people: PersonWithAssignments[]
  auditLog: AuditEntry[]
  directoryOptions: DirectoryOption[]
  syncedAt: string | null
  canSync: boolean
  publishingTargets: PublishingTargetRow[]
  publishingAudit: AuditLogRow[]
}

export async function getBudgetUsageData(): Promise<BudgetUsageData> {
  const supabase = await createClient()

  const profile = await getCurrentProfile()
  const isAdmin = profile?.role === 'admin'
  // This function also feeds /directory, which is not admin-only, so the
  // timestamp comes from the narrow reader rather than the user's client.
  // That is what lets app_settings be admin-only (migration 052).
  const { syncedAt } = await getTsheetsStatus()
  // Pay per person, read privileged and merged in below (migration 054).
  const compensation = await loadCompensationByPerson()

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
    { data: pubTargetsRaw },
    { data: pubAuditRaw },
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
      const WITH_HIRE = 'id, full_name, title, tsheets_user_id, tsheets_only, manager_id, hire_date, i7_projects'
      const BASE = 'id, full_name, title, tsheets_user_id, tsheets_only, manager_id, i7_projects'
      // Everybody active, not only the ones with a TSheets account. The tab
      // says "everyone who logs time on i7", and the query used to say
      // "everyone with a TSheets account". They agreed until the first
      // contractor whose hours are added by hand: no account, no row here, and
      // nowhere to put the rate their invoice is priced at.
      const withHire = await supabase.from('people').select(WITH_HIRE).eq('status', 'active').order('full_name')
      return withHire.error
        ? await supabase.from('people').select(BASE).eq('status', 'active').order('full_name')
        : withHire
    })(),
    // Rates likewise: privileged read, merged back in below.
    loadAssignmentRates({ activeOnly: true }).then(rows => ({
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
    supabase.from('teams').select('id, name'),
    supabase.from('tr_project_budgets').select('client_id, project, hours_allocated').is('effective_to', null),
    supabase.from('i7_monthly_budget').select('month, budget_amount, extra_amount').order('month'),
    supabase.from('i7_project_month_hours').select('project, month, hours_allocated').order('month'),
    supabase.from('publishing_targets').select('*').eq('period_type', 'weekly').order('board_short', { ascending: true }).order('language', { ascending: true }),
    supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(30),
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
      managerName: managerId ? nameById.get(managerId) ?? null : null,
      managerTeam: managerId ? teamsByPerson.get(managerId)?.[0] ?? null : null,
      hireDate: (p as { hire_date?: string | null }).hire_date ?? null,
      costRate: internalRate != null ? Number(internalRate) : null,
      monthlySalary: monthlySalary != null ? Number(monthlySalary) : null,
      projects: (p as { i7_projects?: string[] | null }).i7_projects ?? [],
      tsheetsUserId: (p.tsheets_user_id as number | null) ?? null,
      tsheetsOnly: p.tsheets_only ?? false,
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
  const actorIds = [...new Set((auditRaw ?? []).map(e => (e as { changed_by?: string | null }).changed_by).filter(Boolean))] as string[]
  const { data: actorProfiles } = actorIds.length
    ? await supabase.from('profiles').select('id, full_name').in('id', actorIds)
    : { data: [] as { id: string; full_name: string | null }[] }
  const actorNameById = new Map((actorProfiles ?? []).map(p => [p.id, p.full_name]))
  const BUDGET_ENTITIES = new Set(['budget', 'monthly_budget', 'project_budget', 'project_month_hours', 'budget_history'])

  const auditLog: AuditEntry[] = (auditRaw ?? []).map(e => {
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
    canSync: isAdmin,
    publishingTargets: pubTargetsRaw ?? [],
    publishingAudit: pubAuditRaw ?? [],
  }
}
