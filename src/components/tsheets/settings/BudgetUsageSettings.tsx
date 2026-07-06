// Budget Usage Report settings — clients & budgets, people & rates, and the
// change history. Rendered as a section of the general Settings page (it used
// to be its own page under the tool).

import { createClient } from '@/lib/supabase/server'
import { getCurrentProfile } from '@/lib/auth/role'
import { I7_PROJECTS } from '@/lib/tsheets/i7report'
import { SettingsTabs } from './SettingsTabs'
import type { ClientWithBudget } from './ClientsTab'
import type { PersonWithAssignments } from './PeopleTab'
import type { AuditEntry } from './HistoryTab'

export async function BudgetUsageSettings() {
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
  ] = await Promise.all([
    // Only real clients (top-level job codes) — children like "Content"/"SEO"
    // are activities, not clients you budget or bill against.
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
      .select('id, entity_type, entity_id, action, before_data, after_data, justification, changed_at')
      .order('changed_at', { ascending: false })
      .limit(100),
    // Directory people not yet linked to TSheets — offered as merge targets.
    supabase
      .from('people')
      .select('id, full_name, title')
      .is('tsheets_user_id', null)
      .eq('tsheets_only', false)
      .order('full_name'),
    supabase.from('team_members').select('person_id, team_id'),
    supabase.from('teams').select('id, name'),
    supabase.from('tr_project_budgets').select('client_id, project, hours_allocated').is('effective_to', null),
  ])

  // clientId → project → budgeted hours
  const projHoursByClient = new Map<number, Map<string, number>>()
  for (const pb of (projBudgetsRaw ?? [])) {
    const m = projHoursByClient.get(pb.client_id) ?? new Map<string, number>()
    m.set(pb.project, Number(pb.hours_allocated))
    projHoursByClient.set(pb.client_id, m)
  }

  // personId → [team names]
  const teamNameById = new Map((teamRows ?? []).map(t => [t.id, t.name]))
  const teamsByPerson = new Map<string, string[]>()
  for (const m of (memberRows ?? [])) {
    const name = teamNameById.get(m.team_id)
    if (!name) continue
    const list = teamsByPerson.get(m.person_id) ?? []
    list.push(name)
    teamsByPerson.set(m.person_id, list)
  }

  const directoryOptions = (directoryRaw ?? []).map(p => ({
    id: p.id,
    name: p.full_name,
    title: p.title ?? null,
  }))

  // Build client list with their active budget
  const budgetMap = new Map((budgets ?? []).map(b => [b.client_id, b]))
  const clients: ClientWithBudget[] = (clientsRaw ?? []).map(c => {
    const b = budgetMap.get(c.id)
    // Only the i7 client is broken into projects (matched by name).
    const isI7 = /i7/i.test(c.name)
    const saved = projHoursByClient.get(c.id)
    const projectBudgets = isI7
      ? I7_PROJECTS.map(p => ({ project: p, hours: saved?.get(p) ?? null }))
      : []
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
    }
  })

  const clientNameMap = new Map(clients.map(c => [c.id, c.name]))

  // Group assignments by tsheets_user_id
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

  const auditLog: AuditEntry[] = (auditRaw ?? []).map(e => ({
    id: e.id,
    entityType: e.entity_type,
    entityId: e.entity_id,
    action: e.action,
    beforeData: e.before_data as Record<string, unknown> | null,
    afterData: e.after_data as Record<string, unknown>,
    justification: e.justification,
    changedAt: e.changed_at,
  }))

  return (
    <div>
      <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-1">Budget Usage Report</h2>
      <p className="text-xs text-slate-400 mb-3">
        Manage clients, hourly rates, and budget allocations. Every change requires a justification and is recorded in the audit log.
      </p>
      <SettingsTabs clients={clients} people={people} auditLog={auditLog} directoryOptions={directoryOptions} syncedAt={syncedAt} canSync={isAdmin} />
    </div>
  )
}
