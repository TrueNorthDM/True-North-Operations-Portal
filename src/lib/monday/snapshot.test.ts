import { describe, it, expect, vi, afterEach } from 'vitest'
import { processBoard } from './snapshot'

// A board read that goes wrong keeps the stored snapshot (audit, 10 October 2026).

afterEach(() => { vi.unstubAllGlobals() })

const reply = (data: unknown) => new Response(JSON.stringify(data), { status: 200 })
const BOARD = { id: '1', short: 'X', since: new Date(Date.now() - 40 * 86_400_000).toISOString() }

describe('processBoard', () => {
  it('fails when Monday returns no board, instead of an empty one', async () => {
    vi.stubGlobal('fetch', async () => reply({ data: { boards: [] } }))
    await expect(processBoard('t', BOARD)).rejects.toThrow(/no board/)
  })

  it('fails when a stretch of the activity log could not be read', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const q = JSON.parse(init.body).query as string
      if (q.includes('items_page')) return reply({ data: { boards: [{ id: '1', groups: [], items_page: { cursor: null, items: [] } }] } })
      return reply({ errors: [{ message: 'Internal error' }] })
    })
    await expect(processBoard('t', BOARD)).rejects.toThrow(/activity log chunks failed/)
  })
})
