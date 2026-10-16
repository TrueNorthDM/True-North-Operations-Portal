'use server'

/**
 * Who's working (design handoff of 16 October 2026, SPEC section 7, Who's
 * Working.dc.html frames 2A to 2P): the drawer and page data, the count on the
 * top-bar icon, and "Clock out for them..." (2E), which only Super Admins have.
 */

import { revalidatePath } from 'next/cache'
import { loadAccess, writerAccess } from '@/lib/access/resolve'
import { getViewAs } from '@/lib/auth/view-as-server'
import { db, loadCatalog, loadDirectory, viewerFor, type Viewer } from '@/lib/timeclock/clocky-context'
import { audit, closeClock, runningOf, snapshot } from '@/lib/timeclock/clocky-store'
import { countOnTheClock, loadWhosWorking } from '@/lib/timeclock/clocky-working'
import { timeLabel } from '@/lib/timeclock/format'
import { END_AFTER_START, REASON_REQUIRED, reasonOf } from '@/lib/timeclock/entry-rules'
import { canClockOutFor } from '@/lib/timeclock/scope'
import type { Fail, Result, WhosWorkingData } from '@/lib/timeclock/clocky-types'

const NO_ACCESS = "Who's working is not open to your access."
const fail = (error: string): Fail => ({ ok: false, error })
const isFail = (x: unknown): x is Fail => !!x && typeof x === 'object' && (x as Fail).ok === false

async function reader(): Promise<Viewer | Fail> {
  const access = await loadAccess()
  if (!access.can('ck-whos-working')) return fail(NO_ACCESS)
  return (await viewerFor(access)) ?? fail('Your login is not linked to anyone in the Directory.')
}

/** The drawer and the page: everyone in the viewer's scope, with "On the clock" and "Everyone today" left to the screen. */
export async function getWhosWorking(): Promise<Result<{ data: WhosWorkingData }>> {
  const v = await reader()
  if (isFail(v)) return v
  try {
    return { ok: true, data: await loadWhosWorking(v, new Date()) }
  } catch (e) {
    console.error("[clocky who's working]", (e as Error).message)
    return fail("Who's working could not be read. Try again in a moment.")
  }
}

/** The badge on the top-bar icon (no badge at zero). */
export async function getWhosWorkingCount(): Promise<Result<{ count: number }>> {
  const access = await loadAccess()
  if (!access.can('ck-whos-working')) return { ok: true, count: 0 }
  const v = await viewerFor(access)
  if (!v) return { ok: true, count: 0 }
  try {
    return { ok: true, count: await countOnTheClock(v) }
  } catch (e) {
    console.error("[clocky who's working] count:", (e as Error).message)
    return { ok: true, count: 0 }
  }
}

/**
 * "Clock out for them..." (2E): a Super Admin ends someone's running clock at
 * a time between its start and now (default now), with a required reason. The
 * entry is marked "Clocked out by <name>"; the time is recorded on the quarter
 * hour like every other.
 */
export async function clockOutFor(input: { personId: string; end?: string; reason: string }): Promise<Result<{ toast: string }>> {
  if (await getViewAs()) return fail('View Stage is only a preview. Close it to clock anyone out.')
  const access = await writerAccess()
  if (!access) return fail('Sign in again to save.')
  if (!access.can('ck-clock-out-for')) return fail('Only a Super Admin can clock someone out.')
  const v = await viewerFor(access)
  if (!v) return fail('Your login is not linked to anyone in the Directory.')
  try {
    const now = new Date()
    const c = db()
    const [catalog, dir] = await Promise.all([loadCatalog(), loadDirectory()])
    const personId = String(input.personId ?? '')
    if (!dir.people.has(personId) || !canClockOutFor(v, dir.target(personId))) return fail('Only a Super Admin can clock someone out.')
    const reason = reasonOf(input.reason)
    if (!reason) return fail(REASON_REQUIRED)
    const e = await runningOf(c, personId)
    if (!e || !e.started_at) return fail('They are not on the clock any more.')
    const end = !input.end || input.end === 'now' ? now : new Date(input.end)
    if (Number.isNaN(end.getTime()) || end.getTime() > now.getTime() + 60_000) return fail('Pick an end time.')
    if (end.getTime() <= Date.parse(e.started_at_real ?? e.started_at)) return fail(END_AFTER_START)
    const closed = await closeClock(c, e, end, dir.zoneOf(personId), { patch: { clocked_out_by: v.personId } })
    if (!closed) return fail('They are not on the clock any more.')
    await c.from('tc_entries').update({ clocked_out_by: v.personId }).in('id', closed.ids)
    await audit(c, [{
      entryId: closed.lastId, action: 'clocked_out_for', by: v.personId, reason, before: snapshot(e, catalog),
      after: snapshot({ ...e, ended_at: closed.recordedEnd, ended_at_real: closed.realEnd }, catalog, { split_ids: closed.ids }),
    }])
    revalidatePath('/clocky-hours')
    return { ok: true, toast: `${dir.nameOf(personId)} clocked out at ${timeLabel(end, v.zone)}. Marked "Clocked out by ${v.name}".` }
  } catch (e) {
    console.error("[clocky who's working] clock out:", (e as Error).message)
    return fail('Not saved. Try again in a moment.')
  }
}
