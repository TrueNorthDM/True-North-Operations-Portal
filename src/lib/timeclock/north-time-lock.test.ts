import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The North Time lock (migration 132): the setting fails closed, and every
 * action that records or decides hours goes through it. The second half reads
 * the source as text, like access/coverage.test.ts: a new write action that
 * forgets the lock fails here before it ships.
 */

const answer: { data: unknown; error: unknown; throws?: boolean } = { data: null, error: null }
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    if (answer.throws) throw new Error('no database')
    return { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: answer.data, error: answer.error }) }) }) }) }
  },
}))

import { openFrom, northTimeOpen, closedRefusal, NORTH_TIME_CLOSED } from './north-time-lock'

describe('openFrom', () => {
  it('is open only when the row says true and nothing failed', () => {
    expect(openFrom({ north_time_open: true }, null)).toBe(true)
    expect(openFrom({ north_time_open: false }, null)).toBe(false)
    expect(openFrom({}, null)).toBe(false)
    expect(openFrom(null, null)).toBe(false)
    expect(openFrom({ north_time_open: true }, { message: 'column app_settings.north_time_open does not exist' })).toBe(false)
  })
})

describe('northTimeOpen', () => {
  beforeEach(() => { answer.data = null; answer.error = null; answer.throws = false; vi.spyOn(console, 'error').mockImplementation(() => {}) })
  it('reads the switch', async () => {
    answer.data = { north_time_open: true }
    expect(await northTimeOpen()).toBe(true)
  })
  it('fails closed on a read error, a missing row or no database', async () => {
    answer.error = { message: 'boom' }
    answer.data = { north_time_open: true }
    expect(await northTimeOpen()).toBe(false)
    answer.error = null; answer.data = null
    expect(await northTimeOpen()).toBe(false)
    answer.throws = true
    expect(await northTimeOpen()).toBe(false)
  })
  it('closedRefusal answers in the caller\'s own shape', async () => {
    const fail = (error: string) => ({ ok: false as const, error })
    expect(await closedRefusal(fail)).toEqual({ ok: false, error: NORTH_TIME_CLOSED })
    answer.data = { north_time_open: true }
    expect(await closedRefusal(fail)).toBeNull()
  })
})

// ── Every write goes through the lock ────────────────────────────────────────

const APP = join(__dirname, '..', '..', 'app', '(app)')
const WRITE_FILES = [
  'clocky-hours/clock-actions.ts',
  'clocky-hours/entries-actions.ts',
  'clocky-hours/approvals/actions.ts',
  'clocky-hours/invoices/actions.ts',
  'clocky-hours/whos-working/actions.ts',
  'requests/actions.ts',
  'requests/reimbursements/new/route.ts',
  'admin/settings/skipped-actions.ts',
]
/** Reads: they record nothing, so they need no lock. */
const READ = /^get[A-Z]/
const code = (p: string) => readFileSync(join(APP, p), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')

/** Each top-level function's name and body (up to the next top-level declaration). */
function functions(src: string): { name: string; exported: boolean; body: string }[] {
  const re = /^(export )?async function (\w+)\(/gm
  const marks = [...src.matchAll(re)].map(m => ({ at: m.index!, name: m[2], exported: !!m[1] }))
  return marks.map((m, i) => ({ name: m.name, exported: m.exported, body: src.slice(m.at, marks[i + 1]?.at ?? src.length) }))
}

describe('every North Time write goes through the lock', () => {
  for (const file of WRITE_FILES) {
    it(file, () => {
      const fns = functions(code(file))
      const locked = new Set(fns.filter(f => !f.exported && f.body.includes('closedRefusal(')).map(f => f.name))
      const exported = fns.filter(f => f.exported && !READ.test(f.name))
      expect(exported.length).toBeGreaterThan(0)
      const open = exported.filter(f => !f.body.includes('closedRefusal(') && ![...locked].some(h => new RegExp(`await ${h}\\(`).test(f.body)))
      expect(open.map(f => f.name)).toEqual([])
    })
  }
})
