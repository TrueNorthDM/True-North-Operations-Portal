/**
 * Company settings for Clocky part 2 (Company Settings.dc.html):
 *
 *   13A  Integrations: Rippling and Google Calendar, what each sends and
 *        reads, the errors with Try again
 *   13B  Invoices: numbering, who approves invoices, True North's billing
 *        details, payment terms
 *   13C  Reminders: the timesheet reminders, each on or off, and the bell
 *        lines Clocky part 2 adds
 *
 * Read for Super Admins (who change them) and Admins (read only). Secrets
 * never leave the server: only the last four characters of the Rippling token
 * and the Google service account's address.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { loadDirectory } from './clocky-context'
import { dateLabel, dayLabel, localDate, stampLabel } from './format'
import { loadConnections } from '@/lib/integrations/connections'
import { loadInvoiceSettings } from './pay-terms'
import { docNumber, seqText } from './doc-number'
import { REMINDERS, type ReminderKey } from './reminder-kinds'

export interface IntegrationError { id: number; when: string; what: string; text: string; failed: boolean; doneText: string | null }

export interface IntegrationsData {
  rippling: { tokenSaved: boolean; tokenEnd: string | null; who: string; facts: { k: string; v: string }[]; errors: IntegrationError[] }
  google: { connected: boolean; saved: boolean; account: string | null; who: string; teamCalendarId: string; goodNewsCalendarId: string; facts: { k: string; v: string }[]; errors: IntegrationError[] }
}

type JobRow = { id: number; kind: string; ref_table: string; payload: Record<string, unknown>; state: string; last_error: string | null; attempts: number; created_at: string; done_at: string | null; next_at: string }

const WHAT: Record<string, string> = { rippling_pto: 'Time off', rippling_pto_cancel: 'Time off', rippling_hours: 'Hours', gcal_upsert: 'Calendar', gcal_delete: 'Calendar' }

const RIPPLING_KINDS = ['rippling_pto', 'rippling_pto_cancel', 'rippling_hours']
const GOOGLE_KINDS = ['gcal_upsert', 'gcal_delete']

/** The outbox as 13A reads it: what is waiting or failed, and what went out in the last two weeks. */
async function readOutbox(now: Date): Promise<JobRow[]> {
  const { data, error } = await createAdminClient().from('integration_jobs').select('id, kind, ref_table, payload, state, last_error, attempts, created_at, done_at, next_at')
    .or(`state.in.(failed,waiting_connection,queued),done_at.gte.${new Date(now.getTime() - 14 * 86_400_000).toISOString()}`).order('id', { ascending: false }).limit(200)
  if (error) throw new Error(`The outbox could not be read: ${error.message}`)
  return (data ?? []) as JobRow[]
}

/** The jobs an integration's error list shows: failed, or sent after a failed try; the newest twelve. */
export function listedErrors<J extends Pick<JobRow, 'kind' | 'state' | 'last_error' | 'attempts'>>(list: readonly J[], kinds: readonly string[]): J[] {
  return list.filter(j => kinds.includes(j.kind) && j.last_error && (j.state === 'failed' || (j.state === 'done' && j.attempts > 1))).slice(0, 12)
}

/**
 * One error line of 13A: who or what the job was for, the kind, the days, and
 * the error. A time off job names its person; an Agenda event's job (8E) has
 * no person, so it names the event by its title and its day (audit, 27
 * October 2026: those lines read "Someone").
 */
export function jobErrorText(p: Record<string, unknown>, error: string | null, nameOf: (id: string) => string, zone: string): string {
  const who = typeof p.who === 'string' ? p.who
    : typeof p.person_id === 'string' ? nameOf(p.person_id)
      : typeof p.summary === 'string' && p.summary.trim() ? `"${p.summary.trim()}"`
        : 'Someone'
  // A timed Agenda event carries instants (startAt, endAt): its day in the viewer's zone.
  const a = typeof p.start === 'string' ? p.start : typeof p.startAt === 'string' ? localDate(p.startAt, zone) : ''
  const b = typeof p.end === 'string' ? p.end : typeof p.endAt === 'string' ? localDate(p.endAt, zone) : ''
  // One day with its weekday ("Thu, Oct 29", 13A); a span as "Oct 4 to Oct 17".
  const days = a && b ? (a === b ? dayLabel(a) : `${dateLabel(a).replace(/, \d{4}$/, '')} to ${dateLabel(b).replace(/, \d{4}$/, '')}`) : ''
  return `${who}${typeof p.kind === 'string' ? `, ${p.kind}` : ''}${days ? `, ${days}` : ''}: "${error}"`
}

/**
 * The rail's "Failed jobs to try again" (owner, 25 October 2026): exactly the
 * rows 13A draws with Try again, read and filtered the same way.
 */
export async function countRetryable(now = new Date()): Promise<number> {
  const list = await readOutbox(now)
  return [RIPPLING_KINDS, GOOGLE_KINDS].reduce((n, kinds) => n + listedErrors(list, kinds).filter(j => j.state === 'failed').length, 0)
}

