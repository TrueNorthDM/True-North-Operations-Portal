import { describe, expect, it } from 'vitest'
import {
  BOARD_FALLBACK, barWidth, boardColour, holdingReadout, labelOn, totalHours, totalSteps,
} from './holdings'

const person = (holdings: { board: string; steps: number; hours: number }[], availableHours = 82) =>
  ({ id: '1', name: 'A', role: 'Writing', holdings, availableHours })

describe('boardColour', () => {
  it('gives the four named boards their fixed colours', () => {
    expect(boardColour('AAAF Publishing')).toBe('#A9C0DE')
    expect(boardColour('HFA Publishing')).toBe('#2a5cab')
    expect(boardColour('i7 Marketing')).toBe('#012358')
    expect(boardColour('Team Reports Scheduled')).toBe('#F2C40A')
  })

  it('falls back rather than inventing a colour per board', () => {
    expect(boardColour('Some Other Board')).toBe(BOARD_FALLBACK)
  })
})

describe('labelOn', () => {
  // The handoff's own sample would put white on the yellow board. Its prose
  // says ink on the light ones, and measuring the colour is what makes that
  // hold for a board nobody has added yet.
  it('reads ink on the light boards', () => {
    expect(labelOn('#F2C40A')).toBe('#012358')
    expect(labelOn('#A9C0DE')).toBe('#012358')
    expect(labelOn(BOARD_FALLBACK)).toBe('#012358')
  })

  it('reads white on the dark ones', () => {
    expect(labelOn('#012358')).toBe('#ffffff')
    expect(labelOn('#2a5cab')).toBe('#ffffff')
  })
})

describe('barWidth', () => {
  it('measures everybody against the busiest, not against themselves', () => {
    const busy = person([{ board: 'A', steps: 4, hours: 58 }])
    const quiet = person([{ board: 'A', steps: 1, hours: 29 }])
    expect(barWidth(busy, 58)).toBe(100)
    expect(barWidth(quiet, 58)).toBe(50)
  })

  it('draws nothing when nobody is holding anything', () => {
    expect(barWidth(person([]), 0)).toBe(0)
  })
})

describe('totals and readout', () => {
  it('adds up across boards', () => {
    const p = person([
      { board: 'AAAF Publishing', steps: 4, hours: 44 },
      { board: 'HFA Publishing', steps: 1, hours: 14 },
    ])
    expect(totalSteps(p)).toBe(5)
    expect(totalHours(p)).toBe(58)
    expect(holdingReadout(p)).toBe('5 steps · 58h of 82h')
  })
})
