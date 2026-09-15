import { describe, expect, it } from 'vitest'
import { looksSuspicious, orderForReview, reviewProgress, type StepUnderReview } from './steps-review'

const step = (o: Partial<StepUnderReview> = {}): StepUnderReview => ({
  boardId: 1, boardName: 'B', workspaceName: null, peopleCol: 'p', peopleTitle: 'Approver',
  stepName: 'Approve', stages: [{ statusCol: 's', statusTitle: 'Approve', dateCol: 'd', dateTitle: 'Approve By' }],
  source: 'guess', assignments: 10, suspicious: false, ...o,
})

describe('looksSuspicious', () => {
  // The one that started this: a dropdown of importance is not a stage, so
  // "Lana, Priority: High" was never a task.
  it('flags a column that is not a stage of work', () => {
    expect(looksSuspicious('Priority')).toBe(true)
    expect(looksSuspicious('  type ')).toBe(true)
    expect(looksSuspicious('Notes')).toBe(true)
  })

  // A step needs a deadline now, and on the simple boards a Status column with a
  // date after it is the stage of work.
  it('no longer flags a step called Status', () => {
    expect(looksSuspicious('Status')).toBe(false)
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
    expect(p).toEqual({ total: 3, settled: 1, suspicious: 1, notSteps: 0, unverifiedAssignments: 47 })
  })
})

describe('columns that are not steps', () => {
  const notAStep = (o: Partial<StepUnderReview> = {}) => step({ stages: [], stepName: 'Assigner', assignments: 0, ...o })

  it('waits at the end of the review, after every real step', () => {
    const sorted = [notAStep({ peopleCol: 'a' }), step({ peopleCol: 'b', source: 'confirmed' })].sort(orderForReview)
    expect(sorted.map(s => s.peopleCol)).toEqual(['b', 'a'])
  })

  it('is counted apart, not as a step waiting for review', () => {
    const p = reviewProgress([notAStep(), step(), step({ source: 'confirmed' })])
    expect(p.total).toBe(2)
    expect(p.settled).toBe(1)
    expect(p.notSteps).toBe(1)
  })
})
