import { describe, expect, it } from 'vitest'
import { arrangeReimbursements } from './requests-data'

describe('the reimbursements list', () => {
  it('keeps a request\'s receipts together, where its latest one falls, oldest first inside it', () => {
    const rows = [
      { id: 1, spent_on: '2026-10-31', report_id: null },
      { id: 11, spent_on: '2026-10-12', report_id: 7 },
      { id: 12, spent_on: '2026-10-15', report_id: 7 },
      { id: 2, spent_on: '2026-10-14', report_id: null },
      { id: 13, spent_on: '2026-10-13', report_id: 7 },
      { id: 3, spent_on: '2026-09-27', report_id: null },
    ]
    expect(arrangeReimbursements(rows).map(r => r.id)).toEqual([1, 11, 13, 12, 2, 3])
  })
})
