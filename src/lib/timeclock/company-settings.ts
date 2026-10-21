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
import { dateLabel, localDate, stampLabel } from './format'
import { loadConnections } from '@/lib/integrations/connections'
import { loadInvoiceSettings } from './pay-terms'
import { REMINDERS, type ReminderKey } from './reminder-kinds'

export interface IntegrationError { id: number; when: string; what: string; text: string; failed: boolean; doneText: string | null }

export interface IntegrationsData {
  rippling: { tokenSaved: boolean; tokenEnd: string | null; who: string; facts: { k: string; v: string }[]; errors: IntegrationError[] }
  google: { connected: boolean; saved: boolean; account: string | null; who: string; teamCalendarId: string; goodNewsCalendarId: string; facts: { k: string; v: string }[]; errors: IntegrationError[] }
}

type JobRow = { id: number; kind: string; payload: Record<string, unknown>; state: string; last_error: string | null; attempts: number; created_at: string; done_at: string | null; next_at: string }

const WHAT: Record<string, string> = { rippling_pto: 'Time off', rippling_pto_cancel: 'Time off', rippling_hours: 'Hours', gcal_upsert: 'Calendar', gcal_delete: 'Calendar' }

export async function loadIntegrations(zone: string, now = new Date()): Promise<IntegrationsData> {
  const c = createAdminClient()
  const [conn, dir, { data: jobs, error }] = await Promise.all([
    loadConnections(), loadDirectory(),
    c.from('integration_jobs').select('id, kind, payload, state, last_error, attempts, created_at, done_at, next_at')
      .or(`state.in.(failed,waiting_connection,queued),done_at.gte.${new Date(now.getTime() - 14 * 86_400_000).toISOString()}`).order('id', { ascending: false }).limit(200),
  ])
  if (error) throw new Error(`The outbox could not be read: ${error.message}`)
  const list = (jobs ?? []) as JobRow[]
  const at = (t: string) => stampLabel(t, zone).replace(/, \d{4},/, ',')
  const days = (p: Record<string, unknown>) => {
    const a = String(p.start ?? ''), b = String(p.end ?? '')
    return a && b ? (a === b ? dateLabel(a).replace(/, \d{4}$/, '') : `${dateLabel(a).replace(/, \d{4}$/, '')} to ${dateLabel(b).replace(/, \d{4}$/, '')}`) : ''
  }
  const errorsOf = (kinds: string[]): IntegrationError[] => list
    .filter(j => kinds.includes(j.kind) && j.last_error && (j.state === 'failed' || (j.state === 'done' && j.attempts > 1)))
    .slice(0, 12)
    .map(j => {
      const p = j.payload ?? {}
      const who = typeof p.who === 'string' ? p.who : typeof p.person_id === 'string' ? dir.nameOf(p.person_id) : 'Someone'
      const what = WHAT[j.kind] ?? j.kind
      return {
        id: j.id, when: at(j.next_at ?? j.created_at), what,
        text: `${who}${typeof p.kind === 'string' ? `, ${p.kind}` : ''}${days(p) ? `, ${days(p)}` : ''}: "${j.last_error}"`,
        failed: j.state === 'failed', doneText: j.state === 'done' && j.done_at ? `Sent ${at(j.done_at)}` : null,
      }
    })
  const waitingRippling = list.filter(j => j.kind.startsWith('rippling') && (j.state === 'waiting_connection' || j.state === 'queued')).length
  const todayLocal = localDate(now, zone)
  const gcalToday = list.filter(j => j.kind === 'gcal_upsert' && j.state === 'done' && j.done_at && localDate(j.done_at, zone) === todayLocal)
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
      errors: errorsOf(['rippling_pto', 'rippling_pto_cancel', 'rippling_hours']),
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
      errors: errorsOf(['gcal_upsert', 'gcal_delete']),
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
}

export async function loadInvoiceSettingsData(now = new Date()): Promise<InvoiceSettingsData> {
  const [s, dir, { data: raw }] = await Promise.all([
    loadInvoiceSettings(), loadDirectory(),
    createAdminClient().from('invoice_settings').select('number_year, rmb_number_year').eq('singleton_id', 1).maybeSingle(),
  ])
  const y = Number(localDate(now, 'America/New_York').slice(0, 4))
  const next = (n: number, year: number | null) => String(year && year !== y ? 1 : n).padStart(4, '0')
  const lines = (s.billingAddress ?? '').split('\n')
  const def = s.defaultApprover
  const others = s.invoiceApprovers.filter(id => id !== def)
  return {
    prefix: s.prefix, nextNumber: next(s.nextNumber, raw?.number_year ?? null), rmbPrefix: s.rmbPrefix,
    nextInvoice: `${s.prefix}-${y}-${next(s.nextNumber, raw?.number_year ?? null)}`, nextRmb: `${s.rmbPrefix}-${y}-${next(s.rmbNextNumber, raw?.rmb_number_year ?? null)}`,
    approvers: [
      ...(def ? [{ name: dir.nameOf(def), who: others.length ? `Everyone, except the people who report to ${others.map(o => dir.nameOf(o)).join(' or ')}` : 'Everyone' }] : []),
      ...others.map(o => ({ name: dir.nameOf(o), who: 'The people who report to them' })),
    ],
    billing: { name: s.billingName ?? '', address: lines[0] ?? '', country: lines.slice(1).join(', '), email: s.billingEmail ?? '' },
    paymentDays: s.paymentDays,
  }
}

export { REMINDERS, type ReminderKey }

export async function loadReminders(): Promise<Record<ReminderKey, boolean>> {
  const { data } = await createAdminClient().from('app_settings').select('clocky_reminders').eq('singleton_id', 1).maybeSingle()
  const r = (data?.clocky_reminders ?? {}) as Partial<Record<ReminderKey, boolean>>
  return Object.fromEntries(REMINDERS.map(x => [x.key, r[x.key] !== false])) as Record<ReminderKey, boolean>
}
