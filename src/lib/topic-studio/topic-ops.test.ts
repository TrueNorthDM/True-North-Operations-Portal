import { describe, expect, it } from 'vitest'
import { compList, termContext } from './analysis'
import { briefHtml, briefMarkdown, slugOf, termListText, termsCsv } from './brief'
import { cleanCapture, pagePayload, placeCapture } from './capture-place'
import { readPage, readProject } from './project'
import { PAGES, analysis, project, row } from './test-fixture'
import {
  addDirectQuestion, addTerm, buildTerms, cleanNotes, cleanRules, clearBuild, cycleTier, deleteGroup, groupNameOk, moveKeysToGroup, moveTerm, moveToEnd, newGroup,
  notVariant, removeTerms, renameGroup, restoreAll, restoreTerm, syncQuestions, toggleDirect, toggleQuestionOff,
} from './term-ops'

describe('readProject / readPage', () => {
  it('fills what is missing and keeps what is there', () => {
    const p = readProject({ topic: 'T', primary_keyphrase: 'k', monday_url: null, client_code: 'AAAF', shared: true, data: {} })
    expect(p).toMatchObject({ topic: 'T', primary: 'k', client: 'AAAF', shared: true, terms: [], removed: [], organic: [], termGroups: null, groupsCustom: false })
    expect(readProject({ ...row(), data: { terms: [{ t: 'moisture meter', tier: 'weird' }, { t: '' }, 5] } }).terms).toEqual([{ t: 'moisture meter', key: 'moisture meter', tier: 'medium' }])
  })
  it('ignores build rules that are not numbers', () => {
    expect(project({ buildRules: { size: 20, singles: 'x', nope: 3 } }).buildRules).toEqual({ size: 20 })
  })
  it('reads a page with its blocks and links, dropping malformed ones', () => {
    const pg = readPage({ artifact_id: 'c1', kind: 'competitor', url: 'https://a.test', title: 'A', captured_at: null, data: { blocks: [['h1', 'x'], ['p'], 'bad', ['p', 'y']], links: [['https://l.test', 'L'], 7], desc: 'd' } })
    expect(pg.blocks).toEqual([['h1', 'x'], ['p', 'y']])
    expect(pg.links).toEqual([['https://l.test', 'L']])
    expect(pg.desc).toBe('d')
  })
})

describe('competitor list', () => {
  it('lists the organic addresses in rank order, then AI-cited ones, with no duplicates', () => {
    const p = project({ organic: ['https://a.test/x', '', 'https://www.b.test/y/', 'https://a.test/x/'], cited: ['https://b.test/y', 'https://c.test/z'] })
    const l = compList(p, [])
    expect(l.map(c => [c.rank, c.domain, c.cited])).toEqual([[1, 'a.test', false], [3, 'b.test', true], [null, 'c.test', true]])
    expect(l.map(c => c.label)).toEqual(['#1 a.test', '#3 b.test', 'AIO c.test'])
  })
  it('matches a captured page by address, whatever the scheme or slash', () => {
    const a = analysis(project({ organic: ['http://www.site1.example.com/dry-firewood/'] }))
    expect(a.comps[0].page?.title).toBe('Dry firewood 1')
    expect(a.N).toBe(1)
  })
})