export async function loadIntegrations(zone: string, now = new Date()): Promise<IntegrationsData> {
  const [conn, dir, list] = await Promise.all([loadConnections(), loadDirectory(), readOutbox(now)])
  const at = (t: string) => stampLabel(t, zone).replace(/, \d{4},/, ',')
  const errorsOf = (kinds: string[]): IntegrationError[] => listedErrors(list, kinds)
    .map(j => {
      const what = WHAT[j.kind] ?? j.kind
      return {
        id: j.id, when: at(j.next_at ?? j.created_at), what,
        text: jobErrorText(j.payload ?? {}, j.last_error, id => dir.nameOf(id), zone),
        failed: j.state === 'failed', doneText: j.state === 'done' && j.done_at ? `Sent ${at(j.done_at)}` : null,
      }
    })
  const waitingRippling = list.filter(j => j.kind.startsWith('rippling') && (j.state === 'waiting_connection' || j.state === 'queued')).length
  const todayLocal = localDate(now, zone)
  // "PTO events written today": time off only, not the Agenda's events (audit, 27 October 2026).
  const gcalToday = list.filter(j => j.kind === 'gcal_upsert' && j.ref_table === 'tc_absence_requests' && j.state === 'done' && j.done_at && localDate(j.done_at, zone) === todayLocal)
  const lastGcal = list.filter(j => j.kind.startsWith('gcal') && j.done_at).sort((a, b) => (a.done_at! < b.done_at! ? 1 : -1))[0]
  const by = (id: string | null, when: string | null) => `${id ? ` by ${dir.nameOf(id)}` : ''}${when ? `, ${dateLabel(localDate(when, zone))}` : ''}`
  return {
    rippling: {
      tokenSaved: conn.rippling.tokenSaved, tokenEnd: conn.rippling.tokenEnd,
      who: conn.rippling.tokenSaved ? `Token saved${by(conn.rippling.connectedBy, conn.rippling.connectedAt)}. Nothing is sent until the portal's Rippling calls are written.` : 'Not connected. Paste the company API token to connect it.',
      facts: [
        { k: 'Sends', v: 'Approved PTO, and approved employee hours by day' },
        { k: 'Reads', v: 'PTO balances (Vacation, Sick, Holiday)' },
        { k: 'Waiting to send', v: waitingRippling ? `${waitingRippling} item${waitingRippling === 1 ? '' : 's'}, sent by themselves once it works` : 'Nothing' },
      ],
      errors: errorsOf(RIPPLING_KINDS),
    },
    google: {
      connected: conn.google.connected, saved: !!conn.google.account, account: conn.google.account,
      who: conn.google.connected ? `Connected as ${conn.google.account ?? 'the service account'}${by(conn.google.connectedBy, conn.google.connectedAt)}.` : conn.google.account ? `Service account ${conn.google.account} saved. Add the team calendar to connect it.` : 'Not connected. Paste the Google service account key to connect it.',
      teamCalendarId: conn.google.teamCalendarId ?? '', goodNewsCalendarId: conn.google.goodNewsCalendarId ?? '',
      facts: [
        { k: 'Last sync', v: lastGcal?.done_at ? `${at(lastGcal.done_at)}${gcalToday.length ? `: ${gcalToday.length} PTO event${gcalToday.length === 1 ? '' : 's'} written today` : ''}` : 'Nothing written yet' },
        { k: 'Writes', v: 'Approved PTO ("Name, out") and events marked for the team calendar' },
        { k: 'Reads', v: 'The Good News Calendar, shown in Agenda (read only)' },
      ],
      errors: errorsOf(GOOGLE_KINDS),
    },
  }
}

export interface InvoiceSettingsData {
  prefix: string
  nextNumber: string
  rmbPrefix: string
  nextInvoice: string
  nextRmb: string
  approvers: { name: string; who: string }[]
  billing: { name: string; address: string; country: string; email: string }
  paymentDays: number
  /** Dollars a mile for a Mileage reimbursement. */
  mileageRate: number
}

export async function loadInvoiceSettingsData(now = new Date()): Promise<InvoiceSettingsData> {
  const [s, dir] = await Promise.all([loadInvoiceSettings(), loadDirectory()])
  // The count never restarts: only the year in the number changes.
  const y = Number(localDate(now, 'America/New_York').slice(0, 4))
  const lines = (s.billingAddress ?? '').split('\n')
  const def = s.defaultApprover
  const others = s.invoiceApprovers.filter(id => id !== def)
  return {
    prefix: s.prefix, nextNumber: seqText(s.nextNumber), rmbPrefix: s.rmbPrefix,
    nextInvoice: docNumber(s.prefix, y, s.nextNumber), nextRmb: docNumber(s.rmbPrefix, y, s.rmbNextNumber),
    approvers: [
      ...(def ? [{ name: dir.nameOf(def), who: others.length ? `Everyone, except the people who report to ${others.map(o => dir.nameOf(o)).join(' or ')}` : 'Everyone' }] : []),
      ...others.map(o => ({ name: dir.nameOf(o), who: 'The people who report to them' })),
    ],
    billing: { name: s.billingName ?? '', address: lines[0] ?? '', country: lines.slice(1).join(', '), email: s.billingEmail ?? '' },
    paymentDays: s.paymentDays,
    mileageRate: s.mileageRate,
  }
}

export { REMINDERS, type ReminderKey }

export async function loadReminders(): Promise<Record<ReminderKey, boolean>> {
  const { data, error } = await createAdminClient().from('app_settings').select('clocky_reminders').eq('singleton_id', 1).maybeSingle()
  // Unread is not "all on": the switches would show on and the hourly run would send what a Super Admin turned off.
  if (error) throw new Error(`Reminder settings could not be read: ${error.message}`)
  const r = (data?.clocky_reminders ?? {}) as Partial<Record<ReminderKey, boolean>>
  return Object.fromEntries(REMINDERS.map(x => [x.key, r[x.key] !== false])) as Record<ReminderKey, boolean>
}
