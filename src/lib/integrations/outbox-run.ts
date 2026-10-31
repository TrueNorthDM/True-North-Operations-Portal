/**
 * The outbox worker (every 5 minutes, /api/cron/clocky-outbox): sends what is
 * queued in integration_jobs and writes the answer back on the request, so the
 * screens say "Sent to Rippling" or "Rippling refused it" with Try again.
 *
 *   gcal_upsert, gcal_delete   the team calendar (google-calendar.ts): time
 *                              off, and Agenda events and milestones; on
 *                              office@'s own calendar through its Google
 *                              sign-in (Agenda settings, since 31 October
 *                              2026), the old service account only if office@
 *                              is not connected
 *   rippling_*                 not sent yet: what the portal must call in
 *                              Rippling is an open question for the owner, so
 *                              these fail with that sentence instead of
 *                              guessing an API
 *
 * A slow or failing service never blocks a decision: a job that fails for a
 * passing reason is tried again later (5 minutes, then longer), up to 5 times.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { accessToken, deleteEvent, insertAllDay, insertTimed, parseServiceAccount } from './google-calendar'
import { accessTokenFor } from '@/lib/agenda/google-app'
import { notifyClockyTimeOffRefused } from '@/lib/notifications/run'
import { dayLabel } from '@/lib/timeclock/format'

export interface OutboxReport { sent: number; failed: number; retried: number; errors: string[] }

const BATCH = 25
const MAX_ATTEMPTS = 5
const RIPPLING_NOT_BUILT = 'Not sent: the portal does not call Rippling yet. What it must send there is still an open question.'

type Job = { id: number; kind: string; ref_table: string; ref_id: number; payload: Record<string, unknown>; attempts: number }

/** A failure that will not pass by trying again. */
class Final extends Error {}