describe('analysis', () => {
  const a = analysis()
  it('finds candidate terms and leaves out what the SEO wants to avoid', () => {
    const { list, N } = a.candidates()
    expect(N).toBe(4)
    expect(list.map(c => c.k)).toContain('moisture meter')
    expect(list.map(c => c.k).join(' ')).not.toMatch(/chainsaw/)
  })
  it('counts the AI answers that have an answer and skips "none"', () => {
    expect(a.ais.map(x => x.label)).toEqual(['AI Overview', 'ChatGPT', 'Perplexity'])
  })
  it('says how a term is used on each competitor and in each AI answer', () => {
    const s = a.termStats('moisture meter')
    expect(s.per).toHaveLength(4)
    expect(s.df).toBe(4)
    expect(s.min).toBeGreaterThan(0)
    expect(s.aiPer.map(x => x.label)).toEqual(['AI Overview', 'ChatGPT', 'Perplexity'])
    expect(s.ai).toBe(2)
  })
  it('gives null where a competitor has no capture', () => {
    expect(analysis(project(), PAGES.slice(0, 2)).termStats('moisture meter').per).toEqual([expect.any(Number), expect.any(Number), null, null])
  })
  it('reports word counts and reading ease of the captured pages', () => {
    const w = a.wordStats()
    expect(w.med).toBeGreaterThan(50)
    expect(a.avgFlesch()).not.toBeNull()
  })
  it('scores each competitor against the term list, and a target from the best three', () => {
    const p = project({ terms: [{ t: 'moisture meter', tier: 'high' }, { t: 'firewood', tier: 'medium' }, { t: 'creosote', tier: 'low' }] })
    const s = analysis(p).compScores()
    expect(s.scores).toHaveLength(4)
    expect(s.scores.every(v => v != null && v > 0)).toBe(true)
    expect(s.target).toBeGreaterThan(0)
  })
  it('keeps terms that mean the same thing as one concept', () => {
    const p = project({ terms: [{ t: 'moisture meter', tier: 'high' }, { t: 'meter moisture', tier: 'medium' }, { t: 'creosote', tier: 'low' }] })
    const c = analysis(p).concepts()
    expect(c.map(x => x.t)).toEqual(['moisture meter', 'creosote'])
    expect(c[0].alts).toEqual(['meter moisture'])
  })
  it('honours Not the same and a saved variant', () => {
    const base = [{ t: 'moisture meter', tier: 'high' }, { t: 'meter moisture', tier: 'medium' }]
    expect(analysis(project({ terms: base, notVariant: { 'meter moisture': true } })).concepts()).toHaveLength(2)
    expect(analysis(project({ terms: [...base, { t: 'tester', tier: 'low' }], variantOf: { tester: 'moisture meter' } })).concepts()[0].alts).toEqual(['meter moisture', 'tester'])
  })
  it('groups terms that end in the same word, or by the saved groups', () => {
    const terms = [{ t: 'moisture meter', tier: 'high' }, { t: 'wood meter', tier: 'high' }, { t: 'creosote', tier: 'low' }]
    const auto = analysis(project({ terms })).termGroups()
    expect(auto.map(g => [g.name, g.items.length, g.other])).toEqual([['Wood meter', 2, false], ['Other terms', 1, true]])
    const custom = analysis(project({ terms, groupsCustom: true, termGroups: [{ name: 'Burning', keys: ['creosote'] }, { name: 'Empty', keys: [] }] })).termGroups()
    expect(custom.map(g => [g.name, g.items.length])).toEqual([['Burning', 1], ['Empty', 0], ['Other terms', 2]])
  })
  it('warns when most terms are single words', () => {
    const terms = ['firewood', 'moisture', 'meter', 'creosote', 'chimney', 'smoke', 'stack', 'logs', 'season', 'burn', 'dry', 'wood'].map(t => ({ t, tier: 'medium' }))
    expect(analysis(project({ terms })).warnings().some(w => /single words/.test(w))).toBe(true)
    expect(analysis(project({ terms: terms.slice(0, 5) })).warnings()).toEqual([])
  })
  it('lists the questions competitors ask, and never more key terms than ten', () => {
    expect(a.competitorQuestions().map(q => q.q)).toContain('How long does firewood take to season?')
    const many = Array.from({ length: 14 }, (_, i) => ({ t: `term${i} firewood`, tier: 'high' }))
    expect(analysis(project({ terms: many })).keyTerms()).toHaveLength(10)
  })
  it('puts the high terms first as key terms, topped up to five from the rest, never the primary keyphrase', () => {
    const terms = [{ t: 'how to dry firewood', tier: 'high' }, { t: 'creosote', tier: 'high' }, { t: 'smoke', tier: 'medium' }, { t: 'chimney', tier: 'low' }]
    expect(analysis(project({ terms })).keyTerms().map(t => t.t)).toEqual(['creosote', 'smoke', 'chimney'])
  })
  it('shows a term in context: uses, headings and the sentences around it', () => {
    const c = termContext(a, 'moisture meter', 'moisture meter')
    expect(c.stats).toMatchObject({ df: 4, competitors: 4 })
    expect(c.sources.length).toBeGreaterThanOrEqual(4)
    expect(c.sources[0].examples[0].text).toMatch(/moisture meter/i)
  })
})

