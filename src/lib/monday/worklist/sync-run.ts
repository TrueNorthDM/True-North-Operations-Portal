// The Monday sync's lock and its record of runs (migration 091, My Work plan
// phase 5). Both degrade to "not there" before the migration has run: the sync
// then behaves as it did before, unlocked and unrecorded.
//
//   Lock    one row. A firing holds it while its chain of hops runs; every hop of
//           the same firing (the same `since`) may take it again, and it expires
//           on its own, so a chain killed half way cannot hold it forever. A
//           second firing that finds it held skips its turn.
//   Runs    one row per hop: what it read, which boards failed and why. Boards
//           that failed in a run are skipped by that run's later hops.

import type { SupabaseClient } from '@supabase/supabase-js'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

/** Longer than one hop can live (300 s), so a live chain never loses it. */
export const LEASE_MS = 6 * 60_000

function missingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  return error.code === '42P01' || error.code === 'PGRST205'
    || (/monday_sync_(lock|runs)/.test(error.message ?? '') && /does not exist|could not find|schema cache/i.test(error.message ?? ''))
}

export type Lease = { ok: true; unrecorded?: boolean } | { ok: false; heldBy: string | null; until: string | null }

/** Take the lock for this firing, or learn who holds it. */
export async function acquireLease(supabase: Client, since: string, now = new Date()): Promise<Lease> {
  const until = new Date(now.getTime() + LEASE_MS).toISOString()
  const { data, error } = await supabase
    .from('monday_sync_lock')
    .update({ holder: since, expires_at: until })
    .eq('id', 1)
    .or(`holder.is.null,expires_at.is.null,expires_at.lt."${now.toISOString()}",holder.eq."${since}"`)
    .select('holder')
  if (missingTable(error)) return { ok: true, unrecorded: true }
  if (error) throw new Error(`sync lock: ${error.message}`)
  if (data && data.length) return { ok: true }
  const { data: held } = await supabase.from('monday_sync_lock').select('holder, expires_at').eq('id', 1).maybeSingle()
  const h = held as { holder: string | null; expires_at: string | null } | null
  return { ok: false, heldBy: h?.holder ?? null, until: h?.expires_at ?? null }
}

/** Let go of the lock at the end of this firing's chain. */
export async function releaseLease(supabase: Client, since: string): Promise<void> {
  const { error } = await supabase.from('monday_sync_lock')
    .update({ holder: null, expires_at: null }).eq('id', 1).eq('holder', since)
  if (error && !missingTable(error)) console.error(`[monday-worklist] releasing the sync lock: ${error.message}`)
}

/** Open this hop's row; null before migration 091. */
export async function startRun(supabase: Client, since: string, hop: number): Promise<number | null> {
  const { data, error } = await supabase.from('monday_sync_runs').insert({ since, hop }).select('id').single()
  if (error) {
    if (!missingTable(error)) console.error(`[monday-worklist] recording the run: ${error.message}`)
    return null
  }
  return (data as { id: number }).id
}

export interface RunOutcome {
  boards_read?: number
  items?: number
  assignments?: number
  remaining?: number | null
  failed?: { board: number; name: string; error: string }[]
  gone?: number
  chained?: string | null
  error?: string | null
}

/** Close this hop's row with what it did. */
export async function finishRun(supabase: Client, id: number | null, outcome: RunOutcome): Promise<void> {
  if (id == null) return
  const { error } = await supabase.from('monday_sync_runs')
    .update({ ...outcome, finished_at: new Date().toISOString() }).eq('id', id)
  if (error) console.error(`[monday-worklist] recording the run: ${error.message}`)
}

/** Boards that failed earlier in this firing, to leave alone until the next one. */
export async function failedThisRun(supabase: Client, since: string): Promise<Set<number>> {
  const { data, error } = await supabase.from('monday_sync_runs').select('failed').eq('since', since)
  if (error) return new Set()
  const ids = ((data ?? []) as { failed: { board: number }[] | null }[])
    .flatMap(r => (r.failed ?? []).map(f => Number(f.board)))
  return new Set(ids.filter(n => Number.isFinite(n)))
}
