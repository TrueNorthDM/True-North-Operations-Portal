'use server'

/**
 * Agenda (Clocky part 2, Agenda.dc.html 8E): a new event or milestone, and
 * editing or deleting one.
 *
 *   Super Admins and Admins (ag-company)   company events and milestones, for
 *                                          everyone or chosen teams
 *   Team Leaders (ag-team)                 an event for a team they lead
 *
 * Whoever may create an event may edit or delete it (lib/agenda/events.ts,
 * mayManageEvent): no new right.
 *
 * "Add to the team Google Calendar" queues it on the outbox; it waits there
 * while Google Calendar is not connected. An edit takes the old copy off the
 * calendar and queues the new one; a delete takes it off. Writes are for the
 * person really signed in, never during a View Stage preview.
 */

import { revalidatePath } from 'next/cache'
import { writerAccess, type Access } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { enqueue, type JobState } from '@/lib/integrations/outbox'
import { loadDirectory, type Directory } from '@/lib/timeclock/clocky-context'
import { loadClients } from '@/lib/timeclock/requests-data'
import { calendarPayload, calendarPlan, checkEvent, mayManageEvent, type EventFields, type EventInput, type EventRights, type EventRow } from '@/lib/agenda/events'
import type { Fail, Result } from '@/lib/timeclock/clocky-types'

export type NewEventInput = EventInput

const fail = (error: string): Fail => ({ ok: false, error })
const NOT_SAVED = 'Not saved. Try again in a moment.'
const GONE = 'That event is no longer on the Agenda.'
const ROW = 'id, kind, team_id, title, start_date, end_date, starts_at, ends_at, time_zone, place, audience_team_ids, client, description, add_to_google, google_event_id, calendar_state'
/** Calendar jobs not sent yet: they carry a version that no longer exists. */
const PENDING = ['waiting_connection', 'queued', 'failed']

type Stored = EventRow & { id: number; google_event_id: string | null; calendar_state: string | null }

/** The person really signed in, with their event rights; a sentence when they may not write. */
const DOING = { create: 'Creating', edit: 'Editing', delete: 'Deleting' } as const

async function writer(verb: keyof typeof DOING): Promise<Fail | { access: Access & { personId: string }; rights: EventRights; dir: Directory }> {
  if (await getViewAs()) return fail(`View Stage is only a preview. Close it to ${verb} an event.`)
  const access = await writerAccess()
  if (!access?.personId) return fail('Sign in again to save.')
  const dir = await loadDirectory()
  const rights: EventRights = { company: access.can('ag-company'), team: access.can('ag-team'), led: dir.led.get(access.personId) ?? new Set<string>() }
  if (!rights.company && !rights.team) return fail(`${DOING[verb]} events is not open to your access.`)
  return { access: access as Access & { personId: string }, rights, dir }
}

/** A milestone's client must be one of the list, as on create. */
async function clientOk(row: EventFields): Promise<boolean> {
  return !(row.kind === 'milestone' && row.client) || (await loadClients()).includes(row.client)
}

const eventId = (raw: unknown): number | null => { const n = Number(raw); return Number.isSafeInteger(n) && n > 0 ? n : null }

async function loadEvent(id: number): Promise<Stored | null> {
  const { data, error } = await createAdminClient().from('agenda_events').select(ROW).eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Stored | null) ?? null
}

/** Queues one calendar job; a queue that fails never fails the save (a retry would make it twice). */
async function queue(job: Parameters<typeof enqueue>[0]): Promise<JobState | 'unqueued'> {
  try {
    return await enqueue(job)
  } catch (e) {
    console.error('[agenda] calendar queue:', e instanceof Error ? e.message : e)
    return 'unqueued'
  }
}

async function dropPending(id: number): Promise<void> {
  const { error } = await createAdminClient().from('integration_jobs').delete()
    .eq('ref_table', 'agenda_events').eq('ref_id', id).eq('kind', 'gcal_upsert').in('state', PENDING)
  if (error) console.error('[agenda] calendar jobs not taken back:', error.message)
}

const removeJob = (ev: Stored, googleId: string) => ({
  kind: 'gcal_delete' as const, refTable: 'agenda_events', refId: ev.id, key: `agenda_delete:${ev.id}:${googleId}`,
  payload: { event_id: googleId, summary: ev.title, start: ev.start_date, end: ev.end_date },
})

function refresh() {
  revalidatePath('/agenda')
  revalidatePath('/')
}

