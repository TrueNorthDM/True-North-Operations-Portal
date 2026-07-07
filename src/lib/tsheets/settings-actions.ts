'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { syncClientsCore, syncPeopleCore, syncTimesheetsCore } from '@/lib/tsheets/sync'
import { currentYearMonth } from '@/lib/tsheets/report'

// Writes to people / tr_* go through the signed-in user's session and are
// gated by RLS (is_admin). Guard here too so a non-admin gets a clear message
// instead of a silent RLS rejection that the UI would otherwise report as
// success.
async function requireAdmin(): Promise<string | null> {
  return (await isCurrentUserAdmin()) ? null : 'You must be an admin to run this.'
}

// ─── Sync job codes from TSheets into tr_clients ────────────────────────────

export async function syncTrClients(token: string): Promise<{ ok: boolean; count: number; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, count: 0, error: notAdmin }

  const supabase = await createClient()
  const result = await syncClientsCore(supabase, token)
  if (result.ok) revalidatePath('/settings')
  return result
}

// ─── Sync TSheets users into the people directory ───────────────────────────

export async function syncPeopleFromTsheets(token: string): Promise<{
  ok: boolean
  linked: number
  imported: number
  error?: string
}> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, linked: 0, imported: 0, error: notAdmin }

  const supabase = await createClient()
  const result = await syncPeopleCore(supabase, token)
  if (result.ok) revalidatePath('/settings')
  return result
}

// ─── Manually link a TSheets-only import to an existing directory person ─────

export async function linkTsheetsPersonToDirectory(input: {
  tsheetsOnlyPersonId: string   // people.id of the imported (tsheets_only) row
  directoryPersonId: string     // people.id of the real directory person
}): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()

  // Read the TSheets link off the imported row.
  const { data: src, error: srcErr } = await supabase
    .from('people')
    .select('id, tsheets_user_id')
    .eq('id', input.tsheetsOnlyPersonId)
    .maybeSingle()
  if (srcErr) return { ok: false, error: srcErr.message }
  if (!src || src.tsheets_user_id == null) return { ok: false, error: 'That person has no TSheets link to move.' }

  // Delete the import first to free the unique tsheets_user_id, then assign it
  // to the real person. Rates (keyed by tsheets_user_id) follow automatically.
  const { error: delErr } = await supabase.from('people').delete().eq('id', input.tsheetsOnlyPersonId)
  if (delErr) return { ok: false, error: delErr.message }

  const { error: updErr } = await supabase
    .from('people')
    .update({ tsheets_user_id: src.tsheets_user_id })
    .eq('id', input.directoryPersonId)
  if (updErr) return { ok: false, error: updErr.message }

  revalidatePath('/settings')
  revalidatePath('/admin/people')
  revalidatePath('/')
  return { ok: true }
}

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

// ─── Portal-level sync wrappers (read token from DB — never exposed to browser) ─

export async function syncClientsFromPortal(): Promise<{ ok: boolean; count: number; error?: string }> {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()
  if (!settings?.tsheets_api_token) {
    return { ok: false, count: 0, error: 'No TSheets token configured in Settings.' }
  }
  return syncTrClients(settings.tsheets_api_token)
}

export async function syncPeopleFromPortal(): Promise<{
  ok: boolean
  linked: number
  imported: number
  error?: string
}> {
  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token')
    .eq('singleton_id', 1)
    .maybeSingle()
  if (!settings?.tsheets_api_token) {
    return { ok: false, linked: 0, imported: 0, error: 'No TSheets token configured in Settings.' }
  }
  return syncPeopleFromTsheets(settings.tsheets_api_token)
}

// Manual "sync now" behind the last-synced status button: runs both syncs and
// stamps tsheets_synced_at. The cron does the same on its schedule.
export async function syncAllFromTsheets(): Promise<{ ok: boolean; error?: string }> {
  const notAdmin = await requireAdmin()
  if (notAdmin) return { ok: false, error: notAdmin }

  const supabase = await createClient()
  const { data: settings } = await supabase
    .from('app_settings')
    .select('tsheets_api_token, tsheets_synced_at')
    .eq('singleton_id', 1)
    .maybeSingle()
  if (!settings?.tsheets_api_token) return { ok: false, error: 'No TSheets token configured in Settings.' }
  const token = settings.tsheets_api_token
  const lastSyncedAt = settings.tsheets_synced_at ?? null

  const clients = await syncClientsCore(supabase, token)
  if (!clients.ok) return { ok: false, error: clients.error }
  const people = await syncPeopleCore(supabase, token)
  if (!people.ok) return { ok: false, error: people.error }
  const timesheets = await syncTimesheetsCore(supabase, token, lastSyncedAt)
  if (!timesheets.ok) return { ok: false, error: timesheets.error }

  await supabase.from('app_settings').update({ tsheets_synced_at: new Date().toISOString() }).eq('singleton_id', 1)

  revalidatePath('/settings')
  revalidatePath('/tools/time-report')
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
