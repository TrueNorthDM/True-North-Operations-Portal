import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb, type Before } from '@/lib/timeclock/reimbursement-fake-db.test-util'

// The two reimbursement routes (audit, 5 November 2026): an edit that fails part way removes only the new
// files no row took, and a request decided while new receipts join it leaves them a request of their own.

let fake = fakeDb({})
const dropped: string[][] = []
let uploads = 0

vi.mock('@/lib/auth/view-as-server', () => ({ getViewAs: async () => null }))
vi.mock('@/lib/timeclock/north-time-lock', () => ({ closedRefusal: async () => null }))
vi.mock('@/lib/access/resolve', () => ({ writerAccess: async () => ({ can: () => true }) }))
vi.mock('@/lib/timeclock/clocky-context', () => ({
  viewerFor: async () => ({ personId: 'ana', zone: 'America/New_York' }),
  allRows: async (page: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) => {
    const { data, error } = await page(0, 999)
    if (error) throw new Error(error.message)
    return data ?? []
  },
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.client }))
vi.mock('@/lib/timeclock/clocky-notify', () => ({ announceReimbursementChanged: vi.fn(), announceReimbursementReportRequested: vi.fn(), announceReimbursementRequested: vi.fn() }))
vi.mock('@/lib/timeclock/reimbursement-store', async () => {
  const actual = await vi.importActual<typeof import('@/lib/timeclock/reimbursement-store')>('@/lib/timeclock/reimbursement-store')
  return {
    ...actual,
    itemRules: async () => ({ clients: [], contractor: false, mileageRate: 0.76, today: '2026-11-05' }),
    storeReceipt: async () => `ana/new-${++uploads}.pdf`,
    dropReceipts: async (paths: (string | null)[]) => { dropped.push(paths.filter((p): p is string => !!p)) },
    nextReceiptNumber: async () => `RCT-2026-0${uploads}`,
    logRmbChanges: vi.fn(),
    rmbDeciderNames: async () => 'David Sharpe',
  }
})

const { POST: edit } = await import('./edit/route')
const { POST: create } = await import('./new/route')

const pdf = (name: string) => new File(['%PDF-1.4'], name, { type: 'application/pdf' })
const receipt = (id: number, extra: Record<string, unknown> = {}) => ({
  id, person_id: 'ana', report_id: 7, state: 'pending', spent_on: '2026-10-30', category: 'Software', amount: 45, currency: 'USD', purpose: 'Figma',
  client: null, billable: false, miles: null, mileage_rate: null, receipt_path: `ana/old-${id}.pdf`, receipt_name: `old-${id}.pdf`, receipt_number: `RCT-2026-00${id}`, ...extra,
})
const line = (f: FormData, i: number, x: { rid?: number; file?: File; keep?: boolean; purpose?: string }) => {
  f.set(`rid_${i}`, x.rid ? String(x.rid) : '')
  if (x.keep) f.set(`keep_${i}`, 'yes')
  if (x.file) f.set(`receipt_${i}`, x.file)
  f.set(`category_${i}`, 'Software'); f.set(`date_${i}`, '2026-10-30'); f.set(`amount_${i}`, '45.00'); f.set(`currency_${i}`, 'USD')
  f.set(`purpose_${i}`, x.purpose ?? 'Figma'); f.set(`client_${i}`, 'None')
}
const post = (form: FormData) => ({ formData: async () => form }) as unknown as Request
/** Fails the n-th write (update, insert or delete) to reimbursements. */
const failWrite = (n: number): Before => {
  let seen = 0
  return q => { if (q.table === 'reimbursements' && q.op !== 'select' && ++seen === n) return { message: 'boom' } }
}

beforeEach(() => { dropped.length = 0; uploads = 0 })

