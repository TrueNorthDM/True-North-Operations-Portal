/**
 * Shared TSheets → portal sync logic.
 *
 * Written to take a Supabase client so both callers can reuse it:
 *   - the manual "Sync from TSheets" buttons (settings-actions, user session)
 *   - the scheduled job endpoint (admin/service-role client, no user session)
 *
 * Kept out of the 'use server' actions file on purpose, this module is imported
 * by an API route as well, and must not be marked as server actions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import { fetchUsers, fetchJobcodes } from './client'

// ─── Name matching ──────────────────────────────────────────────────────────

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

// Typed against the app schema so the queries below stay type-checked; the
// untyped admin (service-role) client is also assignable here.
type Client = SupabaseClient<Database>

// ─── Clients (job codes) ─────────────────────────────────────────────────────

export async function syncClientsCore(supabase: Client, token: string): Promise<{ ok: boolean; count: number; error?: string }> {
  try {
    const jobcodes = await fetchJobcodes(token)
    if (jobcodes.length === 0) return { ok: true, count: 0 }

    const rows = jobcodes.map(jc => ({
      tsheets_jobcode_id: jc.id,
      name: jc.name,
      active: true,
      // TSheets uses parent_id 0 for top-level clients, normalise to NULL so
      // the settings screens can filter real clients with `parent_id IS NULL`.
      parent_id: jc.parent_id ? jc.parent_id : null,
    }))
    const { error } = await supabase
      .from('tr_clients')
      .upsert(rows, { onConflict: 'tsheets_jobcode_id', ignoreDuplicates: false })
    if (error) return { ok: false, count: 0, error: error.message }

    return { ok: true, count: rows.length }
  } catch (e) {
    return { ok: false, count: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── People (directory link / import) ────────────────────────────────────────

export async function syncPeopleCore(supabase: Client, token: string): Promise<{ ok: boolean; linked: number; imported: number; error?: string }> {
  try {
    const users = await fetchUsers(token)

    // Pull the directory once, then match in memory (fewer round-trips + lets us
    // fuzzy-match on full name / nicknames / typos, not just a first-name prefix).
    const { data: allPeople, error: readErr } = await supabase
      .from('people')
      .select('id, full_name, tsheets_user_id, tsheets_only')
    if (readErr) return { ok: false, linked: 0, imported: 0, error: readErr.message }

    const rows = (allPeople ?? []) as { id: string; full_name: string; tsheets_user_id: number | null; tsheets_only: boolean }[]

    // Known accounts come from tc_user_links, not from the person column: a
    // person can own more than one TSheets account and only the primary is on
    // the row, so reading the column re-imported the others as new people.
    const { data: linkRows, error: linkReadErr } = await supabase
      .from('tc_user_links').select('tsheets_user_id')
    if (linkReadErr) return { ok: false, linked: 0, imported: 0, error: linkReadErr.message }
    const linkedIds = new Set((linkRows ?? []).map((l: { tsheets_user_id: number }) => l.tsheets_user_id))
    // Match targets = real directory people (not TSheets-only imports) with no link yet.
    const pool = rows.filter(p => p.tsheets_user_id == null && !p.tsheets_only)

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
        // The person had no link, so this account becomes their primary.
        const { error: linkErr } = await supabase.from('tc_user_links')
          .insert({ tsheets_user_id: user.id, person_id: match.id, is_primary: true })
        if (linkErr) return { ok: false, linked, imported, error: `Link record failed for ${fullName}: ${linkErr.message}` }
        pool.splice(matchIdx, 1)               // don't match the same directory person twice
        linkedIds.add(user.id)
        linked++
      } else {
        const { data: created, error } = await supabase.from('people').insert({
          full_name: fullName,
          tsheets_user_id: user.id,
          tsheets_only: true,
        }).select('id').single()
        if (error) return { ok: false, linked, imported, error: `Import failed for ${fullName}: ${error.message}` }
        const { error: linkErr } = await supabase.from('tc_user_links')
          .insert({ tsheets_user_id: user.id, person_id: (created as { id: string }).id, is_primary: true })
        if (linkErr) return { ok: false, linked, imported, error: `Link record failed for ${fullName}: ${linkErr.message}` }
        linkedIds.add(user.id)
        imported++
      }
    }

    return { ok: true, linked, imported }
  } catch (e) {
    return { ok: false, linked: 0, imported: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// Timesheets used to be pulled here into tsheets_timesheets. That cache lost
// its last reader when the client reports moved to tc_entries, so the pull and
// its date helper went with it. Hours come through the Clocky import now.

