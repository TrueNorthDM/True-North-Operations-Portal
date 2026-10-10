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

  // One busy month on AAAF had more than Monday's 10,000 per request, and was
  // cut there without a word.
  it('reads a stretch at the limit again in halves, so nothing is cut off', async () => {
    let full = true
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      const body = JSON.parse(init.body)
      if ((body.query as string).includes('items_page')) return reply({ data: { boards: [{ id: '1', groups: [], items_page: { cursor: null, items: [] } }] } })
      const n = full ? 10000 : 3
      full = false
      const logs = Array.from({ length: n }, (_, i) => ({ id: `${body.variables.from}-${i}`, event: 'create_pulse', created_at: '1', data: '{}' }))
      return reply({ data: { boards: [{ activity_logs: logs }] } })
    })
    const snap = await processBoard('t', { ...BOARD, since: new Date(Date.now() - 20 * 86_400_000).toISOString() })
    expect(snap.activity).toHaveLength(6)
  })
})
