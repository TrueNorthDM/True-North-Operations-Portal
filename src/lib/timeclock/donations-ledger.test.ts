/**
 * What the records screen says about each figure.
 *
 * The counting rules here are the kind that go wrong quietly: "last changed"
 * reading the oldest entry instead of the newest, or a correction count that
 * includes the entry being created and so says every figure has been corrected
 * once.
 */

import { describe, it, expect } from 'vitest'
import { deriveLedger, projectName, UNRESTRICTED, type RawDonation, type RawLogRow } from './donations-ledger'

const donation = (over: Partial<RawDonation> = {}): RawDonation => ({
  id: 1, project_label: 'AAAF', month: '2026-03', amount_usd: '467.00', note: null, ...over,
})

const entry = (over: Partial<RawLogRow> = {}): RawLogRow => ({
  id: 1, donation_id: 1, project_label: 'AAAF', month: '2026-03', action: 'created',
  amount_before: null, amount_after: '467.00', note_before: null, note_after: null,
  actor_name: 'Tina Mills', actor_email: 'tina@example.org', at: '2026-09-09T10:00:00Z', ...over,
})

describe('deriveLedger', () => {
  it('takes the newest change as the last one, not the first seen', () => {
    // Newest first, which is the order the query asks for.
    const log = [
      entry({ id: 3, action: 'updated', at: '2026-09-09T14:00:00Z', actor_name: 'Dave Reid', actor_email: null }),
      entry({ id: 2, action: 'updated', at: '2026-09-09T12:00:00Z' }),
      entry({ id: 1, action: 'created', at: '2026-09-09T10:00:00Z' }),
    ]
    const { entries } = deriveLedger([donation()], log, null)
    expect(entries[0].lastChangedBy).toBe('Dave Reid')
    expect(entries[0].lastChangedAt).toBe('2026-09-09T14:00:00Z')
  })

  // Creating a figure is not correcting it. Counting the create would tell the
  // reader every entry had been corrected once, which is the opposite of what
  // the column is for.
  it('does not count the creation as a correction', () => {
    const { entries } = deriveLedger([donation()], [entry()], null)
    expect(entries[0].changes).toBe(0)
  })

  it('counts updates and deletions', () => {
    const log = [
      entry({ id: 3, action: 'updated' }),
      entry({ id: 2, action: 'updated' }),
      entry({ id: 1, action: 'created' }),
    ]
    expect(deriveLedger([donation()], log, null).entries[0].changes).toBe(2)
  })

  it('leaves a figure with no log entry saying so rather than guessing', () => {
    const { entries } = deriveLedger([donation()], [], null)
    expect(entries[0].lastChangedBy).toBeNull()
    expect(entries[0].lastChangedAt).toBeNull()
    expect(entries[0].changes).toBe(0)
  })

  // A deletion's log entry has no donation to attach to any more. It must still
  // appear in the log, and must not be counted against some other figure.
  it('keeps a deletion in the log without attaching it to a figure', () => {
    const log = [entry({ id: 2, donation_id: null, action: 'deleted', amount_before: '467.00', amount_after: null })]
    const { log: out, entries } = deriveLedger([donation({ id: 9 })], log, null)
    expect(out).toHaveLength(1)
    expect(out[0].amountAfter).toBeNull()
    expect(entries[0].changes).toBe(0)
  })

  it('offers only years that have something in them, newest first', () => {
    const donations = [donation({ id: 1, month: '2026-03' }), donation({ id: 2, month: '2025-11' })]
    expect(deriveLedger(donations, [], null).years).toEqual(['2026', '2025'])
  })

  it('filters both tables by the chosen year', () => {
    const donations = [donation({ id: 1, month: '2026-03' }), donation({ id: 2, month: '2025-11' })]
    const log = [entry({ id: 1, month: '2025-11', donation_id: 2 })]
    const out = deriveLedger(donations, log, '2026')
    expect(out.entries.map(e => e.month)).toEqual(['2026-03'])
    expect(out.log).toHaveLength(0)
    // The filter must not narrow what the filter itself offers, or picking a
    // year would hide every other year from the picker.
    expect(out.years).toEqual(['2026', '2025'])
  })

  it('names the actor by email when no person matched, and says so when neither did', () => {
    const log = [
      entry({ id: 2, donation_id: 2, actor_name: null, actor_email: 'someone@example.org' }),
      entry({ id: 3, donation_id: 3, actor_name: null, actor_email: null }),
    ]
    const out = deriveLedger([], log, null)
    expect(out.log[0].actor).toBe('someone@example.org')
    expect(out.log[1].actor).toBe('Unknown')
  })

  it('reads numbers that arrive as strings, which is how postgres sends numeric', () => {
    const { entries } = deriveLedger([donation({ amount_usd: '12104.00' })], [], null)
    expect(entries[0].amount).toBe(12104)
  })
})

describe('projectName', () => {
  it('gives the client name, not the label the sheet uses', () => {
    expect(projectName('AAAF')).toBe('AskAnAdventistFriend.com')
    expect(projectName('Africa')).toBe('Hope for Africa')
  })

  // 079 kept project_label nullable for unrestricted giving. Nothing writes it
  // any more, but a row that predates that decision must still read as words.
  it('names an unrestricted donation rather than showing a blank', () => {
    expect(projectName(null)).toBe(UNRESTRICTED)
  })

  it('passes through a label it does not know rather than hiding the row', () => {
    expect(projectName('Something else')).toBe('Something else')
  })
})
