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

    revalidatePath('/settings')
    return { ok: true, count: rows.length }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Name matching (used by the TSheets people sync) ────────────────────────

/** lowercase, strip accents, collapse whitespace. */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
function normalizeName(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '').replace(/\s+/g, ' ').trim()
}

// Common English nickname ↔ formal-name groups (so Dave ↔ David link on sync).
const NICKNAME_GROUPS: string[][] = [
  ['david', 'dave', 'davey'], ['michael', 'mike', 'mikey'], ['robert', 'rob', 'bob', 'bobby'],
  ['william', 'will', 'bill', 'billy'], ['james', 'jim', 'jimmy'], ['john', 'jack', 'johnny'],
  ['richard', 'rick', 'rich', 'dick'], ['thomas', 'tom', 'tommy'], ['joseph', 'joe', 'joey'],
  ['charles', 'charlie', 'chuck'], ['christopher', 'chris'], ['daniel', 'dan', 'danny'],
  ['matthew', 'matt'], ['anthony', 'tony'], ['nicholas', 'nick'], ['samuel', 'sam'],
  ['benjamin', 'ben'], ['alexander', 'alex'], ['nathaniel', 'nathan', 'nate'],
  ['andrew', 'andy', 'drew'], ['stephanie', 'steph'], ['jennifer', 'jen', 'jenny'],
  ['katherine', 'kate', 'katie', 'kathy'], ['elizabeth', 'liz', 'beth', 'betty'],
]
function nicknameMatch(a: string, b: string): boolean {
  if (a === b) return true
  return NICKNAME_GROUPS.some(g => g.includes(a) && g.includes(b))
}

/** Levenshtein distance (tolerates one-character typos like Clarise → Clarisse). */
function editDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i++) dp[i][0] = i
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[a.length][b.length]
}

/**
 * A TSheets (first, last) matches a directory full name when the full names are
 * equal, OR the last names match and the first names are equal / a nickname /
 * off by a single character. Requiring the last name to match keeps it precise.
 */
function namesMatch(tFirst: string, tLast: string, dirFullName: string): boolean {
  const dir = normalizeName(dirFullName)
  const tFull = `${tFirst} ${tLast}`.trim()
  if (dir && dir === tFull) return true
  const parts = dir.split(' ')
  if (parts.length < 2 || !tLast) return false
  const dFirst = parts[0]
  const dLast = parts[parts.length - 1]
  if (dLast !== tLast) return false
  return dFirst === tFirst || nicknameMatch(dFirst, tFirst) || editDistance(dFirst, tFirst) <= 1
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

    // Pull the directory once, then match in memory (fewer round-trips + lets us
    // fuzzy-match on full name / nicknames / typos, not just a first-name prefix).
    const { data: allPeople, error: readErr } = await supabase
      .from('people')
      .select('id, full_name, tsheets_user_id, tsheets_only')
    if (readErr) return { ok: false, linked: 0, imported: 0, error: readErr.message }

    const linkedIds = new Set((allPeople ?? []).filter(p => p.tsheets_user_id != null).map(p => p.tsheets_user_id))
    // Match targets = real directory people (not TSheets-only imports) with no link yet.
    const pool = (allPeople ?? []).filter(p => p.tsheets_user_id == null && !p.tsheets_only)

    let linked = 0
    let imported = 0

    for (const user of users) {
      if (!user.first_name) continue           // skip admin/system accounts with no name
      if (linkedIds.has(user.id)) continue     // already linked

      const tFirst = normalizeName(user.first_name)
      const tLast = normalizeName(user.last_name ?? '')
      const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ')

      const matchIdx = pool.findIndex(p => namesMatch(tFirst, tLast, p.full_name))
      if (matchIdx >= 0) {
        const match = pool[matchIdx]
        const { error } = await supabase.from('people').update({ tsheets_user_id: user.id }).eq('id', match.id)
        if (error) return { ok: false, linked, imported, error: `Link failed for ${fullName}: ${error.message}` }
        pool.splice(matchIdx, 1)               // don't match the same directory person twice
        linkedIds.add(user.id)
        linked++
      } else {
        const { error } = await supabase.from('people').insert({
          full_name: fullName,
          tsheets_user_id: user.id,
          tsheets_only: true,
        })
        if (error) return { ok: false, linked, imported, error: `Import failed for ${fullName}: ${error.message}` }
        linkedIds.add(user.id)
        imported++
      }
    }

    revalidatePath('/settings')
    return { ok: true, linked, imported }
  } catch (e) {
    return { ok: false, linked: 0, imported: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
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
