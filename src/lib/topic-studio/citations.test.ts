import { describe, expect, it } from 'vitest'
import type { TopicPage } from './project'
import { analysis, project } from './test-fixture'
import {
  addManualCite, addManualSource, applyCuratedOp, citationData, citationsBrief, citationsBriefHtml, citationsBriefMarkdown, citationsView, cleanCuratedOp, cleanSourceUrl,
  curatedCites, curatedSources, linkData, pickCite, pickSource, readCurated, removeManualCite, removeManualSource, srcTitle, type Curated,
} from './citations'

const CLEAN = readCurated({})

const body = (extra: string[]): [string, string][] => [['h1', 'Dry firewood'], ['p', 'Seasoned firewood burns hotter and cleaner than wet wood does.'], ...extra.map(t => ['p', t] as [string, string])]
const page = (n: number, extra: string[], links: [string, string][]): TopicPage => ({
  artifactId: `c${n}`, kind: 'competitor', url: `https://site${n}.example.com/dry-firewood`, title: `Dry firewood ${n}`, desc: '', blocks: body(extra), links, capturedAt: null, method: 'button',
})
const PAGES: TopicPage[] = [
  page(1, ['As Psalm 51:10 says, create in me a clean heart. See also Psalm 51:10 again and John 3:16.', 'According to the Mayo Clinic, dry wood is safer to burn.'], [
    ['https://www.cdc.gov/wood', 'Wood smoke facts'], ['https://www.cdc.gov/wood/more', 'here'], ['https://www.facebook.com/sharer/sharer.php?u=x', 'Share'], ['https://site1.example.com/own', 'own page'], ['https://forest.example.org/a', 'Forest guide'],
  ]),
  page(2, ['Read Psalm 51:10 and Romans 8:28. A study from the University of Maine found drying matters.'], [['https://www.cdc.gov/wood', 'here'], ['https://forest.example.org/b', 'Another guide']]),
  page(3, ['Genesis is a book of beginnings. According to Mayo Clinic, smoke harms lungs.'], [['https://other.example.net/x', 'Other thing']]),
  page(4, ['Nothing cited here at all.'], []),
]
const a = () => analysis(project(), PAGES)

describe('citationData', () => {
  const d = citationData(a())
  it('lists the Scripture passages most cited first, counting competitors and uses', () => {
    const top = d.refs[0]
    expect(top).toMatchObject({ name: 'Psalm 51:10', df: 2, n: 3 })
    expect(top.from).toEqual(['#1 site1.example.com', '#2 site2.example.com'])
    expect(d.refs.map(r => r.name)).toEqual(expect.arrayContaining(['John 3:16', 'Romans 8:28']))
    expect(d.refs.every((r, i) => i === 0 || r.df <= d.refs[i - 1].df)).toBe(true)
  })
  it('lists the books, each once per competitor', () => {
    const names = d.books.map(b => b.name)
    expect(names).toEqual(expect.arrayContaining(['Psalms', 'John', 'Romans', 'Genesis']))
    expect(d.books.find(b => b.name === 'Psalms')).toMatchObject({ df: 2 })
    expect(d.books[0]).not.toHaveProperty('n')
  })
  it('lists the outside sites, leaving out the competitor itself and share buttons', () => {
    expect(d.domains.map(x => x.name)).toEqual(['cdc.gov', 'forest.example.org', 'other.example.net'])
    expect(d.domains[0]).toMatchObject({ df: 2, from: ['#1 site1.example.com', '#2 site2.example.com'] })
    expect(d.domains[0].links).toHaveLength(3)
    expect(d.domains.some(x => /facebook|site1/.test(x.name))).toBe(false)
  })
  it('lists the named authorities, without a leading "the"', () => {
    expect(d.accord.map(x => x.name)).toEqual(['Mayo Clinic', 'University of Maine'])
    expect(d.accord[0]).toMatchObject({ df: 2 })
  })
  it('is empty when nothing is captured', () => {
    expect(citationData(analysis(project(), []))).toEqual({ refs: [], books: [], domains: [], accord: [] })
  })
})

