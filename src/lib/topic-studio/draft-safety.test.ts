import { describe, expect, it } from 'vitest'
import { cleanDraftHtml } from './draft-client'
import { sanitizeDraftHtml, draftText, draftWords } from './sanitize'

const INPUTS = [
  '<p>Plain paragraph with <strong>bold</strong>, <em>italic</em> and <u>under</u>.</p>',
  '<h1>Title</h1><p>Text</p><h2>Sub</h2><ul><li>One</li><li>Two <a href="https://a.test/x?y=1&z=2">link</a></li></ul><ol><li>First</li></ol><blockquote><p>Quoted</p></blockquote>',
  '<p>Tom &amp; Jerry &lt;3 and a&nbsp;b &#8217; quote</p>',
  '<ul><li>Parent<ul><li>Child</li></ul></li></ul>',
  '<p>Line one<br>line two</p>',
  '<div style="font-weight:700">Google Docs <span style="font-style:italic">style</span></div>',
  '<p class="MsoNormal">Word<o:p></o:p> paragraph&nbsp;</p>',
  '<table><tr><td>A</td><td>B</td></tr></table>',
  '<p><a href="mailto:x@y.test">mail</a> <a href="javascript:alert(1)">bad</a> <a href="/relative">rel</a></p>',
  'Loose text<p>then a paragraph</p>more loose',
  '<h5>Five</h5><h6>Six</h6>',
  '<p>Emoji \u{1F600} and accents éè and curly “quotes”</p>',
]
describe('what the editor produces survives the server sanitizer unchanged', () => {
  for (const [i, x] of INPUTS.entries()) it(`input ${i + 1}`, () => {
    const clean = cleanDraftHtml(x)
    expect(sanitizeDraftHtml(clean)).toBe(clean)
  })
})

describe('attacks', () => {
  const ATTACKS = [
    '<img src=x onerror=alert(1)>', '<svg/onload=alert(1)>', '<script>alert(1)</script>', '<scr<script>ipt>alert(1)</scr</script>ipt>',
    '<a href="javascript:alert(1)">x</a>', '<a href="JaVaScRiPt:alert(1)">x</a>', '<a href="java\tscript:alert(1)">x</a>', '<a href="&#106;avascript:alert(1)">x</a>',
    '<a href="data:text/html;base64,PHNjcmlwdD4=">x</a>', '<p onclick="alert(1)">x</p>', '<p style="background:url(javascript:alert(1))">x</p>',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>', '<object data="x"></object>', '<form action="x"><input></form>', '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<p><b onmouseover=alert(1)>x</b></p>', '<a href=\'x" onfocus="alert(1)\'>x</a>', '"><script>alert(1)</script>', '<!--><script>alert(1)</script>-->', '<style>*{x:expression(alert(1))}</style>',
    '<a href="https://ok.test/" onclick="alert(1)" target="_self">ok</a>', '<base href="javascript:alert(1)//">', '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">', '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
  ]
  for (const [i, x] of ATTACKS.entries()) it(`attack ${i + 1}: ${x.slice(0, 40)}`, () => {
    const out = sanitizeDraftHtml(x)
    expect(out).not.toMatch(/<\s*(script|iframe|object|embed|svg|math|style|img|form|input|base|meta|link)/i)
    expect(out).not.toMatch(/\son\w+\s*=/i)
    expect(out).not.toMatch(/href="(?!https?:\/\/|mailto:)/i)
    expect(out).not.toMatch(/<[^>]*javascript:/i)
    expect(sanitizeDraftHtml(out)).toBe(out)
    // Putting it in a document must not create any element but the allowed ones.
    const d = new DOMParser().parseFromString(`<body>${out}</body>`, 'text/html')
    for (const e of Array.from(d.body.querySelectorAll('*'))) expect(['P', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'U', 'A', 'BR']).toContain(e.tagName)
    for (const a of Array.from(d.body.querySelectorAll('a'))) expect(a.getAttributeNames().sort()).toEqual(['href', 'rel', 'target'])
  })
})

describe('spaces beside bold and italic', () => {
  // Real drafts pasted from Google Docs hold <em> sees us </em>(Genesis): the server moves the spaces outside the tag.
  // Same words, same spacing on screen; it only settles on the first save and then stays put.
  it('moves them outside the tag without changing the text', () => {
    const raw = '<p>who<em> sees us </em>(Genesis 16:13) and<strong> never give up </strong>(1 Thess 5)</p>'
    const out = sanitizeDraftHtml(raw)
    expect(out).toBe('<p>who <em>sees us</em> (Genesis 16:13) and <strong>never give up</strong> (1 Thess 5)</p>')
    expect(draftText(out)).toBe(draftText(raw))
    expect(sanitizeDraftHtml(out)).toBe(out)
  })
})

describe('words', () => { it('counts words of sanitized html', () => { expect(draftWords('<p>One two</p><ul><li>three-four five</li></ul>')).toBe(5) }) })
