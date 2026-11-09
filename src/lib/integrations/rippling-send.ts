/**
 * Sending to Rippling (owner, 9 November 2026): the outbox jobs that reach it,
 * the people matched to their Rippling workers, and what waited from before the
 * connection (every approval since North Time started, 8 November 2026).
 *
 *   rippling_pto         an approved time off: one approved leave request a
 *                        day, ids kept on the request so nothing is sent twice
 *   rippling_pto_cancel  that time off cancelled: each of those days cancelled
 *   rippling_hours       an employee's approved pay period: one total a day,
 *                        created, changed or removed so Rippling holds exactly
 *                        what the portal approved
 *
 * The rules are in rippling-rules.ts (tested), the calls in rippling.ts.
 * Staging never sends: its data is a copy (connections.ts).
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadRoutes } from '@/lib/timeclock/pay-terms'
import { loadStartDates } from '@/lib/timeclock/waves-data'
import { cancelLeave, companyName, createHours, createLeave, deleteHours, listLeaveTypes, listWorkers, RipplingError, updateHours } from './rippling'
import { hoursByDay, leaveDays, leaveTypeFor, matchWorkers, planEntries, sentLeave, type SentEntries } from './rippling-rules'

/** The day North Time started (Wave 1's pay period): nothing before it is sent. */
export const RIPPLING_FROM = '2026-11-08'

type Db = ReturnType<typeof createAdminClient>
export type OutJob = { id: number; kind: string; ref_table: string; ref_id: number; payload: Record<string, unknown>; attempts: number }

export async function ripplingToken(c: Db = createAdminClient()): Promise<string> {
  const { data, error } = await c.from('app_settings').select('rippling_api_token').eq('singleton_id', 1).maybeSingle()
  if (error) throw new Error(`The Rippling token could not be read: ${error.message}`)
  if (!data?.rippling_api_token) throw new RipplingError('Rippling is not connected. A Super Admin pastes the token in Company settings, Integrations.', 0, true)
  return data.rippling_api_token as string
}

// ── People ──────────────────────────────────────────────────────────────────

export interface MatchReport { company: string; employees: number; matched: number; missing: string[] }

/**
 * Every active US employee matched to their Rippling worker by email, saved on
 * the person; a person no longer matched loses the old id (never a stale one).
 */
export async function matchPeople(token: string, c: Db = createAdminClient()): Promise<MatchReport> {
  const [company, workers, routes, { data: people, error }] = await Promise.all([
    companyName(token), listWorkers(token), loadRoutes(),
    c.from('people').select('id, full_name, email_true_north, email_goodnews, email_coe, email_personal, rippling_worker_id').eq('status', 'active'),
  ])
  if (error) throw new Error(`The people could not be read: ${error.message}`)
  const employees = (people ?? []).filter(p => routes.get(p.id) && !routes.get(p.id)!.isContractor)
  const found = matchWorkers(employees.map(p => ({ id: p.id, emails: [p.email_true_north, p.email_goodnews, p.email_coe, p.email_personal] })), workers)
  for (const p of employees) {
    const id = found.get(p.id) ?? null
    if (id === (p.rippling_worker_id ?? null)) continue
    const { error: e } = await c.from('people').update({ rippling_worker_id: id }).eq('id', p.id)
    if (e) throw new Error(`The Rippling match was not saved: ${e.message}`)
  }
  return { company, employees: employees.length, matched: found.size, missing: employees.filter(p => !found.has(p.id)).map(p => p.full_name ?? 'Someone').sort() }
}

async function workerOf(c: Db, personId: string, who: string): Promise<string> {
  const { data } = await c.from('people').select('rippling_worker_id').eq('id', personId).maybeSingle()
  if (!data?.rippling_worker_id) throw new RipplingError(`${who} is not matched to a Rippling employee. Check that their work email is the same in both, then press Match people in Company settings, Integrations.`, 0, true)
  return data.rippling_worker_id as string
}

// ── The jobs ────────────────────────────────────────────────────────────────

/** One outbox job to Rippling. Throws RipplingError (final or not) when it does not go. */
export async function sendRipplingJob(j: OutJob, token: string, c: Db = createAdminClient()): Promise<void> {
  if (j.kind === 'rippling_pto') return sendTimeOff(j, token, c)
  if (j.kind === 'rippling_pto_cancel') return cancelTimeOff(j, token, c)
  if (j.kind === 'rippling_hours') return sendHours(j, token, c)
  throw new RipplingError(`Unknown Rippling job: ${j.kind}.`, 0, true)
}

let leaveTypes: { at: number; types: { id: string; name: string }[] } | null = null
async function typesOf(token: string) {
  if (!leaveTypes || Date.now() - leaveTypes.at > 10 * 60_000) leaveTypes = { at: Date.now(), types: await listLeaveTypes(token) }
  return leaveTypes.types
}