describe('linkData and curatedSources', () => {
  it('lists each outside address once, with its anchor text, most linked first', () => {
    const l = linkData(a())
    expect(l.map(x => x.n)).toEqual(['cdc.gov/wood', 'cdc.gov/wood/more', 'forest.example.org/a', 'forest.example.org/b', 'other.example.net/x'])
    expect(l[0]).toMatchObject({ text: 'Wood smoke facts', domain: 'cdc.gov', domDf: 2, def: true })
    expect(l[0].from).toHaveLength(2)
    // "here" says nothing: the title falls back to the address.
    expect(l.find(x => x.n === 'cdc.gov/wood/more')?.text).toBe('')
    expect(srcTitle(l.find(x => x.n === 'cdc.gov/wood/more')!)).toBe('cdc.gov/wood/more')
    expect(l.find(x => x.n === 'other.example.net/x')?.def).toBe(false)
  })
  it('puts the defaults in the brief until the SEO ticks, then follows the ticks', () => {
    expect(curatedSources(a(), CLEAN).brief.map(x => x.n)).toEqual(['cdc.gov/wood', 'cdc.gov/wood/more', 'forest.example.org/a', 'forest.example.org/b'])
    const c = readCurated({ curated: { srcPicks: { 'cdc.gov/wood': false, 'other.example.net/x': true } } })
    expect(curatedSources(a(), c).brief.map(x => x.n)).toEqual(['cdc.gov/wood/more', 'forest.example.org/a', 'forest.example.org/b', 'other.example.net/x'])
  })
  it('puts the sources the SEO typed first and does not list them twice', () => {
    const c = readCurated({ curated: { srcManual: [{ url: 'https://www.forest.example.org/a/', title: 'Mine', added: 1 }] } })
    const s = curatedSources(a(), c)
    expect(s.manual).toHaveLength(1)
    expect(s.brief[0]).toMatchObject({ manual: true, text: 'Mine', domain: 'forest.example.org' })
    expect(s.auto.some(x => x.n === 'forest.example.org/a')).toBe(false)
  })
})

describe('curatedCites', () => {
  it('ticks the first twelve until the SEO chooses', () => {
    const c = curatedCites(a(), CLEAN, 'refs')
    expect(c.auto.every(x => x.inBrief)).toBe(true)
    const many = analysis(project(), [page(1, [Array.from({ length: 15 }, (_, i) => `Psalm ${i + 1}:1`).join(' ')], [])])
    const m = curatedCites(many, CLEAN, 'refs')
    expect(m.auto.filter(x => x.inBrief)).toHaveLength(12)
    expect(m.brief).toHaveLength(12)
  })
  it('follows a tick, and puts a typed name first without repeating it', () => {
    const c = readCurated({ curated: { citePicks: { auth: { 'Mayo Clinic': false } }, citeManual: { auth: ['Wagner Meters', 'university of maine'] } } })
    const x = curatedCites(a(), c, 'auth')
    expect(x.auto.map(r => [r.name, r.inBrief])).toEqual([['Mayo Clinic', false]])
    expect(x.brief.map(r => r.name)).toEqual(['Wagner Meters', 'university of maine'])
    const only = curatedCites(a(), readCurated({ curated: { citePicks: { auth: { 'Mayo Clinic': false } } } }), 'auth')
    expect(only.auto.map(r => [r.name, r.inBrief])).toEqual([['Mayo Clinic', false], ['University of Maine', true]])
  })
  it('finds nothing before a page is captured, but keeps what was typed', () => {
    const none = analysis(project(), [])
    const c = readCurated({ curated: { citeManual: { auth: ['WHO'] } } })
    expect(curatedCites(none, c, 'auth').brief.map(r => r.name)).toEqual(['WHO'])
    expect(curatedCites(none, c, 'books').brief).toEqual([])
  })
})

