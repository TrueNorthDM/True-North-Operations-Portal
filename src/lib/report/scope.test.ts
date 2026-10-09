import { describe, expect, it } from 'vitest'
import { reportFilter, reportHref, resolvePeriod, resolveScope, scopesFor, viewLabel, weekColumns } from './scope'

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

  it('offers My team only to someone who leads a team, at level 3 too', () => {
    expect(scopesFor(3, false)).toEqual(['me', 'everyone'])
  })
})

describe('resolveScope', () => {
  it('opens on Everyone for whoever may see everyone, and on My team for a lead', () => {
    expect(resolveScope(undefined, 2)).toBe('team')
    expect(resolveScope(undefined, 3)).toBe('everyone')
    expect(resolveScope(undefined, 3, false)).toBe('everyone')
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
    expect(resolveScope('all-the-things', 3)).toBe('everyone')
    expect(resolveScope('team', 3, false)).toBe('everyone')
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

  // The default scope depends on who opens the link, so a pasted My team
  // link must say My team, or it opens as Everyone for an Admin.
  it('leaves the default tab and period out, and always writes the scope', () => {
    expect(reportHref('/report', { tab: 'overview', scope: 'team', period: 90 })).toBe('/report?scope=team')
  })

  it('keeps the team and person filters', () => {
    expect(reportHref('/report', { tab: 'overview', scope: 'team', period: 90, team: 'abc' }))
      .toBe('/report?scope=team&team=abc')
  })

  it('builds the export URLs from the same state', () => {
    expect(reportHref('/report/csv', state)).toBe('/report/csv?tab=people&scope=everyone&period=30')
  })
})

describe('what the page is showing, in words', () => {
  it('names a filter rather than the scope it sits under', () => {
    expect(viewLabel('team', 'SEO', null)).toBe('SEO team')
    expect(viewLabel('everyone', 'SEO', 'Ana Silva')).toBe('Ana Silva')
    expect(viewLabel('everyone')).toBe('Everyone')
  })
})

describe('a level 2 person who leads no team', () => {
  // My team at level 2 is the teams they lead; with none there is nothing to offer.
  it('gets Me alone, and lands on it', () => {
    expect(scopesFor(2, false)).toEqual(['me'])
    expect(resolveScope('team', 2, false)).toBe('me')
    expect(resolveScope(undefined, 2, false)).toBe('me')
  })
})

describe('reportFilter', () => {
  const base = { meId: 'me', led: [] as string[], ledMembers: new Set<string>() }
  const lead = { ...base, led: ['seo', 'graphics'], ledMembers: new Set(['me', 'ana', 'bo']) }

  it('reads only themselves for Me, at any level', () => {
    for (const level of [1, 2, 3]) {
      expect(reportFilter({ ...lead, level, scope: 'me', team: 'seo', person: 'ana' }))
        .toEqual({ filter: { personId: 'me' }, team: null, person: null })
    }
  })

  it('never lets level 1 out of their own work, whatever the URL says', () => {
    expect(reportFilter({ ...lead, level: 1, scope: 'everyone', team: 'seo', person: 'ana' }).filter)
      .toEqual({ personId: 'me' })
  })

  // The leak this rule closes: My team with no team picked read the whole company.
  it('gives a team leader the teams they lead when no team is picked, never everyone', () => {
    expect(reportFilter({ ...lead, level: 2, scope: 'team' }).filter).toEqual({ teamIds: ['seo', 'graphics'] })
  })

  it('narrows a team leader to one of their teams when they pick it', () => {
    expect(reportFilter({ ...lead, level: 2, scope: 'team', team: 'seo' }))
      .toEqual({ filter: { teamIds: ['seo'] }, team: 'seo', person: null })
  })

  it('drops a team they do not lead rather than obeying it', () => {
    expect(reportFilter({ ...lead, level: 2, scope: 'team', team: 'finance' }))
      .toEqual({ filter: { teamIds: ['seo', 'graphics'] }, team: null, person: null })
  })

  it('takes a person only if they are on one of those teams', () => {
    expect(reportFilter({ ...lead, level: 2, scope: 'team', person: 'ana' }).filter).toEqual({ personId: 'ana' })
    expect(reportFilter({ ...lead, level: 2, scope: 'team', person: 'stranger' }))
      .toEqual({ filter: { teamIds: ['seo', 'graphics'] }, team: null, person: null })
  })

  it('falls back to their own work at level 2 when they lead nothing', () => {
    expect(reportFilter({ ...base, level: 2, scope: 'team' }).filter).toEqual({ personId: 'me' })
  })

  // Decided 9 October 2026: My team is the teams they lead at every level.
  // It read the whole company for an Admin, under the label My team.
  it('gives My team the teams they lead at level 3 too, never the company', () => {
    expect(reportFilter({ ...lead, level: 3, scope: 'team' }).filter).toEqual({ teamIds: ['seo', 'graphics'] })
    expect(reportFilter({ ...base, level: 3, scope: 'team' }).filter).toEqual({ personId: 'me' })
  })

  it('gives Everyone a picked person or team, otherwise everyone', () => {
    expect(reportFilter({ ...base, level: 3, scope: 'everyone' }).filter).toEqual({})
    expect(reportFilter({ ...base, level: 3, scope: 'everyone', team: 'finance' }).filter).toEqual({ teamId: 'finance' })
    expect(reportFilter({ ...base, level: 3, scope: 'everyone', person: 'zed' }).filter).toEqual({ personId: 'zed' })
  })
})
