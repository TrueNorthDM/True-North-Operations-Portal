import { describe, it, expect } from 'vitest'
import {
  allowanceSeconds, checkRequest, countedRow, DELETED, decidedText, IN_ENTRIES, judge, logLine, MAX_IDS, NO_ROW, RUNNING,
  splitDecided, summary, UNMATCHED, type Facts,
} from './skipped-decisions'

// Deciding the TSheets entries set aside after the North Time start date (owner, 27 October 2026).

const facts = (over: Partial<Facts> = {}): Facts => ({
  choice: 'count', found: true, decidedLine: null, deletedInTsheets: false, running: false, unmatched: false,
  inEntries: false, lockedText: null, overText: null, reason: null, pastAllowance: false, ...over,
})

describe('the request, whatever the browser sent', () => {
  it('takes the two choices only', () => {
    expect(checkRequest({ ids: [1], choice: 'delete' })).toEqual({ ok: false, error: 'Choose Count it or Discard it.' })
    expect(checkRequest(null).ok).toBe(false)
    expect(checkRequest({ ids: [1], choice: 'count' })).toEqual({ ok: true, ids: [1], choice: 'count', reason: null, pastAllowance: false })
  })

  it('takes TSheets ids only, once each, and a bounded number of them', () => {
    expect(checkRequest({ ids: [], choice: 'count' }).ok).toBe(false)
    expect(checkRequest({ ids: ['1'], choice: 'count' }).ok).toBe(false)
    expect(checkRequest({ ids: [1.5], choice: 'count' }).ok).toBe(false)
    expect(checkRequest({ ids: [-3], choice: 'count' }).ok).toBe(false)
    expect(checkRequest({ ids: [4, 4, 5], choice: 'discard' })).toMatchObject({ ok: true, ids: [4, 5] })
    expect(checkRequest({ ids: Array.from({ length: MAX_IDS + 1 }, (_, i) => i + 1), choice: 'discard' }).ok).toBe(false)
  })

  it('keeps the reason trimmed and short, and past the allowance only for a count', () => {
    expect(checkRequest({ ids: [1], choice: 'discard', reason: '   ' })).toMatchObject({ reason: null })
    expect(checkRequest({ ids: [1], choice: 'discard', reason: ' worked \n late ' })).toMatchObject({ reason: 'worked late' })
    expect((checkRequest({ ids: [1], choice: 'discard', reason: 'x'.repeat(900) }) as { reason: string }).reason).toHaveLength(500)
    expect(checkRequest({ ids: [1], choice: 'discard', reason: 7 }).ok).toBe(false)
    expect(checkRequest({ ids: [1], choice: 'discard', pastAllowance: true })).toMatchObject({ pastAllowance: false })
    expect(checkRequest({ ids: [1], choice: 'count', pastAllowance: 'yes' })).toMatchObject({ pastAllowance: false })
    expect(checkRequest({ ids: [1], choice: 'count', pastAllowance: true })).toMatchObject({ pastAllowance: true })
  })
})

describe('whether an entry may be decided', () => {
  it('does nothing to an entry already decided, and says so', () => {
    const v = judge(facts({ decidedLine: 'Counted by Ana on Oct 28, 2026' }))
    expect(v).toEqual({ kind: 'already', text: 'Already decided: Counted by Ana on Oct 28, 2026. Nothing changed.' })
    expect(judge(facts({ choice: 'discard', decidedLine: 'Discarded by Ana on Oct 28, 2026' })).kind).toBe('already')
  })

  it('refuses an entry no longer set aside', () => {
    expect(judge(facts({ found: false }))).toEqual({ kind: 'refused', text: NO_ROW })
  })

  it('discards anything undecided, with or without a reason', () => {
    expect(judge(facts({ choice: 'discard', deletedInTsheets: true, running: true, inEntries: true, lockedText: 'x', overText: 'y' }))).toEqual({ kind: 'ok' })
  })

  it('refuses to count what cannot become hours', () => {
    expect(judge(facts({ deletedInTsheets: true }))).toEqual({ kind: 'refused', text: DELETED })
    expect(judge(facts({ running: true }))).toEqual({ kind: 'refused', text: RUNNING })
    expect(judge(facts({ unmatched: true }))).toEqual({ kind: 'refused', text: UNMATCHED })
    expect(judge(facts({ inEntries: true }))).toEqual({ kind: 'refused', text: IN_ENTRIES })
    expect(judge(facts({ lockedText: 'For Ana, November is submitted. Ask a Super Admin to reopen it.' })))
      .toEqual({ kind: 'refused', text: 'For Ana, November is submitted. Ask a Super Admin to reopen it.' })
  })

  it('a submitted period refuses even with a reason past the allowance', () => {
    expect(judge(facts({ lockedText: 'locked', overText: 'over', reason: 'ok', pastAllowance: true })).kind).toBe('refused')
  })

  it('past the allowance: shows the allowance line and waits for a reason given after it', () => {
    const over = 'That puts Ana past her allowance of 40h for the week of Nov 9.'
    expect(judge(facts({ overText: over }))).toEqual({ kind: 'needs-reason', text: over })
    // A reason alone is not enough: it has to come from the window that showed the line.
    expect(judge(facts({ overText: over, reason: 'asked to' }))).toEqual({ kind: 'needs-reason', text: over })
    expect(judge(facts({ overText: over, pastAllowance: true }))).toEqual({ kind: 'needs-reason', text: over })
    expect(judge(facts({ overText: over, reason: 'Approved by Ben on the phone', pastAllowance: true }))).toEqual({ kind: 'ok' })
  })

  it('counts an entry within the allowance', () => {
    expect(judge(facts())).toEqual({ kind: 'ok' })
  })
})