describe('term list edits', () => {
  const built = () => project(buildTerms(analysis()))
  it('builds up to the size rule, by thirds of relevance, keeping terms added by hand', () => {
    const base = project({ terms: [{ t: 'my own term', key: 'my own term', tier: 'low', src: 'manual' }], buildRules: { size: 15 } })
    const patch = buildTerms(analysis(base)) as { terms: { t: string; tier: string; src: string }[] }
    expect(patch.terms[0]).toMatchObject({ t: 'my own term', src: 'manual' })
    const auto = patch.terms.filter(t => t.src === 'data')
    expect(auto.length).toBeLessThanOrEqual(15)
    const tiers = auto.map(t => t.tier)
    expect(tiers).toEqual([...tiers].sort((x, y) => ['high', 'medium', 'low'].indexOf(x) - ['high', 'medium', 'low'].indexOf(y)))
  })
  it('does not bring back a removed term when rebuilding', () => {
    const first = built()
    const key = first.terms[0].key as string
    const p = project({ ...removeTerms(first, [key]) })
    expect(buildTerms(analysis(p)).terms).not.toContainEqual(expect.objectContaining({ key }))
  })
  it('changes relevance in a cycle and moves terms by key', () => {
    const p = project({ terms: [{ t: 'a firewood', tier: 'high' }, { t: 'b firewood', tier: 'low' }] })
    expect((cycleTier(p, 'a firewood').terms as { tier: string }[])[0].tier).toBe('medium')
    expect((cycleTier(p, 'b firewood').terms as { tier: string }[])[1].tier).toBe('high')
    expect((moveTerm(p, 'a firewood', 1).terms as { key: string }[]).map(t => t.key)).toEqual(['b firewood', 'a firewood'])
    expect(moveTerm(p, 'a firewood', -1)).toEqual({})
    expect(() => cycleTier(p, 'nothing')).toThrow(/no longer/)
  })
  it('removes with a reason, restores one or all, and adds by hand', () => {
    const p = project({ terms: [{ t: 'a firewood', tier: 'high' }, { t: 'b firewood', tier: 'low' }] })
    const gone = removeTerms(p, ['a firewood', 'b firewood'])
    expect(gone.terms).toEqual([])
    expect(gone.removed).toEqual([{ t: 'a firewood', key: 'a firewood', reason: 'removed by you' }, { t: 'b firewood', key: 'b firewood', reason: 'removed by you' }])
    const q = project(gone)
    expect((restoreTerm(q, 'b firewood').terms as { tier: string; src: string }[])[0]).toMatchObject({ tier: 'medium', src: 'data' })
    expect(restoreAll(q).removed).toEqual([])
    expect((restoreAll(q).terms as unknown[]).length).toBe(2)
    expect(() => restoreTerm(q, 'zzz')).toThrow(/not in the removed/)
    const added = addTerm(q, '  Seasoned Firewood ')
    expect((added.terms as { t: string; src: string; tier: string }[])[0]).toMatchObject({ t: 'Seasoned Firewood', src: 'manual', tier: 'high' })
    expect(() => addTerm(project(added), 'seasoned firewood')).toThrow(/already/)
    expect(() => addTerm(q, '   ')).toThrow(/Type the term/)
  })
  it('moves chosen terms to the top or the bottom, in their own order', () => {
    const p = project({ terms: ['a', 'b', 'c', 'd'].map(t => ({ t: `${t} firewood`, tier: 'high' })) })
    expect((moveToEnd(p, ['c firewood', 'a firewood'], 'bottom').terms as { key: string }[]).map(t => t.key)).toEqual(['b firewood', 'd firewood', 'a firewood', 'c firewood'])
    expect((moveToEnd(p, ['c firewood'], 'top').terms as { key: string }[])[0].key).toBe('c firewood')
  })
  it('stops treating a term as a variant, and clears a whole build', () => {
    const p = project({ variantOf: { x: 'y', z: 'y' } })
    expect(notVariant(p, 'x')).toEqual({ notVariant: { x: true }, variantOf: { z: 'y' } })
    expect(clearBuild()).toMatchObject({ terms: [], removed: [], termGroups: null, groupsCustom: false, variantOf: {} })
  })
  it('keeps only the build rules that differ from the defaults, inside their sliders', () => {
    expect(cleanRules({ size: 35, singles: 20, everyday: 500, inside: 1, nope: 4, spread: 'x' })).toEqual({ singles: 20, everyday: 100, inside: 30 })
    expect(cleanRules(null)).toEqual({})
  })
})

