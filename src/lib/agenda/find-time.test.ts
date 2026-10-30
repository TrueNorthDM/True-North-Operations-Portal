import { describe, it, expect } from 'vitest'
import { findDay, nextFree, whyNot, type Avail } from './find-time'
import { DC, instantOf } from './time'
import { workingIntervals } from './working-hours'

const at = (day: string, min: number) => instantOf(day, min, DC)
const range = (from: string, to: string) => [instantOf(from, 0, DC), instantOf(to, 0, DC)] as const
const person = (id: string, zone: string, busy: [number, number][] = []): Avail => {
  const [a, b] = range('2026-11-01', '2026-12-05')
  return { id, work: workingIntervals({ 1: [[540, 1080]], 2: [[540, 1080]], 3: [[540, 1080]], 4: [[540, 1080]], 5: [[540, 1080]] }, zone, a, b), busy }
}

describe('findDay', () => {
  it('finds the hours both a Fortaleza and a Denver person work, minus busy times', () => {
    // Nov 4: Fortaleza 9 to 6 is 7 AM to 4 PM in Washington; Denver 9 to 6 is 11 AM to 8 PM.
    const you = person('you', 'America/Fortaleza', [[at('2026-11-04', 720), at('2026-11-04', 780)]])
    const devon = person('devon', 'America/Denver')
    const r = findDay([you, devon], '2026-11-04', 60)
    expect(r.allFree).toEqual([660, 780, 810, 840, 870, 900])
    expect(r.best).toEqual([])
    expect(r.rows[0].work).toEqual([[420, 960]])
  })
  it('gives the best times and who cannot when nobody fits everyone', () => {
    const r = findDay([person('you', 'America/Fortaleza'), person('grace', 'Africa/Nairobi'), person('devon', 'America/Denver')], '2026-11-04', 60)
    expect(r.allFree).toEqual([])
    expect(r.best[0].free).toBe(2)
    expect(r.best[0].missing).toEqual([{ id: 'devon', why: 'Outside working hours' }])
  })
  it('says why a person cannot', () => {
    const row = { id: 'x', work: [[540, 1020]] as [number, number][], busy: [[600, 660]] as [number, number][] }
    expect(whyNot(row, 600, 30)).toBe('Busy')
    expect(whyNot(row, 1000, 60)).toBe('Outside working hours')
    expect(whyNot(row, 540, 60)).toBeNull()
  })
})

describe('nextFree', () => {
  it('skips the weekend and finds the first three times', () => {
    const allDay = (d: string): [number, number] => [at(d, 0), at(d, 1440)]
    const you = person('you', DC, [allDay('2026-11-06'), allDay('2026-11-09')])
    const r = nextFree([you], '2026-11-05', 60)
    expect(r).toEqual([{ day: '2026-11-10', start: 540 }, { day: '2026-11-10', start: 570 }, { day: '2026-11-10', start: 600 }])
  })
})
