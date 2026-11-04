import { describe, expect, it } from 'vitest'
import { monthIn, readOldReview } from './old-review'

const WORD = `Annual Performance Review 2025
Employee: Amy Prindle
Position: Final Editor

JOB DESCRIPTION
Current responsibilities
Final edits for the English articles and the style guide.
I also run the weekly edit queue.
Initial role expectations:
Writer, then final editor from March 2024.
Role alignment: Mostly aligned.
Success indicators
Articles publish within 5 working days.

SELF-EVALUATION
Strengths: clear notes.

Goals for 2026
1. Clear the backlog of 40 articles (by June 2026)
   Measured by the queue staying under a week.
2. Write a headline checklist for the team, by December 2026
3) Finish an SEO writing course

MANAGER'S FEEDBACK
Good year.`

describe('reading last year\'s review', () => {
  it('finds the four Job Description answers, on their own lines or after a colon', () => {
    const r = readOldReview(WORD, 2026)
    expect(r.job.job_current).toBe('Final edits for the English articles and the style guide.\nI also run the weekly edit queue.')
    expect(r.job.job_initial).toBe('Writer, then final editor from March 2024.')
    expect(r.job.job_alignment).toBe('Mostly aligned.')
    expect(r.job.job_success).toBe('Articles publish within 5 working days.')
  })
  it('lists the goals for the year under review, with their month, until the next section', () => {
    expect(readOldReview(WORD, 2026).goals).toEqual([
      { what: 'Clear the backlog of 40 articles', byMonth: '2026-06-01' },
      { what: 'Write a headline checklist for the team', byMonth: '2026-12-01' },
      { what: 'Finish an SEO writing course', byMonth: null },
    ])
  })
  it('takes one goal per line when the list has no bullets, and "next year" as the heading', () => {
    const text = 'Goals for next year:\nTrain one new final editor\nMove every edit request into the portal by May 2026\nSIGNATURES\nAmy'
    expect(readOldReview(text, 2026).goals).toEqual([
      { what: 'Train one new final editor', byMonth: null },
      { what: 'Move every edit request into the portal', byMonth: '2026-05-01' },
    ])
  })
  it('finds nothing in a file without those parts, and ignores goals of another year', () => {
    expect(readOldReview('Some notes\nGoals for 2024\n1. Old goal from long ago', 2026)).toEqual({ goals: [], job: {} })
  })
  it('reads a month in its usual spellings', () => {
    expect(monthIn('due Sept. 2026')).toBe('2026-09-01')
    expect(monthIn('by Jun 2026')).toBe('2026-06-01')
    expect(monthIn('no date')).toBeNull()
  })
})
