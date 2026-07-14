'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { currentYearMonth } from '@/lib/tsheets/report'
import { requireAdmin } from '@/lib/tsheets/require-admin'

// TSheets sync actions live in ./sync-actions.ts (audit M5-2).

// ─── Budget ──────────────────────────────────────────────────────────────────

export async function saveTrBudget(input: {
  clientId: number
  hoursAllocated: number | null
  budgetAmount: number | null
  budgetStartDate: string          // YYYY-MM-DD (first of month) — required
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
// months are locked — only the current month and future can change — and every
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
  revalidatePath('/tools/time-report')
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
  revalidatePath('/tools/time-report')
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
  revalidatePath('/tools/time-report')
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

export async function saveTrAssignment(input: {
  tsheetsUserId: number
  clientId: number
  hourlyRate: number
  effectiveFrom: string  // YYYY-MM-DD
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Close current active assignment
  const { data: current } = await supabase
    .from('tr_assignments')
    .select('*')
    .eq('tsheets_user_id', input.tsheetsUserId)
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

// Internal cost per hour (people.internal_rate) — one value per person, shared
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

  const { data: before } = await supabase
    .from('people')
    .select('id, full_name, internal_rate')
    .eq('id', input.personId)
    .maybeSingle()
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
    before_data: { person_name: before.full_name, cost_rate: before.internal_rate },
    after_data: { person_name: before.full_name, cost_rate: input.costRate },
    justification: input.justification,
    changed_by: user?.id,
  })

  revalidatePath('/settings')
  return { ok: true }
}

export async function deactivateTrAssignment(input: {
  tsheetsUserId: number
  clientId: number
  effectiveFrom: string
  justification: string
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: current } = await supabase
    .from('tr_assignments')
    .select('*')
    .eq('tsheets_user_id', input.tsheetsUserId)
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