describe('group edits', () => {
  const terms = [{ t: 'moisture meter', tier: 'high' }, { t: 'wood meter', tier: 'high' }, { t: 'creosote', tier: 'low' }]
  const a = () => analysis(project({ terms }))
  it('makes the shown groups the saved ones on the first edit', () => {
    const { patch, name } = newGroup(a())
    expect(name).toBe('New group')
    expect(patch).toEqual({ termGroups: [{ name: 'New group', keys: [] }, { name: 'Wood meter', keys: ['moisture meter', 'wood meter'] }], groupsCustom: true })
  })
  it('names a second new group so it never repeats one, or "Other terms"', () => {
    const p = project({ terms, groupsCustom: true, termGroups: [{ name: 'New group', keys: [] }] })
    expect(newGroup(analysis(p)).name).toBe('New group 2')
    expect(newGroup(analysis(p), 'Other terms').name).toBe('Other terms 2')
  })
  it('renames, refusing a name already used', () => {
    expect((renameGroup(a(), 'Wood meter', 'Meters').termGroups as { name: string }[])[0].name).toBe('Meters')
    const p = project({ terms, groupsCustom: true, termGroups: [{ name: 'A', keys: [] }, { name: 'B', keys: [] }] })
    expect(() => renameGroup(analysis(p), 'A', 'b')).toThrow(/already used/)
    expect(() => renameGroup(analysis(p), 'A', 'Other terms')).toThrow(/already used/)
    expect(groupNameOk([{ name: 'A', keys: [] }], 'a', 'A')).toBe(true)
  })
  it('deletes a group so its terms fall under Other terms', () => {
    expect((deleteGroup(a(), 'Wood meter').termGroups as unknown[])).toEqual([])
    expect(() => deleteGroup(a(), 'Nope')).toThrow(/no longer exists/)
  })
  it('moves terms with their variants to a group, or out of every group', () => {
    const p = project({ terms: [...terms, { t: 'meter moisture', tier: 'low' }], groupsCustom: true, termGroups: [{ name: 'G1', keys: ['moisture meter'] }, { name: 'G2', keys: [] }] })
    const moved = moveKeysToGroup(analysis(p), ['meter moisture'], 'G2')
    expect(moved.termGroups).toEqual([{ name: 'G1', keys: [] }, { name: 'G2', keys: ['moisture meter'] }])
    expect(moveKeysToGroup(analysis(p), ['moisture meter'], null).termGroups).toEqual([{ name: 'G1', keys: [] }, { name: 'G2', keys: [] }])
    expect(() => moveKeysToGroup(analysis(p), ['creosote'], 'Gone')).toThrow(/no longer exists/)
  })
})

describe('question edits', () => {
  it('finds competitor questions, updating the ones already known and keeping the rest', () => {
    const p = project({ questions: [{ q: 'How long does firewood take to season?', key: 'how long do firewood take to season', src: 'competitor', direct: true }, { q: 'Mine?', key: 'mine', src: 'manual' }] })
    const found = analysis(p).competitorQuestions()
    const out = (syncQuestions(p, found).questions as { q: string; key: string; direct?: boolean; src: string }[])
    expect(out.some(q => q.q === 'Mine?')).toBe(true)
    expect(out.filter(q => q.key === found[0].key)).toHaveLength(1)
    expect(out.find(q => q.q.startsWith('How long'))?.direct).toBe(true)
    expect(out.filter(q => q.src === 'competitor').length).toBeLessThanOrEqual(60)
  })
  it('toggles "answer directly" and removed, naming the question by key', () => {
    const p = project({ questions: [{ q: 'Why?', key: 'why', off: true, reason: 'r' }] })
    expect((toggleDirect(p, 'why').questions as { direct: boolean }[])[0].direct).toBe(true)
    const back = (toggleQuestionOff(p, 'why').questions as { off: boolean; reason?: string }[])[0]
    expect(back).toMatchObject({ off: false })
    expect(back.reason).toBeUndefined()
    expect(() => toggleDirect(p, 'zzz')).toThrow(/no longer/)
  })
  it('adds a question to answer directly, or promotes the one already listed', () => {
    const p = project({ questions: [{ q: 'Why is it wet?', key: termKey('Why is it wet'), src: 'competitor', off: true }] })
    expect((addDirectQuestion(p, '  How dry is dry ').questions as { q: string; src: string; direct: boolean }[]).pop()).toMatchObject({ q: 'How dry is dry?', src: 'manual', direct: true })
    const promoted = addDirectQuestion(p, 'Why is it wet?').questions as { direct: boolean; off: boolean }[]
    expect(promoted).toHaveLength(1)
    expect(promoted[0]).toMatchObject({ direct: true, off: false })
    expect(() => addDirectQuestion(p, ' ')).toThrow(/Type the question/)
  })
  it('keeps notes as trimmed non-empty lines', () => {
    expect(cleanNotes(['  a ', '', 5, 'b'])).toEqual(['a', 'b'])
    expect(cleanNotes('x')).toEqual([])
    expect(cleanNotes(Array.from({ length: 40 }, (_, i) => `n${i}`))).toHaveLength(30)
  })
})

