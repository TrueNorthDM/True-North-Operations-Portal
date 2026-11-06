import { describe, expect, it } from 'vitest'
import { bookmarkletHref, parseCapture } from './capture'

describe('parseCapture', () => {
  it('reads the capture button as it comes (JSON with the marker)', () => {
    const json = JSON.stringify({ _hfa: 2, url: 'https://a.test/x', title: 'T', desc: 'd', blocks: [['h1', 'Hi'], ['p', 'Body']], links: [['https://l.test', 'L']] })
    expect(parseCapture(json, '', '')).toMatchObject({ _hfa: 2, url: 'https://a.test/x', blocks: [['h1', 'Hi'], ['p', 'Body']] })
  })
  it('reads copied page HTML: headings, paragraphs and list items, dropping menus', () => {
    const html = '<html><body><nav><a href="/x">Menu</a></nav><article><h1>Dry firewood</h1><p>Seasoned wood burns hotter and cleaner than wet wood.</p><h2>Why</h2><ul><li>Less smoke</li></ul></article><footer>Copyright</footer></body></html>'
    const c = parseCapture('', html, 'a.test')!
    expect(c.blocks).toEqual([['h1', 'Dry firewood'], ['p', 'Seasoned wood burns hotter and cleaner than wet wood.'], ['h2', 'Why'], ['li', 'Less smoke']])
    expect(c.title).toBe('Dry firewood')
  })
  it('reads plain text line by line, guessing headings from short lines with no full stop', () => {
    const c = parseCapture('How to dry firewood\nSeasoned wood burns hotter and cleaner than wet wood does.\nWhy it matters\nIt keeps the chimney cleaner and the stove running well for longer than expected.', '', '')!
    expect(c.blocks.map(b => b[0])).toEqual(['h1', 'p', 'h2', 'p'])
    expect(c._hfa).toBe(0)
    expect(c.title).toBe('How to dry firewood')
  })
  it('returns null when there is nothing', () => {
    expect(parseCapture('  ', '', '')).toBeNull()
    expect(parseCapture('', '<html><body><nav>only a menu</nav></body></html>', '')).toBeNull()
  })
})

describe('bookmarkletHref', () => {
  it('is a javascript: address that runs the capture on the page with its host', () => {
    const href = bookmarkletHref()
    expect(href.startsWith('javascript:')).toBe(true)
    const code = decodeURIComponent(href.slice('javascript:'.length))
    expect(code).toContain("(document,'bm',location.hostname.replace(/^www\\./,''))")
    expect(() => new Function(code)).not.toThrow()
  })
})
