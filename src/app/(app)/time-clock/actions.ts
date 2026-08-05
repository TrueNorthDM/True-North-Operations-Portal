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
import { loadCurrentPerson } from '@/lib/directory/current-person'
import { dateInZone, durationSeconds, validateDraft, wallToInstant, type Draft } from '@/lib/timeclock/clock'

export interface Result { ok: boolean; error?: string }

const OK: Result = { ok: true }
const fail = (error: string): Result => ({ ok: false, error })

async function context() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const me = await loadCurrentPerson(supabase, user)
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
  revalidatePath('/time-clock')
  return OK
}

export async function stopClock(): Promise<Result> {
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
  revalidatePath('/time-clock')
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
      .from('tc_entries').select('*').eq('id', input.id).maybeSingle()
    const { error, count } = await ctx.supabase
      .from('tc_entries').update(row, { count: 'exact' }).eq('id', input.id)
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

  revalidatePath('/time-clock')
  return OK
}

export async function deleteEntry(id: number): Promise<Result> {
  const ctx = await context()
  if (!ctx) return fail('We could not tell who you are. Sign out and back in.')

  const { data: before } = await ctx.supabase
    .from('tc_entries').select('*').eq('id', id).maybeSingle()
  const { error, count } = await ctx.supabase
    .from('tc_entries').delete({ count: 'exact' }).eq('id', id)
  if (error) return fail(error.message)
  if (!count) return fail('That entry can no longer be deleted. It has been submitted or approved.')

  await audit(ctx, 'delete', null, before, null)
  revalidatePath('/time-clock')
  return OK
}
