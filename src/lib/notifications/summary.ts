/**
 * Sending the daily summary emails (7 October 2026). Runs every 15 minutes
 * from the server's crontab (/api/cron/daily-summary).
 *
 * A daily-summary notification lands in the bell at 8:00 in its person's time
 * zone. Each run looks for the ones that landed and have not been emailed, and
 * for each person whose own calendar says it is a working day (Monday to
 * Friday, not a US federal holiday) and past 8:00, sends them: one email per
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
 * Until migration 092 is run, the run reports it and does nothing.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/resend'
import { renderSummary, type SummaryCategory, type SummaryItem } from '@/lib/email/summary'
import { DAILY_HOUR, TYPE_BY_KEY } from './catalogue'
import { isWorkingDay, missedDays } from './calendar'
import { loadAudience } from './audience'
import { zoneDate, zoneHour } from './schedule'
import { loadZones, missingTable } from './store'
import { zoneLabel } from './zones'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Client = SupabaseClient<any, any, any>

/** How far back a waiting notification still goes out by email. Older ones are let go. */
export const EMAIL_WITHIN_DAYS = 14
/** Tries per person, category and day before a failing address is left until the next working day. */
export const MAX_ATTEMPTS = 3

const DAY = 86_400_000
const CATEGORIES: readonly SummaryCategory[] = ['tools', 'system']

type Waiting = { id: string; person_id: string; type_key: string; title: string; body: string; href: string | null; deliver_at: string }
type Digest = { person_id: string; category: SummaryCategory; status: 'sent' | 'skipped' | 'failed'; attempts: number }

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

async function markEmailed(db: Client, ids: readonly string[], at: string): Promise<void> {
  for (let i = 0; i < ids.length; i += 200) {
    await db.from('notifications').update({ emailed_at: at }).in('id', ids.slice(i, i + 200))
  }
}

/** `origin`: the portal's public address, for the links in the email (publicOrigin of the request). */
export async function sendDailySummaries(opts: { origin: string; now?: Date; db?: Client }): Promise<SummaryReport> {
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
      .order('deliver_at', { ascending: true }).range(from, from + 999)
    if (error) return { ...report, errors: [error.message] }
    waiting.push(...((data ?? []) as Waiting[]))
    if ((data ?? []).length < 1000) break
  }
  report.waiting = waiting.length
  if (!waiting.length) return report

  const byPerson = new Map<string, Waiting[]>()
  for (const w of waiting) (byPerson.get(w.person_id) ?? byPerson.set(w.person_id, []).get(w.person_id)!).push(w)
  const people = [...byPerson.keys()]

  const [aud, zones, { data: digestRows }] = await Promise.all([
    loadAudience(db),
    loadZones(db, people),
    db.from('notification_digests').select('person_id, category, status, attempts, local_day')
      .in('person_id', people).gte('local_day', zoneDate(new Date(now.getTime() - 2 * DAY))),
  ])
  const digests = new Map<string, Digest>()
  for (const d of (digestRows ?? []) as (Digest & { local_day: string })[]) digests.set(`${d.person_id}|${d.category}|${d.local_day}`, d)

  for (const [personId, rows] of byPerson) {
    const zone = zones.get(personId)
    const today = zoneDate(now, zone)
    const who = aud.byId.get(personId)
    if (!who || !who.email) {
      await markEmailed(db, rows.map(r => r.id), stamp)
      report.letGo += rows.length
      continue
    }
    if (!isWorkingDay(today) || zoneHour(now, zone) < DAILY_HOUR) { report.notYet += 1; continue }

    for (const category of CATEGORIES) {
      const mine = rows.filter(r => categoryOf(r.type_key) === category)
      if (!mine.length) continue
      const key = `${personId}|${category}|${today}`
      const before = digests.get(key)
      // Already sent today: anything newer waits for the next working day.
      if (before && (before.status !== 'failed' || before.attempts >= MAX_ATTEMPTS)) continue

      const items: SummaryItem[] = mine.map(r => ({
        type: r.type_key, title: r.title, body: r.body, href: r.href, day: zoneDate(new Date(r.deliver_at), zone),
      }))
      const mail = renderSummary({
        category, firstName: firstName(who.name), today, missed: missedDays(today), items, origin, zoneLabel: zoneLabel(zone),
      })
      const res = await sendEmail({ to: who.email, ...mail })
      const record = async (status: Digest['status'], error: string | null) => {
        const { error: e } = await db.from('notification_digests').upsert({
          person_id: personId, category, local_day: today, status, items: items.length, error,
          attempts: (before?.attempts ?? 0) + 1, updated_at: stamp,
        }, { onConflict: 'person_id,category,local_day' })
        if (e) report.errors.push(`digest ${category}: ${e.message}`)
      }
      if (res.sent) {
        await markEmailed(db, mine.map(r => r.id), stamp)
        await record('sent', null)
        report.sent += 1
      } else if (res.blocked) {
        // This copy cannot email this person at all (staging, no service): let go.
        await markEmailed(db, mine.map(r => r.id), stamp)
        await record('skipped', res.reason)
        report.letGo += mine.length
      } else {
        await record('failed', res.reason)
        report.failed += 1
        report.errors.push(`${category} to ${personId}: ${res.reason}`)
      }
    }
  }
  return report
}
