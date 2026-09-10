/**
 * The donation records themselves, rather than the totals a report shows.
 *
 * The report answers "what came in this month" and the month-by-month table
 * answers "how has the year gone". Neither answers "what have we entered, when
 * did we enter it, and has anyone changed it", which is what a person who types
 * these figures in needs when they want to check their own work.
 *
 * Read with the privileged client and gated in app code, like every other
 * client-report read: row-level security is the floor here, not the gate.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { TRACKED_PROJECTS } from './projects'

const NAME_OF = new Map<string, string>(TRACKED_PROJECTS.map(p => [p.label, p.name]))

/** Unrestricted donations name no project. 079 kept the column nullable. */
export const UNRESTRICTED = 'Not tied to a project'

export function projectName(label: string | null): string {
  return label === null ? UNRESTRICTED : NAME_OF.get(label) ?? label
}

export interface DonationEntry {
  id: number
  project: string | null
  projectName: string
  month: string
  amount: number
  note: string | null
  /** From the newest log entry, so it survives the person being renamed. */
  lastChangedAt: string | null
  lastChangedBy: string | null
  /** How many times this figure has been touched since it was created. */
  changes: number
}

export interface DonationLogEntry {
  id: number
  month: string
  projectName: string
  action: 'created' | 'updated' | 'deleted'
  amountBefore: number | null
  amountAfter: number | null
  noteBefore: string | null
  noteAfter: string | null
  actor: string
  at: string
}

export interface DonationLedger {
  entries: DonationEntry[]
  log: DonationLogEntry[]
  /** Every year that has either an entry or a log line, newest first. */
  years: string[]
  /** True when migration 080 has not been applied yet. */
  logMissing: boolean
}

/** "Imported from the tracking sheet" is written as a name with no email. */
function actorLabel(name: string | null, email: string | null): string {
  if (name && email) return name
  if (name) return name
  if (email) return email
  // A row with neither is a write that happened outside the screen.
  return 'Unknown'
}

export interface RawDonation {
  id: number; project_label: string | null; month: string; amount_usd: string | number; note: string | null
}

export interface RawLogRow {
  id: number; donation_id: number | null; project_label: string | null; month: string
  action: 'created' | 'updated' | 'deleted'
  amount_before: string | number | null; amount_after: string | number | null
  note_before: string | null; note_after: string | null
  actor_name: string | null; actor_email: string | null; at: string
}

/**
 * The shaping, apart from the reading, so it can be tested.
 *
 * `rawLog` must be newest first: the first entry seen for a donation is taken
 * as its latest change, which is cheaper than sorting again and is the order
 * the query already asks for.
 */
export function deriveLedger(
  donations: RawDonation[],
  rawLog: RawLogRow[],
  year: string | null,
  logMissing = false,
): DonationLedger {
  const latest = new Map<number, { at: string; by: string }>()
  const counted = new Map<number, number>()
  for (const l of rawLog) {
    if (l.donation_id == null) continue
    if (!latest.has(l.donation_id)) {
      latest.set(l.donation_id, { at: l.at, by: actorLabel(l.actor_name, l.actor_email) })
    }
    // 'created' is the entry existing, not a change to it.
    if (l.action !== 'created') counted.set(l.donation_id, (counted.get(l.donation_id) ?? 0) + 1)
  }

  const all: DonationEntry[] = donations.map(d => ({
    id: d.id,
    project: d.project_label,
    projectName: projectName(d.project_label),
    month: d.month,
    amount: Number(d.amount_usd),
    note: d.note,
    lastChangedAt: latest.get(d.id)?.at ?? null,
    lastChangedBy: latest.get(d.id)?.by ?? null,
    changes: counted.get(d.id) ?? 0,
  }))

  const log: DonationLogEntry[] = rawLog.map(l => ({
    id: l.id,
    month: l.month,
    projectName: projectName(l.project_label),
    action: l.action,
    amountBefore: l.amount_before === null ? null : Number(l.amount_before),
    amountAfter: l.amount_after === null ? null : Number(l.amount_after),
    noteBefore: l.note_before,
    noteAfter: l.note_after,
    actor: actorLabel(l.actor_name, l.actor_email),
    at: l.at,
  }))

  // Offered from what exists rather than from a fixed range, so the filter
  // never offers a year with nothing in it and never hides one that has.
  const years = [...new Set([...all, ...log].map(r => r.month.slice(0, 4)))].sort().reverse()

  return {
    entries: year ? all.filter(e => e.month.startsWith(year)) : all,
    log: year ? log.filter(l => l.month.startsWith(year)) : log,
    years,
    logMissing,
  }
}

/**
 * @param year Four digits, or null for every year.
 */
export async function loadDonationLedger(year: string | null): Promise<DonationLedger> {
  const supabase = createAdminClient()

  const [donations, logRows] = await Promise.all([
    supabase.from('tc_project_donations')
      .select('id, project_label, month, amount_usd, note')
      .order('month', { ascending: false }),
    supabase.from('tc_project_donations_log')
      .select('id, donation_id, project_label, month, action, amount_before, amount_after, note_before, note_after, actor_name, actor_email, at')
      .order('at', { ascending: false }),
  ])

  // The log table arriving missing is not an error worth a crash: PostgREST
  // resolves rather than rejects, so an unapplied migration reaches here as a
  // null. The page then shows the entries and says the log is not there yet.
  return deriveLedger(
    (donations.data ?? []) as RawDonation[],
    (logRows.data ?? []) as RawLogRow[],
    year,
    !!logRows.error,
  )
}