describe('the Time entry it becomes', () => {
  const entry = {
    external_id: 77, person_id: 'ana', jobcode_id: 5, started_at: '2026-11-09T13:00:00Z', ended_at: '2026-11-09T15:00:00Z',
    duration_seconds: 7200, entry_date: '2026-11-09', kind: 'clock' as const, state: 'approved' as const, notes: null, fields: { 3: 'SEO' },
    source: 'tsheets' as const, created_by: null, updated_at: '2026-11-09T15:00:00Z',
  }

  it('is the import\'s row, open, and the portal\'s from then on', () => {
    const r = countedRow(entry, '2026-11-10T12:00:00Z')
    expect(r).toEqual({ ...entry, state: 'open', updated_at: '2026-11-10T12:00:00Z', changed_here_at: '2026-11-10T12:00:00Z' })
  })

  it('counts time off as nothing against the allowance, and never less than nothing', () => {
    expect(allowanceSeconds({ kind: 'absence', duration_seconds: 28800 })).toBe(0)
    expect(allowanceSeconds({ kind: 'clock', duration_seconds: 7200 })).toBe(7200)
    expect(allowanceSeconds({ kind: 'manual', duration_seconds: -5 })).toBe(0)
  })
})

describe('what the page and the log say', () => {
  it('sums up a batch', () => {
    expect(summary('count', [{ id: 1, outcome: 'done', text: '' }, { id: 2, outcome: 'done', text: '' }])).toBe('Counted 2 entries.')
    expect(summary('discard', [{ id: 1, outcome: 'done', text: '' }, { id: 2, outcome: 'already', text: '' }]))
      .toBe('Discarded 1 entry. 1 was already decided, nothing changed.')
    expect(summary('count', [{ id: 1, outcome: 'needs-reason', text: '' }, { id: 2, outcome: 'refused', text: '' }, { id: 3, outcome: 'refused', text: '' }]))
      .toBe('1 entry goes past the allowance and needs a reason. 2 entries could not be counted.')
  })

  it('says who decided, how and when', () => {
    expect(decidedText('imported', 'Ana Lima', 'Oct 28, 2026')).toBe('Counted by Ana Lima on Oct 28, 2026')
    expect(decidedText('dismissed', null, 'Oct 28, 2026')).toBe('Discarded on Oct 28, 2026')
    expect(logLine('Ana Lima', 'Nov 9, 2026', 77, 'count', 'Approved by Ben')).toBe('Ana Lima, Nov 9, 2026: TSheets entry #77 counted (Approved by Ben)')
    expect(logLine('Ana Lima', 'Nov 9, 2026', 77, 'discard', null)).toBe('Ana Lima, Nov 9, 2026: TSheets entry #77 discarded')
  })

  it('splits the list into the two tabs', () => {
    const rows = [{ id: 1, decidedAt: null }, { id: 2, decidedAt: '2026-10-28T10:00:00Z' }, { id: 3, decidedAt: null }]
    expect(splitDecided(rows)).toEqual({ todo: [rows[0], rows[2]], decided: [rows[1]] })
  })
})
