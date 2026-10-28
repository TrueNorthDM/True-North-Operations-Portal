import { describe, expect, it } from 'vitest'
import { UnrecognizedActionError } from 'next/dist/client/components/unrecognized-action-error'
import { NETWORK_TEXT, UPDATED_TEXT, failText, isStalePage, staleOr } from './action-error'

describe('a save that threw', () => {
  it('says reload when the page is older than the deploy', () => {
    const e = new UnrecognizedActionError('Server Action "401f" was not found on the server.')
    expect(isStalePage(e)).toBe(true)
    expect(failText(e)).toBe(UPDATED_TEXT)
  })
  it('says the connection for anything else', () => {
    expect(failText(new TypeError('Failed to fetch'))).toBe(NETWORK_TEXT)
    expect(failText(undefined)).toBe(NETWORK_TEXT)
  })
  it("keeps a screen's own sentence unless the page is older than the deploy", () => {
    const own = 'Not marked read. Try again in a moment.'
    expect(staleOr(new UnrecognizedActionError('Server Action "409f" was not found on the server.'), own)).toBe(UPDATED_TEXT)
    expect(staleOr(new TypeError('Failed to fetch'), own)).toBe(own)
  })
})
