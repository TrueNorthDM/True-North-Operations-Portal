import { describe, expect, it } from 'vitest'
import { reportHref, resolvePeriod, resolveScope, scopesFor, weekColumns } from './scope'

describe('scopesFor', () => {
  it('gives level 1 one option, not a disabled row of three', () => {
    expect(scopesFor(1)).toEqual(['me'])
  })

  it('gives level 2 their own work and their team', () => {
    expect(scopesFor(2)).toEqual(['me', 'team'])
  })

  it('gives level 3 everyone', () => {
    expect(scopesFor(3)).toEqual(['me', 'team', 'everyone'])
  })
})

describe('resolveScope', () => {
  it('defaults to the team, because this is a lead page', () => {
    expect(resolveScope(undefined, 2)).toBe('team')
    expect(resolveScope(undefined, 3)).toBe('team')
  })

  it('defaults level 1 to themselves, the only thing they may see', () => {
    expect(resolveScope(undefined, 1)).toBe('me')
  })

  // The URL is typed by people. A level 1 person editing the query string
  // lands on their own work, not on an error and not on everyone.
  it('clamps a scope the level may not ask for', () => {
    expect(resolveScope('everyone', 1)).toBe('me')
    expect(resolveScope('everyone', 2)).toBe('team')
  })

  it('ignores a scope that is not a scope at all', () => {
    expect(resolveScope('all-the-things', 3)).toBe('team')
  })

  it('honours a scope the level may ask for', () => {
    expect(resolveScope('everyone', 3)).toBe('everyone')
    expect(resolveScope('me', 2)).toBe('me')
  })
})

describe('resolvePeriod', () => {
  it('defaults to 90 days', () => {
    expect(resolvePeriod(undefined)).toBe(90)
    expect(resolvePeriod('')).toBe(90)
  })

  it('takes a period it recognises', () => {
    expect(resolvePeriod('30')).toBe(30)
  })

  it('refuses one it does not, rather than querying it', () => {
    expect(resolvePeriod('365')).toBe(90)
    expect(resolvePeriod('abc')).toBe(90)
  })
})

describe('weekColumns', () => {
  // Not days / 7: a part-week column on the end always reads as a collapse
  // in delivery rather than as a week that has not finished.
  it('draws whole weeks only', () => {
    expect(weekColumns(90)).toBe(12)
    expect(weekColumns(30)).toBe(5)
  })
})

describe('reportHref', () => {
  const state = { tab: 'people', scope: 'everyone', period: 30 } as const

  // The tab bar shipped without this and dropped scope and period on every
  // click, while the two switches beside it carried them correctly. That is
  // the failure mode of writing one rule twice.
  it('carries the rest of the state through every change', () => {
    expect(reportHref('/report', state, { tab: 'workload' }))
      .toBe('/report?tab=workload&scope=everyone&period=30')
    expect(reportHref('/report', state, { period: 90 }))
      .toBe('/report?tab=people&scope=everyone')
  })

  it('leaves the defaults out, so the plain view has a plain URL', () => {
    expect(reportHref('/report', { tab: 'overview', scope: 'team', period: 90 })).toBe('/report')
  })

  it('keeps the team and person filters', () => {
    expect(reportHref('/report', { tab: 'overview', scope: 'team', period: 90, team: 'abc' }))
      .toBe('/report?team=abc')
  })

  it('builds the export URLs from the same state', () => {
    expect(reportHref('/report/csv', state)).toBe('/report/csv?tab=people&scope=everyone&period=30')
  })
})
