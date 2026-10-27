import { describe, it, expect, vi, beforeEach } from 'vitest'

// Company settings > Job catalogue (11B), audit of 27 October 2026.

let readFails = false
let options: { label: string; position: number }[] = []
const inserts: Record<string, unknown>[] = []

const client = {
  from: () => ({
    // As PostgREST answers: never more than 1,000 rows at once, whatever was asked.
    select: () => ({ eq: () => ({ order: () => ({ range: async (a: number, b: number) => (readFails ? { data: null, error: { message: 'boom' } } : { data: options.slice(a, Math.min(b + 1, a + 1000)), error: null }) }) }) }),
    insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null } },
  }),
}

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async () => true }))
vi.mock('@/lib/auth/session', () => ({ getRealPerson: async () => null }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => client }))

const { addOption } = await import('./catalogue-actions')

beforeEach(() => {
  readFails = false
  options = [{ label: 'Writing', position: 0 }, { label: 'Design', position: 1 }]
  inserts.length = 0
})

describe('addOption', () => {
  it('adds at the end and refuses a name already there', async () => {
    expect((await addOption({ fieldId: 7, label: 'Video' })).ok).toBe(true)
    expect(inserts[0]).toMatchObject({ field_id: 7, label: 'Video', position: 2 })
    expect((await addOption({ fieldId: 7, label: 'design' })).ok).toBe(false)
  })

  it('reads every option of a field past the first 1,000', async () => {
    options = Array.from({ length: 1200 }, (_, i) => ({ label: `Code ${i}`, position: i }))
    expect((await addOption({ fieldId: 7, label: 'code 1100' })).ok).toBe(false)
    expect((await addOption({ fieldId: 7, label: 'Code 1200' })).ok).toBe(true)
    expect(inserts[0]).toMatchObject({ label: 'Code 1200', position: 1200 })
  })

  it('adds nothing when the field\'s options could not be read', async () => {
    readFails = true
    expect((await addOption({ fieldId: 7, label: 'Design' })).ok).toBe(false)
    expect(inserts).toEqual([])
  })
})
