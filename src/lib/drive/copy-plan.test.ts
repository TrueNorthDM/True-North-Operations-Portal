import { describe, expect, it } from 'vitest'
import {
  afterFailure, backoffMs, copyCounts, driveShow, folderPath, folderText, historyLines, MAX_ATTEMPTS, needsCopy, planCopies,
  wantInvoice, wantReceipt, wantRmb, type CopyRow, type Want,
} from './copy-plan'
import { docNumber } from '@/lib/timeclock/doc-number'

const FROM = '2026-11-01'
const NOW = Date.parse('2026-11-10T15:00:00Z')

const row = (x: Partial<CopyRow>): CopyRow => ({
  id: 1, kind: 'invoice', ref_id: 10, version_key: null, pending_key: null, state: 'waiting', drive_file_id: null, web_link: null,
  file_name: null, folder_path: null, attempts: 0, last_error: null, next_at: '2026-11-10T14:00:00Z', claimed_at: null, history: [],
  copied_at: null, updated_at: '2026-11-10T14:00:00Z', ...x,
})

describe('the folders', () => {
  it('are made inside the picked folder, one set for each kind, no folder per person', () => {
    expect(folderPath('invoice', 'Finance')).toEqual(['Docs from the Portal', 'Invoices'])
    expect(folderPath('receipt', 'Finance')).toEqual(['Docs from the Portal', 'Reimbursement Requests', 'Receipts'])
    expect(folderPath('rmb', 'Finance')).toEqual(['Docs from the Portal', 'Reimbursement Requests', 'RMB'])
    expect(folderText('rmb')).toBe('Docs from the Portal / Reimbursement Requests / RMB')
  })

  it('do not nest a second "Docs from the Portal" when that is the folder picked', () => {
    expect(folderPath('invoice', 'Docs from the Portal')).toEqual(['Invoices'])
    expect(folderPath('receipt', ' docs from the portal ')).toEqual(['Reimbursement Requests', 'Receipts'])
  })
})

describe('what should be in Drive', () => {
  it('an invoice once approved, from Nov 1 (New York days); a new version when paid', () => {
    expect(wantInvoice({ id: 1, state: 'waiting', approved_at: null, paid_on: null }, FROM)).toBe('after')
    expect(wantInvoice({ id: 1, state: 'draft', approved_at: '2026-11-03T10:00:00Z', paid_on: null }, FROM)).toBe('after')
    // 11:30 PM in New York on Oct 31 is Nov 1 in UTC: still before.
    expect(wantInvoice({ id: 1, state: 'approved', approved_at: '2026-11-01T03:30:00Z', paid_on: null }, FROM)).toBe('before')
    expect(wantInvoice({ id: 1, state: 'approved', approved_at: '2026-11-03T10:00:00Z', paid_on: null }, FROM)).toEqual({ kind: 'invoice', refId: 1, key: 'approved:2026-11-03T10:00:00Z', at: '2026-11-03T10:00:00Z' })
    expect(wantInvoice({ id: 1, state: 'paid', approved_at: '2026-11-03T10:00:00Z', paid_on: '2026-11-12' }, FROM)).toMatchObject({ key: 'paid:2026-11-12' })
  })

  it('a receipt once its reimbursement is approved, whoever asked; none without a receipt', () => {
    expect(wantReceipt({ id: 5, state: 'pending', decided_at: null, receipt_path: 'p/a.jpg' }, FROM)).toBe('after')
    expect(wantReceipt({ id: 5, state: 'denied', decided_at: '2026-11-03T10:00:00Z', receipt_path: 'p/a.jpg' }, FROM)).toBe('after')
    expect(wantReceipt({ id: 5, state: 'on_invoice', decided_at: '2026-11-03T10:00:00Z', receipt_path: 'p/a.jpg' }, FROM)).toMatchObject({ kind: 'receipt', key: 'approved' })
    expect(wantReceipt({ id: 5, state: 'approved', decided_at: '2026-11-03T10:00:00Z', receipt_path: null }, FROM)).toBeNull()
  })

  it('an RMB document when made, a new version when an item is added and when paid', () => {
    expect(wantRmb({ id: 3, state: 'approved', created_at: '2026-10-20T10:00:00Z', paid_on: null, total: 10 }, FROM)).toBe('before')
    expect(wantRmb({ id: 3, state: 'approved', created_at: '2026-11-02T10:00:00Z', paid_on: null, total: '57.9' }, FROM)).toMatchObject({ key: 'made:57.90' })
    expect(wantRmb({ id: 3, state: 'paid', created_at: '2026-11-02T10:00:00Z', paid_on: '2026-11-09', total: 57.9 }, FROM)).toMatchObject({ key: 'paid:2026-11-09' })
  })
})

