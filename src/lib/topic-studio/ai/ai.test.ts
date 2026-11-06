import { describe, expect, it } from 'vitest'
import { NeedsMore, Unreadable, isFeature, prepare, type AiContext } from './features'
import { parseLooseJSON } from './json'
import { PROMPT_DEFS, PROMPT_ORDER } from './prompt-defs'
import { readAiResults, interviewSelected } from './results'
import { DEFAULT_MODEL, DEFAULT_SETTINGS, featureConfig, fillPrompt, modelBlocked, promptTemplate, readSettings, validatePrompt } from './settings'
import { analysis, PAGES, project } from '../test-fixture'
import type { TopicPage } from '../project'
import type { ClientFull } from '../store'

const BM: ClientFull = { code: 'BM', name: 'Bessemeter', heading: 'BM Topic', faith: false, about: 'Wood moisture meters.', orig: 'Test results and customer stories.' }
const AAAF: ClientFull = { ...BM, code: 'AAAF', name: 'Ask An Adventist Friend', faith: true }
const TERMS = [{ t: 'moisture meter', tier: 'high' }, { t: 'meter moisture', tier: 'medium' }, { t: 'creosote', tier: 'low' }, { t: 'my own', tier: 'high', src: 'manual' }]
const DRAFT = '<h1>How to dry firewood</h1><p>A moisture meter tells you when firewood is dry enough to burn this winter.</p><h2>Why seasoning matters</h2><p>Seasoning takes months and keeps the chimney clean.</p>'

const ctx = (over: Record<string, unknown> = {}, extra: Partial<AiContext> = {}, pages = PAGES): AiContext => ({
  analysis: analysis(project(over), pages), pages, client: BM, settings: DEFAULT_SETTINGS, draftHtml: '', ...extra,
})
const discussion = (n: number): TopicPage => ({ artifactId: `d${n}`, kind: 'discussion', url: `https://reddit.test/r/x/${n}`, title: `Thread ${n}`, desc: '', blocks: [['p', `Why is my firewood still wet after a year? Thread ${n}.`]], links: [], capturedAt: null, method: 'paste' })

