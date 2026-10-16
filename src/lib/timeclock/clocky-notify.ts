/**
 * Clocky's notifications, worded in each person's own time zone with the
 * design's copy (SPEC 11, README "Time correction requests", Clock Safety.dc.html
 * frames N1 to N4), and handed to the notification system (lib/notifications/
 * run.ts), which decides from the rules and each person's choices whether and
 * when they land. Nothing here may break the action it rides on: every call
 * catches and logs.
 *
 * Not a "use server" file.
 */

import { headers } from 'next/headers'
import {
  notifyClockyCorrectionDecided, notifyClockyCorrectionRequested, notifyClockyStillWorking,
  notifyClockyStopped, notifyClockyTimeOffRequested,
} from '@/lib/notifications/run'
import type { Db } from '@/lib/supabase/types'
import { loadDirectory } from './clocky-context'
import { localDate, timeLabel } from './format'
import { roundIso } from './rounding'
import { correctionDecidedText, correctionRequestedText, timeOffRequestedText } from './notify-text'
import { stillWorkingText, stopWhen, stoppedText } from './safety'
import type { AutoStop } from './clocky-store'

/** Where links in an email point: the portal's public address (APP_URL), else this request's. */
export async function portalOrigin(): Promise<string> {
  if (process.env.APP_URL) return new URL(process.env.APP_URL).origin
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    if (host) return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`
  } catch { /* outside a request */ }
  return 'https://truenorthportal.online'
}

const quiet = async (what: string, run: () => Promise<unknown>) => {
  try { await run() } catch (e) { console.error(`[clocky] ${what}:`, (e as Error).message) }
}

/** N1 at 4h 30m: the bell only. */
export async function announceStillWorking(x: { personId: string; windowStartedAt: string }, db?: Db): Promise<void> {
  await quiet('still working', async () => {
    const dir = await loadDirectory()
    await notifyClockyStillWorking({ ...x, text: stillWorkingText(x.windowStartedAt, dir.zoneOf(x.personId)) }, db)
  })
}

/** N2 at 5h 00m: the bell and the one email. */
export async function announceStop(st: AutoStop, origin: string, now: Date = new Date(), db?: Db): Promise<void> {
  await quiet('clock stopped', async () => {
    const dir = await loadDirectory()
    const zone = dir.zoneOf(st.personId)
    const when = stopWhen(st.stoppedAt, zone, localDate(now, zone))
    await notifyClockyStopped({
      personId: st.personId,
      entryId: st.entryId,
      text: stoppedText(when),
      stoppedAt: when,
      clockedInAt: timeLabel(roundIso(st.windowStartedAt), zone),
      origin,
    }, db)
  })
}


export async function announceCorrectionRequested(r: { id: number; person_id: string; started_at: string; ended_at: string; entry_date: string }): Promise<void> {
  await quiet('correction requested', async () => {
    const dir = await loadDirectory()
    await notifyClockyCorrectionRequested({
      requestId: r.id,
      personId: r.person_id,
      teamIds: dir.target(r.person_id).teamIds,
      text: correctionRequestedText(dir.nameOf(r.person_id), r, dir.zoneOf(r.person_id)),
    })
  })
}

export async function announceCorrectionDecided(r: { id: number; person_id: string; started_at: string; ended_at: string; entry_date: string }, deciderId: string, approved: boolean, note: string | null): Promise<void> {
  await quiet('correction decided', async () => {
    const dir = await loadDirectory()
    await notifyClockyCorrectionDecided({
      requestId: r.id,
      personId: r.person_id,
      text: correctionDecidedText(dir.nameOf(deciderId), r, approved, note),
    })
  })
}

export async function announceTimeOffRequested(r: { id: number; person_id: string; start_date: string; end_date: string; kind: string; seconds: number }): Promise<void> {
  await quiet('time off requested', async () => {
    const dir = await loadDirectory()
    await notifyClockyTimeOffRequested({
      requestId: r.id,
      personId: r.person_id,
      text: timeOffRequestedText(dir.nameOf(r.person_id), r.kind, r.start_date, r.end_date, r.seconds),
    })
  })
}