export async function runOutbox(now = new Date()): Promise<OutboxReport> {
  const c = createAdminClient()
  const report: OutboxReport = { sent: 0, failed: 0, retried: 0, errors: [] }
  const { data, error } = await c.from('integration_jobs').select('id, kind, ref_table, ref_id, payload, attempts')
    .eq('state', 'queued').lte('next_at', now.toISOString()).order('next_at').limit(BATCH)
  if (error) throw new Error(`The outbox could not be read: ${error.message}`)
  const jobs = (data ?? []) as Job[]
  if (!jobs.length) return report
  const [{ data: s }, { data: team }] = await Promise.all([
    c.from('app_settings').select('google_service_account, google_team_calendar_id').eq('singleton_id', 1).maybeSingle(),
    c.from('agenda_accounts').select('id').eq('team_calendar', true).eq('source', 'google').eq('status', 'connected').maybeSingle(),
  ])
  let target: { token: string; calendar: string } | null = null
  const google = async () => {
    if (target) return target
    // The team calendar connected by Google sign-in (office@): its own calendar.
    if (team) {
      const t = await accessTokenFor(team.id as number)
      if (!t) throw new Final('The team calendar (office@) needs to be connected again in Agenda settings.')
      return (target = { token: t, calendar: 'primary' })
    }
    if (!s?.google_service_account) throw new Final('The team calendar is not connected. A Super Admin connects office@ in Agenda settings.')
    if (!s.google_team_calendar_id) throw new Final('No team calendar is set in Company settings, Integrations.')
    return (target = { token: await accessToken(parseServiceAccount(s.google_service_account)), calendar: s.google_team_calendar_id })
  }

  for (const j of jobs) {
    try {
      if (j.kind === 'gcal_upsert') {
        const g = await google()
        if (j.ref_table === 'agenda_events') {
          // An Agenda event or milestone (8E): at a time in its zone, or all day.
          const p = j.payload as { summary?: string; start?: string; end?: string; startAt?: string; endAt?: string; timeZone?: string; location?: string | null; description?: string | null }
          if (!p.summary) throw new Final('The job has no title.')
          // Deleted in the Agenda before it went out: nothing to put on the calendar.
          const { data: still } = await c.from('agenda_events').select('id').eq('id', j.ref_id).maybeSingle()
          if (!still) {
            await c.from('integration_jobs').update({ state: 'done', done_at: new Date().toISOString(), last_error: null, attempts: j.attempts + 1 }).eq('id', j.id)
            continue
          }
          const id = p.startAt && p.endAt && p.timeZone
            ? await insertTimed(g.token, g.calendar, { summary: p.summary, startAt: p.startAt, endAt: p.endAt, timeZone: p.timeZone, location: p.location, description: p.description })
            : p.start && p.end ? await insertAllDay(g.token, g.calendar, { summary: p.summary, start: p.start, end: p.end, transparent: false, location: p.location, description: p.description })
            : null
          if (!id) throw new Final('The job has no days.')
          await c.from('agenda_events').update({ calendar_state: 'done', google_event_id: id }).eq('id', j.ref_id)
        } else {
          const p = j.payload as { who?: string; start?: string; end?: string }
          if (!p.who || !p.start || !p.end) throw new Final('The job has no person or days.')
          // The type of time off stays private (Super Admins and the person): the calendar says only "out".
          const id = await insertAllDay(g.token, g.calendar, { summary: `${p.who}: Time off`, start: p.start, end: p.end })
          if (j.ref_table === 'tc_absence_requests') await c.from('tc_absence_requests').update({ calendar_state: 'done', calendar_event_id: id }).eq('id', j.ref_id)
        }
      } else if (j.kind === 'gcal_delete') {
        const g = await google()
        const eventId = (j.payload as { event_id?: string | null }).event_id
        // Time off cancelled, or an Agenda event edited or deleted (its old copy).
        if (eventId) await deleteEvent(g.token, g.calendar, eventId)
        if (j.ref_table === 'tc_absence_requests') await c.from('tc_absence_requests').update({ calendar_event_id: null }).eq('id', j.ref_id)
      } else {
        throw new Final(RIPPLING_NOT_BUILT)
      }
      await c.from('integration_jobs').update({ state: 'done', done_at: new Date().toISOString(), last_error: null, attempts: j.attempts + 1 }).eq('id', j.id)
      report.sent++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const attempts = j.attempts + 1
      if (e instanceof Final || attempts >= MAX_ATTEMPTS) {
        await c.from('integration_jobs').update({ state: 'failed', last_error: msg, attempts }).eq('id', j.id)
        await markRefused(j, msg)
        report.failed++
      } else {
        const wait = 5 * 60_000 * 2 ** (attempts - 1)
        await c.from('integration_jobs').update({ last_error: msg, attempts, next_at: new Date(now.getTime() + wait).toISOString() }).eq('id', j.id)
        report.retried++
      }
      report.errors.push(`${j.kind} #${j.ref_id}: ${msg}`)
    }
  }
  return report

  async function markRefused(j: Job, msg: string) {
    if (j.ref_table === 'agenda_events') {
      if (j.kind === 'gcal_upsert') await c.from('agenda_events').update({ calendar_state: 'failed' }).eq('id', j.ref_id)
      return
    }
    if (j.ref_table !== 'tc_absence_requests') return
    if (j.kind === 'rippling_pto') {
      await c.from('tc_absence_requests').update({ rippling_state: 'refused', rippling_error: msg }).eq('id', j.ref_id)
      const p = j.payload as { who?: string; kind?: string; start?: string; end?: string }
      const days = p.start && p.end ? (p.start === p.end ? dayLabel(p.start) : `${dayLabel(p.start)} to ${dayLabel(p.end)}`) : ''
      await notifyClockyTimeOffRefused({ requestId: j.ref_id, text: `Rippling refused ${p.who ?? 'someone'}'s time off (${[p.kind, days].filter(Boolean).join(', ')})`, body: `"${msg}"` })
    }
    if (j.kind === 'gcal_upsert') await c.from('tc_absence_requests').update({ calendar_state: 'failed' }).eq('id', j.ref_id)
  }
}
