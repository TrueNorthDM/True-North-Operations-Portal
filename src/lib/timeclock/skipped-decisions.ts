/**
 * Deciding the TSheets entries set aside after their person's North Time start
 * date (tc_import_skipped, migrations 129 and 130). For each one a Super Admin
 * or Admin either counts it (it becomes a Time entry, source 'tsheets', open)
 * or discards it (marked decided, no entry). Owner, 27 October 2026.
 *
 * Pure: the rules the server action applies (settings/skipped-actions.ts), in
 * one place so they can be tested without a database. The action reads the
 * facts and writes the result.
 */

import type { toEntry } from './import'

/** What the person chose. The database keeps 'imported' and 'dismissed' (migration 129's check). */
export type Choice = 'count' | 'discard'

export const DECISION_OF: Record<Choice, 'imported' | 'dismissed'> = { count: 'imported', discard: 'dismissed' }

/** Most entries one request may decide (the page sends what is selected). */
export const MAX_IDS = 200
/** The reason as it is kept. */
export const MAX_REASON = 500

export interface DecideInput {
  ids: number[]
  choice: Choice
  reason?: string | null
  /** The person saw the allowance line and counts past it anyway, with the reason. */
  pastAllowance?: boolean
}

export type Request =
  | { ok: true; ids: number[]; choice: Choice; reason: string | null; pastAllowance: boolean }
  | { ok: false; error: string }

/** The request as the server accepts it, whatever the browser sent. */
export function checkRequest(input: unknown): Request {
  const i = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const choice = i.choice
  if (choice !== 'count' && choice !== 'discard') return { ok: false, error: 'Choose Count it or Discard it.' }
  const raw = i.ids
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: 'Select an entry first.' }
  const ids: number[] = []
  for (const v of raw) {
    if (typeof v !== 'number' || !Number.isSafeInteger(v) || v <= 0) return { ok: false, error: 'One of the entries is not a TSheets entry.' }
    if (!ids.includes(v)) ids.push(v)
  }
  if (ids.length > MAX_IDS) return { ok: false, error: `Decide at most ${MAX_IDS} entries at a time.` }
  if (i.reason != null && typeof i.reason !== 'string') return { ok: false, error: 'The reason is not text.' }
  const reason = typeof i.reason === 'string' ? i.reason.replace(/\s+/g, ' ').trim().slice(0, MAX_REASON) : ''
  return { ok: true, ids, choice, reason: reason || null, pastAllowance: choice === 'count' && i.pastAllowance === true }
}

/** What the server knows about one entry when it is decided. */
export interface Facts {
  choice: Choice
  /** The row exists in tc_import_skipped. */
  found: boolean
  /** How it was decided, when it is: "Counted by Ana on Oct 28, 2026" (decidedText). */
  decidedLine: string | null
  /** Gone from TSheets since it was set aside. */
  deletedInTsheets: boolean
  /** Still running in TSheets: no end, so no hours yet. */
  running: boolean
  /** The import's own mapping gives it no person, or another person than the one it was set aside for. */
  unmatched: boolean
  /** A Time entry with this TSheets id already exists. */
  inEntries: boolean
  /** The person's period behind the entry's day is submitted or approved: its sentence (periods.ts, lockedMessage). */
  lockedText: string | null
  /** Counting it passes the person's allowance: the allowance sentence (allowance-limit.ts, limitRefusal). */
  overText: string | null
  reason: string | null
  pastAllowance: boolean
}

export type Verdict =
  | { kind: 'ok' }
  | { kind: 'already'; text: string }
  | { kind: 'refused'; text: string }
  /** Past the allowance: `text` is the allowance line, shown before the reason is asked. */
  | { kind: 'needs-reason'; text: string }

export const NO_ROW = 'That entry is no longer set aside.'
export const DELETED = 'This entry was deleted in TSheets since. Discard it instead.'
export const RUNNING = 'This entry is still running in TSheets. Count it after it ends, or discard it.'
export const UNMATCHED = 'This entry no longer matches its person in TSheets. Nothing changed.'
export const IN_ENTRIES = 'Time entries already holds this TSheets entry. Discard it here instead.'
export const REASON_FOR_ALLOWANCE = 'Say why the hours count past the allowance.'

