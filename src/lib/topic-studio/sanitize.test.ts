import { describe, expect, it } from 'vitest'
import { MAX_DRAFT_CHARS, draftText, draftWords, sanitizeDraftHtml as s } from './sanitize'

const A = (href: string, text: string) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`

describe('clean vocabulary', () => {
  const clean = [
    '<h1>Title</h1><h2>Two</h2><h3>Three</h3><h4>Four</h4>',
    '<p>Plain paragraph</p>',
    '<p>One <strong>bold</strong> <em>it</em> <u>under</u> end</p>',
    '<blockquote><p>Quoted</p></blockquote>',
    '<ul><li>a</li><li>b</li></ul>',
    '<ol><li>a<ul><li>nested</li></ul></li></ol>',
    '<p>line<br>break</p>',
    '<p>Fish &amp; chips &lt;b&gt; a&nbsp;b</p>',
    `<p>See ${A('https://example.com/a?x=1&amp;y=2', 'this')} now</p>`,
    `<p>${A('mailto:a@b.com', 'mail')}</p>`,
    '<p>Curly &#8217; and &#x2019; stay</p>',
  ]
  it.each(clean)('round-trips %s', (h) => {
    expect(s(h)).toBe(h)
  })
})

describe('dangerous markup', () => {
  it('removes script and style with their content', () => {
    expect(s('<p>a</p><script>alert(1)</script><p>b</p>')).toBe('<p>a</p><p>b</p>')
    expect(s('<style>p{x:y}</style><p>a<style>b</style>c</p>')).toBe('<p>ac</p>')
    expect(s('<p>x<SCRIPT type="t">evil()</SCRIPT >y</p>')).toBe('<p>xy</p>')
    expect(s('<p>a</p><script>never closed')).toBe('<p>a</p>')
  })
  it('removes the other content-dropping tags', () => {
    expect(s('<p>a<iframe src=x>inner</iframe>b</p>')).toBe('<p>ab</p>')
    expect(s('<p>a<svg><title>t</title><p>in</p></svg>b</p>')).toBe('<p>ab</p>')
    expect(s('<p>a<textarea><b>q</b></textarea>b</p>')).toBe('<p>ab</p>')
    expect(s('<p>a<form><p>f</p></form>b</p>')).toBe('<p>ab</p>')
  })
  it('drops void tags', () => {
    expect(s('<p>a<img src=x onerror=alert(1)>b<input value=1><meta x><link rel=a><base href=x>c</p>')).toBe(
      '<p>abc</p>',
    )
  })
  it('drops event handlers and other attributes', () => {
    expect(s('<p onclick="alert(1)" style="x:y" class=c>hi</p>')).toBe('<p>hi</p>')
    expect(s('<strong onmouseover=alert(1)>x</strong>')).toBe('<p><strong>x</strong></p>')
    expect(s('<p>a <img src=x onerror=alert(1)> b</p>')).toBe('<p>a b</p>')
  })
  it('survives split-tag tricks', () => {
    const a = s('<scr<script>ipt>alert(1)</scr</script>ipt>')
    expect(a).not.toMatch(/<script/i)
    expect(a).not.toContain('<scr')
    const b = s('<<script>alert(1)</script>>')
    expect(b).not.toMatch(/<script/i)
    expect(b).toBe('<p>&lt;&gt;</p>')
    expect(s('<p>1 < 2 and 3 > 2</p>')).toBe('<p>1 &lt; 2 and 3 &gt; 2</p>')
  })
  it('never echoes unknown tags', () => {
    expect(s('<p>a<marquee>b</marquee><blink>c</blink></p>')).toBe('<p>abc</p>')
    expect(s('<custom-tag onclick=x>t</custom-tag>')).toBe('<p>t</p>')
  })
})

describe('links', () => {
  it('drops unsafe schemes and keeps the text', () => {
    for (const href of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      'java\tscript:alert(1)',
      '&#106;avascript:alert(1)',
      '&#x6A;avascript:alert(1)',
      'javascript&colon;alert(1)',
      'jav&Tab;ascript:alert(1)',
      'data:text/html,<b>x</b>',
      'vbscript:msgbox(1)',
      '  javascript:alert(1)',
      '/relative/path',
      '//evil.com',
      '',
    ]) {
      expect(s(`<p><a href="${href}">text</a></p>`)).toBe('<p>text</p>')
    }
  })
  it('keeps http, https and mailto, case-insensitively', () => {
    expect(s('<p><a href="HTTP://x.com">a</a></p>')).toBe(`<p>${A('HTTP://x.com', 'a')}</p>`)
    expect(s('<p><a href=https://x.com/p>a</a></p>')).toBe(`<p>${A('https://x.com/p', 'a')}</p>`)
    expect(s("<p><a href='mailto:me@x.com'>a</a></p>")).toBe(`<p>${A('mailto:me@x.com', 'a')}</p>`)
    expect(s('<p><A HREF = "https://x.com" target=_self rel=x onclick=y>a</A></p>')).toBe(
      `<p>${A('https://x.com', 'a')}</p>`,
    )
  })
  it('trims the address and handles > inside quotes', () => {
    expect(s('<p><a href="  https://x.com/a>b  ">t</a></p>')).toBe(`<p>${A('https://x.com/a&gt;b', 't')}</p>`)
  })
  it('escapes quotes, angle brackets and ampersands in the address', () => {
    expect(s('<p><a href="https://x.com/?a=1&b=2&amp;c=3">t</a></p>')).toBe(
      `<p>${A('https://x.com/?a=1&amp;b=2&amp;c=3', 't')}</p>`,
    )
    expect(s('<p><a href=\'https://x.com/"q"\'>t</a></p>')).toBe(`<p>${A('https://x.com/&quot;q&quot;', 't')}</p>`)
    expect(s('<p><a href="https://x.com/&quot;onmouseover=&quot;x">t</a></p>')).toBe(
      `<p>${A('https://x.com/&quot;onmouseover=&quot;x', 't')}</p>`,
    )
    expect(s('<p><a href="https://x.com/&quot; onmouseover=&quot;x">t</a></p>')).toBe('<p>t</p>')
    expect(s('<p><a href="https://x.com/&lt;b&gt;">t</a></p>')).toBe(`<p>${A('https://x.com/&lt;b&gt;', 't')}</p>`)
  })
  it('rejects addresses with whitespace, controls or over 2000 chars', () => {
    expect(s('<p><a href="https://x.com/a b">t</a></p>')).toBe('<p>t</p>')
    expect(s('<p><a href="https://x.com/&#10;a">t</a></p>')).toBe('<p>t</p>')
    expect(s('<p><a href="https://x.com/' + 'a'.repeat(1980) + '">t</a></p>')).toContain('<a ')
    expect(s('<p><a href="https://x.com/' + 'a'.repeat(2000) + '">t</a></p>')).toBe('<p>t</p>')
  })
  it('drops a nested anchor and keeps text', () => {
    expect(s('<p><a href="https://a.com">x<a href="https://b.com">y</a>z</a></p>')).toBe(
      `<p>${A('https://a.com', 'xyz')}</p>`,
    )
  })
  it('drops an anchor without an href', () => {
    expect(s('<p><a name=x>t</a></p>')).toBe('<p>t</p>')
  })
})

describe('structure', () => {
  it('closes unclosed tags', () => {
    expect(s('<p>a <strong>b<em>c')).toBe('<p>a <strong>b<em>c</em></strong></p>')
    expect(s('<ul><li>a<li>b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(s('<blockquote><p>q')).toBe('<blockquote><p>q</p></blockquote>')
  })
  it('ignores stray end tags', () => {
    expect(s('</p>a</strong></li></ul></foo>')).toBe('<p>a</p>')
    expect(s('<p>a</em>b</p></p>')).toBe('<p>ab</p>')
  })
  it('closes down to the matching tag', () => {
    expect(s('<p>a<strong>b<em>c</strong>d</p>')).toBe('<p>a<strong>b<em>c</em></strong>d</p>')
    expect(s('<ul><li>a<strong>b</ul>c')).toBe('<ul><li>a<strong>b</strong></li></ul><p>c</p>')
  })
  it('drops li outside a list and keeps its text', () => {
    expect(s('<li>a</li>')).toBe('<p>a</p>')
    expect(s('<p>x<li>y</li></p>')).toBe('<p>xy</p>')
    expect(s('<blockquote><li>q</li></blockquote>')).toBe('<blockquote><p>q</p></blockquote>')
  })
  it('drops lists directly inside text containers', () => {
    expect(s('<p>a<ul><li>b</li></ul>c</p>')).toBe('<p>abc</p>')
    expect(s('<h2>a<ol><li>b</li></ol></h2>')).toBe('<h2>ab</h2>')
    expect(s('<p><strong>a<ul><li>b</li></ul></strong></p>')).toBe('<p><strong>a</strong>b</p>')
  })
  it('does not nest blocks inside p or headings', () => {
    expect(s('<p>a<p>b</p>')).toBe('<p>a</p><p>b</p>')
    expect(s('<p>a<h2>b</h2>c</p>')).toBe('<p>a</p><h2>b</h2><p>c</p>')
    expect(s('<p>a<blockquote>q</blockquote>')).toBe('<p>a</p><blockquote><p>q</p></blockquote>')
    expect(s('<strong><p>x</p></strong>')).toBe('<p>x</p>')
    expect(s('<ul><li><p>a</p><p>b</p></li></ul>')).toBe('<ul><li>a b</li></ul>')
  })
  it('wraps loose text in a paragraph and keeps lists after it', () => {
    expect(s('hello <b>x</b> world')).toBe('<p>hello x world</p>')
    expect(s('intro<ul><li>a</li></ul>')).toBe('<p>intro</p><ul><li>a</li></ul>')
    expect(s('<ul>loose<li>a</li></ul>')).toBe('<ul><li>loose</li><li>a</li></ul>')
  })
  it('turns division-style tags into separate paragraphs', () => {
    expect(s('<div>a</div><div>b</div>')).toBe('<p>a</p><p>b</p>')
    expect(s('<table><tr><td>a</td><td>b</td></tr></table>')).toBe('<p>a b</p>')
  })
  it('keeps nested lists and quotes', () => {
    expect(s('<ul><li>a<ol><li>b</li></ol></li></ul>')).toBe('<ul><li>a<ol><li>b</li></ol></li></ul>')
    expect(s('<blockquote><blockquote><p>d</p></blockquote></blockquote>')).toBe(
      '<blockquote><blockquote><p>d</p></blockquote></blockquote>',
    )
  })
  it('caps nesting at 20 and keeps the text', () => {
    const out = s('<ul><li>'.repeat(50) + 'deep' + '</li></ul>'.repeat(50))
    expect(out).toContain('deep')
    expect((out.match(/<ul>/g) || []).length).toBe(20)
    const q = s('<blockquote>'.repeat(30) + 'x')
    expect((q.match(/<blockquote>/g) || []).length).toBe(20)
    expect(q).toContain('x')
  })
})

describe('comments and other markup', () => {
  it('drops comments and conditional comments', () => {
    expect(s('<p>a<!-- hidden <script>x</script> -->b</p>')).toBe('<p>ab</p>')
    expect(s('<p>a<!--[if IE]><p>ie</p><![endif]-->b</p>')).toBe('<p>ab</p>')
    expect(s('<p>a<![if !IE]>b<![endif]>c</p>')).toBe('<p>abc</p>')
    expect(s('<p>a<!-->b</p>')).toBe('<p>ab</p>')
  })
  it('drops doctype, CDATA and processing instructions', () => {
    expect(s('<!DOCTYPE html><p>a</p>')).toBe('<p>a</p>')
    expect(s('<p>a<![CDATA[ <b>x</b> ]]>b</p>')).toBe('<p>ab</p>')
    expect(s('<?xml version="1.0"?><p>a</p>')).toBe('<p>a</p>')
  })
  it('drops an unterminated comment or tag at the end', () => {
    expect(s('<p>a</p><!-- never')).toBe('<p>a</p>')
    expect(s('<p>a</p><a href="x')).toBe('<p>a</p>')
    expect(s('<p>a</p><div class=')).toBe('<p>a</p>')
    expect(s('<p>a</p></p')).toBe('<p>a</p>')
    expect(s('<p>a</p><?php')).toBe('<p>a</p>')
  })
})

describe('text and entities', () => {
  it('keeps the five named entities', () => {
    expect(s('<p>&amp;&lt;&gt;&quot;&nbsp;x</p>')).toBe('<p>&amp;&lt;&gt;&quot;&nbsp;x</p>')
  })
  it('normalises raw characters', () => {
    expect(s('<p>a b > c "d"</p>')).toBe('<p>a&nbsp;b &gt; c "d"</p>')
  })
  it('keeps valid numeric references', () => {
    expect(s('<p>&#8217; &#x2019; &#X41; &#65;</p>')).toBe('<p>&#8217; &#x2019; &#X41; &#65;</p>')
  })
  it('escapes invalid or unknown references', () => {
    expect(s('<p>&#0; &#xD800; &#1114112; &#x; &# &#12345678; &#1;</p>')).toBe(
      '<p>&amp;#0; &amp;#xD800; &amp;#1114112; &amp;#x; &amp;# &amp;#12345678; &amp;#1;</p>',
    )
    expect(s('<p>&copy; &apos; &AMP; &amp &lt</p>')).toBe('<p>&amp;copy; &amp;apos; &amp;AMP; &amp;amp &amp;lt</p>')
  })
  it('drops raw control characters', () => {
    expect(s('<p>a\u0000b\u0007c\u0085d\ud800e</p>')).toBe('<p>abcde</p>')
    expect(s('<p>a\tb\r\nc</p>')).toBe('<p>a b c</p>')
  })
  it('handles bare < and &', () => {
    expect(s('a < b & c')).toBe('<p>a &lt; b &amp; c</p>')
    expect(s('<p>x <3 y</p>')).toBe('<p>x &lt;3 y</p>')
    expect(s('<p>x </ y <! z</p>')).toBe('<p>x &lt;/ y</p>')
    expect(s('5 <')).toBe('<p>5 &lt;</p>')
  })
  it('escaped markup stays text', () => {
    expect(s('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
  })
})

describe('whitespace and empty blocks', () => {
  it('collapses runs and trims block edges', () => {
    expect(s('<p>  a \n\n  b\t c  </p>')).toBe('<p>a b c</p>')
    expect(s('<p> <strong> a </strong> <em> b </em> </p>')).toBe('<p><strong>a</strong> <em>b</em></p>')
    expect(s('<p>a <!-- c --> b</p>')).toBe('<p>a b</p>')
    expect(s('<p>a <strong> b</strong></p>')).toBe('<p>a <strong>b</strong></p>')
  })
  it('keeps one space between adjacent inline pieces', () => {
    expect(s('<p><em>a</em> <strong>b</strong></p>')).toBe('<p><em>a</em> <strong>b</strong></p>')
    expect(s('<p><em>a </em><strong>b</strong></p>')).toBe('<p><em>a</em> <strong>b</strong></p>')
  })
  it('drops blocks without visible text', () => {
    expect(s('<p></p><p> </p><p><br></p><h2>&nbsp;</h2><ul><li></li></ul><blockquote><p></p></blockquote>')).toBe('')
    expect(s('<p>a</p><p><br></p><p>b</p>')).toBe('<p>a</p><p>b</p>')
    expect(s('<ul><li> </li><li>x</li></ul>')).toBe('<ul><li>x</li></ul>')
    expect(s('<p><strong></strong>a<em> </em></p>')).toBe('<p>a</p>')
  })
  it('trims leading and trailing line breaks but keeps inner ones', () => {
    expect(s('<p><br>a<br><br>b<br></p>')).toBe('<p>a<br><br>b</p>')
    expect(s('<p>a <br> b</p>')).toBe('<p>a<br>b</p>')
  })
})

describe('input handling', () => {
  it('returns empty for non-strings', () => {
    for (const v of [undefined, null, 5, {}, [], true, Symbol('x')]) expect(s(v)).toBe('')
    expect(s('')).toBe('')
  })
  it('cuts input longer than the maximum', () => {
    const out = s('<p>' + 'a'.repeat(MAX_DRAFT_CHARS + 5000) + '</p>')
    expect(out.length).toBeLessThanOrEqual(MAX_DRAFT_CHARS)
    expect(out.length).toBeGreaterThan(MAX_DRAFT_CHARS - 2000)
    expect(out.startsWith('<p>aaa')).toBe(true)
    expect(out.endsWith('a</p>')).toBe(true)
    expect(s(out)).toBe(out)
  })
  it('keeps the output within the maximum when escaping grows the text', () => {
    const out = s('&'.repeat(MAX_DRAFT_CHARS))
    expect(out.length).toBeLessThanOrEqual(MAX_DRAFT_CHARS)
    expect(out.startsWith('<p>&amp;')).toBe(true)
    expect(s(out)).toBe(out)
  })
})

function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CORPUS: string[] = [
  '',
  '<p>a</p>',
  'plain text',
  '<p>a<p>b',
  '<ul><li>a<li>b</ul>',
  '<ol><li>a<ul><li>b</li></ul>c</li></ol>',
  '<blockquote>q<blockquote>r</blockquote></blockquote>',
  '<scr<script>ipt>alert(1)</scr</script>ipt>',
  '<<script>alert(1)</script>',
  '<p onclick=alert(1)>x</p>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<a href="https://x.com/?a=1&b=2&amp;c=3">x</a>',
  '<a href=\'https://x.com/"q"\'>x</a>',
  '<a href="https://a.com">x<a href="https://b.com">y</a></a>',
  '<!-- c --><p>a</p><!--[if IE]><p>x</p><![endif]-->',
  '<![CDATA[x]]><?php x ?><!DOCTYPE html>',
  '&amp; &lt; &gt; &quot; &nbsp; &#8217; &#x2019; &#0; &copy; & &',
  'a < b > c <3 </ x <! y',
  '<p>  a \n b  </p>  <p> </p> <p><br></p>',
  '<p>a<br><br>b<br></p>',
  '<li>a</li><li>b</li>',
  '<p>a<ul><li>b</li></ul>c</p>',
  '<strong><p>x</p></strong>',
  '<p><strong>a <em>b</strong> c</em></p>',
  '<div><div>a</div><span>b</span></div>',
  '<table><tr><td>a<td>b</table>',
  '<svg><title>x</title></svg><p>a</p><math><mi>x</mi></math>',
  '<style>a{}</style><p>b</p><textarea><p>c</p></textarea>',
  '<p>a</p></p></ul></li></strong>',
  '<a href="x',
  '<p>a</p><!-- open',
  '\u0000<p>\u0007a\ud800b</p>',
  '<h1>a<h2>b<h3>c<h4>d',
  '<p>a&nbsp;&nbsp;b</p><p>&nbsp;</p>',
  '<ul>text<li>a</li>more</ul>',
  'intro<ul><li>a</li></ul>outro',
  '<p><a href="https://x.com"><strong>a</strong> <em>b</em></a></p>',
  '<ul><li><ul><li><ul><li>x</li></ul></li></ul></li></ul>',
  '<p>' + 'x '.repeat(500) + '</p>',
]

const ADVERSARIAL: Array<[string, string]> = [
  ['100k less-than', '<'.repeat(100_000)],
  ['a-tag starts', '<a '.repeat(130_000)],
  ['nested ul li', '<ul><li>'.repeat(50_000)],
  ['nested ul li closed', '<ul><li>x'.repeat(20_000) + '</li></ul>'.repeat(20_000)],
  ['open paragraphs', '<p>'.repeat(130_000)],
  ['open strong', '<strong>'.repeat(50_000) + 'x'],
  ['open blockquote', '<blockquote>'.repeat(30_000) + 'x'],
  ['stray end tags', '</p>'.repeat(90_000)],
  ['ampersands', '&'.repeat(MAX_DRAFT_CHARS)],
  ['comments', '<!---->'.repeat(50_000)],
  ['script starts', '<script>'.repeat(50_000)],
  ['end-like script', '<script>' + '</scriptx'.repeat(40_000)],
  ['quotes', '<a href="'.repeat(40_000)],
  ['br run', '<p>' + '<br>'.repeat(90_000) + 'x</p>'],
  ['long href', '<a href="https://x.com/' + 'a'.repeat(390_000) + '">x</a>'],
]

describe('idempotence and speed', () => {
  it.each(CORPUS.map((c, i) => [i, c] as const))('corpus %i is idempotent', (_i, input) => {
    const once = s(input)
    expect(s(once)).toBe(once)
  })
  it('has a corpus of at least 30 inputs', () => {
    expect(CORPUS.length).toBeGreaterThanOrEqual(30)
  })
  it.each(ADVERSARIAL)('finishes fast on %s', (_name, input) => {
    const t0 = Date.now()
    const once = s(input)
    const ms = Date.now() - t0
    expect(ms).toBeLessThan(2000)
    expect(once.length).toBeLessThanOrEqual(MAX_DRAFT_CHARS)
    expect(s(once)).toBe(once)
    expect(once).not.toMatch(/<script/i)
  }, 20_000)
})

describe('randomised safety', () => {
  const FRAGS = ['<', '>', '</', 'p', 'script', 'a href=', '"', "'", '&', '&amp;', 'javascript:', ' ', 'x', 'onerror=']
  const TAG = /^(?:<\/?(?:h[1-4]|p|blockquote|ul|ol|li|strong|em|u|a)>|<br>|<a href="[^"<>]*" target="_blank" rel="noopener">)$/

  it('300 random strings: idempotent and only canonical tags', () => {
    const rnd = seeded(20261105)
    for (let n = 0; n < 300; n++) {
      const len = 5 + Math.floor(rnd() * 40)
      let input = ''
      for (let k = 0; k < len; k++) input += FRAGS[Math.floor(rnd() * FRAGS.length)]
      const out = s(input)
      expect(s(out), JSON.stringify(input)).toBe(out)
      expect(out).not.toMatch(/<script|<iframe/i)
      const tags = out.match(/<[^>]*>/g) || []
      for (const t of tags) {
        expect(TAG.test(t), `${JSON.stringify(input)} -> ${t}`).toBe(true)
        // no unsafe address inside any link
        const m = /^<a href="([^"]*)"/.exec(t)
        if (m) expect(/^(?:https?:\/\/|mailto:)/i.test(m[1])).toBe(true)
        expect(t).not.toMatch(/ on[a-z]+=/i)
        expect(t).not.toMatch(/javascript:/i)
      }
      // no raw angle bracket outside of a tag
      expect(out.replace(/<[^>]*>/g, '')).not.toMatch(/[<>]/)
    }
  })
})

describe('draftText and draftWords', () => {
  it('reads the visible text', () => {
    const h = '<h2>Title</h2><p>One &amp; two<br>three&nbsp;four</p><ul><li>a</li><li>b</li></ul>'
    expect(draftText(h)).toBe('Title One & two three four a b')
    expect(draftText('')).toBe('')
    expect(draftText('<p>&lt;b&gt; &quot;q&quot; &apos;s&apos; &#8217; &#x2019;</p>')).toBe('<b> "q" \'s\' ’ ’')
    expect(draftText('<p>' + A('https://x.com/?a=1&amp;b=2', 'link') + ' text</p>')).toBe('link text')
  })
  it('keeps unknown references literal', () => {
    expect(draftText('<p>&amp;amp; &foo; &#0;</p>')).toBe('&amp; &foo; &#0;')
  })
  it('counts words', () => {
    expect(draftWords('')).toBe(0)
    expect(draftWords('<p>Hello, world</p>')).toBe(2)
    expect(draftWords("<p>It’s don't 3 cafés</p>")).toBe(4)
    expect(draftWords('<h2>One</h2><p>two<br>three</p>')).toBe(3)
    expect(draftWords('<p>a&nbsp;b</p>')).toBe(2)
  })
})
