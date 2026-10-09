/**
 * Sending the daily summary emails (7 October 2026). Runs every 15 minutes
 * from the server's crontab (/api/cron/daily-summary).
 *
 * A daily-summary notification lands in the bell at 8:00 in its person's time
 * zone. Each run looks for the ones that landed and have not been emailed, and
 * for each person whose own calendar says it is a working day (Monday to
 * Friday, not a US federal holiday) and past their summary hour (8:00 unless
 * they chose another), sends them: one email per
 * category, Tools and System, so never more than two. On a day off nothing
 * goes; the next working day's email holds everything since ("what you missed
 * since Friday"). Nobody gets an empty email: no notifications, no email.
 *
 * Each email is written down in notification_digests (person, category, day),
 * so a summary is sent once a day at most, and an address that keeps failing
 * is tried three times and then left until the next working day. Where email
 * cannot go at all (the staging copy, no email service, a person with no
 * address or no longer signing in) the notifications are let go, so they are
 * not picked up again run after run: they are still in the bell.
 *
 * Since the audit of 9 October 2026:
 * - A summary is CLAIMED before it is sent (the digest row written as
 *   'sending', migration 100), and Resend is given an idempotency key, so two
 *   runs, or a run after a restart, never send it twice.
 * - Any read that fails stops the run with an error; nothing is let go on a
 *   guess (an empty audience used to drop the whole day's emails).
 * - What goes in the email is checked again when it is sent: a type the
 *   person no longer reaches, or that they or an admin turned off since, is
 *   left out. It stays in the bell (decided 9 October 2026: only what has
 *   not arrived yet is held back).
 * - Sends are paced, and a busy email service (rate limit, its own error)
 *   does not use up one of the three tries.
 *
 * Until migration 092 is run, the run reports it and does nothing.
 */

import type { Db } from '@/lib/supabase/types'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { renderSummary, type SummaryCategory, type SummaryItem } from '@/lib/email/summary'
import { DAILY_HOUR, TYPE_BY_KEY, effective } from './catalogue'
import { isWorkingDay, missedDays } from './calendar'
import { loadAudience } from './audience'
import { zoneDate, zoneHour } from './schedule'
import { loadDelivery, loadPrefs, loadRules, missingTable } from './store'
import { zoneLabel } from './zones'

type Client = Db

/** How far back a waiting notification still goes out by email. Older ones are let go. */
export const EMAIL_WITHIN_DAYS = 14
/** Tries per person, category and day before a failing address is left until the next working day. */
export const MAX_ATTEMPTS = 3

const DAY = 86_400_000
/** A 'sending' claim older than this is taken for a run that died; the idempotency key keeps a retry single. */
const STALE_CLAIM_MS = 30 * 60_000
/** Between two sends: Resend allows about two a second. */
const PACE_MS = 600
const CATEGORIES: readonly SummaryCategory[] = ['tools', 'system']

type Waiting = { id: string; person_id: string; type_key: string; title: string; body: string; href: string | null; deliver_at: string }
type Digest = { person_id: string; category: SummaryCategory; status: 'sending' | 'sent' | 'skipped' | 'failed'; attempts: number; updated_at: string }

export interface SummaryReport {
  skipped?: string
  waiting: number
  sent: number
  /** Let go without an email: staging, no email service, no address, no longer signing in. */
  letGo: number
  failed: number
  /** People whose calendar says not yet: before 8:00, or a day off. */
  notYet: number
  errors: string[]
}

/** The first word of a name, for "Good morning, Ana". */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || 'there'

/** Which category a notification type belongs to in the summary, if any. */
export const categoryOf = (typeKey: string): SummaryCategory | null => {
  const b = TYPE_BY_KEY.get(typeKey)?.block
  return b === 'tools' || b === 'system' ? b : null
}

/** Marks rows as emailed (or let go). The error, if any, so the run reports it. */
async function markEmailed(db: Client, ids: readonly string[], at: string): Promise<string | null> {
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await db.from('notifications').update({ emailed_at: at }).in('id', ids.slice(i, i + 200))
    if (error) return error.message
  }
  return null
}

