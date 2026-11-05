import { describe, expect, it } from 'vitest'
import {
  CODES_PER_DAY, CODES_PER_DAY_VISITOR, CODES_PER_HOUR, CODE_LIFE_MS, MAX_TRIES, MONTH_SLOT, alreadySentText, buildFormLines, cameFrom, checkSubmission,
  codeLimit, codeLimitText, codeOf, codeVerdict, emailOf, firstDuplicate,
  formInvoice, formRecord, itemKey, itemName, keptText, lastMonth, monthBounds, monthOk, monthState, monthTakenText, newSenderRights, opensInline,
  rateFor, ratesFor, resendWait, sniffReceipt, withMonth,
  type CheckContext, type RawSubmission,
} from './rules'
import { confirmText } from '@/lib/timeclock/contractor-invoice'

describe('the code', () => {
  const now = Date.parse('2026-11-01T12:00:00Z')
  const row = (p: Partial<{ tries: number; expires_at: string; used_at: string | null }> = {}) =>
    ({ tries: 0, expires_at: new Date(now + CODE_LIFE_MS).toISOString(), used_at: null, ...p })

  it('works for 10 minutes and no longer', () => {
    expect(codeVerdict(row(), now)).toBe('ok')
    expect(codeVerdict(row({ expires_at: new Date(now).toISOString() }), now)).toBe('expired')
    expect(codeVerdict(row({ expires_at: new Date(now - 1).toISOString() }), now)).toBe('expired')
  })

  it('takes five tries, then a new code is needed', () => {
    expect(codeVerdict(row({ tries: MAX_TRIES - 1 }), now)).toBe('ok')
    expect(codeVerdict(row({ tries: MAX_TRIES }), now)).toBe('locked')
  })

  it('is used once, and none asked is none', () => {
    expect(codeVerdict(row({ used_at: new Date(now).toISOString() }), now)).toBe('used')
    expect(codeVerdict(null, now)).toBe('none')
  })

  it('is sent again only after a minute', () => {
    expect(resendWait(null, now)).toBe(0)
    expect(resendWait(new Date(now - 20_000).toISOString(), now)).toBe(40)
    expect(resendWait(new Date(now - 60_000).toISOString(), now)).toBe(0)
  })

  // Rows of the last day, `mine` (id 0) among them, as requestCode reads them after storing its own.
  const ago = (ms: number, id: number) => ({ id, created_at: new Date(now - ms).toISOString() })
  const spread = (n: number, from: number, step: number, id0 = 100) => Array.from({ length: n }, (_, i) => ago(from + i * step, id0 + i))
  const mine = ago(0, 0)
  const lim = (e: { id: number; created_at: string }[], c: { id: number; created_at: string }[]) => codeLimit(0, e, c, now)

  it('caps the codes an hour for an email and for a network address', () => {
    expect(lim([mine, ...spread(4, 120_000, 60_000)], [mine])).toEqual({ kind: 'ok' })
    expect(lim([mine, ...spread(5, 120_000, 60_000)], [mine])).toEqual({ kind: 'hour' })
    expect(lim([mine], [mine, ...spread(CODES_PER_HOUR, 0, 60_000)])).toEqual({ kind: 'hour' })
    // Over an hour ago no longer counts for the hour.
    expect(lim([mine, ...spread(5, 3_601_000, 60_000)], [mine])).toEqual({ kind: 'ok' })
  })

  it('caps the codes a day for an email and for a network address', () => {
    const emailDay = spread(CODES_PER_DAY - 1, 3_700_000, 600_000)
    expect(lim([mine, ...emailDay], [mine])).toEqual({ kind: 'ok' })
    expect(lim([mine, ...emailDay, ago(3_650_000, 999)], [mine])).toEqual({ kind: 'day' })
    expect(lim([mine], [mine, ...spread(CODES_PER_DAY_VISITOR - 1, 3_700_000, 60_000)])).toEqual({ kind: 'ok' })
    expect(lim([mine], [mine, ...spread(CODES_PER_DAY_VISITOR, 3_700_000, 60_000)])).toEqual({ kind: 'day' })
    expect(codeLimitText({ kind: 'day' })).toBe('Too many codes in the last day. Try again later.')
    expect(codeLimitText({ kind: 'hour' })).toBe('Too many codes in the last hour. Try again later.')
  })

  it('waits a minute after the last code of the email, its own not counted', () => {
    expect(lim([mine], [mine])).toEqual({ kind: 'ok' })
    expect(lim([mine, ago(20_000, 7)], [mine])).toEqual({ kind: 'wait', seconds: 40 })
    expect(codeLimitText({ kind: 'wait', seconds: 40 })).toBe('Wait 40 seconds, then send it again.')
  })

  // requestCode stores its code, then reads, then decides (and deletes its own when refused).
  // Played in every random order, codes asked for at once never pass more than the caps.
  function race(reqs: { email: string; client: string }[], seed: number): number {
    let r = seed
    const rand = () => ((r = (r * 1103515245 + 12345) % 2 ** 31) / 2 ** 31)
    const rows = new Map<number, { email: string; client: string }>()
    const stage = reqs.map(() => 0)
    const seen: { e: { id: number; created_at: string }[]; c: { id: number; created_at: string }[] }[] = []
    let passed = 0
    while (stage.some(s => s < 2)) {
      const live = stage.flatMap((s, i) => (s < 2 ? [i] : []))
      const i = live[Math.floor(rand() * live.length)]
      if (stage[i] === 0) rows.set(i, reqs[i])
      else {
        const all = [...rows].map(([id, x]) => ({ id, x, created_at: new Date(now).toISOString() }))
        seen[i] = { e: all.filter(a => a.x.email === reqs[i].email), c: all.filter(a => a.x.client === reqs[i].client) }
        if (codeLimit(i, seen[i].e, seen[i].c, now).kind === 'ok') passed++
        else rows.delete(i)
      }
      stage[i]++
    }
    return passed
  }

  it('lets at most one of 20 codes asked at once for one email go', () => {
    const runs = Array.from({ length: 200 }, (_, s) => race(Array.from({ length: 20 }, () => ({ email: 'ana@example.com', client: 'k' })), s + 1))
    expect(Math.max(...runs)).toBe(1)
  })

  it('lets at most the hourly cap go of 20 codes asked at once from one address', () => {
    const runs = Array.from({ length: 200 }, (_, s) => race(Array.from({ length: 20 }, (_, i) => ({ email: `p${i}@example.com`, client: 'k' })), s + 1))
    expect(Math.max(...runs)).toBeLessThanOrEqual(CODES_PER_HOUR)
    expect(Math.max(...runs)).toBeGreaterThan(0)
  })

  it('reads six digits and a plain email only', () => {
    expect(codeOf(' 123 456 ')).toBe('123456')
    expect(codeOf('12345')).toBeNull()
    expect(codeOf('12a456')).toBeNull()
    expect(emailOf('  Ana@Example.COM ')).toBe('ana@example.com')
    expect(emailOf('a,b@example.com')).toBeNull()
    expect(emailOf('ana@example')).toBeNull()
    expect(emailOf('x(y)@example.com')).toBeNull()
  })
})

