'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { currentYearMonth } from '@/lib/tsheets/report'
import { requireAdmin } from '@/lib/tsheets/require-admin'
import { loadPersonCompensation } from '@/lib/hr/compensation'

// TSheets sync actions live in ./sync-actions.ts (audit M5-2).

// ─── Budget ──────────────────────────────────────────────────────────────────

export async function saveTrBudget(input: {
  clientId: number
  hoursAllocated: number | null
  budgetAmount: number | null
  budgetStartDate: string          // YYYY-MM-DD (first of month), required
  budgetEndDate: string | null     // YYYY-MM-DD or null (ongoing)
  extraBudget: number
  extraStartDate: string | null    // required when extraBudget > 0
  extraEndDate: string | null      // YYYY-MM-DD or null (ongoing)
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  // Server-side guards (mirror the form rules so a bad payload can't slip through)
  if (!input.budgetStartDate) return { ok: false, error: 'Budget start date is required.' }
  if (input.extraBudget > 0 && !input.extraStartDate) {
    return { ok: false, error: 'Extra budget start date is required when an extra budget is set.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Close the current active budget for this client
  const { data: current } = await supabase
    .from('tr_budgets')
    .select('*')
    .eq('client_id', input.clientId)
    .is('end_date', null)
    .maybeSingle()

  if (current) {
    const endDate = new Date(input.budgetStartDate)
    endDate.setDate(endDate.getDate() - 1)
    const { error } = await supabase
      .from('tr_budgets')
      .update({ end_date: endDate.toISOString().slice(0, 10) })
      .eq('id', current.id)
    if (error) return { ok: false, error: error.message }
  }

  // Insert new budget. Extra dates are only stored when there's an extra amount.
  const hasExtra = input.extraBudget > 0
  const { data: inserted, error: insertErr } = await supabase
    .from('tr_budgets')
    .insert({
      client_id: input.clientId,
      hours_allocated: input.hoursAllocated,
      budget_amount: input.budgetAmount,
      extra_budget: input.extraBudget,
      start_date: input.budgetStartDate,
      budget_end_date: input.budgetEndDate,
      extra_start_date: hasExtra ? input.extraStartDate : null,
      extra_end_date: hasExtra ? input.extraEndDate : null,
      justification: input.justification,
      created_by: user?.id,
    })
    .select()
    .single()
  if (insertErr) return { ok: false, error: insertErr.message }

  // Audit log
  await supabase.from('tr_audit_log').insert({
    entity_type: 'budget',
    entity_id: inserted.id,
    action: current ? 'update' : 'create',
    before_data: current ?? null,
    after_data: inserted,
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  return { ok: true }
}

// ─── Monthly budget schedule (the report's source of truth) ──────────────────
// Writes the per-month $ budget the i7 report reads (i7_monthly_budget). Past
// months are locked (only the current month and future can change) and every
// save records one audit entry summarising the months it touched.
export async function saveMonthlyBudgets(input: {
  changes: { month: string; budgetAmount: number; extraAmount: number }[]  // month = 'YYYY-MM'
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }
  if (!input.changes.length) return { ok: false, error: 'No changes to save.' }
  if (input.justification.trim().length < 10) return { ok: false, error: 'A justification (10+ chars) is required.' }

  const nowYm = currentYearMonth()
  for (const c of input.changes) {
    if (c.month < nowYm) return { ok: false, error: `Past months can't be changed (${c.month}).` }
    if (c.budgetAmount < 0 || c.extraAmount < 0) return { ok: false, error: 'Amounts must be 0 or more.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Previous values (for the audit before/after)
  const monthKeys = input.changes.map(c => `${c.month}-01`)
  const { data: existing } = await supabase
    .from('i7_monthly_budget')
    .select('month, budget_amount, extra_amount')
    .in('month', monthKeys)
  const prev = new Map((existing ?? []).map(r => [String(r.month).slice(0, 7), r]))

  const before: { month: string; budget_amount: number | null; extra_amount: number | null }[] = []
  const after: { month: string; budget_amount: number; extra_amount: number }[] = []

  for (const c of input.changes) {
    const p = prev.get(c.month)
    before.push({ month: c.month, budget_amount: p ? Number(p.budget_amount) : null, extra_amount: p ? Number(p.extra_amount) : null })
    after.push({ month: c.month, budget_amount: c.budgetAmount, extra_amount: c.extraAmount })
    const { error } = await supabase
      .from('i7_monthly_budget')
      .upsert(
        { month: `${c.month}-01`, budget_amount: c.budgetAmount, extra_amount: c.extraAmount, justification: input.justification, created_by: user?.id },
        { onConflict: 'month' },
      )
    if (error) return { ok: false, error: error.message }
  }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'monthly_budget',
    entity_id: 0,
    action: 'update',
    before_data: { months: before },
    after_data: { months: after },
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  revalidatePath('/work-tools/time-report')
  return { ok: true }
}

// ─── Per-month report narrative (shown on the report + in the PDF) ───────────
export async function saveReportNote(input: { month: string; note: string }): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase
    .from('i7_report_notes')
    .upsert({ month: `${input.month}-01`, note: input.note, updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: 'month' })
  if (error) return { ok: false, error: error.message }
  revalidatePath('/work-tools/time-report')
  return { ok: true }
}

// ─── Per-month project hours (the report's Budget-hrs guide, per month) ──────
// Writes the project × month hours the report reads (i7_project_month_hours).
// Same rules as the monthly budget: past months are locked, one audit entry.
export async function saveProjectMonthHours(input: {
  clientId: number
  changes: { project: string; month: string; hours: number }[]  // month = 'YYYY-MM'
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }
  if (!input.changes.length) return { ok: false, error: 'No changes to save.' }
  if (input.justification.trim().length < 10) return { ok: false, error: 'A justification (10+ chars) is required.' }

  const nowYm = currentYearMonth()
  for (const c of input.changes) {
    if (c.month < nowYm) return { ok: false, error: `Past months can't be changed (${c.month}).` }
    if (c.hours < 0) return { ok: false, error: 'Hours must be 0 or more.' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: existing } = await supabase
    .from('i7_project_month_hours')
    .select('project, month, hours_allocated')
    .eq('client_id', input.clientId)
    .in('month', input.changes.map(c => `${c.month}-01`))
  const prev = new Map((existing ?? []).map(r => [`${r.project}|${String(r.month).slice(0, 7)}`, Number(r.hours_allocated)]))

  const before: { project: string; month: string; hours: number | null }[] = []
  const after: { project: string; month: string; hours: number }[] = []
  for (const c of input.changes) {
    before.push({ project: c.project, month: c.month, hours: prev.get(`${c.project}|${c.month}`) ?? null })
    after.push({ project: c.project, month: c.month, hours: c.hours })
    const { error } = await supabase
      .from('i7_project_month_hours')
      .upsert(
        { client_id: input.clientId, project: c.project, month: `${c.month}-01`, hours_allocated: c.hours, justification: input.justification, created_by: user?.id },
        { onConflict: 'client_id,project,month' },
      )
    if (error) return { ok: false, error: error.message }
  }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'project_month_hours',
    entity_id: input.clientId,
    action: 'update',
    before_data: { hours: before },
    after_data: { hours: after },
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  revalidatePath('/work-tools/time-report')
  return { ok: true }
}

// ─── Project budget hours (the guide, one level below the client $ budget) ────

export async function saveProjectBudget(input: {
  clientId: number
  project: string
  hoursAllocated: number
  effectiveFrom: string   // YYYY-MM-DD (first of month)
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Close the current active hours for this project
  const { data: current } = await supabase
    .from('tr_project_budgets')
    .select('*')
    .eq('client_id', input.clientId)
    .eq('project', input.project)
    .is('effective_to', null)
    .maybeSingle()

  if (current) {
    const closeDate = new Date(input.effectiveFrom)
    closeDate.setDate(closeDate.getDate() - 1)
    const { error } = await supabase
      .from('tr_project_budgets')
      .update({ effective_to: closeDate.toISOString().slice(0, 10) })
      .eq('id', current.id)
    if (error) return { ok: false, error: error.message }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('tr_project_budgets')
    .insert({
      client_id: input.clientId,
      project: input.project,
      hours_allocated: input.hoursAllocated,
      effective_from: input.effectiveFrom,
      justification: input.justification,
      created_by: user?.id,
    })
    .select()
    .single()
  if (insertErr) return { ok: false, error: insertErr.message }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'project_budget',
    entity_id: inserted.id,
    action: current ? 'update' : 'create',
    before_data: current ?? null,
    after_data: inserted,
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  return { ok: true }
}

// ─── Assignment (rate history) ────────────────────────────────────────────────

/**
 * Set somebody's billing rate.
 *
 * Keyed by the person. tsheetsUserId is still written when there is one, for
 * the sync and for anything that has not moved over yet, but it stopped being
 * the identity: a contractor with no TSheets account bills hours too, and had
 * nowhere to keep the rate their invoice is priced at.
 */
export async function saveTrAssignment(input: {
  personId: string
  tsheetsUserId: number | null
  clientId: number
  hourlyRate: number
  effectiveFrom: string  // YYYY-MM-DD
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()

  // The rate table goes through the privileged client, the way every other
  // reader of it already does. Migration 054 revoked SELECT on the table from
  // `authenticated` and re-granted a fixed list of columns, so a session
  // client cannot read hourly_rate at all, and cannot read person_id either
  // because that column did not exist when the list was written. This is
  // still admin-only: requireAdmin above is the gate, not the grant.
  const supabase = createAdminClient()

  // Close current active assignment
  const { data: current } = await supabase
    .from('tr_assignments')
    .select('*')
    .eq('person_id', input.personId)
    .eq('client_id', input.clientId)
    .is('effective_to', null)
    .eq('active', true)
    .maybeSingle()

  if (current) {
    const closeDate = new Date(input.effectiveFrom)
    closeDate.setDate(closeDate.getDate() - 1)
    const { error } = await supabase
      .from('tr_assignments')
      .update({ effective_to: closeDate.toISOString().slice(0, 10) })
      .eq('id', current.id)
    if (error) return { ok: false, error: error.message }
  }

  // Insert new assignment
  const { data: inserted, error: insertErr } = await supabase
    .from('tr_assignments')
    .insert({
      person_id: input.personId,
      tsheets_user_id: input.tsheetsUserId,
      client_id: input.clientId,
      hourly_rate: input.hourlyRate,
      active: true,
      effective_from: input.effectiveFrom,
      justification: input.justification,
      created_by: user?.id,
    })
    .select()
    .single()
  if (insertErr) return { ok: false, error: insertErr.message }

  // Audit log
  await supabase.from('tr_audit_log').insert({
    entity_type: 'assignment',
    entity_id: inserted.id,
    action: current ? 'update' : 'create',
    before_data: current ?? null,
    after_data: inserted,
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  return { ok: true }
}

// Internal cost per hour (people.internal_rate), one value per person, shared
// with the Directory. Justified + audited, like the client rate.
export async function savePersonCostRate(input: {
  personId: string
  costRate: number
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // internal_rate is unreadable by the `authenticated` role (migration 054),
  // so the audit "before" snapshot comes through the privileged reader.
  const before = await loadPersonCompensation(input.personId)
  if (!before) return { ok: false, error: 'Person not found.' }

  const { error: updErr } = await supabase
    .from('people')
    .update({ internal_rate: input.costRate })
    .eq('id', input.personId)
  if (updErr) return { ok: false, error: updErr.message }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'person_cost',
    entity_id: 0, // person is keyed by UUID; the name lives in after_data
    action: 'update',
    before_data: { person_name: before.fullName, cost_rate: before.internalRate },
    after_data: { person_name: before.fullName, cost_rate: input.costRate },
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  return { ok: true }
}

// Break-even rate (people.be_rate): what an hour has to earn to cover somebody,
// overhead included. A third figure beside the client rate and the cost rate,
// answering a third question. Justified + audited like the other two.
export async function savePersonBeRate(input: {
  personId: string
  beRate: number
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Read through the privileged reader, like the cost rate: be_rate is excluded
  // from the `authenticated` column grant for the same reason it is.
  const before = await loadPersonCompensation(input.personId)
  if (!before) return { ok: false, error: 'Person not found.' }

  const { error: updErr } = await supabase
    .from('people')
    .update({ be_rate: input.beRate })
    .eq('id', input.personId)
  if (updErr) return { ok: false, error: updErr.message }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'person_be_rate',
    entity_id: 0,
    action: 'update',
    before_data: { person_name: before.fullName, be_rate: before.beRate },
    after_data: { person_name: before.fullName, be_rate: input.beRate },
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  revalidatePath('/directory')
  return { ok: true }
}

// Fixed monthly cost (people.monthly_salary), for staff paid a flat amount per
// month rather than by the hour. One value per person, justified + audited like
// the cost rate. Edited in the Directory's Rates & Costs tab.
export async function savePersonMonthlySalary(input: {
  personId: string
  monthlySalary: number
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Same as savePersonCostRate: the old value is a privileged read now.
  const before = await loadPersonCompensation(input.personId)
  if (!before) return { ok: false, error: 'Person not found.' }

  const { error: updErr } = await supabase
    .from('people')
    .update({ monthly_salary: input.monthlySalary })
    .eq('id', input.personId)
  if (updErr) return { ok: false, error: updErr.message }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'person_salary',
    entity_id: 0, // person is keyed by UUID; the name lives in after_data
    action: 'update',
    before_data: { person_name: before.fullName, monthly_salary: before.monthlySalary },
    after_data: { person_name: before.fullName, monthly_salary: input.monthlySalary },
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/directory')
  revalidatePath('/settings')
  return { ok: true }
}

// The i7 projects a person works on (the budget roster). Drives each project's
// average billing rate. Light-touch: no justification modal, but still audited.
export async function savePersonProjects(input: {
  personId: string
  projects: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: before } = await supabase
    .from('people')
    .select('id, full_name, i7_projects')
    .eq('id', input.personId)
    .maybeSingle()
  if (!before) return { ok: false, error: 'Person not found.' }

  const projects = [...new Set(input.projects)].sort()
  const { error: updErr } = await supabase
    .from('people')
    .update({ i7_projects: projects })
    .eq('id', input.personId)
  if (updErr) return { ok: false, error: updErr.message }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'person_projects',
    entity_id: 0,
    action: 'update',
    before_data: { person_name: before.full_name, projects: (before as { i7_projects?: string[] }).i7_projects ?? [] },
    after_data: { person_name: before.full_name, projects },
    justification: 'Project assignment updated',
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  return { ok: true }
}

// Project-side roster editing (Clients, Projects & Job Codes tab): set exactly
// which people work on ONE project. Reconciles people.i7_projects across the
// whole roster, adds the project to the chosen people, removes it from the rest.
// Same array the budget's average rate reads. Light-touch, still audited.
export async function saveProjectRoster(input: {
  project: string
  personIds: string[]
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: people, error } = await supabase
    .from('people')
    .select('id, full_name, i7_projects')
    .not('tsheets_user_id', 'is', null)
  if (error) return { ok: false, error: error.message }

  const chosen = new Set(input.personIds)
  const assignedNames: string[] = []
  for (const p of people ?? []) {
    const current = ((p as { i7_projects?: string[] | null }).i7_projects) ?? []
    const has = current.includes(input.project)
    const should = chosen.has(p.id as string)
    if (should) assignedNames.push(p.full_name as string)
    if (has === should) continue
    const next = should
      ? [...new Set([...current, input.project])].sort()
      : current.filter(x => x !== input.project)
    const { error: updErr } = await supabase.from('people').update({ i7_projects: next }).eq('id', p.id)
    if (updErr) return { ok: false, error: updErr.message }
  }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'project_roster',
    entity_id: 0,
    action: 'update',
    before_data: null,
    after_data: { project: input.project, people: assignedNames.sort() },
    justification: 'Project roster updated',
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  return { ok: true }
}

export async function deactivateTrAssignment(input: {
  personId: string
  clientId: number
  effectiveFrom: string
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()

  // Same table, same reason as saveTrAssignment above.
  const supabase = createAdminClient()

  const { data: current } = await supabase
    .from('tr_assignments')
    .select('*')
    .eq('person_id', input.personId)
    .eq('client_id', input.clientId)
    .is('effective_to', null)
    .eq('active', true)
    .maybeSingle()

  if (!current) return { ok: false, error: 'No active assignment found.' }

  const closeDate = new Date(input.effectiveFrom)
  closeDate.setDate(closeDate.getDate() - 1)
  const { error } = await supabase
    .from('tr_assignments')
    .update({ effective_to: closeDate.toISOString().slice(0, 10), active: false })
    .eq('id', current.id)
  if (error) return { ok: false, error: error.message }

  await supabase.from('tr_audit_log').insert({
    entity_type: 'assignment',
    entity_id: current.id,
    action: 'deactivate',
    before_data: current,
    after_data: { ...current, effective_to: closeDate.toISOString().slice(0, 10), active: false },
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  return { ok: true }
}
