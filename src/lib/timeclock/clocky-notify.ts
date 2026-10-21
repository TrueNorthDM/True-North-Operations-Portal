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
  notifyClockyStopped, notifyClockyTimeOffRequested, notifyClockyTimeOffDecided, notifyClockyClockedOutFor,
  notifyClockyTimesheetSubmitted, notifyClockyTimesheetDecided,
  notifyClockyInvoiceMade, notifyClockyInvoiceApproved, notifyClockyInvoicePaid,
} from '@/lib/notifications/run'
import type { Db } from '@/lib/supabase/types'
import { loadDirectory } from './clocky-context'
import { localDate, timeLabel } from './format'
import { roundIso } from './rounding'
import {
  clockedOutForText, correctionDecidedText, correctionRequestedText, timeOffDecidedText, timeOffRequestedText,
  timesheetDecidedText, timesheetSubmittedText, invoiceMadeText, invoiceApprovedText, invoicePaidText,
  hoursApprovedForApproverText, hoursApprovedForPersonText,
} from './notify-text'
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

export async function announceTimeOffDecided(r: { id: number; person_id: string; start_date: string; end_date: string; kind: string; seconds: number }, deciderId: string, approved: boolean, note: string | null): Promise<void> {
  await quiet('time off decided', async () => {
    const dir = await loadDirectory()
    await notifyClockyTimeOffDecided({
      requestId: r.id,
      personId: r.person_id,
      text: timeOffDecidedText(dir.nameOf(deciderId), r.kind, r.start_date, r.end_date, r.seconds, approved, note),
    })
  })
}

/** 2E: the person whose clock someone else ended hears who, when (in their own zone) and why. */
export async function announceClockedOutFor(x: { entryId: number; personId: string; byId: string; endedAt: string; reason: string }): Promise<void> {
  await quiet('clocked out for', async () => {
    const dir = await loadDirectory()
    await notifyClockyClockedOutFor({
      entryId: x.entryId,
      personId: x.personId,
      text: clockedOutForText(dir.nameOf(x.byId), timeLabel(x.endedAt, dir.zoneOf(x.personId)), x.reason),
    })
  })
}

/** A period sent (3H): whoever decides it first hears of it (its Reports to, or the invoice approver). */
export async function announceTimesheetSubmitted(x: { submissionId: number; sentAt: string; personId: string; to: readonly string[]; period: string; seconds: number; text?: string }): Promise<void> {
  await quiet('timesheet submitted', async () => {
    const dir = await loadDirectory()
    await notifyClockyTimesheetSubmitted({ submissionId: x.submissionId, sentAt: x.sentAt, personId: x.personId, to: x.to, text: x.text ?? timesheetSubmittedText(dir.nameOf(x.personId), x.period, x.seconds) })
  })
}

/** Approved, returned or reopened: the person hears who did it, and why when it went back. */
export async function announceTimesheetDecided(x: { submissionId: number; at: string; personId: string; deciderId: string; period: string; how: 'approve' | 'return' | 'reopen'; note: string | null }): Promise<void> {
  await quiet('timesheet decided', async () => {
    const dir = await loadDirectory()
    await notifyClockyTimesheetDecided({ submissionId: x.submissionId, at: x.at, personId: x.personId, text: timesheetDecidedText(dir.nameOf(x.deciderId), x.period, x.how, x.note) })
  })
}

/** A contractor's invoice was made from their timesheet: they hear its number and total. */
export async function announceInvoiceMade(x: { invoiceId: number; at: string; personId: string; number: string; month: string; total: string; withHours: boolean }): Promise<void> {
  await quiet('invoice made', () => notifyClockyInvoiceMade({ invoiceId: x.invoiceId, at: x.at, personId: x.personId, text: invoiceMadeText(x.number, x.month, x.total, x.withHours) }))
}

/** An invoice was approved: Finance hears it is ready to pay. */
export async function announceInvoiceApproved(x: { invoiceId: number; personId: string; number: string; total: string; finance: readonly string[] }): Promise<void> {
  await quiet('invoice approved', async () => {
    const dir = await loadDirectory()
    await notifyClockyInvoiceApproved({ invoiceId: x.invoiceId, to: x.finance, text: invoiceApprovedText(x.number, dir.nameOf(x.personId), x.total) })
  })
}

/** Finance marked an invoice paid: its contractor hears the date and the reference. */
export async function announceInvoicePaid(x: { invoiceId: number; personId: string; number: string; month: string; paidOn: string; ref: string | null }): Promise<void> {
  await quiet('invoice paid', () => notifyClockyInvoicePaid({ invoiceId: x.invoiceId, personId: x.personId, text: invoicePaidText(x.number, x.month, x.paidOn, x.ref) }))
}

/** Two steps, the hours approved: the invoice approver hears it waits for them, the person where it went. */
export async function announceHoursApproved(x: { submissionId: number; at: string; personId: string; hoursBy: string; invoiceBy: string; month: string; number: string; total: string }): Promise<void> {
  await quiet('hours approved', async () => {
    const dir = await loadDirectory()
    const by = dir.nameOf(x.hoursBy)
    await notifyClockyTimesheetSubmitted({ submissionId: x.submissionId, sentAt: x.at, personId: x.personId, to: [x.invoiceBy], text: hoursApprovedForApproverText(by, dir.nameOf(x.personId), x.month, x.number, x.total) })
    await notifyClockyTimesheetDecided({ submissionId: x.submissionId, at: x.at, personId: x.personId, text: hoursApprovedForPersonText(by, x.month, x.number, dir.nameOf(x.invoiceBy)) })
  })
}