describe('Monday items and sending one twice', () => {
  it('compares names trimmed, one space, any case', () => {
    expect(itemName('  Homepage   FAQ,  Spanish ')).toBe('Homepage FAQ, Spanish')
    expect(itemKey('  Homepage   FAQ,  Spanish ')).toBe(itemKey('homepage faq, spanish'))
  })

  it('refuses an item sent before with the same kind, naming only the item and the day', () => {
    const sent = [{ key: itemKey('Donate banner, Spanish'), kind: 'asset' as const, sentOn: '2026-10-28' }]
    expect(firstDuplicate([{ name: 'About us', kind: 'page' }, { name: 'donate  BANNER, spanish', kind: 'asset' }], sent, '2026-11-01'))
      .toEqual({ index: 1, error: '"donate BANNER, spanish" was already sent as a design asset on Oct 28.' })
  })

  it('lets the same item go as the other kind', () => {
    const sent = [{ key: itemKey('Donate banner, Spanish'), kind: 'asset' as const, sentOn: '2026-10-28' }]
    expect(firstDuplicate([{ name: 'Donate banner, Spanish', kind: 'page' }], sent, '2026-11-01')).toBeNull()
  })

  it('refuses the same item twice on one invoice', () => {
    expect(firstDuplicate([{ name: 'About us', kind: 'page' }, { name: 'about us ', kind: 'page' }], [], '2026-11-01')?.index).toBe(1)
  })

  it('names the year when it was another year', () => {
    expect(alreadySentText('X', 'page', '2025-12-30', '2026-11-01')).toBe('"X" was already sent as a translated page on Dec 30, 2025.')
  })
})

