'use server'

// Writing time.
//
// Every one of these runs on the CALLER's Supabase client, never the service
// role, so migration 058's policies decide what lands: your own person, your
// own open entries, and nothing that is already submitted. The checks below are
// there to give a person a sentence they can act on, not to be the security.
// The database is the security.

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { loadApprovers } from '@/lib/timeclock/approvers'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { allowedTo } from '@/lib/access/resolve'
import { dateInZone, durationSeconds, validateDraft, wallToInstant, type Draft } from '@/lib/timeclock/clock'
import { periodFor } from '@/lib/timeclock/periods'
import { workingDays, validateAbsence, absenceOverlaps } from '@/lib/timeclock/absence'

export interface Result { ok: boolean; error?: string }

const OK: Result = { ok: true }
const fail = (error: string): Result => ({ ok: false, error })

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // The person really signed in, never a View Stage preview: these write.
  const me = await loadCurrentPerson(supabase, user, { real: true })
  if (!me) return null

  const [{ data: settings }, { data: fields }] = await Promise.all([
    supabase.from('tc_settings').select('timezone').eq('singleton_id', 1).maybeSingle(),
    supabase.from('tc_fields').select('id, name, required, active').eq('active', true),
  ])
  const timezone = (settings as { timezone?: string } | null)?.timezone ?? 'America/New_York'
  const required = ((fields ?? []) as { id: number; name: string; required: boolean }[])
    .filter(f => f.required)
    .map(f => ({ id: f.id, name: f.name }))
  return { supabase, me, timezone, required }
}

/**
 * A line in the trail, written next to the change rather than instead of it.
 *
 * Deliberately not fatal: an audit row that fails must not roll back somebody's
 * clock-out. Losing a line of history is bad; losing the hours is worse.
 */
async function audit(
  ctx: NonNullable<Awaited<ReturnType<typeof context>>>,
  action: 'create' | 'update' | 'delete',
  entryId: number | null,
  before: unknown,
  after: unknown,
) {
  await ctx.supabase.from('tc_entry_audit').insert({
    entry_id: entryId,
    action,
    changed_by: ctx.me.id,
    before: before ?? null,
    after: after ?? null,
  })
}

// ─── The clock ──────────────────────────────────────────────────────────────

