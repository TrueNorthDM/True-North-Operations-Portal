import { describe, expect, it } from 'vitest'
import { compareInvoice } from './contractor-invoice'
import { buildInvoiceRecord, checkWord, numbersLine, recordFacts, sentOnLabel, shortStamp, zoneCity, type RecordSource } from './invoice-record'

const NY = 'America/New_York'
const NAMES: Record<string, string> = { jordan: 'Jordan Lee', alex: 'Alex Rivera', tina: 'Tina Gennette' }
const h = (n: number) => n * 3600

function source(x: { own?: boolean; legacy?: boolean } = {}): RecordSource {
  const madeBy = x.legacy ? null : x.own ? 'own_file' : 'builder'
  return {
    inv: {
      number: 'INV-2026-061', person_id: 'jordan', submission_id: 61, kind: 'hourly', state: 'paid', source: null,
      period_start: '2026-10-01', period_end: '2026-10-31', created_at: '2026-11-02T14:14:00Z', total: 4096.7,
      paid_on: '2026-11-10', paid_ref: 'WISE-88412', made_by: madeBy, sent_by: x.legacy ? null : 'jordan',
      sent_at: x.legacy ? null : '2026-11-03T13:05:00Z', sent_from: x.legacy ? null : 'portal',
      confirmed_text: x.legacy ? null : 'This is my invoice. I made it and I am sending it to True North for October 2026.',
      their_number: x.legacy ? null : '0142-B', stated_hours: x.own ? 160.5 : null, stated_total: x.own ? 4096.7 : null,
      own_pdf_name: x.own ? 'Jordan Lee - Invoice 0142-B.pdf' : null,
    },
    name: 'Jordan Lee',
    sends: x.legacy ? [] : [
      { at: '2026-11-02T14:14:00Z', madeBy: x.own ? 'own_file' : 'builder', sentFrom: 'portal', sentBy: 'jordan', sentEmail: 'jordan.lee@example.com', confirmed: 'c', theirNumber: '0142', statedHours: null, statedTotal: null, covers: null, ownPdfName: x.own ? 'Jordan Lee - Invoice 0142.pdf' : null, total: 4146.7 },
      { at: '2026-11-03T13:05:00Z', madeBy: x.own ? 'own_file' : 'builder', sentFrom: 'portal', sentBy: 'jordan', sentEmail: 'jordan.lee@example.com', confirmed: 'c', theirNumber: '0142-B', statedHours: null, statedTotal: null, covers: null, ownPdfName: x.own ? 'Jordan Lee - Invoice 0142-B.pdf' : null, total: 4096.7 },
    ],
    events: [
      { step: 'submit', action: 'submit', by_person: 'jordan', at: x.legacy ? '2026-11-02T14:14:20Z' : '2026-11-01T22:02:00Z', note: null },
      { step: 'invoice', action: 'return', by_person: 'alex', at: '2026-11-02T20:40:00Z', note: 'COE Group shows 54.5h; your timesheet has 52.5h.' },
      { step: 'both', action: 'approve', by_person: 'alex', at: '2026-11-03T15:12:00Z', note: null },
      { step: 'paid', action: 'paid', by_person: 'tina', at: '2026-11-10T19:30:00Z', note: null },
    ],
    lineHours: x.own || x.legacy ? null : 160.5,
    check: compareInvoice({
      timesheet: [{ client: 'i7 Marketing', seconds: h(96) }, { client: 'COE Group', seconds: h(52.5) }],
      pay: { kind: 'hourly', rate: 25 },
      reimbursements: [],
      invoice: { madeBy: x.own ? 'own_file' : 'builder', byClient: x.own ? [] : [{ client: 'i7 Marketing', seconds: h(96) }, { client: 'COE Group', seconds: h(54.5) }], hours: 160.5, total: 4096.7, reimbursements: [] },
    }),
    nameOf: id => (id ? NAMES[id] ?? 'Someone' : 'North Time'),
    zone: NY,
  }
}

describe('the record\'s words', () => {
  it('says the zone by its city and the times as the record writes them', () => {
    expect(zoneCity('America/New_York')).toBe('New York')
    expect(zoneCity('Africa/Nairobi')).toBe('Nairobi')
    expect(sentOnLabel('2026-11-02T14:14:00Z', NY)).toBe('Nov 2, 2026 at 9:14 AM (New York)')
    expect(shortStamp('2026-11-10T19:30:00Z', NY)).toBe('Nov 10, 2:30 PM')
  })

  it('names each check', () => {
    expect(checkWord({ check: 'match', invoice: '', timesheet: '' })).toBe('Matches')
    expect(checkWord({ check: 'differs', invoice: '', timesheet: '' })).toBe('Differs')
    expect(checkWord({ check: 'only-timesheet', invoice: '-', timesheet: '1h 00m' })).toBe('Not on invoice')
    expect(checkWord({ check: 'only-invoice', invoice: '1h 00m', timesheet: '-' })).toBe('Not on timesheet')
    expect(checkWord({ check: 'on-file', invoice: 'On their file', timesheet: '96h 00m' })).toBe('On their file')
    expect(checkWord({ check: 'on-file', invoice: '$10.00', timesheet: 'No rate on file' })).toBe('No rate on file')
  })

  it('writes their numbers with the parts that are there', () => {
    expect(numbersLine({ theirNumber: '0142', hours: 160.5, total: 4096.7 })).toBe('Invoice 0142 · 160.50 hours · $4,096.70')
    expect(numbersLine({ theirNumber: null, hours: null, total: 1500 })).toBe('$1,500.00')
    expect(numbersLine({ theirNumber: null, hours: 0, total: null })).toBeNull()
  })

  it('says a portal-made invoice was made by the portal, and when', () => {
    const facts = recordFacts({ name: 'x', initials: 'TN', headline: '', sentOn: null, email: null, how: 'Made by the portal from the timesheet (before November 2026)', confirmed: null, numbers: null }, null, 'Jordan Lee', 'Oct 1, 2026 at 8:00 AM (New York)')
    expect(facts).toEqual([
      { label: 'Made by', text: 'Made by the portal from the timesheet (before November 2026)' },
      { label: 'Made on', text: 'Oct 1, 2026 at 8:00 AM (New York)' },
    ])
  })
})

