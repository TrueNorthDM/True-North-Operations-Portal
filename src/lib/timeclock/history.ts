/**
 * An entry's history (SPEC 3G, Time Entries.dc.html): every change, newest
 * first, in words. "Oct 15, 2026, 5:12 PM · Arnaldo Oliveira edited · End
 * 6:00 PM → 5:10 PM · Reason: forgot to clock out".
 *
 * Built from tc_entry_audit rows (each with the entry as it was before and
 * after, and the reason), the correction request an approval came from, and,
 * for rows QuickBooks Time made, the line "Imported from QuickBooks Time".
 * Times inside the sentences are in the entry owner's zone; the stamp of each
 * line in the viewer's.
 *
 * Pure.
 */

import { dayLabel, stampLabel, timeLabel } from './format'
import { formatDuration } from './rounding'
import type { FieldKeys } from './entry-rules'

/** What the audit keeps of an entry, before and after a change. */
export interface Snapshot {
  started_at?: string | null
  ended_at?: string | null
  started_at_real?: string | null
  ended_at_real?: string | null
  duration_seconds?: number
  entry_date?: string
  jobcode_id?: number | null
  /** The job's path when it was written, so the line still reads after a rename. */
  job?: string | null
  fields?: Record<string, string>
  notes?: string | null
  /** Set on the entry a switch ended: where the person went. */
  next_job?: string | null
  /** Set on a clock North Time stopped at the hours allowance: "140h 00m allowance for October" (owner, 25 October 2026). */
  allowance?: string | null
}

export interface AuditRow {
  id: number
  action: string
  changed_by: string | null
  changed_at: string
  before: Snapshot | null
  after: Snapshot | null
  reason: string | null
}

export interface Change { field: string; old: string; new: string }

export interface HistoryLine {
  at: string
  /** "Oct 15, 2026, 5:12 PM", in the viewer's zone. */
  when: string
  /** Who did it: a person's name, or "Clocky". */
  who: string
  text: string
  changes: Change[]
  reason: string | null
  /** The dot beside the line, as the prototype colours it: red for a stop, navy for a change, teal otherwise. */
  dot: string
}

const RED = '#c8323d'
const NAVY = '#012358'
const TEAL = '#1E7D7F'

const labelOfField: [keyof FieldKeys, string][] = [
  ['activity', 'Activity'], ['company', 'Company'], ['project', 'Project'], ['billable', 'Billable'], ['code', 'i7 Code'],
]

/**
 * The fields that changed between two snapshots, old and new as the person
 * reads them ("empty" when none). `keys` may be both structures' (the TSheets
 * fields and the 2026 Activity, which is a field of its own): each is compared.
 */
export function changesBetween(before: Snapshot, after: Snapshot, keys: FieldKeys | readonly FieldKeys[], zone: string): Change[] {
  const out: Change[] = []
  const cmp = (field: string, o: string, n: string) => { if (o !== n) out.push({ field, old: o || 'empty', new: n || 'empty' }) }
  if (before.entry_date && after.entry_date) cmp('Date', dayLabel(before.entry_date), dayLabel(after.entry_date))
  const timed = !!(before.started_at || after.started_at)
  if (timed) {
    cmp('Start', before.started_at ? timeLabel(before.started_at, zone) : '', after.started_at ? timeLabel(after.started_at, zone) : '')
    const end = (s: Snapshot) => (s.started_at ? (s.ended_at ? timeLabel(s.ended_at, zone) : 'now') : '')
    cmp('End', end(before), end(after))
  } else {
    cmp('Duration', formatDuration(before.duration_seconds ?? 0), formatDuration(after.duration_seconds ?? 0))
  }
  if (before.job !== undefined || after.job !== undefined) cmp('Job', before.job ?? '', after.job ?? '')
  // Activity first, as the prototype lists them, then the other fields.
  const order: [keyof FieldKeys, string][] = [labelOfField[0], ...labelOfField.slice(1)]
  const sets: readonly FieldKeys[] = Array.isArray(keys) ? keys : [keys as FieldKeys]
  const seen = new Set<string>()
  for (const [k, label] of order) {
    for (const set of sets) {
      const id = set[k]
      if (!id || seen.has(id)) continue
      seen.add(id)
      cmp(label, before.fields?.[id] ?? '', after.fields?.[id] ?? '')
    }
  }
  cmp('Notes', before.notes ?? '', after.notes ?? '')
  return out
}

const recordedAs = (real: string | null | undefined, recorded: string | null | undefined, zone: string) =>
  real && recorded && timeLabel(real, zone) !== timeLabel(recorded, zone) ? ` · recorded as ${timeLabel(recorded, zone)}` : ''

