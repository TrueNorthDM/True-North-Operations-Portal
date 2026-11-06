import { describe, expect, it } from 'vitest'
import { readAiResults } from './ai/results'
import { cleanOriginalityEdit, originalityBriefHtml, originalityBriefMarkdown, originalityView } from './originality'

const R = readAiResults({
  commodity: { at: 1, baseline: [{ point: 'Dry wood burns <better>', sources: ['AI Overview', '#1 a.com'] }], unique: [{ point: 'Hardwood only', source: '#3 c.com' }], gaps: [{ point: 'Pellets', why: 'nobody covers them' }] },
  opps: ['Show a reading'], angle: ['For beginners'], interview: { at: 1, who: ['A sawyer'], sme: ['What do you check first?'], stories: ['A wet-wood story'] }, interviewManual: ['My question'],
})

describe('originality', () => {
  it('writes the brief sections, escaping text, and nothing when empty', () => {
    const h = originalityBriefHtml(R)
    expect(h).toContain('Dry wood burns &lt;better&gt; (AI Overview, #1 a.com)')
    expect(h).toContain('Pellets: nobody covers them')
    expect(h).toContain('<h3>Interview prompts for a subject-matter expert</h3>')
    expect(h).toContain('My question')
    expect(originalityBriefHtml(readAiResults(null))).toBe('')
    expect(originalityBriefMarkdown(readAiResults(null))).toBe('')
  })
  it('writes the Markdown too', () => {
    const m = originalityBriefMarkdown(R)
    expect(m).toContain('## Originality')
    expect(m).toContain('- Hardwood only (#3 c.com)')
    expect(m).toContain('- What do you check first?')
    expect(m).not.toMatch(/—/)
  })
  it('keeps only lists of short text from a hand edit, and marks an edited map', () => {
    const e = cleanOriginalityEdit({ opps: ['a', '', 5, 'b'], angle: 'x', interviewManual: Array.from({ length: 90 }, (_, i) => `q${i}`), commodity: { baseline: [{ point: 'p' }] }, evil: 1 })
    expect(e.opps).toEqual(['a', 'b'])
    expect(e.angle).toEqual([])
    expect((e.interviewManual as string[]).length).toBe(60)
    expect(e.commodity).toMatchObject({ baseline: [{ point: 'p' }], edited: true })
    expect('evil' in e).toBe(false)
    expect(cleanOriginalityEdit(null)).toEqual({})
  })
  it('lists the interview questions that go into the brief', () => {
    expect(originalityView(R, 'x').selected).toEqual(['What do you check first?', 'My question', 'A wet-wood story'])
  })
})