describe('what a pass copies', () => {
  const w = (refId: number, key: string, at: string): Want => ({ kind: 'invoice', refId, key, at })

  it('copies what is missing and what changed, never what is in Drive already', () => {
    expect(needsCopy(w(10, 'approved:x', ''), undefined, NOW)).toBe(true)
    expect(needsCopy(w(10, 'approved:x', ''), row({ state: 'done', version_key: 'approved:x' }), NOW)).toBe(false)
    // Paid after approved: a new version of the same file.
    expect(needsCopy(w(10, 'paid:2026-11-12', ''), row({ state: 'done', version_key: 'approved:x' }), NOW)).toBe(true)
  })

  it('waits while another pass writes it, and after a failed try until its time comes', () => {
    expect(needsCopy(w(10, 'k', ''), row({ claimed_at: new Date(NOW - 60_000).toISOString() }), NOW)).toBe(false)
    expect(needsCopy(w(10, 'k', ''), row({ claimed_at: new Date(NOW - 11 * 60_000).toISOString() }), NOW)).toBe(true)
    expect(needsCopy(w(10, 'k', ''), row({ pending_key: 'k', attempts: 1, next_at: new Date(NOW + 60_000).toISOString() }), NOW)).toBe(false)
    expect(needsCopy(w(10, 'k', ''), row({ pending_key: 'k', attempts: 1, next_at: new Date(NOW - 1).toISOString() }), NOW)).toBe(true)
  })

  it('leaves a failed copy for Try again, but tries a newer version afresh', () => {
    expect(needsCopy(w(10, 'k', ''), row({ state: 'failed', pending_key: 'k' }), NOW)).toBe(false)
    expect(needsCopy(w(10, 'paid:1', ''), row({ state: 'failed', pending_key: 'k' }), NOW)).toBe(true)
  })

  it('takes the oldest first, a few at a time', () => {
    const wants = [w(3, 'a', '2026-11-05'), w(1, 'a', '2026-11-02'), w(2, 'a', '2026-11-03'), w(4, 'a', '2026-11-04')]
    const rows = [row({ ref_id: 2, state: 'done', version_key: 'a' })]
    expect(planCopies(wants, rows, NOW, 2).map(x => x.refId)).toEqual([1, 4])
  })

  it('waits longer after each failed try, and fails for good after the fifth', () => {
    expect(backoffMs(1)).toBe(5 * 60_000)
    expect(backoffMs(3)).toBe(20 * 60_000)
    expect(backoffMs(20)).toBe(6 * 3_600_000)
    expect(afterFailure(1, NOW)).toEqual({ state: 'waiting', next_at: new Date(NOW + 5 * 60_000).toISOString() })
    expect(afterFailure(MAX_ATTEMPTS, NOW).state).toBe('failed')
  })
})

describe('the Drive cell and box', () => {
  const want = wantInvoice({ id: 10, state: 'paid', approved_at: '2026-11-03T10:00:00Z', paid_on: '2026-11-12' }, FROM)

  it('says where each item is', () => {
    expect(driveShow('after', undefined).state).toBe('after')
    expect(driveShow('before', undefined).state).toBe('before')
    expect(driveShow(want, undefined)).toMatchObject({ state: 'waiting', updating: false })
    expect(driveShow(want, row({ state: 'done', version_key: 'paid:2026-11-12', web_link: 'L' }))).toMatchObject({ state: 'done', link: 'L' })
    expect(driveShow(want, row({ state: 'done', version_key: 'approved:x', web_link: 'L' }))).toMatchObject({ state: 'waiting', updating: true, link: 'L' })
    expect(driveShow(want, row({ id: 7, state: 'failed', pending_key: 'paid:2026-11-12', last_error: 'Drive answered 500' }))).toMatchObject({ state: 'failed', copyId: 7, error: 'Drive answered 500' })
  })

  it('counts them', () => {
    const shows = [driveShow(want, undefined), driveShow(want, row({ state: 'done', version_key: 'paid:2026-11-12' })), driveShow(want, row({ state: 'failed', pending_key: 'paid:2026-11-12' }))]
    expect(copyCounts(shows)).toEqual({ done: 1, waiting: 1, failed: 1 })
  })

  it('writes the history: copied when approved, updated when paid', () => {
    const h = [{ key: 'approved:2026-11-03T10:00:00Z', at: '2026-11-03T10:05:00Z' }, { key: 'paid:2026-11-12', at: '2026-11-12T16:00:00Z' }]
    expect(historyLines(h, 'America/New_York')).toEqual([
      { text: 'Copied when approved', when: 'Nov 3, 2026, 5:05 AM' },
      { text: 'Updated when paid', when: 'Nov 12, 2026, 11:00 AM' },
    ])
    expect(historyLines([{ key: 'made:10.00', at: '2026-11-03T10:05:00Z' }, { key: 'made:20.00', at: '2026-11-04T10:05:00Z' }], 'UTC').map(x => x.text)).toEqual(['Copied when made', 'Updated when an item was added'])
    expect(historyLines('nonsense', 'UTC')).toEqual([])
  })
})

describe('receipt numbers', () => {
  it('read like the invoice and RMB numbers: prefix, New York year, a count of three digits or more', () => {
    expect(docNumber('RCT', 2026, 5)).toBe('RCT-2026-005')
    expect(docNumber('RCT', 2027, 1234)).toBe('RCT-2027-1234')
  })
})
