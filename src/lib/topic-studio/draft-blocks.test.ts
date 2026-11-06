import { describe, expect, it } from 'vitest'
import { cleanDraftHtml, draftBlocksFromHtml } from './draft-client'
import { draftBlocks } from './draft-blocks'
import { sanitizeDraftHtml } from './sanitize'

const SAMPLES = [
  '<h1>Title</h1><p>One <strong>bold</strong> and <em>italic</em> and <a href="https://a.test/x">a link</a>.</p><h2>Sub</h2><ul><li>First</li><li>Second <u>under</u></li></ul>',
  '<p>Tom &amp; Jerry &lt;3 and a&nbsp;b &#8217; quote</p><blockquote><p>Quoted line</p><p>Second quoted</p></blockquote>',
  '<ol><li>One</li><li>Two</li></ol><h3>Three</h3><h4>Four</h4><p>End</p>',
  '<div>Loose<p>then</p>more loose</div>',
  '<h5>Five</h5><h6>Six</h6><table><tr><td>A</td><td>B</td></tr></table>',
]

describe('draftBlocks', () => {
  it('reads headings, paragraphs and list items, dropping inline formatting', () => {
    expect(draftBlocks('<h1>T</h1><p>A <b>x</b> <strong>bold</strong> <a href="https://a.test">link</a></p><ul><li>one</li></ul>')).toEqual([['h1', 'T'], ['p', 'A x bold link'], ['li', 'one']])
  })
  it('decodes entities and joins a line break with a space', () => {
    expect(draftBlocks('<p>Tom &amp; Jerry&nbsp;&lt;3 &#8217;<br>next</p>')).toEqual([['p', 'Tom & Jerry <3 ’ next']])
  })
  it('puts paragraphs inside a quote in as paragraphs, and skips empty blocks', () => {
    expect(draftBlocks('<blockquote><p>Q1</p><p></p><p>Q2</p></blockquote>')).toEqual([['p', 'Q1'], ['p', 'Q2']])
  })
  // Where the browser's reader differs, on purpose: it glues the words either side of a line break
  // ("Line oneline two") and calls the text of a list item that holds a sublist a paragraph.
  it('keeps a space at a line break and a list item a list item, even with a sublist', () => {
    expect(draftBlocks('<p>Line one<br>line two</p>')).toEqual([['p', 'Line one line two']])
    expect(draftBlocks('<ul><li>Parent<ul><li>Child</li></ul></li></ul>')).toEqual([['li', 'Parent'], ['li', 'Child']])
  })
  it('is empty for an empty or tag-only draft', () => {
    expect(draftBlocks('')).toEqual([])
    expect(draftBlocks('<ul></ul><br>')).toEqual([])
  })
  for (const [i, s] of SAMPLES.entries()) {
    it(`gives the browser's blocks for what the editor and the server produce (sample ${i + 1})`, () => {
      const clean = sanitizeDraftHtml(cleanDraftHtml(s))
      expect(draftBlocks(clean)).toEqual(draftBlocksFromHtml(clean))
    })
  }
})
