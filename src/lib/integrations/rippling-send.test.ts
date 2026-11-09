import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeDb } from '@/lib/timeclock/reimbursement-fake-db.test-util'

const api = vi.hoisted(() => ({
  createLeave: vi.fn(), cancelLeave: vi.fn(), createHours: vi.fn(), updateHours: vi.fn(), deleteHours: vi.fn(),
  listLeaveTypes: vi.fn(), listWorkers: vi.fn(), companyName: vi.fn(),
}))
vi.mock('./rippling', async () => ({ ...(await vi.importActual<object>('./rippling')), ...api }))
vi.mock('@/lib/timeclock/waves-data', () => ({ loadStartDates: async () => new Map([['ana', '2026-11-08'], ['bo', '2026-11-22']]) }))
vi.mock('@/lib/timeclock/pay-terms', () => ({ loadRoutes: async () => new Map([['ana', { isContractor: false }], ['bo', { isContractor: false }], ['cy', { isContractor: true }]]) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => { throw new Error('use the fake') } }))

import { matchPeople, sendRipplingJob, type OutJob } from './rippling-send'
import { RipplingError } from './rippling'

let ids = 0
beforeEach(() => {
  for (const f of Object.values(api)) f.mockReset()
  ids = 0
  api.listLeaveTypes.mockResolvedValue([{ id: 't-vac', name: 'Vacation' }, { id: 't-sick', name: 'Sick Leave' }, { id: 't-unp', name: 'Unpaid Time Off' }])
  api.createLeave.mockImplementation(async () => `L${++ids}`)
  api.createHours.mockImplementation(async () => `H${++ids}`)
})

const job = (kind: string, ref_table: string, ref_id: number, payload: Record<string, unknown>): OutJob => ({ id: 1, kind, ref_table, ref_id, payload, attempts: 0 })

describe('time off to Rippling (owner, 9 November 2026)', () => {
  const db = () => fakeDb({
    people: [{ id: 'ana', rippling_worker_id: 'w-ana' }, { id: 'bo', rippling_worker_id: null }],
    tc_absence_requests: [{ id: 7, person_id: 'ana', state: 'approved', hours_per_day: 8, rippling_request_ids: null }],
  })
  const pto = job('rippling_pto', 'tc_absence_requests', 7, { kind: 'Vacation', days: ['2026-11-10', '2026-11-11'], who: 'Ana' })

  it('sends one approved leave a day, keeps the ids and marks it sent', async () => {
    const f = db()
    await sendRipplingJob(pto, 'tok', f.client as never)
    expect(api.createLeave).toHaveBeenCalledTimes(2)
    expect(api.createLeave.mock.calls[0][1]).toMatchObject({ workerId: 'w-ana', typeId: 't-vac', day: '2026-11-10', hours: null })
    expect(f.db.tc_absence_requests[0]).toMatchObject({ rippling_request_ids: ['2026-11-10:L1', '2026-11-11:L2'], rippling_state: 'sent' })
  })
  it('never sends a day twice when it is tried again after a failure', async () => {
    const f = db()
    api.createLeave.mockResolvedValueOnce('L1').mockRejectedValueOnce(new RipplingError('busy', 503, false))
    await expect(sendRipplingJob(pto, 'tok', f.client as never)).rejects.toThrow('busy')
    expect(f.db.tc_absence_requests[0].rippling_request_ids).toEqual(['2026-11-10:L1'])
    api.createLeave.mockResolvedValueOnce('L9')
    await sendRipplingJob(pto, 'tok', f.client as never)
    expect(api.createLeave).toHaveBeenCalledTimes(3)
    expect(f.db.tc_absence_requests[0].rippling_request_ids).toEqual(['2026-11-10:L1', '2026-11-11:L9'])
  })
  it('refuses, for good, a kind Rippling does not have, and a person not matched', async () => {
    await expect(sendRipplingJob({ ...pto, payload: { ...pto.payload, kind: 'Jury duty' } }, 'tok', db().client as never)).rejects.toMatchObject({ final: true })
    const f = db()
    f.db.tc_absence_requests[0].person_id = 'bo'
    await expect(sendRipplingJob(pto, 'tok', f.client as never)).rejects.toMatchObject({ final: true })
    expect(api.createLeave).not.toHaveBeenCalled()
  })
  it('cancels each day sent, and sends nothing for a time off cancelled before it went', async () => {
    const f = db()
    f.db.tc_absence_requests[0].rippling_request_ids = ['2026-11-10:L1', '2026-11-11:L2']
    await sendRipplingJob(job('rippling_pto_cancel', 'tc_absence_requests', 7, {}), 'tok', f.client as never)
    expect(api.cancelLeave.mock.calls.map(c => c[1])).toEqual([{ id: 'L1', workerId: 'w-ana', day: '2026-11-10' }, { id: 'L2', workerId: 'w-ana', day: '2026-11-11' }])
    expect(f.db.tc_absence_requests[0]).toMatchObject({ rippling_request_ids: null, rippling_state: null })
    const g = db()
    g.db.tc_absence_requests[0].state = 'cancelled'
    await sendRipplingJob(pto, 'tok', g.client as never)
    expect(api.createLeave).not.toHaveBeenCalled()
  })
})