/**
 * Takes the summary for (person, category, day) for this run: true when this
 * run wrote the 'sending' row, false when another run has it (or got there
 * first). A new row is inserted, so a second insert fails on the key; a failed
 * or stale one is taken over only if it is still as it was read.
 */
async function claim(db: Client, k: { person_id: string; category: SummaryCategory; local_day: string }, before: Digest | undefined, stamp: string): Promise<boolean> {
  if (!before) {
    const { error } = await db.from('notification_digests')
      .insert({ ...k, status: 'sending', attempts: 1, items: 0, error: null, updated_at: stamp })
    return !error
  }
  const { error, count } = await db.from('notification_digests')
    .update({ status: 'sending', attempts: before.attempts + 1, updated_at: stamp }, { count: 'exact' })
    .eq('person_id', k.person_id).eq('category', k.category).eq('local_day', k.local_day)
    .eq('status', before.status).eq('updated_at', before.updated_at)
  return !error && (count ?? 0) === 1
}

const pause = (ms: number) => (ms > 0 ? new Promise(r => setTimeout(r, ms)) : Promise.resolve())

/** `origin`: the portal's public address, for the links in the email (publicOrigin of the request). */
export async function sendDailySummaries(opts: { origin: string; now?: Date; db?: Client; paceMs?: number }): Promise<SummaryReport> {
  const now = opts.now ?? new Date()
  const db = opts.db ?? createAdminClient()
  const origin = opts.origin
  const report: SummaryReport = { waiting: 0, sent: 0, letGo: 0, failed: 0, notYet: 0, errors: [] }
  const stamp = now.toISOString()

  // Too old for an email: let go, so they are not read again every run.
  const cutoff = new Date(now.getTime() - EMAIL_WITHIN_DAYS * DAY).toISOString()
  const old = await db.from('notifications').update({ emailed_at: stamp })
    .eq('timing', 'daily').is('emailed_at', null).lte('deliver_at', cutoff)
  if (old.error) {
    if (missingTable(old.error) || /emailed_at/.test(old.error.message)) return { ...report, skipped: 'Migration 092 has not been run.' }
    return { ...report, errors: [old.error.message] }
  }

  const waiting: Waiting[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from('notifications')
      .select('id, person_id, type_key, title, body, href, deliver_at')
      .eq('timing', 'daily').is('emailed_at', null).lte('deliver_at', stamp)
      // id breaks ties: many rows share the same 8:00 instant, and paging on
      // deliver_at alone could repeat or skip rows between pages.
      .order('deliver_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999)
    if (error) return { ...report, errors: [error.message] }
    waiting.push(...((data ?? []) as Waiting[]))
    if ((data ?? []).length < 1000) break
  }
  report.waiting = waiting.length
  if (!waiting.length) return report

  const byPerson = new Map<string, Waiting[]>()
  for (const w of waiting) (byPerson.get(w.person_id) ?? byPerson.set(w.person_id, []).get(w.person_id)!).push(w)
  const people = [...byPerson.keys()]

  // Everything the run decides on, read in full or not at all.
  let aud: Awaited<ReturnType<typeof loadAudience>>
  let delivery: Awaited<ReturnType<typeof loadDelivery>>
  let rules: Awaited<ReturnType<typeof loadRules>>['rules']
  let prefs: Awaited<ReturnType<typeof loadPrefs>>
  try {
    ;[aud, delivery, { rules }, prefs] = await Promise.all([
      loadAudience(db), loadDelivery(db, people, { strict: true }), loadRules(db), loadPrefs(db, people),
    ])
  } catch (e) {
    return { ...report, errors: [(e as Error).message] }
  }
  const digests = new Map<string, Digest>()
  const since = zoneDate(new Date(now.getTime() - 2 * DAY))
  for (let i = 0; i < people.length; i += 200) {
    const { data, error } = await db.from('notification_digests').select('person_id, category, status, attempts, local_day, updated_at')
      .in('person_id', people.slice(i, i + 200)).gte('local_day', since)
    if (error) return { ...report, errors: [`digests: ${error.message}`] }
    for (const d of (data ?? []) as (Digest & { local_day: string })[]) digests.set(`${d.person_id}|${d.category}|${d.local_day}`, d)
  }
  const letGo = async (ids: string[]) => {
    const e = await markEmailed(db, ids, stamp)
    if (e) report.errors.push(`let go: ${e}`)
    else report.letGo += ids.length
  }

  for (const [personId, rows] of byPerson) {
    const zone = delivery.get(personId)?.zone
    const hour = delivery.get(personId)?.hour ?? DAILY_HOUR
    const today = zoneDate(now, zone)
    const who = aud.byId.get(personId)
    // Read in full above: not in the audience means inactive, not invited or
    // without an account, so nothing will ever be emailed to them.
    if (!who || !who.email) { await letGo(rows.map(r => r.id)); continue }
    if (!isWorkingDay(today) || zoneHour(now, zone) < hour) { report.notYet += 1; continue }

    // Checked again now: what they no longer reach, or turned off since.
    const still = (r: Waiting) => {
      const t = TYPE_BY_KEY.get(r.type_key)
      const rule = rules[r.type_key]
      return !!t && !!rule && aud.reached(t, who) && effective(t, rule, prefs.get(personId)?.[r.type_key]).enabled
    }
    const held = rows.filter(r => !still(r))
    if (held.length) await letGo(held.map(r => r.id))
    const sendable = rows.filter(still)

    for (const category of CATEGORIES) {
      const mine = sendable.filter(r => categoryOf(r.type_key) === category)
      if (!mine.length) continue
      const key = `${personId}|${category}|${today}`
      const before = digests.get(key)
      if (before) {
        // Already sent or let go today: anything newer waits for the next working day.
        if (before.status === 'sent' || before.status === 'skipped') continue
        if (before.status === 'failed' && before.attempts >= MAX_ATTEMPTS) continue
        if (before.status === 'sending' && now.getTime() - new Date(before.updated_at).getTime() < STALE_CLAIM_MS) continue
      }
      const k = { person_id: personId, category, local_day: today }
      if (!(await claim(db, k, before, stamp))) continue
      const attempts = (before?.attempts ?? 0) + 1

      const items: SummaryItem[] = mine.map(r => ({
        type: r.type_key, title: r.title, body: r.body, href: r.href, day: zoneDate(new Date(r.deliver_at), zone),
      }))
      const mail = renderSummary({
        category, firstName: firstName(who.name), today, missed: missedDays(today), items, origin, zoneLabel: zoneLabel(zone), hour,
      })
      const res = await sendEmail({ to: who.email, ...mail, idempotencyKey: `summary:${personId}:${category}:${today}` })
      const record = async (status: Digest['status'], error: string | null, tries = attempts) => {
        const { error: e } = await db.from('notification_digests')
          .update({ status, items: items.length, error, attempts: tries, updated_at: new Date().toISOString() })
          .eq('person_id', personId).eq('category', category).eq('local_day', today)
        if (e) report.errors.push(`digest ${category}: ${e.message}`)
      }
      if (res.sent) {
        const e = await markEmailed(db, mine.map(r => r.id), stamp)
        if (e) report.errors.push(`emailed ${category} to ${personId}, not marked: ${e}`)
        await record('sent', null)
        report.sent += 1
      } else if (res.blocked) {
        // This copy cannot email this person at all (staging): let go.
        await record('skipped', res.reason)
        await letGo(mine.map(r => r.id))
      } else {
        // A busy service is tried again next run without using up a try.
        await record('failed', res.reason, res.busy ? attempts - 1 : attempts)
        report.failed += 1
        report.errors.push(`${category} to ${personId}: ${res.reason}`)
      }
      if (res.sent || !res.blocked) await pause(opts.paceMs ?? PACE_MS)
    }
  }
  return report
}
