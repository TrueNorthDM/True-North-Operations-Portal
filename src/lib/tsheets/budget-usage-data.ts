// Data loader for the Budget Usage Report settings (clients & budgets, people &
// rates, change history, publishing targets). Extracted from the old
// BudgetUsageSettings component so the Settings page can compose these into its
// own left-nav sections.

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/role'
import { I7_PROJECTS } from '@/lib/tsheets/i7report'
import type { ClientWithBudget } from '@/components/tsheets/settings/ClientsTab'
import type { PersonWithAssignments, DirectoryOption } from '@/components/tsheets/settings/PeopleTab'
import type { AuditEntry } from '@/components/tsheets/settings/HistoryTab'
import type { MonthlyBudget } from '@/components/tsheets/settings/MonthlyBudgetGrid'
import type { ProjectMonthHours } from '@/components/tsheets/settings/ProjectHoursGrid'
import type { PublishingTargetRow, AuditLogRow } from '@/lib/types/database.types'

export interface BudgetUsageData {
  clients: ClientWithBudget[]
  people: PersonWithAssignments[]
  auditLog: AuditEntry[]
  directoryOptions: DirectoryOption[]
  syncedAt: string | null
  canSync: boolean
  pastBudgets: MonthlyBudget[]
  pastProjectHours: ProjectMonthHours[]
  publishingTargets: PublishingTargetRow[]
  publishingAudit: AuditLogRow[]
}

export async function getBudgetUsageData(): Promise<BudgetUsageData> {
  const supabase = await createClient()

  const profile = await getCurrentProfile()
  const isAdmin = profile?.role === 'admin'
  const { data: appSettings } = await supabase
    .from('app_settings')
    .select('tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()
  const syncedAt = appSettings?.tsheets_synced_at ?? null

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
  ] = await Promise.all([
    supabase.from('tr_clients').select('id, name, active').is('parent_id', null).order('name'),
    supabase
      .from('tr_budgets')
      .select('id, client_id, hours_allocated, budget_amount, extra_budget, start_date, budget_end_date, extra_start_date, extra_end_date')
      .is('end_date', null),
    supabase
      .from('people')
      .select('id, full_name, title, tsheets_user_id, tsheets_only')
      .not('tsheets_user_id', 'is', null)
      .order('full_name'),
    supabase
      .from('tr_assignments')
      .select('id, tsheets_user_id, client_id, hourly_rate, effective_from')
      .is('effective_to', null)
      .eq('active', true),
    supabase
      .from('tr_audit_log')
      .select('id, entity_type, entity_id, action, before_data, after_data, justification, changed_at, changed_by')
      .order('changed_at', { ascending: false })
      .limit(100),
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
  ])

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

  const assignmentsByUser = new Map<number, NonNullable<typeof assignments>[number][]>()
  for (const a of (assignments ?? [])) {
    const list = assignmentsByUser.get(a.tsheets_user_id) ?? []
    list.push(a)
    assignmentsByUser.set(a.tsheets_user_id, list)
  }

  const people: PersonWithAssignments[] = (peopleRaw ?? []).map(p => ({
    id: p.id,
    name: p.full_name,
    title: p.title ?? null,
    teams: teamsByPerson.get(p.id) ?? [],
    tsheetsUserId: p.tsheets_user_id as number,
    tsheetsOnly: p.tsheets_only ?? false,
    assignments: (assignmentsByUser.get(p.tsheets_user_id as number) ?? []).map(a => ({
      id: a.id,
      clientId: a.client_id,
      clientName: clientNameMap.get(a.client_id) ?? 'Unknown',
      hourlyRate: Number(a.hourly_rate),
      effectiveFrom: a.effective_from,
    })),
  }))

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
      entityLabel: BUDGET_ENTITIES.has(e.entity_type) ? clientNameMap.get(e.entity_id) ?? null : null,
    }
  })

  return {
    clients,
    people,
    auditLog,
    directoryOptions: directoryOptions as DirectoryOption[],
    syncedAt,
    canSync: isAdmin,
    pastBudgets: monthlyBudgets,
    pastProjectHours: projectMonthHours,
    publishingTargets: pubTargetsRaw ?? [],
    publishingAudit: pubAuditRaw ?? [],
  }
}
