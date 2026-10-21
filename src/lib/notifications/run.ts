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

import type { Db } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/admin'
import type { HealthResult } from '@/lib/health/checks'
import { KEEP_READ_DAYS, KEEP_UNREAD_DAYS } from './catalogue'
import { loadAudience } from './audience'
import { deliver, type Draft, type DeliverResult, type Row } from './deliver'
import {
  accessChangeDrafts, firstLoginDrafts, i7Drafts, integrationDrafts, levelDrafts, makeCtx, publishingDrafts,
  syncDrafts, teamOrderDrafts, unlinkedDrafts, unlinkedSeen, workDrafts, UNLINKED_SEEN, type Ctx,
  clockyAutoStopDrafts, clockyCorrectionDecidedDrafts, clockyCorrectionRequestedDrafts, clockyStillWorkingDrafts,
  clockyStoppedDrafts, clockyTimeOffRequestedDrafts, clockyTimeOffDecidedDrafts, clockyClockedOutForDrafts,
  clockyTimesheetSubmittedDrafts, clockyTimesheetDecidedDrafts, clockyInvoiceMadeDrafts, clockyInvoiceApprovedDrafts, clockyInvoicePaidDrafts, CLOCK_PANEL_HREF,
} from './generators'
import { sendEmail } from '@/lib/email/resend'
import { renderClockStopped } from '@/lib/email/clock-stopped'
import { zoneDate, zoneHour } from './schedule'
import { loadRules, readState, writeState } from './store'

/**
 * Where "a step was assigned" (T1) has read events up to. The next run reads
 * from here, so a run that failed or was skipped is caught up by the next one
 * (audit, 9 October 2026: each run read only its own sync, and lost the events
 * of a sync that was not followed by a run). Moved on only after the
 * notifications are written.
 */
const ASSIGNED_UPTO = 'step-assigned-upto'
/** Never further back than this: a long outage is not worth a flood. */
const ASSIGNED_MAX_BACK_MS = 3 * 86_400_000

type Client = Db

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
    const upto = opts.since ? await readState<string>(db, ASSIGNED_UPTO) : null
    const floor = new Date(ctx.now.getTime() - ASSIGNED_MAX_BACK_MS).toISOString()
    const from = opts.since ? (upto && upto < opts.since ? (upto > floor ? upto : floor) : opts.since) : null
    const { drafts, failed } = await gather(ctx, {
      work: c => workDrafts(c, { since: from }),
      publishing: publishingDrafts,
      i7: i7Drafts,
      firstLogin: firstLoginDrafts,
      ...(opts.incomplete && opts.since
        ? { sync: (c: Ctx) => syncDrafts(c, { since: opts.since!, ...opts.incomplete! }) }
        : {}),
    })
    const res = await deliver(db, drafts, { now: ctx.now, dryRun: opts.dryRun })
    if (!opts.dryRun && opts.since && !failed.work && !res.error) await writeState(db, ASSIGNED_UPTO, ctx.now.toISOString())
    const cleaned = opts.dryRun ? 0 : await cleanup(db, ctx.now)
    return { ...res, failed, cleaned }
  } catch (e) {
    return { failed: { run: (e as Error).message } }
  }
}

/** `after`: runs only once the drafts are all written (state that says "told"). */
async function simple(name: string, build: (ctx: Ctx) => Promise<Draft[]> | Draft[], db: Client = createAdminClient(), after?: (ctx: Ctx) => Promise<void>): Promise<RunReport> {
  try {
    if (!(await ready(db))) return { skipped: 'Migration 088 has not been run.', failed: {} }
    const ctx = makeCtx(db, await loadAudience(db))
    const res = await deliver(db, await build(ctx))
    if (res.error) console.error(`[notifications] ${name}:`, res.error)
    else if (after) await after(ctx)
    return { ...res, failed: {} }
  } catch (e) {
    console.error(`[notifications] ${name}:`, (e as Error).message)
    return { failed: { [name]: (e as Error).message } }
  }
}

export const notifyUnlinked = (db: Client, unlinked: readonly { id: number; name: string; email: string | null }[]) =>
  simple('unlinked', ctx => unlinkedDrafts(ctx, unlinked), db,
    async ctx => writeState(ctx.db, UNLINKED_SEEN, await unlinkedSeen(ctx, unlinked)))

export const notifyHealth = (db: Client, results: readonly HealthResult[]) =>
  simple('health', ctx => integrationDrafts(ctx, results), db)

export const notifyTeamOrder = (teamId: string, actorPersonId: string) =>
  simple('team-order', ctx => teamOrderDrafts(ctx, teamId, actorPersonId))

export const notifyAccessChange = (change: { changeId: number; summary: string; reason: string; actorPersonId: string | null }) =>
  simple('access', ctx => accessChangeDrafts(ctx, change))

export const notifyLevelChange = (change: { personId: string; name: string; from: string; to: string; actorProfileId: string | null }) =>
  simple('level', ctx => levelDrafts(ctx, change))

// ── Clocky (16 October 2026) ────────────────────────────────────────────────