export async function createAgendaEvent(input: NewEventInput): Promise<Result<{ toast: string }>> {
  const w = await writer('create')
  if ('ok' in w) return w
  try {
    const checked = checkEvent(input, { rights: w.rights, teams: new Set(w.dir.teams.keys()) })
    if (!checked.ok) return fail(checked.error)
    const row = checked.row
    if (!(await clientOk(row))) return fail('Pick the client or project from the list.')
    const google = row.add_to_google

    const c = createAdminClient()
    const { data, error } = await c.from('agenda_events').insert({ ...row, calendar_state: google ? 'waiting' : null, created_by: w.access.personId }).select('id').single()
    if (error) { console.error('[agenda]', error.message); return fail(NOT_SAVED) }

    // The event exists from here: a queue that fails does not fail the save.
    const state = google ? await queue({ kind: 'gcal_upsert', refTable: 'agenda_events', refId: data.id, key: `agenda:${data.id}`, payload: calendarPayload(row) }) : null
    refresh()
    return {
      ok: true,
      toast: !google ? 'Created. Everyone who can see it finds it in Agenda.'
        : state === 'unqueued' ? 'Created. Everyone who can see it finds it in Agenda. It could not be sent to the team Google Calendar.'
        : state === 'waiting_connection' ? 'Created. Everyone who can see it finds it in Agenda. It goes on the team Google Calendar once Google Calendar is connected.'
        : 'Created. Everyone who can see it finds it in Agenda and on the team Google Calendar.',
    }
  } catch (e) {
    console.error('[agenda]', e instanceof Error ? e.message : e)
    return fail(NOT_SAVED)
  }
}

/** Edit (8E prefilled): the same checks as a new one, on an event the person may manage. */
export async function updateAgendaEvent(input: NewEventInput & { id: number }): Promise<Result<{ toast: string }>> {
  const w = await writer('edit')
  if ('ok' in w) return w
  const id = eventId(input?.id)
  if (!id) return fail(GONE)
  try {
    const before = await loadEvent(id)
    if (!before) return fail(GONE)
    if (!mayManageEvent(w.rights, before)) return fail('Editing this event is not open to your access.')
    const checked = checkEvent(input, { rights: w.rights, teams: new Set(w.dir.teams.keys()), keepTeam: before.team_id, keepAudience: before.audience_team_ids })
    if (!checked.ok) return fail(checked.error)
    const row = checked.row
    if (!(await clientOk(row))) return fail('Pick the client or project from the list.')

    const plan = calendarPlan(before, row)
    const c = createAdminClient()
    const { data: moved, error } = await c.from('agenda_events').update({
      ...row,
      calendar_state: plan.send ? 'waiting' : row.add_to_google ? before.calendar_state : null,
      google_event_id: plan.remove ? null : before.google_event_id,
    }).eq('id', id).select('id')
    if (error) { console.error('[agenda]', error.message); return fail(NOT_SAVED) }
    if (!moved?.length) return fail(GONE)

    // The calendar follows: the old copy comes off, the new version goes on.
    if (plan.drop) await dropPending(id)
    const removed = plan.remove ? await queue(removeJob(before, plan.remove)) : null
    const sent = plan.send ? await queue({ kind: 'gcal_upsert', refTable: 'agenda_events', refId: id, key: `agenda:${id}:${Date.now()}`, payload: calendarPayload(row) }) : null
    refresh()
    const base = 'Saved. Everyone who can see it finds the change in Agenda.'
    return {
      ok: true,
      toast: removed === 'unqueued' || sent === 'unqueued' ? `${base} The team Google Calendar could not be updated.`
        : sent === 'waiting_connection' ? `${base} The team Google Calendar follows once Google Calendar is connected.`
        : sent ? `${base} The team Google Calendar follows in the next few minutes.`
        : removed ? `${base} It comes off the team Google Calendar in the next few minutes.`
        : base,
    }
  } catch (e) {
    console.error('[agenda]', e instanceof Error ? e.message : e)
    return fail(NOT_SAVED)
  }
}

/** Delete (8D, confirmed in the card): off the Agenda, and off the team Google Calendar if it is there. */
export async function deleteAgendaEvent(input: { id: number }): Promise<Result<{ toast: string }>> {
  const w = await writer('delete')
  if ('ok' in w) return w
  const id = eventId(input?.id)
  if (!id) return fail(GONE)
  try {
    const ev = await loadEvent(id)
    if (!ev) return fail(GONE)
    if (!mayManageEvent(w.rights, ev)) return fail('Deleting this event is not open to your access.')
    const c = createAdminClient()
    const { data: gone, error } = await c.from('agenda_events').delete().eq('id', id).select('id')
    if (error) { console.error('[agenda]', error.message); return fail('Not deleted. Try again in a moment.') }
    if (!gone?.length) return fail(GONE)

    await dropPending(id)
    const removed = ev.google_event_id ? await queue(removeJob(ev, ev.google_event_id)) : null
    refresh()
    const base = `Deleted. ${ev.kind === 'milestone' ? 'The milestone' : 'The event'} is off the Agenda for everyone.`
    return {
      ok: true,
      toast: removed === 'unqueued' ? `${base} It could not be taken off the team Google Calendar.`
        : removed === 'waiting_connection' ? `${base} It comes off the team Google Calendar once Google Calendar is connected.`
        : removed ? `${base} It comes off the team Google Calendar in the next few minutes.`
        : base,
    }
  } catch (e) {
    console.error('[agenda]', e instanceof Error ? e.message : e)
    return fail('Not deleted. Try again in a moment.')
  }
}
