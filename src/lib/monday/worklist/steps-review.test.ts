import { describe, expect, it } from 'vitest'
import { looksSuspicious, orderForReview, reviewProgress, type StepUnderReview } from './steps-review'

const step = (o: Partial<StepUnderReview> = {}): StepUnderReview => ({
  boardId: 1, boardName: 'B', workspaceName: null, peopleCol: 'p',
  stepName: 'Approve', source: 'guess', assignments: 10, suspicious: false, ...o,
})

describe('looksSuspicious', () => {
  // The one that started this: a dropdown of importance is not a stage, so
  // "Lana, Priority: High" was never a task.
  it('flags a column that is not a stage of work', () => {
    expect(looksSuspicious('Priority')).toBe(true)
    expect(looksSuspicious('  status ')).toBe(true)
    expect(looksSuspicious('Notes')).toBe(true)
  })

  it('leaves a real step alone', () => {
    expect(looksSuspicious('Approve')).toBe(false)
    expect(looksSuspicious('Translate')).toBe(false)
  })

  // "Priority review" is a stage; only the bare word is the mistake.
  it('does not flag a step that merely contains the word', () => {
    expect(looksSuspicious('Priority review')).toBe(false)
  })
})

describe('orderForReview', () => {
  it('puts the unconfirmed ahead of the settled', () => {
    expect([step({ source: 'confirmed' }), step()].sort(orderForReview)[0].source).toBe('guess')
  })

  it('puts the suspicious first among the unconfirmed', () => {
    const sorted = [step({ assignments: 900 }), step({ suspicious: true, assignments: 1 })].sort(orderForReview)
    expect(sorted[0].suspicious).toBe(true)
  })

  // So twenty minutes of review buys the most.
  it('then takes the ones carrying the most work', () => {
    const sorted = [step({ assignments: 3 }), step({ assignments: 300 })].sort(orderForReview)
    expect(sorted[0].assignments).toBe(300)
  })
})

describe('reviewProgress', () => {
  it('counts what is settled and what still rests on a guess', () => {
    const p = reviewProgress([
      step({ source: 'confirmed', assignments: 100 }),
      step({ assignments: 40 }),
      step({ suspicious: true, assignments: 7 }),
    ])
    expect(p).toEqual({ total: 3, settled: 1, suspicious: 1, unverifiedAssignments: 47 })
  })
})