describe('the rates', () => {
  const company = { page: 30, asset: 5 }
  it("uses a person's own rate when set, the company's otherwise", () => {
    expect(rateFor('page', company, null)).toBe(30)
    expect(rateFor('page', company, { page: 35, asset: null })).toBe(35)
    expect(rateFor('asset', company, { page: 35, asset: null })).toBe(5)
    expect(rateFor('asset', company, { page: null, asset: 0 })).toBe(5)
    expect(ratesFor(company, { page: null, asset: 6.5 })).toEqual({ page: 30, asset: 6.5 })
  })
})

describe('the month', () => {
  it('defaults to the month that just ended', () => {
    expect(lastMonth('2026-11-01')).toBe('2026-10')
    expect(lastMonth('2026-01-15')).toBe('2025-12')
  })

  it('knows its first and last day', () => {
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(monthBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })

  it('takes this month and the twelve before it', () => {
    expect(monthOk('2026-11', '2026-11-01')).toBe(true)
    expect(monthOk('2025-11', '2026-11-01')).toBe(true)
    expect(monthOk('2025-10', '2026-11-01')).toBe(false)
    expect(monthOk('2026-12', '2026-11-01')).toBe(false)
    expect(monthOk('2026-13', '2026-11-01')).toBe(false)
  })

  it('is one invoice a month: a returned one is sent again, anything else is taken', () => {
    expect(monthState([], false)).toEqual({ kind: 'free' })
    expect(monthState([{ id: 4, number: 'INV-2026-014', state: 'draft' }], false)).toEqual({ kind: 'again', invoiceId: 4, number: 'INV-2026-014' })
    for (const state of ['waiting', 'approved', 'paid']) expect(monthState([{ id: 4, number: 'INV-2026-014', state }], false)).toEqual({ kind: 'taken' })
    expect(monthState([], true)).toEqual({ kind: 'taken' })
  })

  it('says where to write when the month is taken', () => {
    expect(monthTakenText('October 2026', 'finance@example.com')).toBe('You already sent an invoice for October 2026. One invoice a month: to change it, write to Finance at finance@example.com.')
    expect(monthTakenText('October 2026', null)).toBe('You already sent an invoice for October 2026. One invoice a month: to change it, write to Finance.')
  })
})

describe('the lines and the total', () => {
  const rates = { page: 30, asset: 5 }
  it('makes one fixed line, then each reimbursement as its own line', () => {
    const r = buildFormLines({ kind: 'fixed', covers: ' Video editing, 6 episodes ', amount: 1200 }, rates, [{ category: 'Software', purpose: 'Adobe Premiere, November', amount: 22.99 }])
    expect(r.total).toBe(1222.99)
    expect(r.lines.map(l => [l.kind, l.description, l.amount, l.reimbursement])).toEqual([
      ['fixed', 'Video editing, 6 episodes', 1200, null],
      ['reimbursement', 'Adobe Premiere, November', 22.99, 0],
    ])
  })

  it('makes one line a Monday item at its rate, keyed for the duplicate rule', () => {
    const r = buildFormLines({ kind: 'deliverables', items: [{ name: 'Homepage FAQ, Spanish', kind: 'page' }, { name: 'About us, Spanish', kind: 'page' }, { name: 'Volunteer flyer, Spanish', kind: 'asset' }] }, rates)
    expect(r.total).toBe(65)
    expect(r.lines[2]).toMatchObject({ kind: 'deliverable', description: 'Volunteer flyer, Spanish (design asset)', rate: 5, amount: 5, deliverableKind: 'asset', deliverableKey: 'volunteer flyer, spanish', sort: 2 })
  })

  it('adds in cents, so the total never drifts', () => {
    const r = buildFormLines({ kind: 'deliverables', items: Array.from({ length: 10 }, (_, i) => ({ name: `Item ${i}`, kind: 'page' as const })) }, { page: 0.1, asset: 5 })
    expect(r.total).toBe(1)
  })
})

describe('everything a sender types', () => {
  const ctx: CheckContext = { today: '2026-11-01', clients: ['2 - i7 Marketing'], mileageRate: 0.76, files: new Set([0]), countryOk: c => c === 'US', ownPdf: false }
  const base: RawSubmission = {
    month: '2026-10', kind: 'fixed', covers: 'Video editing', amount: '1,200.00',
    sender: { name: 'John Huyn', line1: '123 Example St', city: 'Springfield', state: 'IL', zip: '62701', country: 'us' },
    madeBy: 'builder', confirmed: true,
  }

  it('takes a good fixed invoice, the amount read as typed', () => {
    const r = checkSubmission(base, ctx)
    expect(r.ok && r.value.work).toEqual({ kind: 'fixed', covers: 'Video editing', amount: 1200 })
    expect(r.ok && r.value.sender.country).toBe('US')
  })

  it('refuses a month outside the window, a missing kind, an address or country missing', () => {
    expect(checkSubmission({ ...base, month: '2024-01' }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, kind: 'hourly' }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, sender: { ...base.sender, line1: '' } }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, sender: { ...base.sender, country: 'ZZ' } }, ctx).ok).toBe(false)
  })

  it('refuses an amount of 0 or one over the cap', () => {
    expect(checkSubmission({ ...base, amount: '0' }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, amount: '100001' }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, amount: 'abc' }, ctx).ok).toBe(false)
  })

  it('needs at least one line of a known kind for deliverables', () => {
    expect(checkSubmission({ ...base, kind: 'deliverables', items: [] }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, kind: 'deliverables', items: [{ name: 'About us', kind: 'video' }] }, ctx).ok).toBe(false)
    const r = checkSubmission({ ...base, kind: 'deliverables', items: [{ name: '  About  us ', kind: 'page' }] }, ctx)
    expect(r.ok && r.value.work).toEqual({ kind: 'deliverables', items: [{ name: 'About us', kind: 'page' }] })
  })

  it('checks a reimbursement as New reimbursement does', () => {
    const rmb = { category: 'Software', date: '2026-10-03', amount: '22.99', purpose: 'Adobe Premiere', file: 0, client: 'None' }
    const ok = checkSubmission({ ...base, reimbursements: [rmb] }, ctx)
    expect(ok.ok && ok.value.reimbursements[0]).toMatchObject({ category: 'Software', amount: 22.99, currency: 'USD', client: null, billable: false, file: 0 })
    // A receipt is needed, but for mileage.
    expect(checkSubmission({ ...base, reimbursements: [{ ...rmb, file: null }] }, ctx).ok).toBe(false)
    // In dollars only, never after today, a client from the list.
    expect(checkSubmission({ ...base, reimbursements: [{ ...rmb, currency: 'KES' }] }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, reimbursements: [{ ...rmb, date: '2026-11-02' }] }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, reimbursements: [{ ...rmb, client: 'Someone else' }] }, ctx).ok).toBe(false)
    // A file that was not sent, or one used twice.
    expect(checkSubmission({ ...base, reimbursements: [{ ...rmb, file: 3 }] }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...base, reimbursements: [rmb, rmb] }, ctx).ok).toBe(false)
  })

  it('works out mileage from the company rate, with no receipt, and sends a meal over $25 for review with its reason', () => {
    const r = checkSubmission({ ...base, reimbursements: [{ category: 'Mileage', date: '2026-10-03', miles: '120', purpose: 'Client visit' }] }, ctx)
    expect(r.ok && r.value.reimbursements[0]).toMatchObject({ amount: 91.2, miles: 120, mileageRate: 0.76, file: null, purpose: 'Client visit (120 mi at $0.76 a mile)' })
    // Owner, 5 November 2026: over the $25 it goes through when the description says why; one word is not enough.
    expect(checkSubmission({ ...base, reimbursements: [{ category: 'Meals while travelling', date: '2026-10-03', amount: '30', purpose: 'Dinner', file: 0 }] }, ctx).ok).toBe(false)
    const meal = checkSubmission({ ...base, reimbursements: [{ category: 'Meals while travelling', date: '2026-10-03', amount: '30', purpose: 'Dinner at the hotel, the only place open', file: 0 }] }, ctx)
    expect(meal.ok && meal.value.reimbursements[0]).toMatchObject({ amount: 30, category: 'Meals while travelling' })
  })

  it('keeps billable only with a client', () => {
    const r = checkSubmission({ ...base, reimbursements: [{ category: 'Software', date: '2026-10-03', amount: '5', purpose: 'x', file: 0, client: '2 - i7 Marketing', billable: 'yes' }] }, ctx)
    expect(r.ok && r.value.reimbursements[0].billable).toBe(true)
    const n = checkSubmission({ ...base, reimbursements: [{ category: 'Software', date: '2026-10-03', amount: '5', purpose: 'x', file: 0, client: 'None', billable: 'yes' }] }, ctx)
    expect(n.ok && n.value.reimbursements[0].billable).toBe(false)
  })
})