describe('readCurated', () => {
  it('reads an empty topic as no choices', () => {
    expect(readCurated(undefined)).toEqual({ srcPicks: {}, srcManual: [], citePicks: {}, citeManual: {} })
    expect(readCurated({ terms: [] })).toEqual(CLEAN)
  })
  it('prefers the curated key, and falls back to the keys an imported topic carries', () => {
    const legacy = { srcPicks: { 'a.com/x': true }, citeManual: { auth: ['WHO'] } }
    expect(readCurated(legacy)).toMatchObject({ srcPicks: { 'a.com/x': true }, citeManual: { auth: ['WHO'] } })
    expect(readCurated({ ...legacy, curated: { srcPicks: { 'b.com/y': false } } })).toEqual({ srcPicks: { 'b.com/y': false }, srcManual: [], citePicks: {}, citeManual: {} })
  })
  it('drops what is not usable: non-boolean picks, addresses that are not web, empty names, unknown kinds', () => {
    const c = readCurated({ curated: {
      srcPicks: { a: true, b: 'yes', '': true }, srcManual: [{ url: 'javascript:alert(1)', title: 'x' }, { url: 'https://ok.test/p', title: 5 }, 'bad'],
      citePicks: { auth: { X: false, Y: 1 }, other: { Z: true } }, citeManual: { refs: ['  John 3:16 ', '', 4], nope: ['x'] },
    } })
    expect(c.srcPicks).toEqual({ a: true })
    expect(c.srcManual).toEqual([{ url: 'https://ok.test/p', title: '', added: 0 }])
    expect(c.citePicks).toEqual({ auth: { X: false } })
    expect(c.citeManual).toEqual({ refs: ['John 3:16'] })
  })
})

