import { createClient } from '@/lib/supabase/server'
import { SettingsTabs } from '@/components/tsheets/settings/SettingsTabs'
import type { ClientWithBudget } from '@/components/tsheets/settings/ClientsTab'
import type { PersonWithAssignments } from '@/components/tsheets/settings/PeopleTab'
import type { AuditEntry } from '@/components/tsheets/settings/HistoryTab'

export default async function TimeReportSettingsPage() {
  const supabase = await createClient()

  const [
    { data: clientsRaw },
    { data: budgets },
    { data: peopleRaw },
    { data: assignments },
    { data: auditRaw },
  ] = await Promise.all([
    supabase
      .from('tr_clients')
      .select('id, name, active')
      .order('name'),
    supabase
      .from('tr_budgets')
      .select('id, client_id, hours_allocated, budget_amount, extra_budget, start_date, budget_end_date, extra_start_date, extra_end_date')
      .is('end_date', null),
    supabase
      .from('people')
      .select('id, full_name, tsheets_user_id, tsheets_only')
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
  ])

  // Build client list with their active budget
  const budgetMap = new Map(
    (budgets ?? []).map(b => [b.client_id, b])
  )
  const clients: ClientWithBudget[] = (clientsRaw ?? []).map(c => {
    const b = budgetMap.get(c.id)
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
    }
  })

  // Build client name map for assignment display
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
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <a href="/" className="hover:text-slate-800">Dashboard</a>
          <span>/</span>
          <a href="/tools" className="hover:text-slate-800">Tools</a>
          <span>/</span>
          <a href="/tools/time-report" className="hover:text-slate-800">Time Report</a>
          <span>/</span>
          <span>Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Time Report Settings</h1>
        <p className="mt-1 text-slate-500">
          Manage clients, hourly rates, and budget allocations. Every change requires a justification and is recorded in the audit log.
        </p>
      </div>

      <SettingsTabs clients={clients} people={people} auditLog={auditLog} />
    </div>
  )
}