describe('their own invoice (leadership, 4 November 2026)', () => {
  const ctx: CheckContext = { today: '2026-11-04', clients: [], mileageRate: 0.76, files: new Set([0]), countryOk: c => c === 'US', ownPdf: true }
  const sender = { name: 'John Huyn', line1: '123 Example St', city: 'Springfield', state: 'IL', zip: '62701', country: 'US' }
  const own: RawSubmission = { month: '2026-10', kind: 'fixed', covers: 'Video editing', madeBy: 'own_file', theirNumber: ' JH-0042 ', statedTotal: '$1,250.00', confirmed: true, sender }
  const rates = { page: 30, asset: 5 }
  const rmb = { category: 'Software', date: '2026-10-03', amount: '50', purpose: 'Adobe Premiere', file: 0, client: 'None' }

  it('needs a way chosen and the box ticked, for both ways', () => {
    expect(checkSubmission({ ...own, madeBy: undefined }, ctx)).toMatchObject({ ok: false })
    expect(checkSubmission({ ...own, madeBy: 'portal' }, ctx)).toMatchObject({ ok: false })
    expect(checkSubmission({ ...own, confirmed: false }, ctx)).toEqual({ ok: false, error: 'Tick the box to confirm this is your invoice.' })
    // Only true counts: never a sentence or "yes" from the page.
    expect(checkSubmission({ ...own, confirmed: 'This is my invoice.' }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...own, madeBy: 'builder', amount: '100', confirmed: undefined }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...own, madeBy: 'builder', amount: '100' }, ctx).ok).toBe(true)
  })

  it('needs their PDF and the total on it', () => {
    expect(checkSubmission(own, { ...ctx, ownPdf: false })).toEqual({ ok: false, error: 'Add your invoice: a PDF of up to 10 MB.' })
    expect(checkSubmission({ ...own, statedTotal: '' }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...own, statedTotal: '0' }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...own, statedTotal: '200001' }, ctx).ok).toBe(false)
    expect(checkSubmission({ ...own, covers: '' }, ctx)).toEqual({ ok: false, error: 'Say what your invoice covers.' })
  })

  it('keeps their number (optional) and total, and needs no amount of its own', () => {
    const r = checkSubmission({ ...own, amount: undefined }, ctx)
    expect(r.ok && r.value.madeBy).toBe('own_file')
    expect(r.ok && r.value.own).toEqual({ theirNumber: 'JH-0042', statedTotal: 1250 })
    const n = checkSubmission({ ...own, theirNumber: '  ' }, ctx)
    expect(n.ok && n.value.own?.theirNumber).toBeNull()
  })

  it('makes the total the one on their invoice, reimbursements included', () => {
    const r = checkSubmission({ ...own, reimbursements: [rmb] }, ctx)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.work).toEqual({ kind: 'fixed', covers: 'Video editing', amount: 1200 })
    expect(formInvoice(r.value, rates).total).toBe(1250)
    // Never less than the reimbursements on it.
    expect(checkSubmission({ ...own, statedTotal: '50', reimbursements: [rmb] }, ctx).ok).toBe(false)
  })

  it('needs the total on their invoice to be more than the reimbursements, for deliverables too', () => {
    const items = [{ name: 'About us', kind: 'page' }]
    const error = 'The total on your invoice must be more than the reimbursements on it.'
    expect(checkSubmission({ ...own, kind: 'deliverables', items, statedTotal: '50', reimbursements: [rmb] }, ctx)).toEqual({ ok: false, error })
    expect(checkSubmission({ ...own, kind: 'deliverables', items, statedTotal: '40', reimbursements: [rmb] }, ctx)).toEqual({ ok: false, error })
    const r = checkSubmission({ ...own, kind: 'deliverables', items, statedTotal: '80', reimbursements: [rmb] }, ctx)
    if (!r.ok) throw new Error(r.error)
    expect(formInvoice(r.value, rates).total).toBe(80)
  })

  it('keeps the Monday items at the rates for deliverables, the total theirs', () => {
    const r = checkSubmission({ ...own, kind: 'deliverables', items: [{ name: 'About us', kind: 'page' }, { name: 'Flyer', kind: 'asset' }], statedTotal: '40' }, ctx)
    if (!r.ok) throw new Error(r.error)
    const inv = formInvoice(r.value, rates)
    expect(inv.lines.map(l => l.amount)).toEqual([30, 5])
    expect(inv.total).toBe(40)
  })

  it('fills in here as before: the total adds the lines up', () => {
    const r = checkSubmission({ ...own, madeBy: 'builder', amount: '1,200', statedTotal: '9999', reimbursements: [rmb] }, ctx)
    if (!r.ok) throw new Error(r.error)
    expect(r.value.own).toBeNull()
    expect(formInvoice(r.value, rates).total).toBe(1250)
  })

  it('records the send: own file with their file and no lines; built here with its lines', () => {
    const o = checkSubmission(own, ctx)
    if (!o.ok) throw new Error(o.error)
    const pdf = { path: 'p/1.pdf', name: 'JH-0042.pdf' }
    const confirmed = confirmText('own_file', 'October 2026')
    expect(formRecord(o.value, { rates, sentBy: 'p1', email: 'jh@example.com', confirmed, ownPdf: pdf })).toEqual({
      madeBy: 'own_file', sentFrom: 'form', sentBy: 'p1', sentEmail: 'jh@example.com', confirmed, theirNumber: 'JH-0042', statedHours: null,
      statedTotal: 1250, covers: 'Video editing', ownPdf: pdf, lines: [], total: 1250,
    })
    const b = checkSubmission({ ...own, madeBy: 'builder', amount: '1,200', reimbursements: [rmb] }, ctx)
    if (!b.ok) throw new Error(b.error)
    const rec = formRecord(b.value, { rates, sentBy: null, email: 'jh@example.com', confirmed: confirmText('builder', 'October 2026'), ownPdf: pdf })
    expect(rec).toMatchObject({ madeBy: 'builder', sentBy: null, theirNumber: null, statedTotal: null, ownPdf: null, total: 1250 })
    expect(rec.lines).toEqual([
      { description: 'Video editing', client: null, hours: null, rate: null, amount: 1200 },
      { description: 'Reimbursement: Software, Adobe Premiere', client: null, hours: null, rate: null, amount: 50 },
    ])
  })

  it('shows the page the same sentence the server keeps', () => {
    for (const m of ['own_file', 'builder'] as const) expect(withMonth(confirmText(m, MONTH_SLOT), 'October 2026')).toBe(confirmText(m, 'October 2026'))
    expect(confirmText('own_file', 'October 2026')).toBe('This is my invoice. I made it and I am sending it to True North for October 2026.')
  })

  it('tells them it is kept as they sent it, with the day and time', () => {
    expect(keptText('own_file', '2026-11-04T20:12:00Z', 'America/New_York')).toBe('We keep your file as you sent it, with a note that you sent it on Nov 4, 2026 at 3:12 PM.')
    expect(keptText('builder', '2026-11-04T20:12:00Z', 'UTC')).toBe('We keep it as you sent it, with a note that you wrote it here and sent it on Nov 4, 2026 at 8:12 PM.')
  })
})