describe('an invoice\'s record', () => {
  it('a builder invoice: who sent it, signed in as whom, the sentence, their numbers; page 1 in their name', () => {
    const r = buildInvoiceRecord(source())
    expect(r.madeBy).toBe('builder')
    expect(r.facts).toEqual([
      { label: 'Made and sent by', strong: 'Jordan Lee', text: ', the contractor' },
      { label: 'Sent on', text: 'Nov 3, 2026 at 8:05 AM (New York)' },
      { label: 'Signed in as', text: 'jordan.lee@example.com' },
      { label: 'How', text: 'Built by Jordan Lee with the portal\'s invoice builder' },
      { label: 'Confirmed', text: '"This is my invoice. I made it and I am sending it to True North for October 2026."' },
      { label: 'Their numbers', text: 'Invoice 0142-B · 160.50 hours · $4,096.70' },
    ])
    expect(r.who.headline).toBe('Sent by the contractor, Jordan Lee')
    expect(r.footLine).toBe('Invoice by Jordan Lee, made with the True North portal\'s invoice builder.')
  })

  it('keeps every version sent, the return between them, the approval and the payment, oldest first', () => {
    const r = buildInvoiceRecord(source({ own: true }))
    expect(r.history).toEqual([
      { when: 'Nov 1, 5:02 PM', text: 'Jordan Lee sent the October timesheet.' },
      { when: 'Nov 2, 9:14 AM', text: 'Jordan Lee sent invoice 0142, their own file "Jordan Lee - Invoice 0142.pdf".' },
      { when: 'Nov 2, 3:40 PM', text: 'Alex Rivera sent the invoice back: "COE Group shows 54.5h; your timesheet has 52.5h."' },
      { when: 'Nov 3, 8:05 AM', text: 'Jordan Lee sent invoice 0142-B again, their own file "Jordan Lee - Invoice 0142-B.pdf".' },
      { when: 'Nov 3, 10:12 AM', text: 'Alex Rivera approved the hours and the invoice.' },
      { when: 'Nov 10, 2:30 PM', text: 'Tina Gennette (Finance) marked it paid on Nov 10, reference WISE-88412.' },
    ])
    expect(r.asOf).toBe('Nov 10, 2026, 2:30 PM')
    expect(r.ownFileName).toBe('Jordan Lee - Invoice 0142-B.pdf')
    expect(r.facts.find(f => f.label === 'How')?.text).toBe('Their own file, "Jordan Lee - Invoice 0142-B.pdf"')
    expect(r.facts.find(f => f.label === 'Their numbers')?.text).toBe('Invoice 0142-B · 160.50 hours · $4,096.70')
  })

  it('carries the check, with the words the PDF prints', () => {
    const r = buildInvoiceRecord(source())
    expect(r.check?.rows.map(x => [x.label, x.word])).toEqual([['i7 Marketing', 'Matches'], ['COE Group', 'Differs']])
    expect(r.check?.matches).toBe(false)
    expect(r.check?.total.label).toBe('Total (rate on file $25.00)')
  })

  it('an invoice the portal made before November 2026: made by the portal, the submit that made it not said twice', () => {
    const r = buildInvoiceRecord(source({ legacy: true }))
    expect(r.madeBy).toBeNull()
    expect(r.facts[0]).toEqual({ label: 'Made by', text: 'Made by the portal from the timesheet (before November 2026)' })
    expect(r.history[0]).toEqual({ when: 'Nov 2, 9:14 AM', text: 'The portal made it from the October timesheet.' })
    expect(r.history.some(x => x.text.includes('sent the October timesheet'))).toBe(false)
    expect(r.footLine).toBe('Made by the True North Operations Portal')
  })

  it('a send through the invoice form says so, with the form\'s email', () => {
    const s = source()
    s.inv.sent_from = 'form'
    s.sends = s.sends.map(x => ({ ...x, sentFrom: 'form' as const }))
    const r = buildInvoiceRecord(s)
    expect(r.facts.find(f => f.label === 'Email on the form')?.text).toBe('jordan.lee@example.com')
    expect(r.history.some(x => x.text.endsWith(', through the invoice form.'))).toBe(true)
  })
})
