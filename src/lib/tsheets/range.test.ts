import { describe, it, expect } from 'vitest'
import {
  choiceFromRange, defaultChoice, isSingleMonth, rangeLabel, rangeOf, resolveRange, shiftMonth, shortMonth,
  type RangeChoice,
} from './range'

const NOW = '2026-09'
const choice = (over: Partial<RangeChoice>): RangeChoice => ({ ...defaultChoice(NOW), ...over })

describe('shiftMonth', () => {
  it('walks back over a year end', () => {
    expect(shiftMonth('2026-09', -11)).toBe('2025-10')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
  })
})

describe('rangeOf', () => {
  it('opens on the current month', () => {
    expect(rangeOf(defaultChoice(NOW), NOW)).toEqual({ from: '2026-09', to: '2026-09' })
  })

  it('stops a past year at December and the current year at this month', () => {
    expect(rangeOf(choice({ mode: 'year', year: '2026' }), NOW)).toEqual({ from: '2026-01', to: '2026-09' })
    expect(rangeOf(choice({ mode: 'year', year: '2027' }), '2027-04')).toEqual({ from: '2027-01', to: '2027-04' })
  })

  it('counts the current month as one of the last twelve', () => {
    expect(rangeOf(choice({ mode: 'last12' }), '2027-06')).toEqual({ from: '2026-07', to: '2027-06' })
  })

  // Deliberate, and a change from the Full history export, which did not clamp
  // this one. Before January 2026 there are hours but no budget and no rates,
  // so the twelve months stop at the floor rather than opening with months
  // that would read as costing nothing.
  it('stops the last twelve months at the floor', () => {
    expect(rangeOf(choice({ mode: 'last12' }), NOW)).toEqual({ from: '2026-01', to: '2026-09' })
  })

  it('clamps a custom range to the floor and to today', () => {
    const c = choice({ mode: 'custom', from: '2017-03', to: '2030-01' })
    expect(rangeOf(c, NOW)).toEqual({ from: '2026-01', to: '2026-09' })
  })

  // The floor exists because money starts in 2026. A year before it collapses
  // onto the floor rather than exporting hours beside no budget at all.
  it('collapses a year below the floor onto the floor', () => {
    expect(rangeOf(choice({ mode: 'year', year: '2024' }), NOW)).toEqual({ from: '2026-01', to: '2026-01' })
  })
})

describe('isSingleMonth', () => {
  it('is what decides whether a PDF can be made', () => {
    expect(isSingleMonth(rangeOf(defaultChoice(NOW), NOW))).toBe(true)
    expect(isSingleMonth(rangeOf(choice({ mode: 'last12' }), NOW))).toBe(false)
    expect(isSingleMonth(rangeOf(choice({ mode: 'year', year: '2026' }), NOW))).toBe(false)
  })

  // January of the current year is a year range that happens to be one month.
  // The PDF is available then, because the document it would make is a month.
  it('is true for a year that has only run one month', () => {
    expect(isSingleMonth(rangeOf(choice({ mode: 'year', year: '2026' }), '2026-01'))).toBe(true)
  })
})

describe('rangeLabel', () => {
  it('names a month, a year and a span', () => {
    expect(rangeLabel(defaultChoice(NOW), NOW)).toBe('Sep 2026')
    expect(rangeLabel(choice({ mode: 'year', year: '2026' }), NOW)).toBe('2026')
    expect(rangeLabel(choice({ mode: 'last12' }), '2027-06')).toBe('Jul 2026 to Jun 2027')
  })
})

describe('choiceFromRange', () => {
  it('reads one month back as one month', () => {
    expect(choiceFromRange('2026-07', '2026-07', NOW)).toMatchObject({ mode: 'month', month: '2026-07' })
  })

  it('recognises a whole year and the last twelve months', () => {
    expect(choiceFromRange('2026-01', '2026-09', NOW)).toMatchObject({ mode: 'year', year: '2026' })
    expect(choiceFromRange('2025-01', '2025-12', NOW)).toMatchObject({ mode: 'year', year: '2025' })
    expect(choiceFromRange('2026-07', '2027-06', '2027-06')).toMatchObject({ mode: 'last12' })
  })

  it('falls back to the months somebody picked', () => {
    expect(choiceFromRange('2026-03', '2026-06', NOW)).toMatchObject({ mode: 'custom', from: '2026-03', to: '2026-06' })
  })

  // A round trip through the URL has to come back saying the same thing, or the
  // filter reopens on "choose the months" every time somebody reloads.
  it('round-trips every mode', () => {
    for (const mode of ['month', 'year', 'last12'] as const) {
      const r = rangeOf(choice({ mode, year: '2025' }), NOW)
      expect(rangeOf(choiceFromRange(r.from, r.to, NOW), NOW)).toEqual(r)
    }
  })
})

describe('shortMonth', () => {
  it('reads as a person would say it', () => {
    expect(shortMonth('2026-01')).toBe('Jan 2026')
    expect(shortMonth('2026-12')).toBe('Dec 2026')
  })
})

describe('resolveRange', () => {
  it('opens on the current month when nothing is asked for', () => {
    expect(resolveRange(undefined, undefined, NOW)).toEqual({ from: NOW, to: NOW })
  })

  it('reads half a range as that one month', () => {
    expect(resolveRange('2026-04', undefined, NOW)).toEqual({ from: '2026-04', to: '2026-04' })
    expect(resolveRange(undefined, '2026-04', NOW)).toEqual({ from: '2026-04', to: '2026-04' })
  })

  it('keeps a range somebody actually asked for', () => {
    expect(resolveRange('2026-03', '2026-06', NOW)).toEqual({ from: '2026-03', to: '2026-06' })
  })

  // Everything below arrives from an address bar or an old bookmark, and none
  // of it is worth an error page on a report.
  it('falls back rather than failing on nonsense', () => {
    expect(resolveRange('yes', 'no', NOW)).toEqual({ from: NOW, to: NOW })
    expect(resolveRange('2026-13', '2026-14', NOW)).toEqual({ from: NOW, to: NOW })
    expect(resolveRange('2026-06', '2026-03', NOW)).toEqual({ from: NOW, to: NOW })
  })

  it('pulls a range outside the data back inside it', () => {
    expect(resolveRange('2019-01', '2030-01', NOW)).toEqual({ from: '2026-01', to: NOW })
  })
})