/** Whether the entry may be decided as asked, and if not, the sentence that says why. */
export function judge(f: Facts): Verdict {
  if (!f.found) return { kind: 'refused', text: NO_ROW }
  if (f.decidedLine !== null) return { kind: 'already', text: `Already decided: ${f.decidedLine}. Nothing changed.` }
  if (f.choice === 'discard') return { kind: 'ok' }
  if (f.deletedInTsheets) return { kind: 'refused', text: DELETED }
  if (f.running) return { kind: 'refused', text: RUNNING }
  if (f.unmatched) return { kind: 'refused', text: UNMATCHED }
  if (f.inEntries) return { kind: 'refused', text: IN_ENTRIES }
  if (f.lockedText) return { kind: 'refused', text: f.lockedText }
  // Never cut to fit, never past it unsaid: the whole entry, and only with a reason given after the allowance line was shown.
  if (f.overText && !(f.pastAllowance && f.reason)) return { kind: 'needs-reason', text: f.overText }
  return { kind: 'ok' }
}

/** The hours counting the entry adds to the allowance: time off is not counted against it. */
export const allowanceSeconds = (e: { kind: string; duration_seconds: number }): number =>
  e.kind === 'absence' ? 0 : Math.max(0, e.duration_seconds)

type Mapped = NonNullable<ReturnType<typeof toEntry>>

/**
 * The Time entry a counted entry becomes: the import's own row, open (the
 * person submits it with the rest of their period), and the portal's from now
 * on (changed_here_at), so a later import or a deletion in TSheets leaves it
 * as it was decided.
 */
export function countedRow(entry: Mapped, at: string): Mapped & { state: 'open'; changed_here_at: string } {
  return { ...entry, state: 'open', updated_at: at, changed_here_at: at }
}

export type Outcome = 'done' | 'already' | 'refused' | 'needs-reason'

export interface RowResult { id: number; outcome: Outcome; text: string }

const entries = (k: number) => `${k} ${k === 1 ? 'entry' : 'entries'}`

/** "Counted 3 entries. 1 was already decided, nothing changed. 2 entries need a reason." */
export function summary(choice: Choice, results: readonly RowResult[]): string {
  const n = (o: Outcome) => results.filter(r => r.outcome === o).length
  const parts: string[] = []
  if (n('done')) parts.push(`${choice === 'count' ? 'Counted' : 'Discarded'} ${entries(n('done'))}.`)
  if (n('already')) parts.push(`${n('already') === 1 ? '1 was' : `${n('already')} were`} already decided, nothing changed.`)
  if (n('needs-reason')) parts.push(`${entries(n('needs-reason'))} ${n('needs-reason') === 1 ? 'goes' : 'go'} past the allowance and ${n('needs-reason') === 1 ? 'needs' : 'need'} a reason.`)
  if (n('refused')) parts.push(`${entries(n('refused'))} could not be ${choice === 'count' ? 'counted' : 'discarded'}.`)
  return parts.join(' ')
}

/** The line for settings_change_log: "Ana Lima, Nov 9, 2026: TSheets entry #123 counted (reason)". */
export function logLine(who: string, day: string, id: number, choice: Choice, reason: string | null): string {
  return `${who}, ${day}: TSheets entry #${id} ${choice === 'count' ? 'counted' : 'discarded'}${reason ? ` (${reason})` : ''}`
}

// ── The list ────────────────────────────────────────────────────────────────

export interface Listed { decidedAt: string | null }

/** The two tabs: still to decide, and decided. */
export function splitDecided<T extends Listed>(rows: readonly T[]): { todo: T[]; decided: T[] } {
  return { todo: rows.filter(r => !r.decidedAt), decided: rows.filter(r => !!r.decidedAt) }
}

/** How an entry was decided: "Counted by Ana on Oct 28, 2026" (the date comes formatted). */
export function decidedText(decision: string | null, by: string | null, on: string): string {
  const what = decision === 'imported' ? 'Counted' : decision === 'dismissed' ? 'Discarded' : 'Decided'
  return `${what}${by ? ` by ${by}` : ''}${on ? ` on ${on}` : ''}`
}
