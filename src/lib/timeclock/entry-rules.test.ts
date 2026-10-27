import { describe, it, expect } from 'vitest'
import {
  REASON_REQUIRED, activityNeedsNotes, clockDay, structureOn, approveOverlapLine, attentionReason, correctionOverlapLine, firstOverlap, gateText,
  missingFields, overlapLine, overlapsAmong, reasonOf, sharedSpan, splitAtMidnight, trimOther, trimThis, type FieldKeys,
} from './entry-rules'

const NY = 'America/New_York'
const t = (hhmm: string, day = '15') => `2026-10-${day}T${hhmm}:00.000Z` // 12:00Z is 8:00 AM in New York
const now = new Date(t('20:00'))

describe('no overlaps (README "Rules" 8)', () => {
  it('finds what two entries share, a running one counting to now', () => {
    expect(sharedSpan({ start: t('13:00'), end: t('14:00') }, { start: t('13:30'), end: t('15:00') }, now))
      .toEqual({ start: t('13:30'), end: t('14:00') })
    expect(sharedSpan({ start: t('13:00'), end: t('14:00') }, { start: t('14:00'), end: t('15:00') }, now)).toBeNull()
    expect(sharedSpan({ start: t('19:00'), end: null }, { start: t('19:30'), end: t('19:45') }, now)).not.toBeNull()
    expect(sharedSpan({ start: null, end: null }, { start: t('13:00'), end: t('14:00') }, now)).toBeNull()
  })

  it('ignores the entry itself, and finds the first other', () => {
    const others = [{ id: 1, start: t('13:00'), end: t('13:45') }, { id: 2, start: t('14:00'), end: t('15:00') }]
    expect(firstOverlap({ id: 1, start: t('13:15'), end: t('13:30') }, others, now)).toBeNull()
    expect(firstOverlap({ start: t('13:30'), end: t('14:15') }, others, now)?.other.id).toBe(1)
  })

  it('flags every entry that overlaps another of the same person, and only the same person', () => {
    const rows = [
      { id: 1, personId: 'a', start: t('13:00'), end: t('14:00') },
      { id: 2, personId: 'a', start: t('13:45'), end: t('15:00') },
      { id: 3, personId: 'b', start: t('13:00'), end: t('14:00') },
    ]
    const m = overlapsAmong(rows, now)
    expect([...m.keys()].sort()).toEqual([1, 2])
  })

  it('writes the check lines as the design does', () => {
    expect(overlapLine(7 * 3600 + 45 * 60, { start: t('13:00'), end: t('13:45') }, 'TN Admin', NY))
      .toBe('7h 45m. Overlaps 9:00 AM to 9:45 AM with TN Admin.')
    expect(correctionOverlapLine({ start: t('13:00'), end: t('13:45') }, 'TN Admin', NY))
      .toBe('Overlaps 9:00 AM to 9:45 AM with TN Admin. Ask only for time you have no entry for.')
    expect(approveOverlapLine({ start: t('13:00'), end: t('13:45') }, 'TN Admin', NY))
      .toBe('It overlaps TN Admin (9:00 AM to 9:45 AM). Fix that entry before approving.')
  })

  it('trims the other entry or this one (3F)', () => {
    const me = { start: t('13:00'), end: t('14:00') }
    expect(trimOther(me, { start: t('11:00'), end: t('13:30') })).toEqual({ start: t('11:00'), end: t('13:00') })
    expect(trimOther(me, { start: t('13:30'), end: t('15:00') })).toEqual({ start: t('14:00'), end: t('15:00') })
    expect(trimThis(me, { start: t('11:00'), end: t('13:30') })).toEqual({ start: t('13:30'), end: t('14:00') })
    expect(trimThis(me, { start: t('13:30'), end: t('15:00') })).toEqual({ start: t('13:00'), end: t('13:30') })
    expect(trimThis(me, { start: t('12:00'), end: t('15:00') })).toBeNull()
  })
})

describe('midnight, in the person\'s own time zone', () => {
  it('cuts an entry crossing midnight in New York into one piece per day', () => {
    // 10:00 PM to 2:00 AM New York.
    expect(splitAtMidnight('2026-10-16T02:00:00.000Z', '2026-10-16T06:00:00.000Z', NY)).toEqual([
      { start: '2026-10-16T02:00:00.000Z', end: '2026-10-16T04:00:00.000Z', date: '2026-10-15' },
      { start: '2026-10-16T04:00:00.000Z', end: '2026-10-16T06:00:00.000Z', date: '2026-10-16' },
    ])
  })

  it('cuts at Nairobi\'s midnight for someone in Nairobi', () => {
    expect(splitAtMidnight('2026-10-15T19:00:00.000Z', '2026-10-15T23:00:00.000Z', 'Africa/Nairobi').map(p => p.date))
      .toEqual(['2026-10-15', '2026-10-16'])
  })

  it('leaves a day\'s entry whole, and one ending exactly at midnight on its day', () => {
    expect(splitAtMidnight(t('12:00'), t('17:00'), NY)).toHaveLength(1)
    expect(splitAtMidnight('2026-10-15T23:00:00.000Z', '2026-10-16T04:00:00.000Z', NY)).toEqual([
      { start: '2026-10-15T23:00:00.000Z', end: '2026-10-16T04:00:00.000Z', date: '2026-10-15' },
    ])
  })

  it('makes every piece no longer than a day', () => {
    const pieces = splitAtMidnight('2026-10-12T16:00:00.000Z', '2026-10-15T16:00:00.000Z', NY)
    expect(pieces.map(p => p.date)).toEqual(['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15'])
    for (const p of pieces) expect(Date.parse(p.end) - Date.parse(p.start)).toBeLessThanOrEqual(24 * 3600 * 1000)
  })
})

