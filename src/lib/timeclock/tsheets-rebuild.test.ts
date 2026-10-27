import { afterEach, describe, expect, it, vi } from 'vitest'
import { fakeDb } from '@/lib/directory/__fakes__/db'
import { planRebuild, runRebuild, type PortalField, type PortalJob, type PortalOption } from './tsheets-rebuild'

const J = (x: Partial<PortalJob> & { id: number; name: string }): PortalJob => ({
  parent_id: null, level: null, billable: false, external_id: null, structure: 1, kind: 'regular', active: true, sort_order: null, ...x,
})
const jobs: PortalJob[] = [
  J({ id: 1, name: '1 - True North', external_id: 100 }),
  J({ id: 2, name: 'Content', parent_id: 1, external_id: 101 }),
  J({ id: 3, name: 'Vacation', kind: 'pto', external_id: 102 }),
  J({ id: 12, name: 'Africa', parent_id: 11, structure: 2, level: 'division', billable: true, sort_order: 2 }),
  J({ id: 11, name: 'COE Group', structure: 2, level: 'client', billable: true, sort_order: 1 }),
  J({ id: 13, name: 'Africa General', parent_id: 12, structure: 2, level: 'project', billable: true, sort_order: 3 }),
]
const fields: PortalField[] = [
  ...['3 Activity', '4 Billable', 'Tasks', '1 Company', '1 - i7 Code', '2 Project'].map((name, i) => ({ id: i + 1, external_id: 500 + i, name, active: true, structure: 1 })),
  { id: 9, external_id: null, name: 'Activity', active: true, structure: 2 },
]
const options: PortalOption[] = [
  { id: 1, field_id: 9, label: 'Admin', external_id: null, active: true },
  { id: 2, field_id: 9, label: 'Other', external_id: null, active: true },
  { id: 3, field_id: 1, label: 'WebDev', external_id: 900, active: true },
]

describe('rebuilding QuickBooks Time in the 2026 structure', () => {
  afterEach(() => { vi.unstubAllEnvs() })

  it('archives the six old fields, creates parents before children, keeps time off', () => {
    const p = planRebuild(jobs, fields, options)
    expect(p.archiveFields.map(f => f.name)).toHaveLength(6)
    expect(p.createJobs.map(j => j.name)).toEqual(['COE Group', 'Africa', 'Africa General'])
    expect(p.createItems.map(o => o.label)).toEqual(['Admin', 'Other'])
    expect(p.archiveJobs.map(j => j.name)).toEqual(['1 - True North', 'Content'])
    expect(p.problems).toEqual([])
  })

  it('says what is wrong instead of running', () => {
    expect(planRebuild(jobs, fields.filter(f => f.structure === 1), options).problems).toEqual(['The 2026 Activity field is missing in the portal.'])
  })

  it('is a dry run unless asked live with TSHEETS_WRITE=on', async () => {
    const write = vi.fn()
    const db = fakeDb({ tc_jobcodes: jobs.map(j => ({ ...j })), tc_fields: fields.map(x => ({ ...x })), tc_field_options: options.map(x => ({ ...x })) }).db
    const dry = await runRebuild(db, 't', { live: true, write })
    expect(dry.live).toBe(false)
    expect(write).not.toHaveBeenCalled()
  })

  it('live: sends in order and saves each new id on the portal row', async () => {
    vi.stubEnv('TSHEETS_WRITE', 'on')
    let next = 1000
    const calls: string[] = []
    const write = vi.fn(async (method: string, path: string, data: Record<string, unknown>[]) => {
      calls.push(`${method} ${path} ${data.length}`)
      return Object.fromEntries(data.map((_, i) => [String(i + 1), { id: ++next, _status_code: 200 }]))
    })
    const f = fakeDb({ tc_jobcodes: jobs.map(j => ({ ...j })), tc_fields: fields.map(x => ({ ...x })), tc_field_options: options.map(x => ({ ...x })) })
    const r = await runRebuild(f.db, 't', { live: true, write })
    expect(r.live).toBe(true)
    expect(calls).toEqual(['PUT /customfields 6', 'POST /jobcodes 1', 'POST /jobcodes 1', 'POST /jobcodes 1', 'POST /customfields 1', 'POST /customfielditems 2', 'PUT /jobcodes 2'])
    // Africa's parent is COE Group's new TSheets id (the six archived fields answered 1001 to 1006).
    expect(write.mock.calls[2][2][0]).toMatchObject({ name: 'Africa', parent_id: 1007 })
    expect(f.tables.tc_jobcodes.find(x => x.id === 13)).toMatchObject({ external_id: 1009 })
  })
})
