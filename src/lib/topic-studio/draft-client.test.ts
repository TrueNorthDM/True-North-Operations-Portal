import { describe, expect, it } from 'vitest'
import { cleanDraftHtml, draftBlocksFromHtml, htmlToText, plainToHtml, safeHref } from './draft-client'

// Golden strings come from running the prototype's code once in jsdom.
type Case = { name: string, html: string, clean: string, blocks: [string, string][], text: string }

const CASES: Case[] = [
  { name: 'plain paragraphs', html: '<p>One</p><p>Two  words</p>', clean: '<p>One</p><p>Two words</p>', blocks: [['p','One'],['p','Two words']], text: 'OneTwo  words' },
  { name: 'headings h1 to h6', html: '<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4><h5>E</h5><h6>F</h6>', clean: '<h1>A</h1><h2>B</h2><h3>C</h3><h4>D</h4><h4>E</h4><h4>F</h4>', blocks: [['h1','A'],['h2','B'],['h3','C'],['h4','D'],['h4','E'],['h4','F']], text: 'ABCDEF' },
  { name: 'nested lists', html: '<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>', clean: '<ul><li>a<ul><li>b</li><li>c</li></ul></li><li>d</li></ul>', blocks: [['p','a'],['li','b'],['li','c'],['li','d']], text: 'abcd' },
  { name: 'list item with sublist and text after', html: '<ul><li>one<ol><li>x</li></ol>tail</li></ul>', clean: '<ul><li>one<ol><li>x</li></ol>tail</li></ul>', blocks: [['p','one'],['li','x'],['p','tail']], text: 'onextail' },
  { name: 'ordered list', html: '<ol><li>first</li><li>second</li></ol>', clean: '<ol><li>first</li><li>second</li></ol>', blocks: [['li','first'],['li','second']], text: 'firstsecond' },
  { name: 'blockquote with paragraphs', html: '<blockquote><p>Q1</p><p>Q2</p></blockquote>', clean: '<blockquote><p>Q1</p><p>Q2</p></blockquote>', blocks: [['p','Q1'],['p','Q2']], text: 'Q1Q2' },
  { name: 'nested blockquote', html: '<blockquote>a<blockquote>b</blockquote></blockquote>', clean: '<blockquote><p>a</p><p>b</p></blockquote>', blocks: [['p','a'],['p','b']], text: 'ab' },
  { name: 'bold italic underline tags', html: '<p><strong>b</strong> <em>i</em> <u>u</u> <b>b2</b> <i>i2</i></p>', clean: '<p><strong>b</strong> <em>i</em> <u>u</u> <strong>b2</strong> <em>i2</em></p>', blocks: [['p','b i u b2 i2']], text: 'b i u b2 i2' },
  { name: 'bold inside heading is dropped', html: '<h2><strong>Head</strong> line</h2>', clean: '<h2>Head line</h2>', blocks: [['h2','Head line']], text: 'Head line' },
  { name: 'google docs span weight', html: '<p><span style="font-weight:700">Bold</span> <span style="font-style:italic;text-decoration:underline">it</span></p>', clean: '<p><strong>Bold</strong> <em><u>it</u></em></p>', blocks: [['p','Bold it']], text: 'Bold it' },
  { name: 'google docs b wrapper', html: '<b style="font-weight:normal" id="docs-internal-guid-1"><p><span style="font-weight:400">plain</span> <span style="font-weight:700">bold</span></p></b>', clean: '<p>plain <strong>bold</strong></p>', blocks: [['p','plain bold']], text: 'plain bold' },
  { name: 'word style', html: '<p class=MsoNormal>Hello&nbsp;world<o:p></o:p></p><p class=MsoNormal><b>Bold</b><o:p>&nbsp;</o:p></p>', clean: '<p>Hello world</p><p><strong>Bold</strong></p>', blocks: [['p','Hello world'],['p','Bold']], text: 'Hello worldBold ' },
  { name: 'links kept', html: '<p><a href="http://a.com/x">h</a> <a href="https://b.com">hs</a> <a href="mailto:x@y.com">m</a></p>', clean: '<p><a href="http://a.com/x" target="_blank" rel="noopener">h</a> <a href="https://b.com" target="_blank" rel="noopener">hs</a> <a href="mailto:x@y.com" target="_blank" rel="noopener">m</a></p>', blocks: [['p','h hs m']], text: 'h hs m' },
  { name: 'links dropped', html: '<p><a href="javascript:alert(1)">js</a> <a href="/rel">rel</a> <a>none</a></p>', clean: '<p>js rel none</p>', blocks: [['p','js rel none']], text: 'js rel none' },
  { name: 'bold link', html: '<p><a href="https://b.com"><strong>bold link</strong></a></p>', clean: '<p><a href="https://b.com" target="_blank" rel="noopener"><strong>bold link</strong></a></p>', blocks: [['p','bold link']], text: 'bold link' },
  { name: 'br handling', html: '<p>a<br>b<br><br>c<br></p><p><br>lead</p>', clean: '<p>a<br>b<br><br>c</p><p>lead</p>', blocks: [['p','abc'],['p','lead']], text: 'abclead' },
  { name: 'br outside block', html: 'x<br>y', clean: '<p>x<br>y</p>', blocks: [['p','xy']], text: 'xy' },
  { name: 'script and style', html: '<p>ok</p><script>alert(1)</script><style>p{color:red}</style><p>after</p>', clean: '<p>ok</p><p>after</p>', blocks: [['p','ok'],['p','after']], text: 'okalert(1)p{color:red}after' },
  { name: 'iframe img form', html: '<p>t</p><iframe src="x">in</iframe><img src="a.png"><form><input value="v"><button>go</button></form><figure>cap</figure>', clean: '<p>t</p>', blocks: [['p','t']], text: 'tingocap' },
  { name: 'tables flattened', html: '<table><tr><th>H1</th><th>H2</th></tr><tr><td>a</td><td>b</td></tr></table>', clean: '<p>H1 H2</p><p>a b</p>', blocks: [['p','H1 H2'],['p','a b']], text: 'H1H2ab' },
  { name: 'divs and sections', html: '<div>one<div>two</div></div><section>three</section><article><p>four</p></article>', clean: '<p>one</p><p>two</p><p>three</p><p>four</p>', blocks: [['p','one'],['p','two'],['p','three'],['p','four']], text: 'onetwothreefour' },
  { name: 'hr', html: '<p>a</p><hr><p>b</p>', clean: '<p>a</p><p>b</p>', blocks: [['p','a'],['p','b']], text: 'ab' },
  { name: 'empty blocks removed', html: '<p></p><p>  </p><p>&nbsp;</p><ul><li></li></ul><blockquote><p></p></blockquote><h2></h2><p>keep</p>', clean: '<p>keep</p>', blocks: [['p','keep']], text: '   keep' },
  { name: 'adjacent inline merged', html: '<p><strong>a</strong><strong>b</strong> <em>c</em><em>d</em></p>', clean: '<p><strong>ab</strong> <em>cd</em></p>', blocks: [['p','ab cd']], text: 'ab cd' },
  { name: 'adjacent links merged', html: '<p><a href="https://x.com">a</a><a href="https://x.com">b</a><a href="https://y.com">c</a></p>', clean: '<p><a href="https://x.com" target="_blank" rel="noopener">ab</a><a href="https://y.com" target="_blank" rel="noopener">c</a></p>', blocks: [['p','abc']], text: 'abc' },
  { name: 'text outside any block', html: 'Loose text <b>bold</b> more', clean: '<p>Loose text <strong>bold</strong> more</p>', blocks: [['p','Loose text bold more']], text: 'Loose text bold more' },
  { name: 'text directly in list', html: '<ul>text<li>item</li><b>bold</b></ul>', clean: '<ul><li>text</li><li>item</li><li><strong>bold</strong></li></ul>', blocks: [['li','text'],['li','item'],['li','bold']], text: 'textitembold' },
  { name: 'pre becomes p', html: '<pre>line  one\nline two</pre>', clean: '<p>line one line two</p>', blocks: [['p','line one line two']], text: 'line  one\nline two' },
  { name: 'nested div inside p', html: '<p>a<div>b</div>c</p>', clean: '<p>a</p><p>b</p><p>c</p>', blocks: [['p','a'],['p','b'],['p','c']], text: 'abc' },
  { name: 'unknown tags unwrap', html: '<p><font color="red">red</font> <span>span</span> <mark>m</mark></p>', clean: '<p>red span m</p>', blocks: [['p','red span m']], text: 'red span m' },
  { name: 'empty and nullish', html: '', clean: '', blocks: [], text: '' },
  { name: 'html entities', html: '<p>a &lt; b &amp; c</p>', clean: '<p>a &lt; b &amp; c</p>', blocks: [['p','a < b & c']], text: 'a < b & c' },
  { name: 'long paragraph', html: '<p>' + 'word '.repeat(400) + '</p>', clean: '<p>' + 'word '.repeat(399) + 'word</p>', blocks: [['p', 'word '.repeat(399) + 'word']], text: 'word '.repeat(400) },
  { name: 'mixed document', html: '<h1>Title</h1><p>Intro <strong>text</strong>.</p><ul><li>One</li><li>Two <a href="https://x.com">link</a></li></ul><blockquote><p>Quote</p></blockquote><h3>Sub</h3><p>End</p>', clean: '<h1>Title</h1><p>Intro <strong>text</strong>.</p><ul><li>One</li><li>Two <a href="https://x.com" target="_blank" rel="noopener">link</a></li></ul><blockquote><p>Quote</p></blockquote><h3>Sub</h3><p>End</p>', blocks: [['h1','Title'],['p','Intro text.'],['li','One'],['li','Two link'],['p','Quote'],['h3','Sub'],['p','End']], text: 'TitleIntro text.OneTwo linkQuoteSubEnd' },
]