export const notifyClockyStillWorking = (x: { personId: string; windowStartedAt: string; text: string }, db?: Client) =>
  simple('clocky-still-working', ctx => clockyStillWorkingDrafts(ctx, x), db)

export const notifyClockyCorrectionRequested = (x: { requestId: number; personId: string; teamIds: readonly string[]; text: string }) =>
  simple('clocky-correction-requested', ctx => clockyCorrectionRequestedDrafts(ctx, x))

export const notifyClockyCorrectionDecided = (x: { requestId: number; personId: string; text: string }) =>
  simple('clocky-correction-decided', ctx => clockyCorrectionDecidedDrafts(ctx, x))

export const notifyClockyTimeOffRequested = (x: { requestId: number; personId: string; text: string }) =>
  simple('clocky-timeoff-requested', ctx => clockyTimeOffRequestedDrafts(ctx, x))

export const notifyClockyTimeOffDecided = (x: { requestId: number; personId: string; text: string }) =>
  simple('clocky-timeoff-decided', ctx => clockyTimeOffDecidedDrafts(ctx, x))

export const notifyClockyClockedOutFor = (x: { entryId: number; personId: string; text: string }) =>
  simple('clocky-clocked-out-for', ctx => clockyClockedOutForDrafts(ctx, x))

export const notifyClockyTimesheetSubmitted = (x: { submissionId: number; sentAt: string; personId: string; to: readonly string[]; text: string }) =>
  simple('clocky-timesheet-submitted', ctx => clockyTimesheetSubmittedDrafts(ctx, x))

export const notifyClockyTimesheetDecided = (x: { submissionId: number; at: string; personId: string; text: string }) =>
  simple('clocky-timesheet-decided', ctx => clockyTimesheetDecidedDrafts(ctx, x))

export const notifyClockyInvoiceMade = (x: { invoiceId: number; at: string; personId: string; text: string }) =>
  simple('clocky-invoice-made', ctx => clockyInvoiceMadeDrafts(ctx, x))

export const notifyClockyInvoiceApproved = (x: { invoiceId: number; to: readonly string[]; text: string }) =>
  simple('clocky-invoice-approved', ctx => clockyInvoiceApprovedDrafts(ctx, x))

export const notifyClockyInvoicePaid = (x: { invoiceId: number; personId: string; text: string }) =>
  simple('clocky-invoice-paid', ctx => clockyInvoicePaidDrafts(ctx, x))

/**
 * N2: the bell row, and with it the one email Clocky sends, "Your clock
 * stopped by itself". The email goes only with a bell row actually written
 * (the type on for this person), once: the row's emailed_at marks it sent, and
 * Resend's idempotency key covers a retry.
 */
export async function notifyClockyStopped(
  x: { personId: string; entryId: number; text: string; stoppedAt: string; clockedInAt: string; origin: string },
  db: Client = createAdminClient(),
): Promise<RunReport & { emailed?: boolean; emailError?: string }> {
  const res = await simple('clocky-stopped', ctx => clockyStoppedDrafts(ctx, x), db)
  try {
    const { data: row, error } = await db.from('notifications').select('id, emailed_at')
      .eq('person_id', x.personId).eq('type_key', 'clocky-stopped').eq('dedupe_key', `stop:${x.entryId}`).maybeSingle()
    if (error) throw new Error(error.message)
    const r = row as { id: string; emailed_at: string | null } | null
    if (!r || r.emailed_at) return res
    const aud = await loadAudience(db)
    const to = aud.byId.get(x.personId)?.email
    if (!to) return { ...res, emailed: false, emailError: 'no address to send to' }
    const msg = renderClockStopped({ stoppedAt: x.stoppedAt, clockedInAt: x.clockedInAt, url: `${x.origin}${CLOCK_PANEL_HREF}`, origin: x.origin })
    const sent = await sendEmail({ to, ...msg, idempotencyKey: `clocky-stopped-${x.entryId}` })
    // Sent, or never possible here (staging, no email service): either way it is not tried again.
    if (sent.sent || sent.blocked) await db.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', r.id)
    if (!sent.sent) console.error('[notifications] clock stopped email:', sent.reason)
    return { ...res, emailed: sent.sent, ...(sent.sent ? {} : { emailError: sent.reason }) }
  } catch (e) {
    console.error('[notifications] clock stopped email:', (e as Error).message)
    return { ...res, emailError: (e as Error).message }
  }
}

/** The state key that remembers which day's automatic clock-outs were summarised. */
const AUTO_STOPS_DAY = 'clocky-auto-stops-day'

/**
 * The Super Admins' daily line about yesterday's automatic clock-outs. Asked
 * on every safety run, done once a day: after 1:00 in New York (yesterday's
 * last stops are in by then), and not again for the same day.
 */
export async function notifyClockyAutoStops(now = new Date(), db: Client = createAdminClient()): Promise<RunReport | null> {
  if (zoneHour(now) < 1) return null
  const today = zoneDate(now)
  if ((await readState<string>(db, AUTO_STOPS_DAY)) === today) return null
  return simple('clocky-auto-stops', clockyAutoStopDrafts, db, async ctx => writeState(ctx.db, AUTO_STOPS_DAY, ctx.today))
}
