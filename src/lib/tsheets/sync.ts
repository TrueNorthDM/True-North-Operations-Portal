/**
 * Shared TSheets → portal sync logic.
 *
 * Written to take a Supabase client so both callers can reuse it:
 *   - the manual "Sync from TSheets" buttons (settings-actions, user session)
 *   - the Vercel Cron endpoint (admin/service-role client, no user session)
 *
 * Kept out of the 'use server' actions file on purpose — this module is imported
 * by an API route as well, and must not be marked as server actions.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import { fetchUsers, fetchJobcodes, fetchTimesheets } from './client'
import { i7JobcodeIds, I7_CODE_CF, ACTIVITY_CF } from './i7report'
import { retentionFloorDate } from './retention'

// ─── Name matching ──────────────────────────────────────────────────────────

/** lowercase, strip accents, collapse whitespace. */
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
export function normalizeName(s: string): string {
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
export function namesMatch(tFirst: string, tLast: string, dirFullName: string): boolean {
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
      // TSheets uses parent_id 0 for top-level clients — normalise to NULL so
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
    const linkedIds = new Set(rows.filter(p => p.tsheets_user_id != null).map(p => p.tsheets_user_id))
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

    return { ok: true, linked, imported }
  } catch (e) {
    return { ok: false, linked: 0, imported: 0, error: e instanceof Error ? e.message : 'Unknown error' }
  }
}

// ─── Timesheets (i7 report cache) ────────────────────────────────────────────

/** TSheets ISO 'Z' → the offset form the API's modified_since expects. */
function toTsheetsIso(iso: string): string {
  return new Date(iso).toISOString().replace(/\.\d+Z$/, '+00:00')
}

/**
 * Caches the i7 timesheets the report reads from — so the page never calls the
 * TSheets API live. Backfills the whole retention window the first time (empty
 * cache), then pulls only entries modified since the last sync. Prunes anything
 * that has aged out of the rolling 24-month window.
 */
export async function syncTimesheetsCore(
  supabase: Client,
  token: string,
  lastSyncedAt?: string | null,
): Promise<{ ok: boolean; upserted: number; pruned: number; mode: 'backfill' | 'incremental'; error?: string }> {
  try {
    const now = new Date()
    const floorDate = retentionFloorDate(now)                                   // 'YYYY-MM-01'
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10)  // last day of current month

    // Only fetch i7 entries (a fraction of the whole account).
    const jobcodes = await fetchJobcodes(token)
    const i7Ids = [...i7JobcodeIds(jobcodes)]
    if (i7Ids.length === 0) return { ok: true, upserted: 0, pruned: 0, mode: 'incremental' }

    // Empty cache → full backfill; otherwise incremental (just what changed).
    const { count } = await supabase.from('tsheets_timesheets').select('id', { count: 'exact', head: true })
    const isEmpty = !count
    const mode: 'backfill' | 'incremental' = isEmpty ? 'backfill' : 'incremental'
    const modifiedSince = isEmpty || !lastSyncedAt ? undefined : toTsheetsIso(lastSyncedAt)

    const ts = await fetchTimesheets(token, floorDate, endDate, i7Ids, modifiedSince)

    let upserted = 0
    if (ts.length > 0) {
      const stamp = new Date().toISOString()
      const rows = ts.map(t => ({
        id: t.id,
        user_id: t.user_id,
        jobcode_id: t.jobcode_id,
        duration: t.duration,
        date: t.date,
        i7_code: (t.customfields?.[I7_CODE_CF] ?? '').trim() || null,
        activity: (t.customfields?.[ACTIVITY_CF] ?? '').trim() || null,
        synced_at: stamp,
      }))
      const { error } = await supabase.from('tsheets_timesheets').upsert(rows, { onConflict: 'id' })
      if (error) return { ok: false, upserted: 0, pruned: 0, mode, error: error.message }
      upserted = rows.length
    }

    // Drop entries that have aged out of the rolling window.
    const { data: prunedRows } = await supabase.from('tsheets_timesheets').delete().lt('date', floorDate).select('id')
    return { ok: true, upserted, pruned: prunedRows?.length ?? 0, mode }
  } catch (e) {
    return { ok: false, upserted: 0, pruned: 0, mode: 'incremental', error: e instanceof Error ? e.message : 'Unknown error' }
  }
}
