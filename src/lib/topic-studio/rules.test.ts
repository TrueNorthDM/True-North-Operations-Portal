import { describe, expect, it } from 'vitest'
import { DEFAULT_RULES } from './project'
import { readSettings } from './ai/settings'
import { analyzeDraft, workshopModel } from './workshop'
import { termsView } from './views'
import { analysis, project } from './test-fixture'

const TERMS = ['moisture meter', 'creosote', 'seasoning', 'chainsaw', 'firewood', 'chimney', 'stack', 'split logs', 'kiln', 'moisture content', 'smoke', 'burn'].map(t => ({ t, tier: 'medium' }))
const withRules = (patch: unknown) => {
  const p = project({ terms: TERMS })
  const s = readSettings(patch)
  p.rules = { features: s.features, terms: s.feedback.terms, writer: s.feedback.writer }
  return analysis(p)
}
const draft = (words: number): [string, string][] => [['h1', 'Dry firewood'], ['p', Array.from({ length: words }, (_, i) => `word${i}`).join(' ')]]

describe('the settings reach the analysis', () => {
  it('uses the defaults until settings are loaded', () => {
    expect(DEFAULT_RULES.writer.length).toEqual({ on: true, thin: 800, long: 2500 })
    expect(project().rules).toBe(DEFAULT_RULES)
  })
  it('judges a draft\'s length by the saved rule', () => {
    expect(analyzeDraft(workshopModel(withRules({})), draft(900))?.length.tone).toBe('ok')
    expect(analyzeDraft(workshopModel(withRules({ feedback: { writer: { length: { thin: 1200 } } } })), draft(900))?.length.tone).toBe('warn')
  })
  it('turns off the terms to avoid when that field is switched off', () => {
    const on = termsView(withRules({})).terms.filter(r => r.avoid).length
    const off = termsView(withRules({ features: { avoid: false } })).terms.filter(r => r.avoid).length
    expect(on).toBeGreaterThan(0)
    expect(off).toBe(0)
  })
  it('reads the list size rule', () => {
    const v = termsView(withRules({ feedback: { terms: { size: { thin: 100, short: 100, max: 100, long: 100 } } } }))
    expect(v.size?.tone).toBe('bad')
  })
})
