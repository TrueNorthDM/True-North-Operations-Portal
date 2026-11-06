import { describe, expect, it } from 'vitest'
import { competitorsView, questionsView, termsView } from './views'
import { PAGES, analysis, project } from './test-fixture'

describe('competitorsView', () => {
  it('lists every competitor with its words, reading ease and capture state', () => {
    const v = competitorsView(analysis(project(), PAGES.slice(0, 3)))
    expect(v.total).toBe(4)
    expect(v.done).toBe(3)
    expect(v.rows.map(r => r.captured)).toEqual([true, true, true, false])
    expect(v.rows[0]).toMatchObject({ rank: 1, domain: 'site1.example.com', title: 'Dry firewood 1', cited: false })
    expect(v.rows[0].words).toBeGreaterThan(50)
    expect(v.rows[0].headings.map(h => h.t)).toContain('How to dry firewood')
    expect(v.rows[3]).toMatchObject({ words: 0, flesch: null, score: null, title: PAGES[3].url })
    expect(v.words.med).toBeGreaterThan(0)
  })
  it('shows no scores until the term list is built, then a score and grade per page', () => {
    expect(competitorsView(analysis()).avgScore).toBeNull()
    const v = competitorsView(analysis(project({ terms: [{ t: 'moisture meter', tier: 'high' }, { t: 'creosote', tier: 'low' }] })))
    expect(v.hasTerms).toBe(true)
    expect(v.avgScore).toBeGreaterThan(0)
    expect(v.rows.every(r => r.score != null && r.grade !== '')).toBe(true)
  })
})

describe('termsView', () => {
  const terms = [{ t: 'moisture meter', tier: 'high' }, { t: 'meter moisture', tier: 'medium' }, { t: 'creosote', tier: 'low' }, { t: 'chainsaw oil', tier: 'low' }]
  const v = termsView(analysis(project({ terms })))
  it('counts concepts apart from their variants, and terms by relevance', () => {
    expect(v.all).toBe(4)
    expect(v.concepts).toBe(3)
    expect(v.tiers).toEqual({ high: 1, medium: 0, low: 2 })
    expect(v.variants).toEqual({ 'moisture meter': ['meter moisture'] })
  })
  it('says how each term is used and marks a variant with its main term', () => {
    const main = v.terms.find(t => t.key === 'moisture meter')!
    expect(main.df).toBe(4)
    expect(main.per).toHaveLength(4)
    expect(main.aiPer.map(a => a.label)).toEqual(['AI Overview', 'ChatGPT', 'Perplexity'])
    expect(v.terms.find(t => t.key === 'meter moisture')?.variantOf).toEqual({ key: 'moisture meter', t: 'moisture meter' })
  })
  it('flags a term that matches a phrase to avoid', () => {
    expect(v.terms.find(t => t.t === 'chainsaw oil')?.avoid).toBe('chainsaw')
    expect(v.terms.find(t => t.t === 'creosote')?.avoid).toBe('')
  })
  it('groups, lists more candidates not already on the list, and the missing AI answers', () => {
    expect(v.groups.flatMap(g => g.keys).sort()).toEqual(['chainsaw oil', 'creosote', 'moisture meter'])
    expect(v.more.length).toBeGreaterThan(0)
    expect(v.more.some(m => m.k === 'moisture meter')).toBe(false)
    expect(v.missing).toEqual([])
    expect(termsView(analysis(project({ aiGemini: '', aiPerplexity: '' }))).missing.map(m => m.label)).toEqual(['Gemini', 'Perplexity'])
  })
  it('gives the rules, how many differ from the defaults, and the list-size advice', () => {
    expect(v.changedRules).toBe(0)
    expect(termsView(analysis(project({ buildRules: { size: 20, singles: 30 } }))).changedRules).toBe(2)
    expect(v.size?.tone).toBe('bad')
    const many = Array.from({ length: 25 }, (_, i) => ({ t: `term${i} firewood`, tier: 'high' }))
    expect(termsView(analysis(project({ terms: many }))).size).toMatchObject({ tone: 'ok', short: 20, max: 35 })
    expect(termsView(analysis(project())).size).toBeNull()
  })
  it('lists removed terms with their reason', () => {
    expect(termsView(analysis(project({ removed: [{ t: 'x', key: 'x', reason: 'removed by you' }] }))).removed).toEqual([{ t: 'x', key: 'x', reason: 'removed by you' }])
  })
  it('has nothing to build from when no page is captured', () => {
    const e = termsView(analysis(project(), []))
    expect(e.N).toBe(0)
    expect(e.more).toEqual([])
    expect(e.groups).toEqual([])
  })
})

describe('questionsView', () => {
  it('sorts questions into the sections of the tab and counts what is captured', () => {
    const p = project({
      answerTop: ['Say this'],
      questions: [
        { q: 'D1?', key: 'd1', direct: true, src: 'manual' },
        { q: 'C1?', key: 'c1', src: 'competitor', from: ['#1 a.com'], heading: true },
        { q: 'M1?', key: 'm1', src: 'manual' },
        { q: 'K1?', key: 'k1', src: 'claude', why: 'gap' },
        { q: 'C2?', key: 'c2', src: 'competitor', off: true, reason: 'dup' },
      ],
    })
    const v = questionsView(analysis(p))
    expect(v.answerTop).toEqual(['Say this'])
    expect(v.direct.map(q => q.key)).toEqual(['d1'])
    expect(v.competitor.map(q => q.key)).toEqual(['c1', 'c2'])
    expect(v.mine.map(q => q.key)).toEqual(['m1'])
    expect(v.claude.map(q => [q.key, q.why])).toEqual([['k1', 'gap']])
    expect(v.competitor[1]).toMatchObject({ off: true, reason: 'dup' })
    expect(v.competitor[0]).toMatchObject({ heading: true, from: ['#1 a.com'] })
    expect(v.hasCompetitorQuestions).toBe(true)
    expect(v.captured).toBe(4)
  })
})
