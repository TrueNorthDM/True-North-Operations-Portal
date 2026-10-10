import { describe, it, expect } from 'vitest'
import { fromAnotherSite } from './same-site'

const req = (site?: string) => new Request('https://portal.test/api/admin/monday-ingest?run=yes',
  { headers: site ? { 'sec-fetch-site': site } : {} })

describe('a request another website started', () => {
  it('is refused when the browser says it came from elsewhere', () => {
    expect(fromAnotherSite(req('cross-site'))).toBe(true)
    expect(fromAnotherSite(req('same-site'))).toBe(true)
  })

  it('is allowed typed, from the portal itself, or from the server', () => {
    expect(fromAnotherSite(req('none'))).toBe(false)
    expect(fromAnotherSite(req('same-origin'))).toBe(false)
    expect(fromAnotherSite(req())).toBe(false)
  })
})