describe('capture', () => {
  const cap = (over: Record<string, unknown> = {}) => ({ _hfa: 2, url: '', title: ' T ', desc: '', blocks: [['h1', 'Hello'], ['p', 'World  text'], ['script', 'x'], ['p', '']], links: [['https://l.test/a', 'A'], ['javascript:1', 'bad'], ['https://l.test/a', 'dup']], ...over })
  it('keeps known tags, trims text, and keeps only web links once', () => {
    const c = cleanCapture(cap(), false) as Exclude<ReturnType<typeof cleanCapture>, string>
    expect(c.blocks).toEqual([['h1', 'Hello'], ['p', 'World text']])
    expect(c.links).toEqual([['https://l.test/a', 'A']])
    expect(c.title).toBe('T')
    expect(c.method).toBe('button')
    expect((cleanCapture(cap({ _hfa: 0 }), true) as { method: string }).method).toBe('paste')
    expect((cleanCapture(cap({ _hfa: 0 }), false) as { method: string }).method).toBe('text')
  })
  it('refuses a capture with nothing in it', () => {
    for (const bad of [null, {}, { blocks: [] }, { blocks: [['nav', 'x']] }, 'x']) expect(cleanCapture(bad, false)).toMatch(/Nothing to capture/)
  })
  it('limits the blocks and links it keeps', () => {
    const c = cleanCapture({ blocks: Array.from({ length: 3000 }, (_, i) => ['p', `t${i}`]), links: Array.from({ length: 400 }, (_, i) => [`https://l.test/${i}`, 'x']) }, true) as { blocks: unknown[]; links: unknown[] }
    expect(c.blocks).toHaveLength(2500)
    expect(c.links).toHaveLength(300)
  })
  const clean = (o = {}) => cleanCapture(cap(o), false) as Exclude<ReturnType<typeof cleanCapture>, string>
  it('puts a capture in the row it was pasted into', () => {
    const p = project()
    const r = placeCapture(p, [], clean(), 1) as Exclude<ReturnType<typeof placeCapture>, string>
    expect(r.url).toBe(PAGES[1].url)
    expect(r.label).toBe('#2 site2.example.com')
    expect(r.patch).toBeNull()
  })
  it('sends a capture with its own address to that competitor, telling the person', () => {
    const r = placeCapture(project(), [], clean({ url: PAGES[2].url }), 0) as Exclude<ReturnType<typeof placeCapture>, string>
    expect(r.url).toBe(PAGES[2].url)
    expect(r.notes[0]).toMatch(/saved there/)
  })
  it('puts an unknown address in the first free slot of the list', () => {
    const p = project({ organic: ['https://a.test/x', '', 'https://c.test/z'] })
    const r = placeCapture(p, [], clean({ url: 'https://new.test/page' }), 'any') as Exclude<ReturnType<typeof placeCapture>, string>
    expect(r.patch).toEqual({ organic: ['https://a.test/x', 'https://new.test/page', 'https://c.test/z'] })
    expect(r.url).toBe('https://new.test/page')
    expect(r.notes[0]).toMatch(/Added new.test/)
  })
  it('fills the next empty competitor when the capture has no address', () => {
    const r = placeCapture(project(), [PAGES[0], PAGES[1]], clean(), 'any') as Exclude<ReturnType<typeof placeCapture>, string>
    expect(r.url).toBe(PAGES[2].url)
  })
  it('says so when every competitor is captured and the list is full', () => {
    expect(placeCapture(project(), PAGES, clean(), 'any')).toMatch(/All competitors are captured/)
  })
  it('stores the page under a stable id so a second capture replaces the first', () => {
    const p = project()
    const a = placeCapture(p, [], clean(), 0) as Exclude<ReturnType<typeof placeCapture>, string>
    const b = placeCapture(p, [], clean({ title: 'Again' }), 0) as Exclude<ReturnType<typeof placeCapture>, string>
    expect(a.artifactId).toBe(b.artifactId)
    expect(a.artifactId).toBe(`c${placeCaptureHash(PAGES[0].url)}`)
    expect(pagePayload(a, clean())).toMatchObject({ artifact_id: a.artifactId, kind: 'competitor', url: PAGES[0].url, data: { method: 'button' } })
  })
})

