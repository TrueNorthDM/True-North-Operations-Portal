import { describe, it, expect } from 'vitest'
import { summarizeResult, relativeTime, activityMoment } from './activity'

// The Href Links feed wording (audit, 10 October 2026).

describe('summarizeResult', () => {
  it('reads a refused link as a warning that names the language and the reason', () => {
    expect(summarizeResult('skipped:link for es refused (The link is not a page on www.askanadventistfriend.com.)')).toEqual({
      severity: 'warn', tag: 'WARN',
      message: 'Spanish link not saved: The link is not a page on www.askanadventistfriend.com.',
    })
  })

  it('reads a status that moved on as ignored', () => {
    expect(summarizeResult('skipped:label is now "Working on it"')).toMatchObject({
      severity: 'warn', message: 'Ignored: the status changed again before the portal read it',
    })
  })

  it('reads Monday being unreachable as an error, without its wording', () => {
    expect(summarizeResult('error:monday (fetch failed: ECONNRESET)')).toEqual({
      severity: 'error', tag: 'ERROR', message: 'Monday could not be reached',
    })
  })

  it('reads a live link changed in Monday as a warning', () => {
    expect(summarizeResult('ok:link changed for es, confirmation removed')).toEqual({
      severity: 'warn', tag: 'WARN', message: 'Spanish link changed in Monday: confirmation removed, page flagged',
    })
  })

  it('treats anything skipped as a warning and anything failed as an error', () => {
    expect(summarizeResult('skipped:something new').severity).toBe('warn')
    expect(summarizeResult('error:upsert page_url (duplicate key value)')).toMatchObject({ severity: 'error', message: 'The link could not be saved' })
    expect(summarizeResult('error:something new (secret db words)')).toMatchObject({ severity: 'error', message: 'Failed: something new' })
  })

  it('keeps the existing readings, with language names', () => {
    expect(summarizeResult('ok:saved en (waiting on: pt,sw)').message).toBe('English link received, still waiting on Portuguese and Swahili')
    expect(summarizeResult('ok:applied Apply Link to 4 sibling items').tag).toBe('APPLY_LINK')
    expect(summarizeResult('ok:confirmed sw (monday=done, all-live=true) [stamped All Live]').tag).toBe('ALL_LIVE')
    expect(summarizeResult('ok:confirmed sw (all-live=false)')).toMatchObject({ tag: 'DONE', message: 'Swahili marked Done in Monday' })
    expect(summarizeResult('ok:deleted "Who is God?" by ana@example.com')).toMatchObject({ tag: 'DELETED' })
    expect(summarizeResult(null)).toMatchObject({ severity: 'warn' })
  })
})

describe('feed times', () => {
  const now = Date.parse('2026-10-10T12:00:00Z')
  it('counts recent ones and dates older ones on the New York day', () => {
    expect(relativeTime('2026-10-10T11:55:00Z', now)).toBe('5m ago')
    // 02:00 UTC on 2 October is still 1 October in New York.
    expect(relativeTime('2026-10-02T02:00:00Z', now)).toBe('Oct 1, 2026')
  })
  it('gives the exact moment in New York', () => {
    expect(activityMoment('2026-10-09T19:05:00Z')).toBe('Oct 9, 2026, 3:05 PM')
  })
})
