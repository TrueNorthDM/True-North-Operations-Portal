import { describe, it, expect } from 'vitest'
import { checkPageUrl, isPageDone } from './rules'
import { renderHreflangHtml } from '@/lib/hreflang'

// The Href Links rules (decided 10 October 2026).

const AAAF = 'https://www.askanadventistfriend.com'

describe('a page URL', () => {
  it('is https on the site, and the bare domain becomes the www form', () => {
    expect(checkPageUrl('https://www.askanadventistfriend.com/pt/page/', AAAF)).toEqual({ ok: true, url: 'https://www.askanadventistfriend.com/pt/page/' })
    expect(checkPageUrl('https://askanadventistfriend.com/x', AAAF)).toEqual({ ok: true, url: 'https://www.askanadventistfriend.com/x' })
  })

  it('refuses the test site, plain http, another site, and a title pasted by mistake', () => {
    expect(checkPageUrl('https://devsite.askanadventistfriend.com/x', AAAF).ok).toBe(false)
    expect(checkPageUrl('http://www.askanadventistfriend.com/x', AAAF).ok).toBe(false)
    expect(checkPageUrl('https://www.hopefor.africa/x', AAAF).ok).toBe(false)
    expect(checkPageUrl('Are Any Adventists Saved?', AAAF).ok).toBe(false)
  })
})

describe('the hreflang code pasted into WordPress', () => {
  it('cannot be broken out of by a quote in a link', () => {
    const html = renderHreflangHtml([{ language_code: 'en', url: 'https://x/" /><script src=//evil></script><link x="' }])
    expect(html).not.toContain('<script')
    expect(html).toContain('&quot;')
  })
})

describe('a done page', () => {
  it('has every current language live, or is not relevant', () => {
    expect(isPageDone({ notRelevant: false, confirmed: new Set(['en', 'sw']) }, ['en', 'sw'])).toBe(true)
    // A language added later reopens it.
    expect(isPageDone({ notRelevant: false, confirmed: new Set(['en', 'sw']) }, ['en', 'sw', 'pt'])).toBe(false)
    expect(isPageDone({ notRelevant: true, confirmed: new Set() }, ['en'])).toBe(true)
  })
})
