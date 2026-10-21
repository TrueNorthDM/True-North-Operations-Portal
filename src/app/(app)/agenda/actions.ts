'use server'

/**
 * Agenda (Clocky part 2, Agenda.dc.html 8E): a new event or milestone.
 *
 *   Super Admins and Admins (ag-company)   company events and milestones, for
 *                                          everyone or chosen teams
 *   Team Leaders (ag-team)                 an event for a team they lead
 *
 * "Add to the team Google Calendar" queues it on the outbox; it waits there
 * while Google Calendar is not connected. Writes are for the person really
 * signed in, never during a View Stage preview.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enqueue } from '@/lib/integrations/outbox'
import { loadDirectory } from '@/lib/timeclock/clocky-context'
import { wallToInstant } from '@/lib/timeclock/clock'
import { loadClients } from '@/lib/timeclock/requests-data'
import { addDays } from '@/lib/timeclock/periods'
import { EVENT_ZONES } from '@/lib/agenda/zones'
import type { Fail, Result } from '@/lib/timeclock/clocky-types'

export interface NewEventInput {
  kind: 'event' | 'milestone'
  when: 'time' | 'day' | 'range'
  title: string
  /** yyyy-mm-dd */
  date: string
  end?: string
  /** "15:00" */
  from?: string
  to?: string
  zone: string
  place?: string
  /** Team ids; empty is everyone. */
  teams: string[]
  client?: string
  description?: string
  google: boolean
}

const fail = (error: string): Fail => ({ ok: false, error })
const ISO = /^\d{4}-\d{2}-\d{2}$/
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export async function createAgendaEvent(input: NewEventInput): Promise<Result<{ toast: string }>> {
  if (await getViewAs()) return fail('View Stage is only a preview. Close it to create an event.')
  const access = await writerAccess()
  if (!access?.personId) return fail('Sign in again to save.')
  const company = access.can('ag-company')
  if (!company && !access.can('ag-team')) return fail('Creating events is not open to your access.')
  try {
    const dir = await loadDirectory()
    const kind = input.kind === 'milestone' ? 'milestone' : 'event'
    if (kind === 'milestone' && !company) return fail('Super Admins and Admins create milestones.')
    const title = String(input.title ?? '').trim()
    if (!title) return fail('Give it a title.')
    if (title.length > 160) return fail('The title is too long.')
    const date = String(input.date ?? '')
    if (!ISO.test(date)) return fail('Pick the date.')

    // Who sees it: a Team Leader's event is for one team they lead.
    const teams = [...new Set((input.teams ?? []).map(String))].filter(t => dir.teams.has(t))
    let teamId: string | null = null
    if (!company) {
      const led = dir.led.get(access.personId) ?? new Set<string>()
      if (teams.length !== 1 || !led.has(teams[0])) return fail('Pick the team you lead.')
      teamId = teams[0]
    }

    const zone = EVENT_ZONES.some(z => z.zone === input.zone) ? input.zone : EVENT_ZONES[0].zone
    const startDate = date
    let endDate = date, startsAt: string | null = null, endsAt: string | null = null
    if (input.when === 'time') {
      if (!HHMM.test(String(input.from)) || !HHMM.test(String(input.to))) return fail('Pick when it starts and ends.')
      if (String(input.to) <= String(input.from)) return fail('It must end after it starts.')
      startsAt = wallToInstant(date, String(input.from), zone)
      endsAt = wallToInstant(date, String(input.to), zone)
      if (!startsAt || !endsAt) return fail('Pick when it starts and ends.')
    } else if (input.when === 'range') {
      const end = String(input.end ?? '')
      if (!ISO.test(end) || end < date) return fail('Pick the last day, on or after the first.')
      if (end > addDays(date, 62)) return fail('A few days is up to two months.')
      endDate = end
    }

    const client = String(input.client ?? '').trim()
    if (kind === 'milestone' && client && !(await loadClients()).includes(client)) return fail('Pick the client or project from the list.')
    const place = String(input.place ?? '').trim().slice(0, 300) || null
    const description = String(input.description ?? '').trim().slice(0, 2000) || null
    const google = !!input.google

    const c = createAdminClient()
    const { data, error } = await c.from('agenda_events').insert({
      kind, team_id: teamId, title, start_date: startDate, end_date: endDate, starts_at: startsAt, ends_at: endsAt,
      time_zone: startsAt ? zone : null, place, audience_team_ids: teams.length ? teams : null,
      client: kind === 'milestone' && client ? client : null, description, add_to_google: google,
      calendar_state: google ? 'waiting' : null, created_by: access.personId,
    }).select('id').single()
    if (error) { console.error('[agenda]', error.message); return fail('Not saved. Try again in a moment.') }

    let waiting = false
    if (google) {
      const state = await enqueue({
        kind: 'gcal_upsert', refTable: 'agenda_events', refId: data.id, key: `agenda:${data.id}`,
        payload: startsAt && endsAt
          ? { summary: title, startAt: startsAt, endAt: endsAt, timeZone: zone, location: place, description }
          : { summary: title, start: startDate, end: endDate, location: place, description },
      })
      waiting = state === 'waiting_connection'
    }
    revalidatePath('/agenda')
    revalidatePath('/')
    return {
      ok: true,
      toast: !google ? 'Created. Everyone who can see it finds it in Agenda.'
        : waiting ? 'Created. Everyone who can see it finds it in Agenda. It goes on the team Google Calendar once Google Calendar is connected.'
        : 'Created. Everyone who can see it finds it in Agenda and on the team Google Calendar.',
    }
  } catch (e) {
    console.error('[agenda]', e instanceof Error ? e.message : e)
    return fail('Not saved. Try again in a moment.')
  }
}