describe('settings', () => {
  it('has a prompt for each of the nine features, each asking for JSON and keeping its required data', () => {
    expect(PROMPT_ORDER).toHaveLength(9)
    for (const k of PROMPT_ORDER) {
      expect(validatePrompt(k, PROMPT_DEFS[k].template)).toBe('')
      expect(PROMPT_DEFS[k].template).not.toMatch(/—/)
    }
  })
  it('fills the data variables and leaves an unknown one empty', () => {
    expect(fillPrompt('A {{x}} B {{ y }} C {{z}}', { x: 'one', y: 2 })).toBe('A one B 2 C ')
  })
  it('checks an edited prompt: unknown variables, missing required ones, no JSON instruction', () => {
    const base = PROMPT_DEFS.group.template
    expect(validatePrompt('group', base.replace('{{term_list}}', '{{nope}}'))).toMatch(/Unknown variable: \{\{nope\}\}/)
    expect(validatePrompt('group', base.replace('{{term_list}}', ''))).toMatch(/Keep \{\{term_list\}\}/)
    expect(validatePrompt('group', base.replace(/json/gi, 'text'))).toMatch(/JSON/)
    expect(validatePrompt('group', `${base}\n`)).toBe('')
  })
  it('uses an Admin\'s edited prompt, else the default', () => {
    const s = readSettings({ ai: { prompts: { group: 'Group these: {{term_list}} Reply with JSON.' } } })
    expect(promptTemplate(s.ai, 'group')).toContain('Group these')
    expect(promptTemplate(s.ai, 'refine')).toBe(PROMPT_DEFS.refine.template)
  })
  it('falls back to defaults for anything missing or invalid, and clamps numbers', () => {
    expect(readSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(readSettings('x')).toEqual(DEFAULT_SETTINGS)
    const s = readSettings({ ai: { dailyCap: 5000, cooldownSec: -3, maxEffort: 'max', features: { refine: { on: false, model: '!!bad!!', effort: 'ultra' } } }, features: { avoid: false, rich: 'yes' }, feedback: { terms: { size: { thin: 9999, on: false } } } })
    expect(s.ai.dailyCap).toBe(1000)
    expect(s.ai.cooldownSec).toBe(0)
    expect(s.ai.maxEffort).toBe('high')
    expect(s.ai.features.refine).toEqual({ on: false, model: DEFAULT_MODEL, effort: 'medium' })
    expect(s.features.avoid).toBe(false)
    expect(s.features.rich).toBe(false)
    expect(s.feedback.terms.size).toMatchObject({ thin: 100, on: false, short: 20 })
  })
  it('does not let an edited prompt equal to the default count as an edit', () => {
    expect(readSettings({ ai: { prompts: { group: PROMPT_DEFS.group.template } } }).ai.prompts).toEqual({})
  })
  it('blocks the priciest models by default and caps effort', () => {
    expect(modelBlocked('claude-fable-5-1', ['fable'])).toBe('fable')
    expect(modelBlocked('claude-opus-5-5', ['fable'])).toBe('')
    const s = readSettings({ ai: { features: { review: { on: true, model: 'claude-fable-5-1', effort: 'high' } }, maxEffort: 'low' } })
    expect(featureConfig(s.ai, 'review')).toEqual({ on: true, model: DEFAULT_MODEL, effort: 'low', blockedModel: 'claude-fable-5-1' })
    expect(featureConfig(DEFAULT_SETTINGS.ai, 'refine')).toEqual({ on: true, model: DEFAULT_MODEL, effort: 'medium', blockedModel: '' })
  })
})

describe('parseLooseJSON', () => {
  it('reads plain JSON, fenced JSON and JSON inside other text', () => {
    expect(parseLooseJSON('{"a":1}')).toEqual({ a: 1 })
    expect(parseLooseJSON('Here you go:\n```json\n{"a":[1,2]}\n```')).toEqual({ a: [1, 2] })
    expect(parseLooseJSON('Sure. {"a":{"b":2}} Hope that helps.')).toEqual({ a: { b: 2 } })
    expect(parseLooseJSON('[1,2]')).toEqual([1, 2])
  })
  it('gives undefined when nothing parses', () => {
    expect(parseLooseJSON('no json here')).toBeUndefined()
    expect(parseLooseJSON('{"a":')).toBeUndefined()
    expect(parseLooseJSON('')).toBeUndefined()
  })
})

describe('isFeature', () => {
  it('knows the nine', () => { expect(['refine', 'review', 'place'].every(isFeature)).toBe(true); expect(isFeature('nope')).toBe(false); expect(isFeature(3)).toBe(false) })
})

describe('refine', () => {
  it('fills the prompt from the topic: client, keyphrases, answers, candidates, current terms', () => {
    const r = prepare('refine', ctx({ terms: TERMS }))
    expect(r.prompt).toContain('Bessemeter (BM). About the client')
    expect(r.prompt).toContain('how to dry firewood')
    expect(r.prompt).toContain('seasoning firewood; moisture meter')
    expect(r.prompt).toContain('AI Overview answer:')
    expect(r.prompt).toMatch(/moisture meter \| 4\/4 \|/)
    expect(r.prompt).toContain('my own (manual)')
    expect(r.prompt).not.toMatch(/\{\{/)
  })
  it('needs a captured competitor page', () => {
    expect(() => prepare('refine', ctx({ terms: TERMS }, {}, []))).toThrow(NeedsMore)
  })
  it('keeps what is there, adds Claude\'s new terms, keeps manual ones and records what it dropped', () => {
    const c = ctx({ terms: TERMS, removed: [{ t: 'old', key: 'old' }] })
    const patch = prepare('refine', c).apply({
      terms: [
        { term: 'Moisture Meter', relevance: 'high', added: false },
        { term: 'chimney fire', relevance: 'weird', added: true, why: 'a risk of wet wood' },
        { term: 'chimney fire', relevance: 'low' },
        { term: '', relevance: 'low' },
      ],
      removed: [{ term: 'click here', reason: 'navigation text' }, { term: 'moisture meter', reason: 'kept anyway' }, { term: 'old', reason: 'again' }],
    }) as { terms: { t: string; tier: string; src: string; why: string }[]; removed: { key: string; reason: string }[]; refinedAt: number }
    expect(patch.terms.map(t => [t.t, t.tier, t.src])).toEqual([['moisture meter', 'high', 'data'], ['chimney fire', 'medium', 'claude'], ['my own', 'high', 'manual']])
    expect(patch.terms[1].why).toBe('a risk of wet wood')
    expect(patch.removed.map(r => r.key)).toEqual(['old', 'click here'])
    expect(patch.refinedAt).toBeGreaterThan(0)
  })
  it('refuses an answer without a term list', () => {
    const r = prepare('refine', ctx({ terms: TERMS }))
    for (const bad of [null, 'text', { terms: 'x' }, { terms: [] }, { terms: [{ term: ' ' }] }]) expect(() => r.apply(bad)).toThrow(Unreadable)
  })
  it('lists the Bible books competitors cite for a faith client only', () => {
    const bible = PAGES.map(p => ({ ...p, blocks: [...p.blocks, ['p', 'See John 3:16 and Psalm 23 for comfort.'] as [string, string]] }))
    expect(prepare('refine', ctx({ terms: TERMS }, { client: AAAF }, bible)).prompt).toMatch(/Bible books cited by competitors: .*John \(4 competitors\)/)
    expect(prepare('refine', ctx({ terms: TERMS }, {}, bible)).prompt).not.toContain('Bible books cited')
  })
  it('uses the feature switches: a switched-off field is "none"', () => {
    const off = readSettings({ features: { secondary: false, avoid: false } })
    const r = prepare('refine', ctx({ terms: TERMS }, { settings: off }))
    expect(r.prompt).not.toContain('seasoning firewood; moisture meter')
    expect(r.prompt).not.toContain('chainsaw')
  })
})

describe('group', () => {
  it('needs terms', () => { expect(() => prepare('group', ctx())).toThrow(/Build the term list first/) })
  it('keeps only known terms in the groups and the variants, and starts the groups fresh', () => {
    const r = prepare('group', ctx({ terms: TERMS }))
    expect(r.prompt).toContain('- moisture meter')
    const patch = r.apply({ groups: [{ name: 'Measuring', terms: ['Moisture meter', 'invented'] }, { name: 'Empty', terms: ['nothing'] }, { name: 'Smoke', terms: ['creosote'] }], variants: [{ main: 'moisture meter', same: ['meter moisture', 'invented', 'moisture meter'] }, { main: 'ghost', same: ['creosote'] }] }) as Record<string, unknown>
    expect(patch.termGroups).toEqual([{ name: 'Measuring', keys: ['moisture meter'] }, { name: 'Smoke', keys: ['creosote'] }])
    expect(patch.variantOf).toEqual({ 'meter moisture': 'moisture meter' })
    expect(patch).toMatchObject({ groupsCustom: false, notVariant: {} })
  })
  it('refuses an answer with no usable group', () => {
    const r = prepare('group', ctx({ terms: TERMS }))
    for (const bad of [null, {}, { groups: [] }, { groups: [{ name: 'X', terms: ['unknown'] }] }]) expect(() => r.apply(bad)).toThrow(Unreadable)
  })
})

describe('cleanq', () => {
  const qs = [{ q: 'Why wet?', key: 'why wet', src: 'competitor', from: ['#1 a'] }, { q: 'Mine?', key: 'mine', src: 'manual', from: [] }, { q: 'How long?', key: 'how long', src: 'competitor', from: ['#1 a', '#2 b'] }]
  it('numbers the competitor questions with how many sources share them, and lists them even before a scan', () => {
    const r = prepare('cleanq', ctx({ questions: qs }))
    expect(r.prompt).toContain('0: Why wet? [1]')
    expect(r.prompt).toContain('1: How long? [2]')
    expect(r.prompt).not.toContain('Mine?')
    expect(prepare('cleanq', ctx()).prompt).toMatch(/0: .*\?/)
  })
  it('turns off the ones Claude names by number, adds gaps once, ignores a wrong number', () => {
    const patch = prepare('cleanq', ctx({ questions: qs })).apply({ remove: [{ i: 1, reason: 'rhetorical' }, { i: 9, reason: 'x' }, { i: 'a' }], gaps: [{ q: 'What about creosote?', why: 'nobody answers it' }, { q: 'Why wet?', why: 'dup' }, { q: '' }] }) as { questions: { key: string; off?: boolean; reason?: string; src: string; why?: string }[] }
    expect(patch.questions.find(q => q.key === 'how long')).toMatchObject({ off: true, reason: 'rhetorical' })
    expect(patch.questions.find(q => q.key === 'why wet')?.off).toBeFalsy()
    const added = patch.questions.filter(q => q.src === 'claude')
    expect(added).toHaveLength(1)
    expect(added[0]).toMatchObject({ q: 'What about creosote?', why: 'nobody answers it' })
  })
  it('needs captured pages and refuses a non-object answer', () => {
    expect(() => prepare('cleanq', ctx({ questions: qs }, {}, []))).toThrow(NeedsMore)
    expect(() => prepare('cleanq', ctx({ questions: qs })).apply('x')).toThrow(Unreadable)
  })
})

describe('answer', () => {
  it('lists the questions to answer directly and the competitors\' openings', () => {
    const r = prepare('answer', ctx({ questions: [{ q: 'How dry is dry?', key: 'k', direct: true }, { q: 'Hidden?', key: 'h', direct: true, off: true }] }))
    expect(r.prompt).toContain('How dry is dry?')
    expect(r.prompt).not.toContain('Hidden?')
    expect(r.prompt).toContain('=== #1 site1.example.com')
  })
  it('keeps the points, at most twelve, and refuses an empty answer', () => {
    const r = prepare('answer', ctx())
    expect((r.apply({ points: ['  one ', '', 'two'] }) as { answerTop: string[] }).answerTop).toEqual(['one', 'two'])
    expect((r.apply({ points: Array.from({ length: 20 }, (_, i) => `p${i}`) }) as { answerTop: string[] }).answerTop).toHaveLength(12)
    for (const bad of [null, {}, { points: [] }, { points: [' '] }]) expect(() => r.apply(bad)).toThrow(Unreadable)
  })
})

describe('insights', () => {
  it('needs a discussion, and sends the threads', () => {
    expect(() => prepare('insights', ctx())).toThrow(/Add at least one discussion/)
    const r = prepare('insights', ctx({}, { pages: [...PAGES, discussion(1), discussion(2)] }))
    expect(r.prompt).toContain('--- Thread 1: Thread 1 (https://reddit.test/r/x/1)')
    expect(r.prompt).toContain('--- Thread 2')
  })
  it('reads the five lists and refuses an answer with none', () => {
    const r = prepare('insights', ctx({}, { pages: [discussion(1)] }))
    expect(r.apply({ painPoints: ['wet wood'], language: ['"still damp"'], questions: [], misconceptions: ['a year is enough'], angles: ['test it'] })).toMatchObject({ insights: { painPoints: ['wet wood'], misconceptions: ['a year is enough'], angles: ['test it'] } })
    for (const bad of [null, {}, { painPoints: [] }]) expect(() => r.apply(bad)).toThrow(Unreadable)
  })
})

describe('commodity and interview', () => {
  it('sends each competitor condensed, with headings marked', () => {
    const r = prepare('commodity', ctx())
    expect(r.prompt).toContain('=== #1 site1.example.com')
    expect(r.prompt).toContain('H1: How to dry firewood')
    expect(r.prompt).toContain('Test results and customer stories.')
    expect(() => prepare('commodity', ctx({}, {}, []))).toThrow(NeedsMore)
  })
  it('stores the map and the notes, accepting points as text or as objects', () => {
    const patch = prepare('commodity', ctx()).apply({
      baseline: [{ point: 'Dry wood burns better', sources: ['AI Overview', '#1 a.com'] }, { point: ' ' }, 'plain text point'],
      unique: [{ point: 'Only one says hardwood', source: '#3 c.com' }], gaps: [{ point: 'Nobody covers pellets', why: 'a gap' }],
      opportunities: ['Show a reading', { point: 'Interview a sawyer' }], angle: ['For beginners'],
    }) as { commodity: { baseline: { point: string; sources?: string[] }[]; unique: { source?: string }[]; gaps: { why?: string }[] }; opps: string[]; angle: string[] }
    expect(patch.commodity.baseline.map(b => b.point)).toEqual(['Dry wood burns better', 'plain text point'])
    expect(patch.commodity.baseline[0].sources).toEqual(['AI Overview', '#1 a.com'])
    expect(patch.commodity.unique[0].source).toBe('#3 c.com')
    expect(patch.commodity.gaps[0].why).toBe('a gap')
    expect(patch.opps).toEqual(['Show a reading', 'Interview a sawyer'])
    expect(patch.angle).toEqual(['For beginners'])
    expect(() => prepare('commodity', ctx()).apply({ unique: [] })).toThrow(Unreadable)
  })
  it('gives the interview prompt the angle and the commodity map when it has them, with wording by client', () => {
    const withMap = ctx({ opps: ['x'], angle: ['For beginners'], commodity: { at: 1, baseline: [{ point: 'Everyone says A' }], unique: [], gaps: [{ point: 'Nobody says B' }] } })
    const p = prepare('interview', withMap).prompt!
    expect(p).toContain('Angle to stand out: For beginners')
    expect(p).toContain('dig past these): Everyone says A')
    expect(p).toContain('What competitors don’t cover: Nobody says B')
    expect(p).toContain('an application expert')
    expect(prepare('interview', ctx({}, { client: AAAF })).prompt).toContain('a pastor, Bible worker')
  })
  it('reads the interview lists and needs the sme list', () => {
    const r = prepare('interview', ctx())
    expect(r.apply({ who: ['A sawyer'], sme: ['What do you check first?'], stories: ['A customer who burned wet wood'] })).toMatchObject({ interview: { who: ['A sawyer'], sme: ['What do you check first?'], stories: ['A customer who burned wet wood'] } })
    for (const bad of [null, { who: [] }, { sme: 'x' }]) expect(() => r.apply(bad)).toThrow(Unreadable)
  })
})

describe('place', () => {
  it('needs a draft', () => { expect(() => prepare('place', ctx({ terms: TERMS }))).toThrow(/Write or paste your draft first/) })
  it('asks only about terms the draft lacks, with where competitors use them and the draft\'s outline', () => {
    const r = prepare('place', ctx({ terms: TERMS }, { draftHtml: DRAFT }))
    expect(r.prompt).toContain('creosote [low]')
    expect(r.prompt).toContain('my own [high]')
    expect(r.prompt).not.toMatch(/- moisture meter|^moisture meter \[/m)
    expect(r.prompt).toContain('[H2] Why seasoning matters')
    expect(r.prompt).toContain('[Intro]')
  })
  it('saves an empty answer without asking Claude when every term is already used', () => {
    const r = prepare('place', ctx({ terms: [{ t: 'moisture meter', tier: 'high' }] }, { draftHtml: DRAFT }))
    expect(r.prompt).toBeNull()
    expect(r.apply(null)).toMatchObject({ placements: { list: [], skip: [] } })
  })
  it('reads placements and skips', () => {
    const r = prepare('place', ctx({ terms: TERMS }, { draftHtml: DRAFT }))
    const patch = r.apply({ placements: [{ term: 'creosote', heading: 'Why seasoning matters', how: 'Add a sentence.' }, { term: '' }], skip: [{ term: 'my own', reason: 'would feel forced' }] }) as { placements: { list: unknown[]; skip: unknown[] } }
    expect(patch.placements.list).toEqual([{ term: 'creosote', heading: 'Why seasoning matters', how: 'Add a sentence.' }])
    expect(patch.placements.skip).toEqual([{ term: 'my own', reason: 'would feel forced' }])
    expect(() => r.apply(null)).toThrow(Unreadable)
  })
})

describe('review', () => {
  const ANSWER = { criteria: [{ name: 'E-E-A-T', rating: 'ok', summary: 's', fixes: ['f'] }, { name: 'Originality', rating: 'needs work', summary: 's2', fixes: [] }], opening: { ok: true, note: 'good' }, closing: { ok: false, note: 'no takeaways' }, original: [{ type: 'story', excerpt: 'I once burned wet wood', heading: 'Intro' }], sections: [{ heading: 'Why', verdict: 'Commodity', note: 'n' }] }
  it('needs a draft, and sends it with headings marked, with the standards and what the SEO recorded', () => {
    expect(() => prepare('review', ctx())).toThrow(/Write or paste your draft first/)
    const r = prepare('review', ctx({ answerTop: ['Say this'], opps: ['Show a reading'], angle: ['Beginners'], commodity: { at: 1, baseline: [{ point: 'Everyone says A' }], unique: [], gaps: [] } }, { draftHtml: DRAFT }))
    expect(r.prompt).toContain('[H1] How to dry firewood')
    expect(r.prompt).toContain('[H2] Why seasoning matters')
    expect(r.prompt).toContain('1. E-E-A-T:')
    expect(r.prompt).toContain('4. Originality:')
    expect(r.prompt).toContain('Answer near the top should include: Say this')
    expect(r.prompt).toContain('- Everyone says A')
  })
  it('stores the review with a hash of the draft it read, so a change can be noticed', () => {
    const patch = prepare('review', ctx({}, { draftHtml: DRAFT })).apply(ANSWER) as { review: { hash: string; criteria: unknown[] } }
    expect(patch.review.hash).toMatch(/^[a-z0-9]+$/)
    expect(patch.review.criteria).toHaveLength(2)
    const other = prepare('review', ctx({}, { draftHtml: `${DRAFT}<p>More.</p>` })).apply(ANSWER) as { review: { hash: string } }
    expect(other.review.hash).not.toBe(patch.review.hash)
    expect(() => prepare('review', ctx({}, { draftHtml: DRAFT })).apply({ criteria: 'x' })).toThrow(Unreadable)
  })
  it('is read back tolerantly from the topic\'s data', () => {
    const stored = readAiResults({ review: { at: 5, hash: 'h', ...ANSWER, sections: [{ heading: 'Why', verdict: 'Commodity', note: 'n' }, { heading: '' }] } })
    expect(stored.review?.sections).toEqual([{ heading: 'Why', verdict: 'commodity', note: 'n' }])
    expect(stored.review?.criteria[0]).toEqual({ name: 'E-E-A-T', rating: 'ok', summary: 's', fixes: ['f'] })
    expect(stored.review?.opening).toEqual({ ok: true, note: 'good' })
    expect(readAiResults(null)).toMatchObject({ commodity: null, review: null, opps: [], interviewManual: [] })
    expect(readAiResults({ review: { criteria: 'x' } }).review).toBeNull()
  })
})

describe('interviewSelected', () => {
  it('lists Claude\'s questions, the SEO\'s own and the story prompts, each once', () => {
    expect(interviewSelected({ interview: { at: 1, who: ['w'], sme: ['a', 'b'], stories: ['s', 'a'] }, interviewManual: ['m', 'b'] })).toEqual(['a', 'b', 'm', 's'])
    expect(interviewSelected({ interview: null, interviewManual: [] })).toEqual([])
  })
})