describe('hours to Rippling', () => {
  const db = () => fakeDb({
    people: [{ id: 'ana', full_name: 'Ana', rippling_worker_id: 'w-ana' }, { id: 'bo', full_name: 'Bo', rippling_worker_id: 'w-bo' }],
    tc_submissions: [{ id: 3, person_id: 'ana', state: 'approved', rippling_entries: null }, { id: 4, person_id: 'bo', state: 'approved', rippling_entries: null }],
    tc_entries: [
      { person_id: 'ana', entry_date: '2026-11-07', duration_seconds: 3600, kind: 'clock' },
      { person_id: 'ana', entry_date: '2026-11-09', duration_seconds: 8 * 3600, kind: 'clock' },
      { person_id: 'ana', entry_date: '2026-11-10', duration_seconds: 8 * 3600, kind: 'absence' },
      { person_id: 'ana', entry_date: '2026-11-12', duration_seconds: 7.5 * 3600, kind: 'manual' },
      { person_id: 'bo', entry_date: '2026-11-09', duration_seconds: 8 * 3600, kind: 'clock' },
    ],
  })
  const hours = (id: number) => job('rippling_hours', 'tc_submissions', id, { start: '2026-11-08', end: '2026-11-21' })

  it('sends one approved total a day from the start date, without time off', async () => {
    const f = db()
    await sendRipplingJob(hours(3), 'tok', f.client as never)
    expect(api.createHours.mock.calls.map(c => c[1])).toEqual([
      { workerId: 'w-ana', day: '2026-11-09', hours: 8, key: 'truenorth-ana-2026-11-09' },
      { workerId: 'w-ana', day: '2026-11-12', hours: 7.5, key: 'truenorth-ana-2026-11-12' },
    ])
    expect(f.db.tc_submissions[0].rippling_entries).toEqual({ '2026-11-09': { id: 'H1', hours: 8 }, '2026-11-12': { id: 'H2', hours: 7.5 } })
  })
  it('sends nothing for someone whose North Time has not started (QuickBooks Time still sends theirs)', async () => {
    await sendRipplingJob(hours(4), 'tok', db().client as never)
    expect(api.createHours).not.toHaveBeenCalled()
  })
  it('changes and removes the days already sent when the period is approved again', async () => {
    const f = db()
    f.db.tc_submissions[0].rippling_entries = { '2026-11-09': { id: 'H1', hours: 6 }, '2026-11-11': { id: 'H7', hours: 2 }, '2026-11-12': { id: 'H2', hours: 7.5 } }
    await sendRipplingJob(hours(3), 'tok', f.client as never)
    expect(api.deleteHours).toHaveBeenCalledWith('tok', 'H7')
    expect(api.updateHours).toHaveBeenCalledWith('tok', { id: 'H1', workerId: 'w-ana', hours: 8 })
    expect(api.createHours).not.toHaveBeenCalled()
    expect(f.db.tc_submissions[0].rippling_entries).toEqual({ '2026-11-09': { id: 'H1', hours: 8 }, '2026-11-12': { id: 'H2', hours: 7.5 } })
  })
  it('sends nothing for a period opened again after the approval', async () => {
    const f = db()
    f.db.tc_submissions[0].state = 'submitted'
    await sendRipplingJob(hours(3), 'tok', f.client as never)
    expect(api.createHours).not.toHaveBeenCalled()
  })
})

describe('matching people', () => {
  it('matches the employees only, and lists who was not found', async () => {
    api.companyName.mockResolvedValue('True North Digital Marketing')
    api.listWorkers.mockResolvedValue([{ id: 'w-ana', status: 'ACTIVE', work_email: 'ana@truenorthdigitalmarketing.com' }, { id: 'w-cy', status: 'ACTIVE', work_email: 'cy@x.org' }])
    const f = fakeDb({ people: [
      { id: 'ana', full_name: 'Ana', status: 'active', email_true_north: 'ana@truenorthdigitalmarketing.com', rippling_worker_id: null },
      { id: 'bo', full_name: 'Bo', status: 'active', email_true_north: 'bo@truenorthdigitalmarketing.com', rippling_worker_id: 'w-stale' },
      { id: 'cy', full_name: 'Cy', status: 'active', email_true_north: 'cy@x.org', rippling_worker_id: null },
    ] })
    const r = await matchPeople('tok', f.client as never)
    expect(r).toEqual({ company: 'True North Digital Marketing', employees: 2, matched: 1, missing: ['Bo'] })
    expect(f.db.people.map(p => p.rippling_worker_id)).toEqual(['w-ana', null, null])
  })
})