async function sendTimeOff(j: OutJob, token: string, c: Db): Promise<void> {
  const { data: r, error } = await c.from('tc_absence_requests').select('id, person_id, state, hours_per_day, rippling_request_ids').eq('id', j.ref_id).maybeSingle()
  if (error) throw new Error(`The time off could not be read: ${error.message}`)
  // Cancelled before it went out: nothing to send.
  if (!r || r.state !== 'approved') return
  const p = j.payload as { kind?: string; days?: string[]; who?: string }
  const who = p.who ?? 'This person'
  const worker = await workerOf(c, r.person_id, who)
  const typeId = leaveTypeFor(p.kind ?? '', await typesOf(token))
  if (!typeId) throw new RipplingError(`Rippling has no leave type for "${p.kind ?? 'this kind'}". Only Vacation, Sick and Unpaid Time Off go to Rippling.`, 0, true)
  const done = sentLeave(r.rippling_request_ids as string[] | null)
  for (const d of leaveDays(p.days ?? [], Number(r.hours_per_day))) {
    if (done.has(d.day)) continue
    const id = await createLeave(token, { workerId: worker, typeId, day: d.day, hours: d.hours, comment: `True North portal, time off request #${r.id}` })
    done.set(d.day, id)
    // Kept after each day, so a retry after a failure never sends a day twice.
    const { error: e } = await c.from('tc_absence_requests').update({ rippling_request_ids: [...done].map(([day, x]) => `${day}:${x}`) }).eq('id', r.id)
    if (e) throw new Error(`The Rippling id was not saved: ${e.message}`)
  }
  await c.from('tc_absence_requests').update({ rippling_state: 'sent', rippling_sent_at: new Date().toISOString(), rippling_error: null }).eq('id', r.id)
}

async function cancelTimeOff(j: OutJob, token: string, c: Db): Promise<void> {
  const { data: r, error } = await c.from('tc_absence_requests').select('id, person_id, rippling_request_ids').eq('id', j.ref_id).maybeSingle()
  if (error) throw new Error(`The time off could not be read: ${error.message}`)
  if (!r) return
  const left = sentLeave(r.rippling_request_ids as string[] | null)
  if (!left.size) return
  const worker = await workerOf(c, r.person_id, (j.payload as { who?: string }).who ?? 'This person')
  for (const [day, id] of [...left]) {
    await cancelLeave(token, { id, workerId: worker, day })
    left.delete(day)
    await c.from('tc_absence_requests').update({ rippling_request_ids: [...left].map(([d, x]) => `${d}:${x}`) }).eq('id', r.id)
  }
  await c.from('tc_absence_requests').update({ rippling_request_ids: null, rippling_state: null, rippling_sent_at: null }).eq('id', r.id)
}

async function sendHours(j: OutJob, token: string, c: Db): Promise<void> {
  const { data: s, error } = await c.from('tc_submissions').select('id, person_id, state, rippling_entries').eq('id', j.ref_id).maybeSingle()
  if (error) throw new Error(`The pay period could not be read: ${error.message}`)
  // Opened again after the approval: the next approval sends it.
  if (!s || s.state !== 'approved') return
  const p = j.payload as { start?: string; end?: string; who?: string }
  if (!p.start || !p.end) throw new RipplingError('The job has no pay period.', 0, true)
  const [{ data: people }, starts, { data: entries, error: eErr }] = await Promise.all([
    c.from('people').select('full_name').eq('id', s.person_id).maybeSingle(),
    loadStartDates(c),
    c.from('tc_entries').select('entry_date, duration_seconds, kind').eq('person_id', s.person_id).gte('entry_date', p.start).lte('entry_date', p.end),
  ])
  if (eErr) throw new Error(`The hours could not be read: ${eErr.message}`)
  const who = p.who ?? people?.full_name ?? 'This person'
  const startsOn = starts.get(s.person_id) ?? null
  const from = startsOn && startsOn > RIPPLING_FROM ? startsOn : RIPPLING_FROM
  const next = hoursByDay((entries ?? []) as { entry_date: string; duration_seconds: number | null; kind: string }[], p.start, p.end, startsOn ? from : null)
  const sent: SentEntries = { ...((s.rippling_entries as SentEntries | null) ?? {}) }
  const plan = planEntries(sent, next)
  if (!plan.create.length && !plan.update.length && !plan.remove.length) return
  const worker = await workerOf(c, s.person_id, who)
  const save = async () => {
    const { error: e } = await c.from('tc_submissions').update({ rippling_entries: sent }).eq('id', s.id)
    if (e) throw new Error(`What went to Rippling was not saved: ${e.message}`)
  }
  for (const x of plan.remove) { await deleteHours(token, x.id); delete sent[x.day]; await save() }
  for (const x of plan.update) { await updateHours(token, { id: x.id, workerId: worker, hours: x.hours }); sent[x.day] = { id: x.id, hours: x.hours }; await save() }
  for (const x of plan.create) {
    const id = await createHours(token, { workerId: worker, day: x.day, hours: x.hours, key: `truenorth-${s.person_id}-${x.day}` })
    sent[x.day] = { id, hours: x.hours }
    await save()
  }
}

// ── What waited ─────────────────────────────────────────────────────────────

/**
 * On connecting: every employee pay period approved since North Time started
 * gets its hours job (the approvals before this was built queued none). Each
 * job once, by its key; the time off waiting moves with releaseWaiting.
 */
export async function queueSinceStart(c: Db = createAdminClient()): Promise<number> {
  const [{ data, error }, routes] = await Promise.all([
    c.from('tc_submissions').select('id, person_id, state, approved_at, tc_periods(start_date, end_date)').eq('state', 'approved'),
    loadRoutes(),
  ])
  if (error) throw new Error(`The approved pay periods could not be read: ${error.message}`)
  const { enqueue } = await import('./outbox')
  let n = 0
  for (const s of (data ?? []) as unknown as { id: number; person_id: string; approved_at: string | null; tc_periods: { start_date: string; end_date: string } | null }[]) {
    const per = s.tc_periods
    if (!per || per.end_date < RIPPLING_FROM || routes.get(s.person_id)?.isContractor !== false) continue
    await enqueue({ kind: 'rippling_hours', refTable: 'tc_submissions', refId: s.id, payload: { person_id: s.person_id, start: per.start_date, end: per.end_date }, key: `rippling_hours:${s.id}:${s.approved_at ?? per.start_date}` })
    n++
  }
  return n
}
