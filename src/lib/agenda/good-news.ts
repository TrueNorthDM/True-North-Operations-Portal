/**
 * The Good News Calendar in the Agenda (Agenda.dc.html 8D, Good News): read
 * from Google into agenda_good_news by the outbox job, at most every 15
 * minutes, two months back and a year ahead. The portal never writes to it;
 * events removed in Google leave the Agenda on the next read.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { accessToken, listEvents, parseServiceAccount, type CalendarEvent } from '@/lib/integrations/google-calendar'
import { addDays } from '@/lib/timeclock/periods'

const EVERY_MS = 15 * 60_000

/** An event's first and last day: all-day ends are exclusive in Google; timed ones keep the day they are written in. */
export function daysOf(e: CalendarEvent): { start: string; end: string; startsAt: string | null; endsAt: string | null } | null {
  if (e.start?.date) {
    const end = e.end?.date ? addDays(e.end.date, -1) : e.start.date
    return { start: e.start.date, end: end < e.start.date ? e.start.date : end, startsAt: null, endsAt: null }
  }
  if (e.start?.dateTime) {
    const start = e.start.dateTime.slice(0, 10), end = (e.end?.dateTime ?? e.start.dateTime).slice(0, 10)
    return { start, end: end < start ? start : end, startsAt: e.start.dateTime, endsAt: e.end?.dateTime ?? null }
  }
  return null
}

export async function syncGoodNews(now = new Date(), force = false): Promise<{ read: number } | null> {
  const c = createAdminClient()
  const { data: s } = await c.from('app_settings').select('google_service_account, google_good_news_calendar_id, good_news_synced_at').eq('singleton_id', 1).maybeSingle()
  if (!s?.google_service_account || !s.google_good_news_calendar_id) return null
  if (!force && s.good_news_synced_at && now.getTime() - Date.parse(s.good_news_synced_at) < EVERY_MS) return null
  const token = await accessToken(parseServiceAccount(s.google_service_account))
  const from = addDays(now.toISOString().slice(0, 10), -62), to = addDays(now.toISOString().slice(0, 10), 366)
  const events = await listEvents(token, s.google_good_news_calendar_id, `${from}T00:00:00Z`, `${to}T00:00:00Z`)
  const rows = events.filter(e => e.status !== 'cancelled').flatMap(e => {
    const d = daysOf(e)
    return d ? [{ google_event_id: e.id, title: e.summary?.trim() || 'Untitled', start_date: d.start, end_date: d.end, starts_at: d.startsAt, ends_at: d.endsAt, description: e.description ?? null, html_link: e.htmlLink ?? null, synced_at: now.toISOString() }] : []
  })
  if (rows.length) {
    const { error } = await c.from('agenda_good_news').upsert(rows, { onConflict: 'google_event_id' })
    if (error) throw new Error(`The Good News Calendar could not be saved: ${error.message}`)
  }
  // What Google no longer has in the window leaves the Agenda.
  const { error: delErr } = await c.from('agenda_good_news').delete().gte('end_date', from).lte('start_date', to).lt('synced_at', now.toISOString())
  if (delErr) throw new Error(`Old Good News events could not be removed: ${delErr.message}`)
  await c.from('app_settings').update({ good_news_synced_at: now.toISOString() }).eq('singleton_id', 1)
  return { read: rows.length }
}
