import { describe, it, expect } from 'vitest'
import { historyLines, type AuditRow } from './history'
import type { FieldKeys } from './entry-rules'

// SPEC 3G and Time Entries.dc.html: every change, newest first, with real and
// recorded times, the reason, and old and new values.

const NY = 'America/New_York'
const keys: FieldKeys = { company: '1', project: '2', activity: '3', billable: '4', code: '5' }
const names = new Map([['wendy', 'Wendy Cacka'], ['arnaldo', 'Arnaldo Oliveira']])
const job = '2 - i7 Marketing › Web Dev'

const row = (id: number, action: string, by: string | null, at: string, before: AuditRow['before'], after: AuditRow['after'], reason: string | null = null): AuditRow =>
  ({ id, action, changed_by: by, changed_at: at, before, after, reason })

const base = { names, personId: 'wendy', ownerZone: NY, viewerZone: NY, keys, jobPath: job }

describe('historyLines', () => {
  it('tells the whole story of an automatic stop, newest first', () => {
    const lines = historyLines({
      ...base,
      audit: [
        row(1, 'clock_in', 'wendy', '2026-10-15T12:07:00Z', null, { started_at: '2026-10-15T12:00:00Z', started_at_real: '2026-10-15T12:07:00Z', job }),
        row(2, 'auto_stop', null, '2026-10-15T17:02:00Z', { ended_at: null }, { ended_at: '2026-10-15T17:00:00Z', ended_at_real: '2026-10-15T17:07:00Z', job }),
        row(3, 'confirm_end', 'wendy', '2026-10-15T17:20:00Z',
          { started_at: '2026-10-15T12:00:00Z', ended_at: '2026-10-15T17:00:00Z', job },
          { started_at: '2026-10-15T12:00:00Z', ended_at: '2026-10-15T16:45:00Z', ended_at_real: '2026-10-15T16:40:00Z', job }),
      ],
    })
    expect(lines.map(l => l.text)).toEqual([
      'Wendy Cacka confirmed the real end time: 12:40 PM · recorded as 12:45 PM',
      'Clocky stopped the clock automatically after 5h 00m',
      `Wendy Cacka clocked in · ${job} · recorded as 8:00 AM`,
    ])
    expect(lines[0].changes).toEqual([{ field: 'End', old: '1:00 PM', new: '12:45 PM' }])
    expect(lines[1].dot).toBe('#c8323d')
    expect(lines[1].who).toBe('Clocky')
    expect(lines[2].when).toBe('Oct 15, 2026, 8:07 AM')
  })

  it('keeps who edited, what changed and why', () => {
    const [line] = historyLines({
      ...base,
      audit: [row(4, 'edit', 'arnaldo', '2026-10-15T21:12:00Z',
        { started_at: '2026-10-15T12:00:00Z', ended_at: '2026-10-15T22:00:00Z', entry_date: '2026-10-15', job, fields: { 3: 'WebDev' }, notes: null },
        { started_at: '2026-10-15T12:00:00Z', ended_at: '2026-10-15T21:15:00Z', entry_date: '2026-10-15', job, fields: { 3: 'Management' }, notes: null },
        'forgot to clock out')],
    })
    expect(line.text).toBe('Arnaldo Oliveira edited')
    expect(line.when).toBe('Oct 15, 2026, 5:12 PM')
    expect(line.reason).toBe('forgot to clock out')
    expect(line.changes).toEqual([
      { field: 'End', old: '6:00 PM', new: '5:15 PM' },
      { field: 'Activity', old: 'WebDev', new: 'Management' },
    ])
  })

  it('says where an entry came from: QuickBooks Time, or an approved correction', () => {
    const imported = historyLines({ ...base, audit: [], importedAt: '2026-10-02T10:00:00Z' })
    expect(imported.map(l => [l.who, l.text])).toEqual([['Clocky', 'Imported from QuickBooks Time']])

    const approved = historyLines({
      ...base,
      audit: [row(5, 'correction_approved', 'arnaldo', '2026-10-09T21:02:00Z', null, { job })],
      request: { requestedAt: '2026-10-09T20:45:00Z', reason: 'I finished the i7 blog draft after my clock stopped.', seconds: 1800, job },
    })
    expect(approved.map(l => l.text)).toEqual([
      'Arnaldo Oliveira approved the correction',
      `Wendy Cacka requested a time correction: 0h 30m · ${job}`,
    ])
    expect(approved[1].reason).toBe('I finished the i7 blog draft after my clock stopped.')
  })

  it('names who added time and who used the week grid for someone else', () => {
    const lines = historyLines({
      ...base,
      audit: [
        row(6, 'add', 'arnaldo', '2026-10-15T21:00:00Z', null, { job }, 'Status meeting held offline.'),
        row(7, 'grid', 'arnaldo', '2026-10-15T21:01:00Z', null, { duration_seconds: 2.75 * 3600, job }, 'Status meeting held offline.'),
        row(8, 'grid', 'wendy', '2026-10-15T21:02:00Z', null, { duration_seconds: 3600, job }, 'Weekly catch-up.'),
        row(9, 'clocked_out_for', 'arnaldo', '2026-10-15T21:03:00Z', null, { ended_at: '2026-10-15T21:00:00Z', ended_at_real: '2026-10-15T21:03:00Z' }, 'Left the clock running.'),
      ],
    })
    expect(lines.map(l => l.text)).toEqual([
      'Clocked out by Arnaldo Oliveira · recorded as 5:00 PM',
      'Wendy Cacka logged 1h 00m in the week grid',
      'Arnaldo Oliveira added 2h 45m for Wendy Cacka in the week grid',
      'Arnaldo Oliveira added time for Wendy Cacka',
    ])
  })
})
