/**
 * The outbox (Clocky part 2, docs/time-clock/06-clocky-part2-design.md
 * "Integrations"): what a decision sends to Rippling or Google Calendar is a
 * row in integration_jobs, never a call made while somebody waits. A decision
 * never fails because Rippling or Google is slow or down; the worker
 * (outbox-run.ts, every 5 minutes) sends what is queued, and its answer shows
 * on the request (sent, refused with Try again).
 *
 * Until a connection exists (Company settings > Integrations, 13A) a job waits
 * as "waiting_connection"; connecting moves those jobs to the queue.
 *
 * Not a "use server" file.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/types/database.generated'
import { loadConnections } from './connections'

export type JobKind = 'rippling_pto' | 'rippling_pto_cancel' | 'rippling_hours' | 'gcal_upsert' | 'gcal_delete'
export type JobState = 'waiting_connection' | 'queued' | 'done' | 'failed'

/** Which connection a kind of job needs. */
export const needs = (kind: JobKind): 'rippling' | 'google' => (kind.startsWith('rippling') ? 'rippling' : 'google')

/**
 * Queues one job, once: the idempotency key makes a second call (a retried
 * decision) a no-op. Returns the state it starts in, which the request shows.
 */
export async function enqueue(job: { kind: JobKind; refTable: string; refId: number; payload: { [k: string]: Json }; key: string }): Promise<JobState> {
  const conn = await loadConnections()
  const state: JobState = conn[needs(job.kind)].connected ? 'queued' : 'waiting_connection'
  const { error } = await createAdminClient().from('integration_jobs').upsert({
    kind: job.kind, ref_table: job.refTable, ref_id: job.refId, payload: job.payload, state,
    idempotency_key: job.key, next_at: new Date().toISOString(),
  }, { onConflict: 'idempotency_key', ignoreDuplicates: true })
  if (error) throw new Error(`The job was not queued: ${error.message}`)
  return state
}

/** "Try again" on a refused or failed job: back in the queue, or waiting for its connection. */
export async function retryJobs(refTable: string, refId: number, kinds: readonly JobKind[]): Promise<void> {
  const conn = await loadConnections()
  const c = createAdminClient()
  for (const kind of kinds) {
    const { error } = await c.from('integration_jobs')
      .update({ state: conn[needs(kind)].connected ? 'queued' : 'waiting_connection', next_at: new Date().toISOString(), last_error: null })
      .eq('ref_table', refTable).eq('ref_id', refId).eq('kind', kind).eq('state', 'failed')
    if (error) throw new Error(`The job was not queued again: ${error.message}`)
  }
}

/** Connecting Rippling or Google (13A): what waited for it goes to the queue. */
export async function releaseWaiting(connection: 'rippling' | 'google'): Promise<number> {
  const kinds = connection === 'rippling' ? ['rippling_pto', 'rippling_pto_cancel', 'rippling_hours'] : ['gcal_upsert', 'gcal_delete']
  const { data, error } = await createAdminClient().from('integration_jobs')
    .update({ state: 'queued', next_at: new Date().toISOString() }).eq('state', 'waiting_connection').in('kind', kinds).select('id')
  if (error) throw new Error(`The waiting jobs were not released: ${error.message}`)
  return data?.length ?? 0
}
