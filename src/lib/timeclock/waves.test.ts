import { describe, it, expect } from 'vitest'
import {
  NO_WAVE, NO_WAVE_MESSAGE, automaticWave, beforeStart, checkDates, clockGate, hasStarted, isDay, isWave, noWaveFor, notYetMessage,
  personWave, splitByStart, startDayLabel, waveChoice,
} from './waves'

const DATES = { 1: '2026-11-08', 2: '2026-11-22' } as const

describe('automaticWave', () => {
  it('Team Leader and above are wave 1; a User is wave 2', () => {
    expect(automaticWave({ level: 'super_admin' })).toBe(1)
    expect(automaticWave({ level: 'admin' })).toBe(1)
    expect(automaticWave({ level: 'team_leader' })).toBe(1)
    expect(automaticWave({ level: 'user' })).toBe(2)
  })

  it('a Lead of a team is wave 1 whatever level was given', () => {
    expect(automaticWave({ level: 'user', leader: true })).toBe(1)
  })
})

describe('personWave', () => {
  it('follows the level without an override', () => {
    expect(personWave({ level: 'team_leader' }, null, DATES)).toEqual({ wave: 1, by: 'level', startsOn: '2026-11-08' })
    expect(personWave({ level: 'user' }, undefined, DATES)).toEqual({ wave: 2, by: 'level', startsOn: '2026-11-22' })
  })

  it('a person added by hand to wave 1 starts with the leaders', () => {
    expect(personWave({ level: 'user' }, 1, DATES)).toEqual({ wave: 1, by: 'hand', startsOn: '2026-11-08' })
  })

  it('a leader moved to wave 2 starts with everyone else', () => {
    expect(personWave({ level: 'admin' }, 2, DATES)).toEqual({ wave: 2, by: 'hand', startsOn: '2026-11-22' })
  })

  it('no date set: no start date, so nothing changes', () => {
    expect(personWave({ level: 'admin' }, null, { 1: null, 2: '2026-11-22' }).startsOn).toBeNull()
    expect(personWave({ level: 'user' }, null, { 1: null, 2: null }).startsOn).toBeNull()
  })
})

describe('no wave (owner, 5 November 2026)', () => {
  it('a person in no wave has no start date, whatever their level and the dates', () => {
    for (const level of ['super_admin', 'admin', 'team_leader', 'user'] as const) {
      expect(personWave({ level }, NO_WAVE, DATES)).toEqual({ wave: 0, by: 'hand', startsOn: null })
      expect(personWave({ level, leader: true }, 0, DATES).startsOn).toBeNull()
    }
    expect(personWave({ level: 'user' }, 0, { 1: null, 2: null })).toEqual({ wave: 0, by: 'hand', startsOn: null })
  })

  it('the clock refuses on every day, with the sentence, dates set or not', () => {
    expect(NO_WAVE_MESSAGE).toBe('You are not on North Time yet. Keep recording your time in TSheets.')
    expect(clockGate(null, '2030-01-01', true)).toBe(NO_WAVE_MESSAGE)
    expect(clockGate('2026-11-08', '2026-12-01', true)).toBe(NO_WAVE_MESSAGE)
    expect(clockGate(null, '2030-01-01', false)).toBeNull()
    expect(noWaveFor('Ed Wagner')).toBe('Ed Wagner is not on North Time yet: their time stays in TSheets.')
  })

  it('never has a start date for the import: every TSheets entry of theirs is kept', () => {
    const start = personWave({ level: 'user' }, 0, DATES).startsOn
    const starts = new Map(start ? [['ed', start]] : [])
    const rows = [{ person_id: 'ed', entry_date: '2026-11-08' }, { person_id: 'ed', entry_date: '2027-03-01' }]
    expect(splitByStart(rows, starts)).toEqual({ keep: rows, skip: [] })
  })

  it('the form sends 0 or "none" for no wave; null follows the level; anything else is refused', () => {
    expect(waveChoice(0)).toBe(0)
    expect(waveChoice('none')).toBe(0)
    expect(waveChoice(1)).toBe(1)
    expect(waveChoice(2)).toBe(2)
    expect(waveChoice(null)).toBeNull()
    expect(waveChoice(3)).toBeUndefined()
    expect(waveChoice('1')).toBeUndefined()
    expect(waveChoice(undefined)).toBeUndefined()
    expect(isWave(0) && isWave(1) && isWave(2) && !isWave(-1)).toBe(true)
  })
})