describe('cleanDraftHtml', () => {
  for (const c of CASES) {
    it('matches the prototype: ' + c.name, () => {
      expect(cleanDraftHtml(c.html)).toBe(c.clean)
    })
  }
  it('is idempotent for every input', () => {
    for (const c of CASES) expect(cleanDraftHtml(cleanDraftHtml(c.html))).toBe(cleanDraftHtml(c.html))
  })
})

describe('draftBlocksFromHtml', () => {
  for (const c of CASES) {
    it('matches the prototype: ' + c.name, () => {
      expect(draftBlocksFromHtml(c.html)).toEqual(c.blocks)
    })
  }
})

describe('htmlToText', () => {
  for (const c of CASES) {
    it('matches the prototype: ' + c.name, () => {
      expect(htmlToText(c.html)).toBe(c.text)
    })
  }
})

describe('plainToHtml', () => {
  const PLAIN: [string, string][] = [
    ['a\n\nb', '<p>a</p><p>b</p>'],
    ['  x < y & z  \r\n"q" \'s\'', '<p>x &lt; y &amp; z</p><p>&quot;q&quot; &#39;s&#39;</p>'],
    ['', ''],
    ['\n\n', ''],
  ]
  for (const [text, html] of PLAIN) {
    it('converts ' + JSON.stringify(text), () => {
      expect(plainToHtml(text)).toBe(html)
    })
  }
})

describe('safeHref', () => {
  const HREFS: [unknown, string][] = [
    ['http://a.com', 'http://a.com'],
    ['HTTPS://B.com', 'HTTPS://B.com'],
    ['mailto:a@b.c', 'mailto:a@b.c'],
    ['  https://trim.com  ', 'https://trim.com'],
    ['javascript:alert(1)', ''],
    ['/rel', ''],
    ['ftp://x', ''],
    ['', ''],
    [null, ''],
    [undefined, ''],
    [5, ''],
    ['//proto.com', ''],
  ]
  for (const [input, expected] of HREFS) {
    it('handles ' + String(input), () => {
      expect(safeHref(input)).toBe(expected)
    })
  }
})