export async function startClock(input: {
  jobcodeId: number
  fields: Record<string, string>
  notes: string
}): Promise<Result> {
  if (!(await allowedTo('h-week'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  const now = new Date()
  const draft: Draft = {
    jobcodeId: input.jobcodeId,
    startedAt: now.toISOString(),
    endedAt: null,
    durationSeconds: 0,
    entryDate: dateInZone(now, ctx.timezone),
    notes: input.notes,
    fields: input.fields,
  }
  // A running clock has no end yet, so the duration rule cannot apply to it.
  const problem = validateDraft({ ...draft, durationSeconds: 1 }, ctx.required)
  if (problem) return fail(problem)

  const { error } = await ctx.supabase.from('tc_entries').insert({
    person_id: ctx.me.id,
    jobcode_id: input.jobcodeId,
    started_at: draft.startedAt,
    ended_at: null,
    duration_seconds: 0,
    entry_date: draft.entryDate,
    kind: 'clock' as const,
    state: 'open' as const,
    notes: input.notes || null,
    fields: input.fields,
    source: 'portal' as const,
    created_by: ctx.me.id,
  })
  if (error) {
    // The partial unique index on (person_id) where ended_at is null is what
    // makes two running clocks impossible. Say what happened in words.
    if (error.code === '23505') return fail('You are already clocked in. Stop that one first.')
    return fail(error.message)
  }

  await audit(ctx, 'create', null, null, { started_at: draft.startedAt, jobcode_id: input.jobcodeId })
  revalidatePath('/hours')
  return OK
}

export async function stopClock(): Promise<Result> {
  if (!(await allowedTo('h-week'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  const { data: open } = await ctx.supabase
    .from('tc_entries')
    .select('id, started_at')
    .eq('person_id', ctx.me.id)
    .is('ended_at', null)
    .eq('kind', 'clock')
    .maybeSingle()

  const running = open as { id: number; started_at: string } | null
  if (!running) return fail('You are not clocked in.')

  const now = new Date().toISOString()
  const seconds = durationSeconds(running.started_at, now)

  const { error } = await ctx.supabase.from('tc_entries').update({
    ended_at: now,
    duration_seconds: seconds,
    updated_at: now,
  }).eq('id', running.id)
  if (error) return fail(error.message)

  await audit(ctx, 'update', running.id, { ended_at: null }, { ended_at: now, duration_seconds: seconds })
  revalidatePath('/hours')
  return OK
}

// ─── Entries by hand ────────────────────────────────────────────────────────

export async function saveEntry(input: {
  id?: number
  jobcodeId: number
  entryDate: string
  startTime: string        // HH:MM, or '' for a duration-only entry
  endTime: string
  hours: number            // used when there are no times
  fields: Record<string, string>
  notes: string
}): Promise<Result> {
  if (!(await allowedTo('h-week'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  // Times are typed on the company's wall clock. Turning them into instants
  // needs the offset that applied ON THAT DATE, which is why the zone is asked
  // per entry instead of once at boot: a March timesheet and a July one do not
  // share an offset.
  const hasTimes = Boolean(input.startTime && input.endTime)
  const startedAt = hasTimes ? wallToInstant(input.entryDate, input.startTime, ctx.timezone) : null
  const endedAt = hasTimes ? wallToInstant(input.entryDate, input.endTime, ctx.timezone) : null
  const seconds = hasTimes && startedAt && endedAt
    ? durationSeconds(startedAt, endedAt)
    : Math.round(input.hours * 3600)

  const draft: Draft = {
    jobcodeId: input.jobcodeId,
    startedAt, endedAt,
    durationSeconds: seconds,
    entryDate: input.entryDate,
    notes: input.notes,
    fields: input.fields,
  }
  const problem = validateDraft(draft, ctx.required)
  if (problem) return fail(problem)

  const row = {
    person_id: ctx.me.id,
    jobcode_id: input.jobcodeId,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: seconds,
    entry_date: input.entryDate,
    kind: (hasTimes ? 'clock' : 'manual') as 'clock' | 'manual',
    state: 'open' as const,
    notes: input.notes || null,
    fields: input.fields,
    source: 'portal' as const,
    updated_at: new Date().toISOString(),
  }

  if (input.id) {
    const { data: before } = await ctx.supabase
        .from('tc_entries').select('*').eq('id', input.id).eq('person_id', ctx.me.id).maybeSingle()
    const { error, count } = await ctx.supabase
      .from('tc_entries').update(row, { count: 'exact' })
      .eq('id', input.id).eq('person_id', ctx.me.id)
    if (error) return fail(error.message)
    // RLS does not raise on an update that matches nothing, it just changes
    // nothing. Without this check, editing a submitted entry would look like it
    // worked and quietly do nothing at all.
    if (!count) return fail('That entry can no longer be edited. It has been submitted or approved.')
    await audit(ctx, 'update', input.id, before, row)
  } else {
    const { data, error } = await ctx.supabase
      .from('tc_entries').insert({ ...row, created_by: ctx.me.id }).select('id').single()
    if (error) return fail(error.message)
    await audit(ctx, 'create', (data as { id: number }).id, null, row)
  }

  revalidatePath('/hours')
  return OK
}

export async function deleteEntry(id: number): Promise<Result> {
  if (!(await allowedTo('h-week'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  const { data: before } = await ctx.supabase
    .from('tc_entries').select('*').eq('id', id).eq('person_id', ctx.me.id).maybeSingle()
  const { error, count } = await ctx.supabase
    .from('tc_entries').delete({ count: 'exact' }).eq('id', id).eq('person_id', ctx.me.id)
  if (error) return fail(error.message)
  if (!count) return fail('That entry can no longer be deleted. It has been submitted or approved.')

  await audit(ctx, 'delete', null, before, null)
  revalidatePath('/hours')
  return OK
}

/** Who can sign off for me (lib/timeclock/approvers.ts: the Super Admins, for now). */
async function myApprovers(ctx: NonNullable<Awaited<ReturnType<typeof context>>>) {
  return loadApprovers(createAdminClient(), ctx.me.id)
}

// ─── Submitting and approving ───────────────────────────────────────────────
//
// The flow that today happens by email. The point of moving it here is not
// speed, it is that the decision leaves a record: who signed off on which
// month, when, and what they said when they handed it back.

/** The period row for a month, created on first use. */
async function periodId(
  ctx: NonNullable<Awaited<ReturnType<typeof context>>>,
  month: string,
): Promise<number | null> {
  const { start, end } = periodFor(`${month}-01`)
  const { data: found } = await ctx.supabase
    .from('tc_periods').select('id').eq('start_date', start).eq('end_date', end).maybeSingle()
  if (found) return (found as { id: number }).id

  // Created by whoever submits first. Insert is admin-only under 057, so this
  // uses the service role: a period is a calendar fact, not a permission, and
  // the alternative is a person unable to submit until an admin creates a row.
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tc_periods').insert({ start_date: start, end_date: end }).select('id').single()
  if (error) return null
  return (data as { id: number }).id
}

export async function submitPeriod(month: string): Promise<Result> {
  if (!(await allowedTo('h-month'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  const { start, end } = periodFor(`${month}-01`)
  const pid = await periodId(ctx, month)
  if (!pid) return fail('Could not open that pay period.')

  // Refusing an empty month on purpose. A submitted month with nothing in it
  // reads as "I worked nothing", and that is almost never what happened; it is
  // somebody who logged their hours elsewhere and pressed the button here.
  const { count } = await ctx.supabase
    .from('tc_entries').select('id', { count: 'exact', head: true })
    .eq('person_id', ctx.me.id).gte('entry_date', start).lte('entry_date', end)
  if (!count) return fail('There is nothing logged in that month yet.')

  // Somebody has to be able to receive it. Without this the button is a
  // one-way door for anyone with no manager and no team leader.
  if (!(await myApprovers(ctx)).length) {
    return fail('Nobody is set up to approve hours yet, so this would go nowhere. Ask a Super Admin.')
  }

  const { data: existing } = await ctx.supabase
    .from('tc_submissions').select('id, state').eq('person_id', ctx.me.id).eq('period_id', pid).maybeSingle()
  const row = existing as { id: number; state: string } | null
  if (row?.state === 'submitted') return fail('That month has already been sent.')
  if (row?.state === 'approved') return fail('That month is already approved.')

  const now = new Date().toISOString()
  if (row) {
    const { error, count: hit } = await ctx.supabase
      .from('tc_submissions').update({ state: 'submitted', submitted_at: now }, { count: 'exact' })
      .eq('id', row.id)
    if (error) return fail(error.message)
    if (!hit) return fail('That month can no longer be sent.')
  } else {
    const { error } = await ctx.supabase.from('tc_submissions').insert({
      person_id: ctx.me.id, period_id: pid, state: 'submitted', submitted_at: now,
    })
    if (error) return fail(error.message)
  }

  // The entries freeze with it. Without this the month could be sent and then
  // quietly rewritten underneath the person about to sign it.
  //
  // Only the ones born here. Imported hours belong to QuickBooks Time and were
  // never editable anyway, and the policy that governs a regular person already
  // refuses them. Leaving them out makes the behaviour the same for everybody:
  // without this clause an admin froze the imported rows too, because the
  // blanket admin policy let the update through, and nobody else did.
  await ctx.supabase.from('tc_entries').update({ state: 'submitted', updated_at: now })
    .eq('person_id', ctx.me.id).eq('state', 'open').eq('source', 'portal')
    .gte('entry_date', start).lte('entry_date', end)

  revalidatePath('/hours')
  return OK
}

export async function decidePeriod(input: {
  personId: string
  month: string
  decision: 'approve' | 'return'
  note?: string
}): Promise<Result> {
  if (!(await allowedTo('h-waiting'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')
  if (input.personId === ctx.me.id) return fail('You cannot approve your own hours.')

  const { start, end } = periodFor(`${input.month}-01`)
  const pid = await periodId(ctx, input.month)
  if (!pid) return fail('Could not open that pay period.')

  const now = new Date().toISOString()
  const { error, count } = await ctx.supabase
    .from('tc_submissions')
    .update({
      state: input.decision === 'approve' ? 'approved' : 'returned',
      approved_at: input.decision === 'approve' ? now : null,
      approved_by: ctx.me.id,
      note: input.note || null,
    }, { count: 'exact' })
    // Only a month that was sent: the approver's row rules may allow more.
    .eq('person_id', input.personId).eq('period_id', pid).eq('state', 'submitted')
  if (error) return fail(error.message)
  // The policy allows the update only when the row is still 'submitted' and the
  // caller may sign for that person, and it refuses by changing nothing rather
  // than by raising. Zero rows is the refusal.
  if (!count) return fail('That month is not waiting for you. It may have been decided already.')

  await ctx.supabase.from('tc_entries')
    .update({ state: input.decision === 'approve' ? 'approved' : 'open', updated_at: now })
    .eq('person_id', input.personId).eq('state', 'submitted').eq('source', 'portal')
    .gte('entry_date', start).lte('entry_date', end)

  revalidatePath('/hours')
  return OK
}

/**
 * Put a submitted month back in a person's hands.
 *
 * Admin only, and it exists because submitting is otherwise a one-way door.
 * Somebody with no manager and no team leader has nobody who can approve or
 * hand back their month, so without this their timesheet is stuck the moment
 * they press the button. The page refuses to submit in that case, but a person
 * can lose their approver AFTER submitting, which no check at submit time can
 * prevent.
 */
export async function reopenPeriod(personId: string, month: string): Promise<Result> {
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')
  if (!(await allowedTo('h-reopen'))) return fail('Only an admin can reopen a month.')

  const { start, end } = periodFor(`${month}-01`)
  const admin = createAdminClient()
  const { data: period } = await admin
    .from('tc_periods').select('id').eq('start_date', start).eq('end_date', end).maybeSingle()
  if (!period) return fail('That pay period does not exist.')

  const now = new Date().toISOString()
  const { error } = await admin.from('tc_submissions')
    .update({ state: 'draft', submitted_at: null, approved_at: null, approved_by: null })
    .eq('person_id', personId).eq('period_id', (period as { id: number }).id)
  if (error) return fail(error.message)

  // Everything in the month, imported rows included. Reopening is the escape
  // hatch, and an escape hatch that cannot undo what an earlier version of this
  // code did is not one. Imported states are re-read from QuickBooks Time on
  // the next delta anyway.
  await admin.from('tc_entries').update({ state: 'open', updated_at: now })
    .eq('person_id', personId).in('state', ['submitted', 'approved'])
    .gte('entry_date', start).lte('entry_date', end)

  await audit(ctx, 'update', null, { period: month, personId }, { reopenedBy: ctx.me.id })
  revalidatePath('/hours')
  return OK
}

// ─── Time off ───────────────────────────────────────────────────────────────
//
// An approved request GENERATES the entries. That is the whole point: today
// somebody types eight hours against "Vacation" by hand and the request that
// justified it exists only in an inbox. Here the request is the record, and the
// hours are its consequence.

/** The entries an approved request stands for, one per working day. */
async function generateAbsenceEntries(
  ctx: NonNullable<Awaited<ReturnType<typeof context>>>,
  req: { id: number; person_id: string; jobcode_id: number; start_date: string; end_date: string; hours_per_day: number },
) {
  const days = workingDays(req.start_date, req.end_date)
  if (!days.length) return

  const admin = createAdminClient()
  const now = new Date().toISOString()
  const rows = days.map(day => ({
    person_id: req.person_id,
    jobcode_id: req.jobcode_id,
    started_at: null,
    ended_at: null,
    duration_seconds: Math.round(req.hours_per_day * 3600),
    entry_date: day,
    kind: 'absence' as const,
    state: 'open' as const,
    notes: `Time off request #${req.id}`,
    fields: {},
    source: 'portal' as const,
    created_by: ctx.me.id,
    updated_at: now,
  }))
  await admin.from('tc_entries').insert(rows)
}

/**
 * Entries an approval created, removed again when it is undone.
 *
 * Matched by the note carrying the request id. Not elegant, but the alternative
 * is a column on tc_entries that exists for one feature, and the note is what a
 * person reading the timesheet needs to see anyway.
 */
async function removeAbsenceEntries(requestId: number, personId: string) {
  const admin = createAdminClient()
  await admin.from('tc_entries').delete()
    .eq('person_id', personId).eq('kind', 'absence').eq('source', 'portal')
    .eq('notes', `Time off request #${requestId}`)
}

export async function requestAbsence(input: {
  jobcodeId: number
  startDate: string
  endDate: string
  hoursPerDay: number
  reason: string
}): Promise<Result> {
  if (!(await allowedTo('h-timeoff'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  const problem = validateAbsence({
    jobcodeId: input.jobcodeId,
    startDate: input.startDate,
    endDate: input.endDate,
    hoursPerDay: input.hoursPerDay,
    reason: input.reason,
  })
  if (problem) return fail(problem)

  if (!(await myApprovers(ctx)).length) {
    return fail('Nobody is set up to approve time off yet. Ask a Super Admin.')
  }

  // Booking the same day twice is a mistake nobody notices until payroll.
  const { data: mine } = await ctx.supabase
    .from('tc_absence_requests').select('start_date, end_date, state')
    .eq('person_id', ctx.me.id).in('state', ['pending', 'approved'])
  const clash = ((mine ?? []) as { start_date: string; end_date: string }[])
    .find(r => absenceOverlaps(
      { startDate: r.start_date, endDate: r.end_date },
      { startDate: input.startDate, endDate: input.endDate },
    ))
  if (clash) return fail(`You already have time off booked from ${clash.start_date} to ${clash.end_date}.`)

  const { error } = await ctx.supabase.from('tc_absence_requests').insert({
    person_id: ctx.me.id,
    jobcode_id: input.jobcodeId,
    start_date: input.startDate,
    end_date: input.endDate,
    hours_per_day: input.hoursPerDay,
    state: 'pending',
    reason: input.reason || null,
  })
  if (error) return fail(error.message)

  revalidatePath('/hours')
  return OK
}

export async function decideAbsence(input: {
  id: number
  decision: 'approve' | 'deny'
  note?: string
}): Promise<Result> {
  if (!(await allowedTo('h-timeoff')) || !(await allowedTo('h-waiting'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  const { data: found } = await ctx.supabase
    .from('tc_absence_requests').select('*').eq('id', input.id).maybeSingle()
  const req = found as {
    id: number; person_id: string; jobcode_id: number
    start_date: string; end_date: string; hours_per_day: number; state: string
  } | null
  if (!req) return fail('That request is not there any more.')
  if (req.person_id === ctx.me.id) return fail('You cannot decide your own time off.')

  const { error, count } = await ctx.supabase
    .from('tc_absence_requests')
    .update({
      state: input.decision === 'approve' ? 'approved' : 'denied',
      decided_by: ctx.me.id,
      decided_at: new Date().toISOString(),
      decision_note: input.note || null,
    }, { count: 'exact' })
    // Only a request still waiting: the approver's row rules may allow more.
    .eq('id', input.id).eq('state', 'pending')
  if (error) return fail(error.message)
  // The policy refuses by changing nothing rather than by raising, so zero rows
  // is the refusal: either it is no longer pending, or this is not yours to
  // decide.
  if (!count) return fail('That request is not waiting for you. It may have been decided already.')

  if (input.decision === 'approve') await generateAbsenceEntries(ctx, req)
  revalidatePath('/hours')
  return OK
}

export async function cancelAbsence(id: number): Promise<Result> {
  if (!(await allowedTo('h-timeoff'))) return fail('That part of My Hours is not open to your access.')
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  const { error, count } = await ctx.supabase
    .from('tc_absence_requests').update({ state: 'cancelled' }, { count: 'exact' })
    .eq('id', id).eq('person_id', ctx.me.id)
  if (error) return fail(error.message)
  if (!count) return fail('That request can no longer be cancelled.')

  // Cancelling an approved request has to take its hours back out, or the
  // month keeps counting days off that are not happening.
  await removeAbsenceEntries(id, ctx.me.id)
  revalidatePath('/hours')
  return OK
}