describe('the clock gate', () => {
  it('refuses before the start date, in the person\'s own day', () => {
    expect(beforeStart('2026-11-22', '2026-11-21')).toBe(true)
    expect(beforeStart('2026-11-22', '2026-11-22')).toBe(false)
    expect(beforeStart(null, '2020-01-01')).toBe(false)
    expect(hasStarted('2026-11-22', '2026-11-22')).toBe(true)
    expect(hasStarted(null, '2030-01-01')).toBe(false)
  })

  it('says the day they start', () => {
    expect(startDayLabel('2026-11-22')).toBe('Sunday, Nov 22')
    expect(notYetMessage('2026-11-22')).toBe('You start on North Time on Sunday, Nov 22. Until then, keep clocking in TSheets.')
    expect(clockGate('2026-11-08', '2026-11-07')).toBe('You start on North Time on Sunday, Nov 8. Until then, keep clocking in TSheets.')
    expect(clockGate('2026-11-08', '2026-11-08')).toBeNull()
    expect(clockGate(null, '2026-11-07')).toBeNull()
  })
})

describe('checkDates', () => {
  it('takes two days, or empty ones', () => {
    expect(checkDates({ 1: '2026-11-08', 2: '2026-11-22' })).toEqual({ ok: true, dates: { 1: '2026-11-08', 2: '2026-11-22' } })
    expect(checkDates({ 1: '', 2: null })).toEqual({ ok: true, dates: { 1: null, 2: null } })
  })

  it('refuses what is not a day, and wave 2 before wave 1', () => {
    expect(checkDates({ 1: '2026-02-30', 2: '' }).ok).toBe(false)
    expect(checkDates({ 1: 'soon', 2: '' }).ok).toBe(false)
    expect(checkDates({ 1: '2026-11-22', 2: '2026-11-08' }).ok).toBe(false)
    expect(isDay('2028-02-29')).toBe(true)
    expect(isDay(20261108)).toBe(false)
  })
})

describe('splitByStart', () => {
  const starts = new Map([['ana', '2026-11-08'], ['bo', '2026-11-22']])
  const rows = [
    { external_id: 1, person_id: 'ana', entry_date: '2026-11-07' },
    { external_id: 2, person_id: 'ana', entry_date: '2026-11-08' },
    { external_id: 3, person_id: 'bo', entry_date: '2026-11-21' },
    { external_id: 4, person_id: 'bo', entry_date: '2026-12-01' },
    { external_id: 5, person_id: 'cy', entry_date: '2027-01-01' },
  ]

  it('keeps entries before the start date and of people with no date; sets the rest aside', () => {
    const { keep, skip } = splitByStart(rows, starts)
    expect(keep.map(r => r.external_id)).toEqual([1, 3, 5])
    expect(skip).toEqual([
      { external_id: 2, person_id: 'ana', entry_date: '2026-11-08', starts_on: '2026-11-08' },
      { external_id: 4, person_id: 'bo', entry_date: '2026-12-01', starts_on: '2026-11-22' },
    ])
  })

  it('drops nothing: every row is kept or set aside', () => {
    const { keep, skip } = splitByStart(rows, starts)
    expect(keep.length + skip.length).toBe(rows.length)
  })

  it('no dates: everything imports as before', () => {
    expect(splitByStart(rows, new Map()).keep).toHaveLength(5)
  })
})