// The Artifact names a captured page 'c' + a hash of its normalised address: an import and a new capture must agree.
import { hashId, normUrl, termKey } from './engine'
const placeCaptureHash = (u: string) => hashId(normUrl(u))

describe('brief', () => {
  const p = project({
    terms: [{ t: 'moisture meter', tier: 'high' }, { t: 'meter moisture', tier: 'medium' }, { t: 'creosote', tier: 'low' }],
    answerTop: ['Say <b>this</b> first'], questions: [{ q: 'How dry is dry?', key: 'how dry be dry', direct: true }, { q: 'Why wet?', key: 'why wet' }, { q: 'Gone?', key: 'gone', off: true }],
  })
  const a = analysis(p)
  it('writes the HTML for Google Docs, escaping what people typed', () => {
    const h = briefHtml(a, 'BM Topic')
    expect(h).toContain('<h2>BM Topic: How to dry firewood</h2>')
    expect(h).toContain('<b>how to dry firewood</b>')
    expect(h).toContain('moisture meter <i>(also: meter moisture)</i>')
    expect(h).toContain('Say &lt;b&gt;this&lt;/b&gt; first')
    expect(h).toContain('<h3>Questions to answer directly (and have summary answers for)</h3><ul><li>How dry is dry?</li></ul>')
    expect(h).toContain('<li>Why wet?</li>')
    expect(h).not.toContain('Gone?')
    expect(h).toContain('<a href="https://site1.example.com/dry-firewood">')
  })
  it('leaves out sections with nothing in them', () => {
    const h = briefHtml(analysis(project()), 'BM Topic')
    expect(h).not.toContain('Key terms for the meta description')
    expect(h).not.toContain('Answer near the top')
    expect(h).not.toContain('<h2>Questions</h2>')
  })
  it('writes the Markdown', () => {
    const m = briefMarkdown(a, 'BM Topic')
    expect(m.startsWith('# BM Topic: How to dry firewood\n')).toBe(true)
    expect(m).toContain('- moisture meter _(also: meter moisture)_')
    expect(m).toContain('### Questions to answer directly (and have summary answers for)\n- How dry is dry?')
    expect(m.endsWith('- https://site4.example.com/dry-firewood')).toBe(true)
  })
  it('writes the term list as bullets with variants', () => {
    expect(termListText(a)).toBe('• moisture meter (also: meter moisture)\n• creosote')
  })
  it('writes a CSV with quoting, groups, variants and uses', () => {
    const csv = termsCsv(a).split('\n')
    expect(csv[0]).toBe('Order,Term,Group,Same as,Relevance,Competitors using,Typical uses,Min,Max,AI answers using it')
    expect(csv[1]).toMatch(/^1,moisture meter,.*,,high,4\/4,\d+,\d+,\d+,"?AI Overview/)
    expect(csv[2]).toMatch(/^2,meter moisture,.*,moisture meter,medium,/)
    const quoted = termsCsv(analysis(project({ terms: [{ t: 'a, "b"', tier: 'high' }] })))
    expect(quoted).toContain('"a, ""b"""')
  })
  it('names downloads from the keyphrase', () => {
    expect(slugOf('How to Dry Firewood?!', 't')).toBe('how-to-dry-firewood')
    expect(slugOf('', 'Topic A/B')).toBe('topic-a-b')
    expect(slugOf('', '')).toBe('topic')
  })
})
