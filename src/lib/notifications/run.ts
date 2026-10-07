/**
 * When the generators run, and how a failure in one is kept from the rest.
 *
 *   notifyAfterSync   end of every Monday sync chain (six times a day): work
 *                     (T1, T2, T3, T8), Publishing Goals (T6), i7 (T7), first
 *                     logins (S3), a sync that did not finish (S2), and the
 *                     retention clean-up.
 *   notifyUnlinked    head of the chain, where the Monday accounts are read (S5).
 *   notifyHealth      after the integration checks (S1).
 *   notifyTeamOrder   after a team's order is saved (T4).
 *   notifyLevelChange after an access level is changed (S4).
 *   notifyAccessChange after access rules change on Admin > Access levels (S6).
 *
 * Nothing here may break the thing it rides on: a sync, a save or a health
 * check that worked must not report failure because a notification did not
 * go out. Every entry point catches and logs, and each generator runs on its
 * own so one broken source does not silence the others.
 *
 * Until migration 088 is run, loadRules reports the tables are not ready and
 * every entry point returns without doing anything.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import type { HealthResult } from '@/lib/health/checks'
import { KEEP_READ_DAYS, KEEP_UNREAD_DAYS } from './catalogue'
import { loadAudience } from './audience'
import { deliver, type Draft, type DeliverResult, type Row } from './deliver'
import {
  accessChangeDrafts, firstLoginDrafts, i7Drafts, integrationDrafts, levelDrafts, makeCtx, publishingDrafts,
  syncDrafts, teamOrderDrafts, unlinkedDrafts, workDrafts, type Ctx,
} from './generators'
import { loadRules } from './store'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

export interface RunReport extends Partial<DeliverResult> {
  skipped?: string
  failed: Record<string, string>
  cleaned?: number
  planned?: Row[]
}

async function ready(db: Client): Promise<boolean> {
  return (await loadRules(db)).ready
}

/** Runs each generator on its own; a throw is recorded under its name. */
async function gather(ctx: Ctx, gens: Record<string, (ctx: Ctx) => Promise<Draft[]> | Draft[]>) {
  const failed: Record<string, string> = {}
  const drafts: Draft[] = []
  await Promise.all(Object.entries(gens).map(async ([name, g]) => {
    try { drafts.push(...await g(ctx)) } catch (e) { failed[name] = (e as Error).message }
  }))
  return { drafts, failed }
}

/** Read ones after 30 days, unread after 90. Counted from when they landed. */
export async function cleanup(db: Client, now = new Date()): Promise<number> {
  const day = 86_400_000
  const read = await db.from('notifications').delete({ count: 'exact' })
    .not('read_at', 'is', null).lt('deliver_at', new Date(now.getTime() - KEEP_READ_DAYS * day).toISOString())
  const unread = await db.from('notifications').delete({ count: 'exact' })
    .is('read_at', null).lt('deliver_at', new Date(now.getTime() - KEEP_UNREAD_DAYS * day).toISOString())
  return (read.count ?? 0) + (unread.count ?? 0)
}

export async function notifyAfterSync(opts: {
  since: string | null
  /** Set when the chain stopped with boards left (how many, when known). */
  incomplete?: { remaining: number | null; reason: string }
  dryRun?: boolean
  now?: Date
  db?: Client
}): Promise<RunReport> {
  try {
    const db = opts.db ?? createAdminClient()
    // A dry run reads only, so it works before the migration too (with the
    // catalogue's default rules): that is how the generators were checked.
    if (!opts.dryRun && !(await ready(db))) return { skipped: 'Migration 088 has not been run.', failed: {} }
    const ctx = makeCtx(db, await loadAudience(db), opts.now)
    const { drafts, failed } = await gather(ctx, {
      work: c => workDrafts(c, { since: opts.since }),
      publishing: publishingDrafts,
      i7: i7Drafts,
      firstLogin: firstLoginDrafts,
      ...(opts.incomplete && opts.since
        ? { sync: (c: Ctx) => syncDrafts(c, { since: opts.since!, ...opts.incomplete! }) }
        : {}),
    })
    const res = await deliver(db, drafts, { now: ctx.now, dryRun: opts.dryRun })
    const cleaned = opts.dryRun ? 0 : await cleanup(db, ctx.now)
    return { ...res, failed, cleaned }
  } catch (e) {
    return { failed: { run: (e as Error).message } }
  }
}

async function simple(name: string, build: (ctx: Ctx) => Promise<Draft[]> | Draft[], db: Client = createAdminClient()): Promise<RunReport> {
  try {
    if (!(await ready(db))) return { skipped: 'Migration 088 has not been run.', failed: {} }
    const ctx = makeCtx(db, await loadAudience(db))
    const res = await deliver(db, await build(ctx))
    if (res.error) console.error(`[notifications] ${name}:`, res.error)
    return { ...res, failed: {} }
  } catch (e) {
    console.error(`[notifications] ${name}:`, (e as Error).message)
    return { failed: { [name]: (e as Error).message } }
  }
}

export const notifyUnlinked = (db: Client, unlinked: readonly { id: number; name: string; email: string | null }[]) =>
  simple('unlinked', ctx => unlinkedDrafts(ctx, unlinked), db)

export const notifyHealth = (db: Client, results: readonly HealthResult[]) =>
  simple('health', ctx => integrationDrafts(ctx, results), db)

export const notifyTeamOrder = (teamId: string, actorPersonId: string) =>
  simple('team-order', ctx => teamOrderDrafts(ctx, teamId, actorPersonId))

export const notifyAccessChange = (change: { changeId: number; summary: string; reason: string; actorPersonId: string | null }) =>
  simple('access', ctx => accessChangeDrafts(ctx, change))

export const notifyLevelChange = (change: { personId: string; name: string; from: string; to: string; actorProfileId: string | null }) =>
  simple('level', ctx => levelDrafts(ctx, change))
