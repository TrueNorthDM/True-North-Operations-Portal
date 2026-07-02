'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { fetchUsers, fetchJobcodes } from '@/lib/tsheets/client'
import { isCurrentUserAdmin } from '@/lib/auth/role'

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
  try {
    const jobcodes = await fetchJobcodes(token)
    if (jobcodes.length === 0) return { ok: true, count: 0 }

    const rows = jobcodes.map(jc => ({
      tsheets_jobcode_id: jc.id,
      name: jc.name,
      active: true,
    }))

    const { error } = await supabase
      .from('tr_clients')
      .upsert(rows, { onConflict: 'tsheets_jobcode_id', ignoreDuplicates: false })
    if (error) return { ok: false, count: 0, error: error.message }

    revalidatePath('/tools/time-report/settings')
    return { ok: true, count: rows.length }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
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
  try {
    const users = await fetchUsers(token)
    let linked = 0
    let imported = 0

    for (const user of users) {
      // TsheetsUser has first_name / last_name, not a combined name field
      const firstName = (user.first_name ?? '').toLowerCase()
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')
      if (!firstName) continue // skip users with no name (admin/system accounts)

      // Check if already linked by tsheets_user_id
      const { data: byId } = await supabase
        .from('people')
        .select('id, tsheets_user_id')
        .eq('tsheets_user_id', user.id)
        .maybeSingle()

      if (byId) continue // already linked

      // Try to match by first name. limit(1) (not maybeSingle) so two people
      // sharing a first name don't error the whole match out.
      const { data: byNameRows } = await supabase
        .from('people')
        .select('id, full_name')
        .ilike('full_name', `${firstName}%`)
        .is('tsheets_user_id', null)
        .limit(1)
      const byName = byNameRows?.[0]

      if (byName) {
        const { error } = await supabase
          .from('people')
          .update({ tsheets_user_id: user.id })
          .eq('id', byName.id)
        // Surface the real error instead of silently counting a failed write.
        if (error) return { ok: false, linked, imported, error: `Link failed for ${fullName}: ${error.message}` }
        linked++
      } else {
        // Import as tsheets_only person
        const { error } = await supabase.from('people').insert({
          full_name: fullName,
          tsheets_user_id: user.id,
          tsheets_only: true,
        })
        if (error) return { ok: false, linked, imported, error: `Import failed for ${fullName}: ${error.message}` }
        imported++
      }
    }

    revalidatePath('/tools/time-report/settings')
    return { ok: true, linked, imported }
  } catch (e) {
    return { ok: false, linked: 0, imported: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
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

  revalidatePath('/tools/time-report/settings')
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

  revalidatePath('/tools/time-report/settings')
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

  revalidatePath('/tools/time-report/settings')
  return { ok: true }
}
