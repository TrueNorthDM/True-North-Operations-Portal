import { describe, it, expect } from 'vitest'

import { siblingItemsToApply } from './apply-links'

const row = (language_code: string, monday_item_id: string | null = `item-${language_code}`) =>
  ({ language_code, monday_item_id })

describe('siblingItemsToApply', () => {
  it('returns one item per active language with a URL', () => {
    const rows = [row('en'), row('pt'), row('es')]
    expect(siblingItemsToApply(rows, ['en', 'pt', 'es'])).toEqual(['item-en', 'item-pt', 'item-es'])
  })

  it('leaves out a language that was paused', () => {
    // Pausing drops the code from sites.languages but keeps its page_urls row.
    // Sending "Apply Link" to it would publish the hreflang for a language
    // somebody deliberately took off the air (audit finding M5-1).
    const rows = [row('en'), row('pt'), row('sw')]
    expect(siblingItemsToApply(rows, ['en', 'pt'])).toEqual(['item-en', 'item-pt'])
  })

  it('leaves out a language that was removed from the site', () => {
    const rows = [row('en'), row('fr')]
    expect(siblingItemsToApply(rows, ['en'])).toEqual(['item-en'])
  })

  it('skips a row with no Monday item id', () => {
    // Saved before the source item was tracked, or edited by hand. There is
    // nothing to flip, and passing null through would throw at the API call.
    const rows = [row('en'), row('pt', null)]
    expect(siblingItemsToApply(rows, ['en', 'pt'])).toEqual(['item-en'])
  })

  it('skips a row with an empty item id', () => {
    expect(siblingItemsToApply([row('en', '')], ['en'])).toEqual([])
  })

  it('returns nothing when no language is active', () => {
    expect(siblingItemsToApply([row('en'), row('pt')], [])).toEqual([])
  })

  it('returns nothing when there are no rows', () => {
    expect(siblingItemsToApply([], ['en', 'pt'])).toEqual([])
  })

  it('ignores an active language that has no row yet', () => {
    // The completeness check upstream is what waits for it; this function only
    // decides who to notify, never who is missing.
    expect(siblingItemsToApply([row('en')], ['en', 'pt'])).toEqual(['item-en'])
  })

  it('keeps the order of the rows, not of the language list', () => {
    const rows = [row('pt'), row('en')]
    expect(siblingItemsToApply(rows, ['en', 'pt'])).toEqual(['item-pt', 'item-en'])
  })
})
