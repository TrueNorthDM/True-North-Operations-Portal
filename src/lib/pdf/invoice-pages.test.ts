import { describe, expect, it } from 'vitest'
import { paperOf, printQuery, recordOnlyQuery, recordPages } from './invoice-pages'

describe('the invoice PDF\'s pages', () => {
  it('numbers the record after the builder\'s sheet or after their own file', () => {
    expect(recordPages(null)).toEqual({ first: 'Page 1 of 2', record: 'Page 2 of 2' })
    expect(recordPages(3)).toEqual({ first: 'Page 1 of 4', record: 'Page 4 of 4' })
  })

  it('prints the record on the paper of their file: Letter either way up, A4 otherwise', () => {
    expect(paperOf(612, 792)).toBe('letter')
    expect(paperOf(792, 612)).toBe('letter')
    expect(paperOf(595.28, 841.89)).toBe('a4')
    expect(paperOf(500, 700)).toBe('a4')
  })

  it('reads its query back, ignoring what is not a page count', () => {
    expect(printQuery(Object.fromEntries(new URLSearchParams(recordOnlyQuery(3, 'letter'))))).toEqual({ only: 'record', ownPages: 3, paper: 'letter' })
    expect(printQuery({})).toEqual({ only: undefined, ownPages: null, paper: 'a4' })
    expect(printQuery({ only: 'all', pages: '-2', paper: 'legal' })).toEqual({ only: undefined, ownPages: null, paper: 'a4' })
    expect(printQuery({ only: ['record'], pages: '1.5' })).toEqual({ only: 'record', ownPages: null, paper: 'a4' })
  })
})