export interface HistoryInput {
  audit: readonly AuditRow[]
  /** person id -> name */
  names: ReadonlyMap<string, string>
  /** The entry's owner. */
  personId: string
  ownerZone: string
  viewerZone: string
  /** The fields' ids: both structures' when the entry may be in either. */
  keys: FieldKeys | readonly FieldKeys[]
  /** The entry's job path today, for lines written before the path was kept. */
  jobPath: string
  /** source = 'tsheets': imported, with when it arrived. */
  importedAt?: string | null
  /** The correction request an approval made this entry from. */
  request?: { requestedAt: string; reason: string; seconds: number; job: string } | null
}

/** The entry's history, newest first. */
export function historyLines(h: HistoryInput): HistoryLine[] {
  const name = (id: string | null) => (id ? h.names.get(id) ?? 'Someone' : 'North Time')
  const line = (at: string, who: string, text: string, extra: Partial<HistoryLine> = {}): HistoryLine => ({
    at, when: stampLabel(at, h.viewerZone), who, text, changes: [], reason: null, dot: TEAL, ...extra,
  })
  const out: HistoryLine[] = []
  const owner = h.names.get(h.personId) ?? 'Someone'

  if (h.importedAt) out.push(line(h.importedAt, 'North Time', 'Imported from QuickBooks Time'))
  if (h.request) {
    out.push(line(h.request.requestedAt, owner,
      `${owner} requested a time correction: ${formatDuration(h.request.seconds)} · ${h.request.job}`,
      { reason: h.request.reason }))
  }

  for (const a of h.audit) {
    const who = name(a.changed_by)
    const before = a.before ?? {}
    const after = a.after ?? {}
    const job = after.job ?? before.job ?? h.jobPath
    const reason = a.reason?.trim() || null
    switch (a.action) {
      case 'clock_in':
        out.push(line(a.changed_at, who, `${who} clocked in · ${job}${recordedAs(after.started_at_real, after.started_at, h.ownerZone)}`))
        break
      case 'switch':
        out.push(after.next_job
          ? line(a.changed_at, who, `${who} switched to ${after.next_job}${recordedAs(after.ended_at_real, after.ended_at, h.ownerZone)}`)
          : line(a.changed_at, who, `${who} switched to ${job}${recordedAs(after.started_at_real, after.started_at, h.ownerZone)}`))
        break
      case 'clock_out':
        out.push(line(a.changed_at, who, `${who} clocked out${recordedAs(after.ended_at_real, after.ended_at, h.ownerZone)}`))
        break
      case 'undo_clock_out':
        out.push(line(a.changed_at, who, `${who} undid the clock out`))
        break
      case 'auto_stop':
        out.push(line(after.ended_at_real ?? a.changed_at, 'North Time', after.allowance
          ? `North Time stopped the clock at the ${after.allowance}`
          : 'North Time stopped the clock automatically after 5h 00m', { dot: RED }))
        break
      case 'confirm_end': {
        const real = after.ended_at_real ?? after.ended_at
        const changes = changesBetween(before, after, h.keys, h.ownerZone).filter(c => c.field === 'End')
        out.push(line(a.changed_at, who,
          `${who} confirmed the real end time: ${real ? timeLabel(real, h.ownerZone) : ''}${recordedAs(real, after.ended_at, h.ownerZone)}`,
          { changes, dot: changes.length ? NAVY : TEAL }))
        break
      }
      case 'clocked_out_for':
        out.push(line(a.changed_at, who, `Clocked out by ${who}${recordedAs(after.ended_at_real, after.ended_at, h.ownerZone)}`, { reason }))
        break
      case 'add':
        out.push(line(a.changed_at, who, `${who} added time${a.changed_by !== h.personId ? ` for ${owner}` : ''}`, { reason }))
        break
      case 'grid': {
        const d = formatDuration(after.duration_seconds ?? 0)
        out.push(line(a.changed_at, who,
          a.changed_by !== h.personId ? `${who} added ${d} for ${owner} in the week grid` : `${who} logged ${d} in the week grid`,
          { reason }))
        break
      }
      case 'trim': {
        const changes = changesBetween(before, after, h.keys, h.ownerZone)
        out.push(line(a.changed_at, who, `${who} trimmed this entry to fix an overlap`, { changes, reason, dot: NAVY }))
        break
      }
      case 'correction_approved':
        out.push(line(a.changed_at, who, `${who} approved the correction`))
        break
      case 'edit':
      case 'update': {
        const changes = changesBetween(before, after, h.keys, h.ownerZone)
        out.push(line(a.changed_at, who, `${who} edited`, { changes, reason, dot: changes.length ? NAVY : TEAL }))
        break
      }
      case 'create':
        out.push(after.started_at && !after.ended_at
          ? line(a.changed_at, who, `${who} clocked in · ${job}`)
          : line(a.changed_at, who, `${who} added time${a.changed_by !== h.personId ? ` for ${owner}` : ''}`, { reason }))
        break
      // keep_going is Clock safety's record, not a change to the entry.
      default:
        break
    }
  }
  return out.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
}