describe('how it came in, and who links a new sender', () => {
  it('says where an invoice came from', () => {
    expect(cameFrom('form_fixed', 0)).toBe('The invoice form, fixed amount')
    expect(cameFrom('form_deliverables', 1)).toBe('The invoice form, deliverables, 1 line')
    expect(cameFrom('form_deliverables', 3)).toBe('The invoice form, deliverables, 3 lines')
    expect(cameFrom(null, 0)).toBeNull()
  })

  it('shows a waiting sender only to who sees everyone\'s money, and lets those of them with ck-inv-link or the default approver link (5 November 2026)', () => {
    const s = { defaultApprover: 'david', finance: ['tina'] }
    const KEYS: Record<string, string[]> = {
      super_admin: ['clocky-invoices', 'ck-money', 'ck-inv-link'],
      admin: ['clocky-invoices', 'ck-inv-link'],
      team_leader: ['clocky-invoices'],
      user: ['clocky-invoices'],
    }
    const a = (personId: string, level: string) => ({ personId, can: (k: string) => KEYS[level].includes(k) })
    expect(newSenderRights(a('arnaldo', 'super_admin'), s)).toEqual({ see: true, link: true })
    // An Admin who is not Finance: no amounts, so no list and no link.
    expect(newSenderRights(a('boss', 'admin'), s)).toEqual({ see: false, link: false })
    expect(newSenderRights(a('tina', 'user'), s)).toEqual({ see: true, link: false })
    expect(newSenderRights(a('lead', 'team_leader'), s)).toEqual({ see: false, link: false })
    // The default approver who is not a Super Admin or Finance sees no amounts.
    expect(newSenderRights(a('david', 'admin'), s)).toEqual({ see: false, link: false })
    expect(newSenderRights({ ...a('arnaldo', 'super_admin'), can: () => false }, s)).toEqual({ see: false, link: false })
  })
})

