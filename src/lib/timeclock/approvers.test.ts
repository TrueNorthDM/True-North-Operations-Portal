import { describe, it, expect } from 'vitest'
import { loadApprovers } from './approvers'

/** A client that answers the one query loadApprovers makes, and records its filters. */
function fakeDb(rows: { id: string; full_name: string }[] | null, error: { message: string } | null = null) {
  const filters: [string, unknown][] = []
  const q = {
    select: () => q,
    eq: (col: string, v: unknown) => { filters.push([col, v]); return q },
    order: () => Promise.resolve({ data: rows, error }),
  }
  return { db: { from: () => q } as never, filters }
}

describe('who approves hours (8 October 2026: the Super Admins)', () => {
  it('asks for active Super Admins only', async () => {
    const { db, filters } = fakeDb([])
    await loadApprovers(db, 'me')
    expect(filters).toEqual([['access_level', 'super_admin'], ['status', 'active']])
  })

  it('never names the person themselves', async () => {
    const { db } = fakeDb([{ id: 'me', full_name: 'Arnaldo' }, { id: 'd', full_name: 'David' }])
    expect(await loadApprovers(db, 'me')).toEqual([{ id: 'd', name: 'David' }])
  })

  it('fails loudly rather than reporting nobody when the read fails', async () => {
    const { db } = fakeDb(null, { message: 'boom' })
    await expect(loadApprovers(db, 'me')).rejects.toThrow('Approvers could not be read')
  })
})
