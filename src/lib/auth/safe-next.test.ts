import { describe, it, expect } from 'vitest'
import { safeNext } from './safe-next'
import { ROUTES } from '@/lib/nav/routes'

describe('safeNext', () => {
  it('keeps a normal relative path', () => {
    expect(safeNext('/admin/tickets')).toBe('/admin/tickets')
  })

  it('preserves query strings on a relative path', () => {
    expect(safeNext(`${ROUTES.i7}?month=2026-07`)).toBe(`${ROUTES.i7}?month=2026-07`)
  })

  it('defaults to "/" for null, undefined, or empty', () => {
    expect(safeNext(null)).toBe('/')
    expect(safeNext(undefined)).toBe('/')
    expect(safeNext('')).toBe('/')
  })

  it('rejects absolute URLs', () => {
    expect(safeNext('https://evil.com')).toBe('/')
    expect(safeNext('http://evil.com/x')).toBe('/')
  })

  it('rejects protocol-relative URLs (//host)', () => {
    expect(safeNext('//evil.com')).toBe('/')
    expect(safeNext('//evil.com/admin')).toBe('/')
  })

  it('rejects the backslash trick (/\\host)', () => {
    expect(safeNext('/\\evil.com')).toBe('/')
  })

  it('rejects control characters that URL parsing strips (/\t/host becomes //host)', () => {
    expect(safeNext('/\t/evil.com')).toBe('/')
    expect(safeNext('/\n/evil.com')).toBe('/')
    expect(safeNext('/\r/evil.com')).toBe('/')
    expect(safeNext('/\u0000evil')).toBe('/')
  })

  it('rejects a backslash anywhere, not only after the first slash', () => {
    expect(safeNext('/a/..\\..\\evil.com')).toBe('/')
  })

  it('never lets the result resolve to another origin', () => {
    for (const raw of ['/\t/evil.com', '/\\evil.com', '//evil.com', '/%09/evil.com', '/directory?next=//evil.com']) {
      const out = safeNext(raw)
      expect(new URL(out, 'https://truenorthportal.online').origin).toBe('https://truenorthportal.online')
    }
  })

  it('keeps an encoded tab as text: it stays a path on this site', () => {
    expect(safeNext('/%09/evil.com')).toBe('/%09/evil.com')
  })

  it('rejects paths not rooted at "/"', () => {
    expect(safeNext('evil.com')).toBe('/')
    expect(safeNext('admin/tickets')).toBe('/')
  })
})

describe('safeNext with a query string', () => {
  // The Report keeps its whole state in the query, so a shared link that
  // survives the login has to keep it.
  it('keeps the query on a relative path', () => {
    expect(safeNext('/report?tab=workload&scope=everyone')).toBe('/report?tab=workload&scope=everyone')
  })

  it('still refuses another origin hidden behind a query', () => {
    expect(safeNext('//evil.com/?next=/report')).toBe('/')
    expect(safeNext('/\\evil.com?x=1')).toBe('/')
    expect(safeNext('https://evil.com/?a=/report')).toBe('/')
  })
})