describe('changing the choices', () => {
  const cur = (p: Record<string, unknown>) => (p.curated as Curated)
  it('ticks and unticks a source and a name, leaving everything else as it was', () => {
    const c1 = cur(pickSource(CLEAN, 'cdc.gov/wood', false))
    expect(c1.srcPicks).toEqual({ 'cdc.gov/wood': false })
    const c2 = cur(pickCite(c1, 'refs', 'John 3:16', false))
    expect(c2).toMatchObject({ srcPicks: { 'cdc.gov/wood': false }, citePicks: { refs: { 'John 3:16': false } } })
    expect(cur(pickCite(c2, 'refs', 'Romans 8:28', true)).citePicks.refs).toEqual({ 'John 3:16': false, 'Romans 8:28': true })
    expect(() => pickSource(CLEAN, '', true)).toThrow('no longer listed')
  })
  it('does not change the object it was given', () => {
    const before = JSON.stringify(CLEAN)
    pickSource(CLEAN, 'a', true); addManualSource(CLEAN, 'https://a.test/x', 't'); pickCite(CLEAN, 'auth', 'A', true)
    expect(JSON.stringify(CLEAN)).toBe(before)
  })
  it('adds a typed source: https added to a bare domain, other schemes refused, no repeats, the old tick dropped', () => {
    expect(cleanSourceUrl('www.who.int/health')).toBe('https://www.who.int/health')
    expect(cleanSourceUrl('ftp://x.test')).toBeNull()
    expect(cleanSourceUrl('javascript:alert(1)')).toBeNull()
    expect(cleanSourceUrl('not a url')).toBeNull()
    const first = cur(addManualSource(readCurated({ curated: { srcPicks: { 'who.int/health': false } } }), 'www.who.int/health', '  WHO   guide ', 99))
    expect(first.srcManual).toEqual([{ url: 'https://www.who.int/health', title: 'WHO guide', added: 99 }])
    expect(first.srcPicks).toEqual({})
    expect(() => addManualSource(first, 'https://who.int/health/', '')).toThrow('already in the brief')
    expect(() => addManualSource(first, 'nonsense', '')).toThrow('starting with https://')
    expect(cur(removeManualSource(first, 'who.int/health')).srcManual).toEqual([])
  })
  it('adds a typed name: ticks the one competitors cite instead of listing it twice, refuses a repeat or an empty one', () => {
    const an = a()
    const off = readCurated({ curated: { citePicks: { auth: { 'Mayo Clinic': false } } } })
    expect(cur(addManualCite(an, off, 'auth', ' mayo clinic ')).citePicks.auth).toEqual({ 'Mayo Clinic': true })
    const typed = cur(addManualCite(an, CLEAN, 'auth', 'World  Health Organization'))
    expect(typed.citeManual.auth).toEqual(['World Health Organization'])
    expect(() => addManualCite(an, typed, 'auth', 'world health organization')).toThrow('already in the brief')
    expect(() => addManualCite(an, CLEAN, 'auth', '   ')).toThrow('Type a name')
    expect(cur(removeManualCite(typed, 'auth', 'World Health Organization')).citeManual.auth).toEqual([])
  })
  it('checks what the browser sends', () => {
    expect(cleanCuratedOp({ op: 'srcPick', n: 'a.com/x', on: true })).toEqual({ op: 'srcPick', n: 'a.com/x', on: true })
    expect(cleanCuratedOp({ op: 'srcPick', n: 'a.com/x', on: 'yes' })).toEqual({ op: 'srcPick', n: 'a.com/x', on: false })
    expect(cleanCuratedOp({ op: 'citeAdd', kind: 'books', name: 'Psalms' })).toEqual({ op: 'citeAdd', kind: 'books', name: 'Psalms' })
    expect(() => cleanCuratedOp({ op: 'citePick', kind: 'constructor', name: 'x', on: true })).toThrow('not available')
    expect(() => cleanCuratedOp({ op: 'citeRemove', kind: 'refs', name: '' })).toThrow('no longer listed')
    expect(() => cleanCuratedOp({ op: 'srcRemove', n: 'x'.repeat(3000) })).toThrow()
    expect(() => cleanCuratedOp({ op: 'drop table' })).toThrow('not available')
    expect(() => cleanCuratedOp(null)).toThrow('not available')
    expect(() => cleanCuratedOp('srcPick')).toThrow('not available')
  })
  it('applies a checked change', () => {
    const p = applyCuratedOp(a(), CLEAN, { op: 'citePick', kind: 'books', name: 'Psalms', on: false })
    expect((p.curated as Curated).citePicks.books).toEqual({ Psalms: false })
  })
})