describe('required fields (README "Rules" 11)', () => {
  const keys: FieldKeys = { company: '1', project: '2', activity: '3', billable: '4', code: '5' }
  const full = { 1: 'True North', 2: 'In-House', 3: 'WebDev', 4: 'yes' }

  it('asks Company, Project, Activity and Billable, in that order', () => {
    expect(missingFields({}, null, keys, false)).toEqual(['company', 'project', 'activity', 'billable'])
    expect(missingFields(full, null, keys, false)).toEqual([])
  })

  it('asks the i7 Code only on i7 jobs', () => {
    expect(missingFields(full, null, keys, true)).toEqual(['code'])
    expect(missingFields({ ...full, 5: 'i7-WEBDVT' }, null, keys, true)).toEqual([])
  })

  it('asks for notes when the Activity says to explain in them', () => {
    expect(activityNeedsNotes('Other (indicate in Notes)')).toBe(true)
    expect(missingFields({ ...full, 3: 'Other (indicate in Notes)' }, '', keys, false)).toEqual(['notes'])
    expect(missingFields({ ...full, 3: 'Other (indicate in Notes)' }, 'Client call', keys, false)).toEqual([])
  })

  it('writes the 1F gate as the panel does', () => {
    expect(gateText('switch', 'TN Admin')).toBe('Before you switch to TN Admin, finish the current entry:')
    expect(gateText('out')).toBe('Before you clock out, finish the current entry:')
  })
})

describe('Needs attention, in the prototype\'s order', () => {
  it('counts a pending correction only for whoever decides it, and time off only for Super Admins', () => {
    expect(attentionReason({ kind: 'correction', pending: true, viewerDecides: true })).toBe('Correction request waiting for you')
    expect(attentionReason({ kind: 'correction', pending: true, viewerDecides: false })).toBeNull()
    expect(attentionReason({ kind: 'time_off', pending: true, viewerDecides: true })).toBe('Time off request waiting for you')
  })

  it('puts an unconfirmed automatic stop first, then what is missing, then over 10 hours, then overlaps', () => {
    expect(attentionReason({ kind: 'clock', autoStoppedUnconfirmed: true, missing: ['activity'] })).toBe('Auto clocked out, end time not confirmed')
    expect(attentionReason({ kind: 'clock', missing: ['company', 'activity'], seconds: 11 * 3600 })).toBe('Missing Activity, Company')
    expect(attentionReason({ kind: 'clock', missing: [], seconds: 10 * 3600 + 900, overlaps: true })).toBe('Over 10 hours')
    expect(attentionReason({ kind: 'clock', missing: [], seconds: 3600, overlaps: true })).toBe('Overlaps another entry')
    expect(attentionReason({ kind: 'manual', missing: [], seconds: 3600 })).toBeNull()
  })
})

describe('a reason for every change (README "Rules" 7)', () => {
  it('keeps a typed reason, trimmed, and refuses an empty one', () => {
    expect(reasonOf('  forgot to clock out  ')).toBe('forgot to clock out')
    expect(reasonOf('   ')).toBeNull()
    expect(reasonOf(undefined)).toBeNull()
    expect(reasonOf('x'.repeat(3000))).toHaveLength(2000)
    expect(REASON_REQUIRED).toBeTruthy()
  })
})

describe('the clock checks the job against the day its entry is recorded on (audit 2026-10-27)', () => {
  it('at 11:53 PM the start rounds to 12:00 AM: the next day, and from the switch date its structure', () => {
    // 03:53Z on Oct 30 is 11:53 PM on Oct 29 in New York.
    const late = new Date('2026-10-30T03:53:00.000Z')
    expect(clockDay(late, NY)).toBe('2026-10-30')
    expect(structureOn(clockDay(late, NY), '2026-10-30')).toBe(2)
    // 11:52 PM still rounds to 11:45 PM: the day before, the TSheets jobs.
    const before = new Date('2026-10-30T03:52:00.000Z')
    expect(clockDay(before, NY)).toBe('2026-10-29')
    expect(structureOn(clockDay(before, NY), '2026-10-30')).toBe(1)
  })
})
