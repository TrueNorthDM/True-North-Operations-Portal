import { describe, expect, it } from 'vitest'
import { applyFilter, clearFilters, toQuery } from './filters'

describe('applyFilter', () => {
  // Screen 4.2: a name left over from the previous team filters every row
  // out, and both filters look perfectly reasonable while it happens.
  it('resets the person whenever the team changes', () => {
    expect(applyFilter({ team: 'seo', person: 'amy' }, 'team', 'writing'))
      .toEqual({ team: 'writing' })
  })

  it('resets the person when the team is cleared too', () => {
    expect(applyFilter({ team: 'seo', person: 'amy' }, 'team', ''))
      .toEqual({})
  })

  it('leaves the team alone when only the person changes', () => {
    expect(applyFilter({ team: 'writing' }, 'person', 'lana'))
      .toEqual({ team: 'writing', person: 'lana' })
  })

  // A filter forces Everyone, so a scope left behind points at something the
  // page is no longer doing.
  it('drops a stale scope when a filter is set', () => {
    expect(applyFilter({ scope: 'me', period: '30' }, 'team', 'writing'))
      .toEqual({ team: 'writing', period: '30' })
  })

  it('keeps the scope when a filter is cleared, since nothing is forced', () => {
    expect(applyFilter({ scope: 'me', person: 'amy' }, 'person', ''))
      .toEqual({ scope: 'me' })
  })

  it('carries the rest of the state through untouched', () => {
    expect(applyFilter({ tab: 'workload', period: '30' }, 'person', 'lana'))
      .toEqual({ tab: 'workload', period: '30', person: 'lana' })
  })
})

describe('clearFilters', () => {
  it('takes both filters and nothing else', () => {
    expect(clearFilters({ tab: 'workload', team: 'seo', person: 'amy', period: '30' }))
      .toEqual({ tab: 'workload', period: '30' })
  })
})

describe('toQuery', () => {
  it('drops empties rather than writing key=', () => {
    expect(toQuery({ tab: 'workload', team: '' })).toBe('tab=workload')
  })
})