describe('the receipt files (audit, 5 November 2026)', () => {
  const bytes = (...parts: (string | number[])[]) => {
    const out: number[] = []
    for (const p of parts) out.push(...(typeof p === 'string' ? p.split('').map(c => c.charCodeAt(0)) : p))
    while (out.length < 16) out.push(0)
    return new Uint8Array(out)
  }

  it('tells a photo or a PDF by its first bytes', () => {
    expect(sniffReceipt(bytes('%PDF-1.7'))).toBe('application/pdf')
    expect(sniffReceipt(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffReceipt(bytes([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffReceipt(bytes('RIFF', [1, 2, 3, 4], 'WEBPVP8 '))).toBe('image/webp')
    expect(sniffReceipt(bytes([0, 0, 0, 0x18], 'ftypheic'))).toBe('image/heic')
    expect(sniffReceipt(bytes([0, 0, 0, 0x18], 'ftypmif1'))).toBe('image/heif')
  })

  it('refuses anything else, whatever the browser called it', () => {
    expect(sniffReceipt(bytes('<html><script>'))).toBeNull()
    expect(sniffReceipt(bytes('<svg xmlns="'))).toBeNull()
    expect(sniffReceipt(bytes([0x89, 0x50, 0x4e, 0x47]))).toBeNull()
    expect(sniffReceipt(bytes('RIFF', [1, 2, 3, 4], 'WAVE'))).toBeNull()
    expect(sniffReceipt(bytes([0, 0, 0, 0x18], 'ftypisom'))).toBeNull()
    expect(sniffReceipt(new Uint8Array())).toBeNull()
  })

  it('opens only photos and PDFs in the browser', () => {
    for (const t of ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'IMAGE/PNG; x=1']) expect(opensInline(t)).toBe(true)
    for (const t of ['text/html', 'image/svg+xml', 'application/octet-stream', '', null, 'toString']) expect(opensInline(t)).toBe(false)
  })
})
