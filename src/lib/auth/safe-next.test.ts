import { describe, it, expect } from 'vitest'
import { safeNext } from './safe-next'

describe('safeNext', () => {
  it('keeps a normal relative path', () => {
    expect(safeNext('/admin/tickets')).toBe('/admin/tickets')
  })

  it('preserves query strings on a relative path', () => {
    expect(safeNext('/work-tools/time-report?month=2026-07')).toBe('/work-tools/time-report?month=2026-07')
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
