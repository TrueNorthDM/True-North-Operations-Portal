import { describe, it, expect } from 'vitest'
import { twoStepDeadline, twoStepNeed, daysLeft, GRACE_DAYS } from './two-step-rule'

const d = (s: string) => new Date(s)
const launch = d('2026-10-01T00:00:00Z')

describe('twoStepDeadline', () => {
  it('gives someone who joins after launch a week from their first sign-in', () => {
    const got = twoStepDeadline({ accountCreated: d('2026-10-05T10:00:00Z'), launch, cutoff: null })
    expect(got?.toISOString()).toBe('2026-10-12T10:00:00.000Z')
  })

  it('gives someone already here no deadline until the cutoff is set', () => {
    expect(twoStepDeadline({ accountCreated: d('2026-09-08T00:00:00Z'), launch, cutoff: null })).toBeNull()
  })

  it('gives someone already here a week from the cutoff', () => {
    const got = twoStepDeadline({ accountCreated: d('2026-09-08T00:00:00Z'), launch, cutoff: d('2026-11-02T12:00:00Z') })
    expect(got?.toISOString()).toBe('2026-11-09T12:00:00.000Z')
  })

  it('has a grace of seven days', () => {
    expect(GRACE_DAYS).toBe(7)
  })
})

describe('twoStepNeed', () => {
  const now = d('2026-10-08T00:00:00Z')
  it('asks for the code when an app is set up and not yet used this session', () => {
    expect(twoStepNeed({ hasFactor: true, aal: 'aal1', deadline: null, now })).toBe('challenge')
  })
  it('lets the session through once the code was given', () => {
    expect(twoStepNeed({ hasFactor: true, aal: 'aal2', deadline: null, now })).toBe('ok')
  })
  it('offers setup, skippable, while the week runs', () => {
    expect(twoStepNeed({ hasFactor: false, aal: 'aal1', deadline: d('2026-10-12T00:00:00Z'), now })).toBe('enroll-optional')
  })
  it('requires setup once the week is over', () => {
    expect(twoStepNeed({ hasFactor: false, aal: 'aal1', deadline: d('2026-10-07T00:00:00Z'), now })).toBe('enroll-required')
  })
  it('asks nothing of someone with no deadline yet', () => {
    expect(twoStepNeed({ hasFactor: false, aal: 'aal1', deadline: null, now })).toBe('ok')
  })
})

describe('daysLeft', () => {
  it('rounds up, and never says zero while time remains', () => {
    expect(daysLeft(d('2026-10-12T00:00:00Z'), d('2026-10-08T00:00:00Z'))).toBe(4)
    expect(daysLeft(d('2026-10-08T01:00:00Z'), d('2026-10-08T00:00:00Z'))).toBe(1)
  })
})
