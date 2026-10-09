import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'
import { TRACKED_PROJECTS } from './projects'

let fake: Fake
let granted = true
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async () => granted }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('./donations-log', async importOriginal => ({
  ...(await importOriginal<typeof import('./donations-log')>()),
  currentActor: async () => ({ personId: 'me', name: 'Me', email: 'me@x.org' }),
}))

const { saveDonation, savePurchase } = await import('./money-in-actions')
const prepaid = TRACKED_PROJECTS.find(p => p.prepaid)!
const funded = TRACKED_PROJECTS.find(p => !p.prepaid)!

beforeEach(() => {
  granted = true
  fake = fakeDb({
    tc_project_purchases: [{ id: 1, project_label: prepaid.label, month: '2026-05', hours: 10, amount_usd: 900, note: 'From the tracking sheet' }],
    tc_project_purchases_log: [],
    tc_project_donations: [{ id: 7, project_label: funded.label, month: '2026-05', amount_usd: 250, note: null }],
    tc_project_donations_log: [],
  })
})

describe('prepaid hours (audit, 9 October 2026)', () => {
  it('keeps the note when the dialog sends only hours and amount', async () => {
    expect(await savePurchase({ project: prepaid.label, month: '2026-05', hours: '12', amount: '1080' })).toEqual({ ok: true })
    expect(fake.tables.tc_project_purchases[0]).toMatchObject({ hours: 12, note: 'From the tracking sheet' })
  })

  it('writes every change to its history, with what it was before', async () => {
    await savePurchase({ project: prepaid.label, month: '2026-05', hours: '12', amount: '1080' })
    expect(fake.tables.tc_project_purchases_log[0]).toMatchObject({ action: 'updated', hours_before: 10, hours_after: 12, actor_name: 'Me' })
    await savePurchase({ project: prepaid.label, month: '2026-05', hours: '', amount: '' })
    expect(fake.tables.tc_project_purchases).toHaveLength(0)
    expect(fake.tables.tc_project_purchases_log[1]).toMatchObject({ action: 'deleted', hours_before: 12 })
  })

  it('refuses when what is there cannot be read, rather than answering ok', async () => {
    fake = fakeDb({}, { fail: ['tc_project_purchases'] })
    expect((await savePurchase({ project: prepaid.label, month: '2026-05', hours: '', amount: '' })).ok).toBe(false)
  })
})

describe('donations', () => {
  it('a figure saved without its history line says so', async () => {
    fake = fakeDb({ tc_project_donations: [{ id: 7, project_label: funded.label, month: '2026-05', amount_usd: 250, note: null }] }, { fail: ['tc_project_donations_log'] })
    const r = await saveDonation({ project: funded.label, month: '2026-05', amount: '300' })
    expect(r.ok).toBe(true)
    expect(r.warning).toMatch(/history could not be written/)
  })

  it('refuses without the item', async () => {
    granted = false
    expect((await saveDonation({ project: funded.label, month: '2026-05', amount: '300' })).ok).toBe(false)
    expect(fake.writes).toEqual([])
  })
})
