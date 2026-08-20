import { describe, it, expect } from 'vitest'
import { resolvePersonFilter, personSelectValue, isMine } from './filters'

const ME = 'me'

describe('resolvePersonFilter', () => {
  it('shows your own work when the page is opened with no parameters', () => {
    expect(resolvePersonFilter({}, ME)).toBe(ME)
  })

  it('shows everybody when the person is explicitly empty', () => {
    expect(resolvePersonFilter({ person: '' }, ME)).toBeNull()
  })

  it('shows the person asked for', () => {
    expect(resolvePersonFilter({ person: 'p2' }, ME)).toBe('p2')
  })

  // The bug: choosing Writers dropped the person parameter, absent means "me",
  // and the team filter silently became "Writers and Arnaldo".
  it('never narrows a team by the signed-in person', () => {
    expect(resolvePersonFilter({ team: 't1' }, ME)).toBeNull()
    expect(resolvePersonFilter({ team: 't1', person: '' }, ME)).toBeNull()
    expect(resolvePersonFilter({ team: 't1', person: 'p2' }, ME)).toBeNull()
  })

  it('shows everybody when nobody is signed in as a person', () => {
    expect(resolvePersonFilter({}, null)).toBeNull()
  })
})

describe('personSelectValue', () => {
  it('shows you when nothing was chosen', () => {
    expect(personSelectValue(undefined, '', ME)).toBe(ME)
  })

  it('shows Anyone once a team is chosen', () => {
    expect(personSelectValue(undefined, 't1', ME)).toBe('')
    expect(personSelectValue(ME, 't1', ME)).toBe('')
  })

  it('shows Anyone when the person was explicitly cleared', () => {
    expect(personSelectValue('', '', ME)).toBe('')
  })
})

describe('isMine', () => {
  it('is true only for your own work with no team in the way', () => {
    expect(isMine(ME, '', ME)).toBe(true)
    expect(isMine(ME, 't1', ME)).toBe(false)
    expect(isMine('', '', ME)).toBe(false)
    expect(isMine('', '', null)).toBe(false)
  })
})
