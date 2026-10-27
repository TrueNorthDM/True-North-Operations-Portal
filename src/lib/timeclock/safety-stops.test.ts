import { describe, it, expect } from 'vitest'
import { STOP_KINDS, STOP_REASON_LABEL, isStopKind, limitStopEvent, stopCounts, stopReasonOf } from './safety-stops'

// Allowance stops on the Clock safety page (27 October 2026): a clock stopped
// at the hours allowance is a stop of its own kind, with its own reason.

const t = (hhmmss: string) => `2026-10-15T${hhmmss}.000Z`

describe('the kinds Clock safety lists as stops', () => {
  it('counts the 5-hour stop and the allowance stop, not the warning or "Keep going"', () => {
    expect([...STOP_KINDS]).toEqual(['auto_stop', 'limit_stop'])
    expect(isStopKind('auto_stop')).toBe(true)
    expect(isStopKind('limit_stop')).toBe(true)
    expect(isStopKind('keep_going')).toBe(false)
    expect(isStopKind('warned')).toBe(false)
  })

  it('names the reason of each', () => {
    expect(stopReasonOf('auto_stop')).toBe('five_hours')
    expect(stopReasonOf('limit_stop')).toBe('allowance')
    expect(STOP_REASON_LABEL[stopReasonOf('limit_stop')]).toBe('Allowance reached')
    expect(STOP_REASON_LABEL[stopReasonOf('auto_stop')]).toBe('5-hour check')
  })
})

describe('the row an allowance stop writes', () => {
  const now = new Date(t('16:00:00'))
  const e = { person_id: 'p1', jobcode_id: 7, started_at: t('13:00:00'), started_at_real: t('13:02:10'), session_started_at: t('12:00:00'), window_started_at: t('12:30:00') }

  it('keeps the person, the job, the entry, where it stopped and the allowance', () => {
    expect(limitStopEvent(e, 42, t('15:45:00'), '40h 00m allowance for the week of Oct 11', now)).toEqual({
      person_id: 'p1',
      entry_id: 42,
      kind: 'limit_stop',
      at: now.toISOString(),
      window_started_at: t('13:02:10'),
      session_started_at: t('12:00:00'),
      jobcode_id: 7,
      stopped_at: t('15:45:00'),
      allowance: '40h 00m allowance for the week of Oct 11',
    })
  })

  it('is keyed by the clock that stopped, not the 5-hour window it shared with others', () => {
    const row = limitStopEvent({ ...e, started_at_real: null }, 42, t('15:45:00'), 'x', now)
    expect(row.window_started_at).toBe(t('13:00:00'))
    expect(row.session_started_at).toBe(t('12:00:00'))
    const noSession = limitStopEvent({ person_id: 'p1', jobcode_id: null, started_at: t('13:00:00') }, 1, t('14:00:00'), 'x', now)
    expect(noSession.session_started_at).toBe(t('13:00:00'))
  })
})

describe('the cards', () => {
  it('counts each kind, the people, and confirmed ends among the 5-hour stops only', () => {
    expect(stopCounts([
      { kind: 'auto_stop', person_id: 'a', confirmed_at: t('18:00:00') },
      { kind: 'auto_stop', person_id: 'b', confirmed_at: null },
      { kind: 'limit_stop', person_id: 'a', confirmed_at: null },
      { kind: 'limit_stop', person_id: 'c', confirmed_at: null },
    ])).toEqual({ autoStops: 2, allowanceStops: 2, people: 3, confirmed: 1 })
    expect(stopCounts([])).toEqual({ autoStops: 0, allowanceStops: 0, people: 0, confirmed: 0 })
  })
})