describe('edit/route.ts: a failure part way', () => {
  it('removes only the new files no row took, and the old files of rows already changed', async () => {
    fake = fakeDb({ reimbursements: [receipt(1), receipt(2)], reimbursement_reports: [{ id: 7, person_id: 'ana', name: 'ASI' }] }, failWrite(2))
    const form = new FormData()
    form.set('target', 'report:7'); form.set('name', 'ASI'); form.set('count', '2')
    line(form, 0, { rid: 1, file: pdf('a.pdf') })
    line(form, 1, { rid: 2, file: pdf('b.pdf') })
    const res = await edit(post(form))
    expect(res.status).toBe(500)
    // Receipt 1 took new-1 and keeps it; new-2 was never written into a row; old-1 is used by nothing now.
    expect(fake.db.reimbursements[0].receipt_path).toBe('ana/new-1.pdf')
    expect(dropped.flat().sort()).toEqual(['ana/new-2.pdf', 'ana/old-1.pdf'])
  })

  it('never takes the file of a receipt added before the failure', async () => {
    // Write 1: receipt 1 changed; write 2: the new receipt added; write 3 (removing receipt 2) fails.
    fake = fakeDb({ reimbursements: [receipt(1), receipt(2)], reimbursement_reports: [{ id: 7, person_id: 'ana', name: 'ASI' }] }, failWrite(3))
    const form = new FormData()
    form.set('target', 'report:7'); form.set('name', 'ASI'); form.set('count', '2')
    line(form, 0, { rid: 1, keep: true, purpose: 'Figma, two seats' })
    line(form, 1, { file: pdf('c.pdf') })
    const res = await edit(post(form))
    expect(res.status).toBe(500)
    const added = fake.db.reimbursements.find(r => r.receipt_path === 'ana/new-1.pdf')
    expect(added).toBeTruthy()
    expect(dropped.flat()).not.toContain('ana/new-1.pdf')
  })

  it('saves as before when nothing fails', async () => {
    fake = fakeDb({ reimbursements: [receipt(1)], reimbursement_reports: [{ id: 7, person_id: 'ana', name: 'ASI' }] })
    const form = new FormData()
    form.set('target', 'report:7'); form.set('name', 'ASI'); form.set('count', '1')
    line(form, 0, { rid: 1, file: pdf('a.pdf') })
    const res = await edit(post(form))
    expect(res.status).toBe(200)
    expect(dropped.flat()).toEqual(['ana/old-1.pdf'])
  })
})

describe('new/route.ts: joining a waiting request for the same event', () => {
  const one = () => {
    const f = new FormData()
    f.set('name', 'ASI'); f.set('count', '1')
    line(f, 0, { file: pdf('taxi.pdf'), purpose: 'Taxi' })
    return f
  }

  it('joins it while every receipt still waits', async () => {
    fake = fakeDb({ reimbursements: [receipt(1)], reimbursement_reports: [{ id: 7, person_id: 'ana', name: 'ASI' }] })
    const res = await create(post(one()))
    expect(((await res.json()) as { toast: string }).toast).toMatch(/^Added to your waiting request "ASI"/)
    expect(fake.db.reimbursements.find(r => r.purpose === 'Taxi')?.report_id).toBe(7)
  })

  it('makes them their own request when it was decided while they joined', async () => {
    // Decided between the read and the insert: receipt 1 is approved as the new one goes in.
    let done = false
    fake = fakeDb({ reimbursements: [receipt(1)], reimbursement_reports: [{ id: 7, person_id: 'ana', name: 'ASI' }] }, (q, db) => {
      if (!done && q.table === 'reimbursements' && q.op === 'insert') { done = true; db.reimbursements[0].state = 'approved' }
    })
    const res = await create(post(one()))
    expect(((await res.json()) as { toast: string }).toast).toMatch(/^Sent\./)
    const taxi = fake.db.reimbursements.find(r => r.purpose === 'Taxi')!
    expect(taxi.report_id).not.toBe(7)
    expect(fake.db.reimbursement_reports.find(r => r.id === taxi.report_id)).toMatchObject({ person_id: 'ana', name: 'ASI' })
  })
})
