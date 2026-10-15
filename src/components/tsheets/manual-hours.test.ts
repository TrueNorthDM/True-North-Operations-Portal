import { describe, it, expect } from 'vitest'
import {
  addedWhat, describeLine, emptyForm, h2, isNotBillable, linesToSend, pendingSummary,
  shouldWarnRate, stageProblem, toEntry, totalHours,
  type ManualForm, type ManualOptions, type ManualRow, type StagedLine,
} from './manual-hours'

const OPTIONS: ManualOptions = {
  people: [],
  tops: [{ id: 't1', name: 'i7', branch: 'i7' }, { id: 't2', name: 'Projects', branch: 'project' }],
  jobsByTop: { t1: [{ id: 7, name: 'SEO' }] },
  i7Codes: [], companies: [], projects: [], activities: [], billable: [],
}
const form = (over: Partial<ManualForm> = {}): ManualForm => ({
  ...emptyForm('2026-10'), personId: 'p1', topId: 't1', jobcodeId: '7', hours: '1.5', ...over,
})
const staged = (hours: number): StagedLine => ({ ...toEntry(form({ hours: String(hours) })), label: 'x' })
const added = (over: Partial<ManualRow> = {}): ManualRow => ({
  id: 1, personName: 'Ana', entryDate: '2026-10-01', hours: 1, jobcodeName: 'SEO',
  tag: '', activity: '', notes: null, addedBy: null, ...over,
})

describe('manual-hours', () => {
  it('starts the day on the first of the month', () => {
    expect(emptyForm('2026-10').entryDate).toBe('2026-10-01')
  })

  it('turns the typed strings into the line the server wants', () => {
    expect(toEntry(form({ i7Code: 'A1', notes: 'inv 3' }))).toMatchObject({ jobcodeId: 7, hours: 1.5, i7Code: 'A1', notes: 'inv 3' })
  })

  it('refuses to stage a line without person, job, day or hours', () => {
    expect(stageProblem(form())).toBeNull()
    for (const bad of [{ personId: '' }, { jobcodeId: '' }, { entryDate: '' }, { hours: '0' }, { hours: '' }]) {
      expect(stageProblem(form(bad))).toBe('Fill the day, the hours and the job before adding the line.')
    }
  })

  it('describes a staged line the way the report reads', () => {
    expect(describeLine(OPTIONS, 't1', toEntry(form({ i7Code: 'A1', activity: 'Writing' })))).toBe('i7 › SEO › A1 › Writing')
    expect(describeLine(OPTIONS, 't2', toEntry(form({ jobcodeId: '9', project: 'Site' })))).toBe('Projects › Site')
  })

  it('sends the typed line with the staged ones, without the label', () => {
    const out = linesToSend([staged(2)], form())
    expect(out.map(d => d.hours)).toEqual([2, 1.5])
    expect(out[0]).not.toHaveProperty('label')
    expect(linesToSend([staged(2)], form({ hours: '' })).map(d => d.hours)).toEqual([2])
    expect(linesToSend([], form({ jobcodeId: '' }))).toEqual([])
  })

  it('counts the typed line in what the button says', () => {
    expect(pendingSummary([staged(0.1), staged(0.2)], form({ hours: '' }))).toEqual({ count: 2, hours: 0.3 })
    expect(pendingSummary([staged(1)], form({ hours: '0.25' }))).toEqual({ count: 2, hours: 1.25 })
  })

  it('warns about a missing rate unless the branch never turns hours into money', () => {
    const noRate = { id: 'p1', name: 'Ana', hasRate: false }
    expect(shouldWarnRate(noRate, undefined)).toBe(true)
    expect(shouldWarnRate(noRate, OPTIONS.tops[0])).toBe(true)
    expect(shouldWarnRate(noRate, OPTIONS.tops[1])).toBe(false)
    expect(shouldWarnRate({ id: 'p2', name: 'Bo' }, undefined)).toBe(false)
    expect(shouldWarnRate(undefined, undefined)).toBe(false)
  })

  it('tags only lines that are not billable', () => {
    expect(isNotBillable('No')).toBe(true)
    expect(isNotBillable('Yes')).toBe(false)
    expect(isNotBillable('')).toBe(false)
    expect(isNotBillable(undefined)).toBe(false)
  })

  it('rounds hours and sums the added rows', () => {
    expect(h2(7.300000001)).toBe(7.3)
    expect(totalHours([added({ hours: 0.1 }), added({ hours: 0.2 })])).toBe(0.3)
  })

  it('says what an added row was for, falling back to the job', () => {
    expect(addedWhat(added({ tag: 'A1', activity: 'Writing' }))).toBe('A1 · Writing')
    expect(addedWhat(added())).toBe('SEO')
  })
})