describe('the brief', () => {
  const faith = { faith: true }
  const brief = citationsBrief(a(), CLEAN, faith)
  it('holds the ticked sources, authorities, books and passages', () => {
    expect(brief.src.map(s => s.title)).toEqual(['Wood smoke facts', 'cdc.gov/wood/more', 'Forest guide', 'Another guide'])
    expect(brief.auth.map(x => x.name)).toEqual(['Mayo Clinic', 'University of Maine'])
    expect(brief.books.map(x => x.name)).toContain('Psalms')
    expect(brief.refs[0]).toMatchObject({ name: 'Psalm 51:10', df: 2, manual: false })
  })
  it('leaves Scripture out for a client without a faith profile', () => {
    const b = citationsBrief(a(), CLEAN, { faith: false })
    expect(b.books).toEqual([])
    expect(b.refs).toEqual([])
    expect(b.src.length).toBe(4)
    expect(b.auth.length).toBe(2)
    expect(citationsBriefHtml(b)).not.toContain('Scripture')
    expect(citationsBriefMarkdown(b)).not.toContain('Scripture')
  })
  it('writes the sections as the Artifact does, escaped', () => {
    const c = readCurated({ curated: { srcManual: [{ url: 'https://x.test/a?b=1&c="2"', title: 'A <b> & B', added: 1 }], citeManual: { auth: ['AT&T Labs'] } } })
    const html = citationsBriefHtml(citationsBrief(a(), c, faith))
    expect(html.indexOf('<h3>Commonly cited Scripture</h3>')).toBeLessThan(html.indexOf('<h3>Commonly linked sources</h3>'))
    expect(html.indexOf('<h3>Commonly linked sources</h3>')).toBeLessThan(html.indexOf('<h3>Named authorities</h3>'))
    expect(html).toContain('<li>Psalm 51:10 <i>(cited by 2 competitors)</i></li>')
    expect(html).toContain('<li>John 3:16 <i>(cited by 1 competitor)</i></li>')
    expect(html).toContain('<a href="https://x.test/a?b=1&amp;c=&quot;2&quot;">A &lt;b&gt; &amp; B</a> <i>(x.test)</i>')
    expect(html).toContain('<a href="https://www.cdc.gov/wood">Wood smoke facts</a> <i>(cdc.gov · linked by 2 competitors)</i>')
    expect(html).toContain('<li>AT&amp;T Labs <i>(added by SEO)</i></li>')
    expect(html).toMatch(/<p>Psalms, [^<]*<\/p>/)
  })
  it('writes the same sections as Markdown', () => {
    const md = citationsBriefMarkdown(brief)
    expect(md).toContain('## Commonly cited Scripture\nPsalms, ')
    expect(md).toContain('## Commonly cited passages\n- Psalm 51:10 (cited by 2 competitors)')
    expect(md).toContain('## Commonly linked sources\n- [Wood smoke facts](https://www.cdc.gov/wood) (cdc.gov · linked by 2 competitors)')
    expect(md).toContain('## Named authorities\n- Mayo Clinic (cited by 2 competitors)')
    expect(md.endsWith('\n')).toBe(true)
  })
  it('is empty when there is nothing to say', () => {
    const none = citationsBrief(analysis(project(), []), CLEAN, faith)
    expect(none).toEqual({ src: [], auth: [], books: [], refs: [] })
    expect(citationsBriefHtml(none)).toBe('')
    expect(citationsBriefMarkdown(none)).toBe('')
  })
  it('never writes an em dash', () => {
    expect(citationsBriefHtml(brief) + citationsBriefMarkdown(brief)).not.toContain(String.fromCharCode(0x2014))
  })
})

describe('citationsView', () => {
  it('splits each list into what is in the brief and what is not, and counts the others', () => {
    const c = readCurated({ curated: { citePicks: { refs: { 'John 3:16': false } }, srcPicks: { 'cdc.gov/wood': false } } })
    const v = citationsView(a(), c, { faith: true })
    expect(v.captured).toBe(4)
    expect(v.faith).toBe(true)
    expect(v.refs.inBrief.map(x => x.name)).not.toContain('John 3:16')
    expect(v.refs.others.map(x => x.name)).toEqual(['John 3:16'])
    expect(v.refs.othersTotal).toBe(1)
    expect(v.sources.inBrief.map(x => x.n)).not.toContain('cdc.gov/wood')
    expect(v.sources.others.map(x => x.n)).toEqual(expect.arrayContaining(['cdc.gov/wood', 'other.example.net/x']))
    expect(v.sources.inBrief[0].title).toBe('cdc.gov/wood/more')
  })
  it('offers the books that are not topic terms yet, for a faith client only', () => {
    const v = citationsView(analysis(project({ terms: [{ t: 'Psalms', tier: 'high' }] }), PAGES), CLEAN, { faith: true })
    expect(v.bookTerms.map(b => b.name)).not.toContain('Psalms')
    expect(v.bookTerms.map(b => b.name)).toContain('John')
    expect(v.bookTerms.find(b => b.name === 'John')?.key).toBe('john')
    expect(citationsView(a(), CLEAN, { faith: false }).bookTerms).toEqual([])
  })
  it('says nothing was captured', () => {
    const v = citationsView(analysis(project(), []), CLEAN, { faith: true })
    expect(v.captured).toBe(0)
    expect(v.sources.inBrief).toEqual([])
  })
})
