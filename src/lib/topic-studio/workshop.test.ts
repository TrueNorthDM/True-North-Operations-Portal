import { describe, expect, it } from 'vitest'
import { analyzeDraft, highlightSpecs, introText, keyChecks, overuseCheck, readingLabel, termRangesIn, workshopModel, draftSource } from './workshop'
import type { Block } from './engine'
import { analysis, project } from './test-fixture'

const TERMS = [{ t: 'moisture meter', tier: 'high' }, { t: 'meter moisture', tier: 'medium' }, { t: 'creosote', tier: 'high' }, { t: 'seasoning', tier: 'low' }, { t: 'chimney fire', tier: 'medium' }]
const model = () => workshopModel(analysis(project({ terms: TERMS })))

const para = (t: string): Block => ['p', t]
const GOOD: Block[] = [
  ['h1', 'How to dry firewood'],
  para('Dry firewood burns hotter and cleaner. A moisture meter tells you when the wood is ready, so you never burn it wet.'),
  ['h2', 'Why seasoning matters'],
  para('Seasoning takes six to twelve months. Wet wood makes creosote, and creosote can cause a chimney fire in your stove pipe.'),
]

describe('workshopModel', () => {
  it('lists the terms with their variants and groups, and the competitors\' yardstick', () => {
    const m = model()
    expect(m.primary).toBe('how to dry firewood')
    expect(m.terms.map(t => t.t)).toEqual(['moisture meter', 'creosote', 'seasoning', 'chimney fire'])
    expect(m.terms[0]).toMatchObject({ alts: ['meter moisture'], altKeys: ['meter moisture'], tier: 'high' })
    expect(m.groups.length).toBeGreaterThan(0)
    expect(m.target).toBeGreaterThan(0)
    expect(m.keyTerms.length).toBeGreaterThan(0)
  })
  it('knows how often competitors use each term, per 1,000 words', () => {
    const m = model()
    expect(m.rates['moisture meter']).toBeGreaterThan(0)
    expect(Object.keys(m.rates).sort()).toEqual(m.terms.map(t => t.key).sort())
  })
  it('has no terms and a zero target before the SEO builds the list', () => {
    const m = workshopModel(analysis(project()))
    expect(m.terms).toEqual([])
    expect(m.target).toBe(0)
  })
})

describe('analyzeDraft', () => {
  it('says nothing while there is no draft', () => {
    expect(analyzeDraft(model(), [])).toBeNull()
  })
  it('counts words and reading ease, and splits the terms into used and still to consider', () => {
    const r = analyzeDraft(model(), GOOD)!
    expect(r.words).toBeGreaterThan(30)
    expect(r.used.map(t => t.t)).toEqual(['moisture meter', 'creosote', 'seasoning', 'chimney fire'])
    expect(r.missing).toEqual([])
    const part = analyzeDraft(model(), [para('A moisture meter is handy for anyone who stacks firewood each autumn before the cold weather arrives.')])!
    expect(part.used.map(t => t.t)).toEqual(['moisture meter'])
    expect(part.missing.map(t => t.t)).toEqual(['creosote', 'seasoning', 'chimney fire'])
  })
  it('counts a variant as the same term, and word endings as the same idea', () => {
    const r = analyzeDraft(model(), [para('Check the meter moisture level. Seasoned logs burn well, and a season of drying helps.')])!
    expect(r.used.map(t => t.key)).toEqual(expect.arrayContaining(['moisture meter', 'seasoning']))
  })
  it('gives guidance in words, never a grade', () => {
    const r = analyzeDraft(model(), GOOD)!
    expect(r.coverage.text).toMatch(/\./)
    expect(['good', 'neutral', 'poor']).toContain(r.coverage.tone)
    expect(JSON.stringify(r)).not.toMatch(/"grade"|A\+/)
  })
  it('warns when a draft is thin or long, and says a typical length is fine', () => {
    expect(analyzeDraft(model(), GOOD)!.length).toMatchObject({ tone: 'warn', text: expect.stringContaining('thin') })
    const long: Block[] = Array.from({ length: 300 }, (_, i) => para(`Sentence number ${i} talks about stacking and drying firewood in a calm and careful way for readers.`))
    expect(analyzeDraft(model(), long)!.length.text).toMatch(/long|typical/)
    const mid: Block[] = Array.from({ length: 80 }, (_, i) => para(`Sentence number ${i} talks about stacking and drying firewood in a calm and careful way.`))
    expect(analyzeDraft(model(), mid)!.length.tone).toBe('ok')
  })
  it('names the reading level, and asks for plainer English below the target', () => {
    const easy = analyzeDraft(model(), [para('Dry wood burns well. Stack it off the ground. Cover the top. Wait a few months. Then use it in your stove. It will be clean and hot. You will be glad you waited for it.')])!
    expect(easy.read?.label).toMatch(/easy|plain/i)
    expect(easy.read?.tone).toBe('ok')
    const hard = analyzeDraft(model(), [para('Notwithstanding considerable environmental variability, the hygroscopic equilibrium characteristics of lignocellulosic combustible materials necessitate comprehensive instrumentation-assisted verification procedures before utilisation in residential thermal appliances is contemplated.')])!
    expect(hard.read?.tone === 'warn' || hard.read === null).toBe(true)
  })
  it('checks the H1 and introduction for the main ideas of the keyphrase, and the key terms in the introduction', () => {
    const r = analyzeDraft(model(), GOOD)!
    expect(r.checks.map(c => c.l)).toEqual(['Primary keyphrase ideas in the H1', 'Primary keyphrase ideas in the introduction', 'Some key terms in the introduction'])
    expect(r.checks[0].st).toBe('ok')
    const none = analyzeDraft(model(), [['h1', 'Gardening notes'], para('Tomatoes like sun and water and a bit of patience from the person looking after them each day.')])!
    expect(none.checks[0].st).toBe('no')
    expect(none.checks[1].st).toBe('no')
  })
})

