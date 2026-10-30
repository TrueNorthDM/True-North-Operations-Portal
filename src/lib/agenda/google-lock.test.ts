import { describe, it, expect, vi, beforeEach } from 'vitest'

/** The new Agenda switch (migration 134): open only when the row says so, closed on any failure. */

const answer: { data: unknown; error: unknown; throws?: boolean } = { data: null, error: null }
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (answer.throws) throw new Error('no database')
    return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: answer.data, error: answer.error }) }) }) }) }
  },
}))

import { openFrom, agendaGoogleOpen, closedRefusal, AGENDA_GOOGLE_CLOSED } from './google-lock'

describe('openFrom', () => {
  it('is open only when the row says true and nothing failed', () => {
    expect(openFrom({ agenda_google_open: true }, null)).toBe(true)
    expect(openFrom({ agenda_google_open: false }, null)).toBe(false)
    expect(openFrom({}, null)).toBe(false)
    expect(openFrom(null, null)).toBe(false)
    expect(openFrom({ agenda_google_open: true }, { message: 'column does not exist' })).toBe(false)
  })
})

describe('agendaGoogleOpen and closedRefusal', () => {
  beforeEach(() => { answer.data = null; answer.error = null; answer.throws = false; vi.spyOn(console, 'error').mockImplementation(() => {}) })
  it('reads the switch', async () => {
    answer.data = { agenda_google_open: true }
    expect(await agendaGoogleOpen()).toBe(true)
  })
  it('fails closed when the database cannot be reached', async () => {
    answer.throws = true
    expect(await agendaGoogleOpen()).toBe(false)
  })
  it('refuses while closed, in the caller\'s own shape', async () => {
    answer.data = { agenda_google_open: false }
    expect(await closedRefusal(error => ({ ok: false as const, error }))).toEqual({ ok: false, error: AGENDA_GOOGLE_CLOSED })
  })
})