describe('introText and keyChecks', () => {
  it('takes the text before the first subheading, without the H1, cut to the rule length', () => {
    expect(introText([['h1', 'Title'], para('First para.'), para('Second para.'), ['h2', 'Next'], para('Later.')])).toBe('First para. Second para.')
    const long = introText([para(Array.from({ length: 400 }, (_, i) => `w${i}`).join(' '))])
    expect(long.split(' ')).toHaveLength(160)
  })
  it('falls back to the first paragraphs when the draft starts with a subheading', () => {
    expect(introText([['h2', 'Start'], para('One.'), para('Two.'), para('Three.'), para('Four.')])).toBe('One. Two. Three.')
  })
  it('has no verdict before a draft exists', () => {
    expect(keyChecks(model(), null).every(c => c.st === null)).toBe(true)
  })
  it('matches partly when only some of the keyphrase ideas are there', () => {
    const d = draftSource([['h1', 'Firewood tips'], para('Wood.')])
    expect(keyChecks(model(), d)[0].st).toBe('part')
  })
})

describe('overuseCheck', () => {
  it('waits for a longer draft', () => {
    expect(overuseCheck(model(), GOOD)).toEqual({ items: [], short: true })
  })
  it('flags a word repeated far more than reads naturally, and a term used much more than competitors do', () => {
    const words = Array.from({ length: 10 }, () => 'Use a moisture meter. A moisture meter is best. Buy a moisture meter now. Stacking matters; stacking again, stacking daily.').join(' ')
    const r = overuseCheck(model(), [para(words)])
    expect(r.short).toBe(false)
    expect(r.items.some(i => i.term && i.w === 'moisture meter')).toBe(true)
    expect(r.items.some(i => !i.term && /stack/i.test(i.w))).toBe(true)
    expect(r.items.length).toBeLessThanOrEqual(12)
    expect(r.items.every(i => i.x > 1)).toBe(true)
  })
  it('finds nothing in a varied draft', () => {
    const varied = Array.from({ length: 220 }, (_, i) => `word${i}x`).join(' ')
    expect(overuseCheck(model(), [para(varied)]).items).toEqual([])
  })
})

describe('highlighting', () => {
  const specs = highlightSpecs(model())
  it('turns terms and variants into word roots, longest phrase first', () => {
    expect(specs[0].roots.length).toBeGreaterThanOrEqual(specs[specs.length - 1].roots.length)
    expect(specs.some(s => s.key === 'moisture meter' && s.roots.join(' ') === 'moistur meter')).toBe(true)
  })
  it('finds a term by its roots, across hyphens, and never overlaps two terms', () => {
    const text = 'A moisture-meter and Meter moisture checks; creosote builds up, then a chimney fire.'
    const r = termRangesIn(text, specs)
    expect(r.map(x => text.slice(x.a, x.b))).toEqual(['moisture-meter', 'Meter moisture', 'creosote', 'chimney fire'])
    expect(r.map(x => x.key)).toEqual(['moisture meter', 'moisture meter', 'creosote', 'chimney fire'])
    for (let i = 1; i < r.length; i++) expect(r[i].a).toBeGreaterThanOrEqual(r[i - 1].b)
  })
  it('does not match words split by punctuation or unrelated words between', () => {
    expect(termRangesIn('The moisture, meter reading and moisture in the meter.', specs)).toEqual([])
  })
  it('matches word endings: seasoned and seasoning are one idea', () => {
    const text = 'Seasoned logs and seasoning time.'
    expect(termRangesIn(text, specs).map(x => text.slice(x.a, x.b))).toEqual(['Seasoned', 'seasoning'])
  })
})

describe('readingLabel', () => {
  it('names each band', () => {
    expect(readingLabel(null)).toBe('')
    expect([95, 85, 75, 65, 55, 40, 20, 5].map(readingLabel)).toEqual(['Very easy to read', 'Easy to read', 'Fairly easy to read', 'Standard plain English', 'Fairly difficult to read', 'Difficult to read', 'Very difficult to read', 'Very confusing'])
  })
})
