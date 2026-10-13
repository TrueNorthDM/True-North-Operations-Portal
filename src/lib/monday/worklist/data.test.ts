import { describe, it, expect, vi } from 'vitest'
import { loadWorklist } from './data'

/* eslint-disable @typescript-eslint/no-explicit-any */

// The privileged reader: the one settings value a non-admin's own read cannot
// see, and the work list itself (my_work_list, migration 110). A module-level
// switch rather than a fixed mock, so each test says what the admin read
// returns; the list is answered from the test's own tables.
const adminSettings: { slug: string | null } = { slug: null }
const admin: { tables: Record<string, any[]>; calls: Record<string, unknown>[]; error: string | null } = { tables: {}, calls: [], error: null }
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { monday_account_slug: adminSettings.slug }, error: null }) }),
      }),
    }),
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn !== 'my_work_list') throw new Error(`unexpected rpc ${fn}`)
      admin.calls.push(args)
      if (admin.error) return { data: null, error: { message: admin.error } }
      return { data: myWorkList(admin.tables.monday_assignments ?? [], args), error: null }
    },
  }),
}))

/**
 * my_work_list as migration 110 writes it: the boards given, the hidden
 * accounts left out, only the accounts given (null is everyone), the open or
 * recent window, open and soonest first, at most p_limit rows.
 */
function myWorkList(rows: any[], a: Record<string, any>): any[] {
  const out = rows
    .filter(r => (a.p_board_ids as number[]).includes(r.board_id))
    .filter(r => !(a.p_hidden_accounts as number[]).includes(r.monday_user_id))
    .filter(r => a.p_accounts === null || (a.p_accounts as number[]).includes(r.monday_user_id))
    .filter(r => r.status_done !== true
      || (!a.p_open_only && (a.p_done_since === null || (r.item_updated_at != null && r.item_updated_at >= a.p_done_since))))
    .sort((x, y) => {
      const done = (v: boolean | null) => (v == null ? 0 : v ? 2 : 1)
      return done(x.status_done) - done(y.status_done)
        || (x.due_date == null ? 1 : 0) - (y.due_date == null ? 1 : 0)
        || String(x.due_date ?? '').localeCompare(String(y.due_date ?? ''))
        || x.id - y.id
    })
  return a.p_limit == null ? out : out.slice(0, a.p_limit)
}

/**
 * A stand-in for the Supabase client that APPLIES the filters it is given.
 *
 * The point of the test is not that loadWorklist calls .in() with the right
 * arguments; it is that a row on a board somebody switched off never reaches
 * the page. Recording the call and asserting on it would pass even if the
 * filter were built against the wrong column, so the fake resolves the query
 * the way Postgres would and the assertions are about rows.
 */
function fakeClient(tables: Record<string, any[]>) {
  const applied: Record<string, string[][]> = {}
  const ranged: string[] = []
  admin.tables = tables
  admin.calls = []
  admin.error = null

  const builder = (table: string) => {
    const filters: any[][] = []
    let head = false

    const rows = () => {
      let out = [...(tables[table] ?? [])]
      for (const f of filters) {
        const [op, col, a, b] = f
        if (op === 'eq') out = out.filter(r => r[col] === a)
        else if (op === 'in') out = out.filter(r => (a as any[]).includes(r[col]))
        else if (op === 'not' && a === 'in') {
          const list = String(b).replace(/[()]/g, '').split(',').filter(Boolean).map(Number)
          out = out.filter(r => !list.includes(r[col]))
        }
        // `or` is only used for the open/recent window, which these tests
        // sidestep by asking for everything.
      }
      return out
    }

    const self: any = {
      select: (_cols?: string, opts?: { head?: boolean; count?: string }) => {
        head = opts?.head === true
        return self
      },
      eq: (...a: any[]) => { filters.push(['eq', ...a]); return self },
      in: (...a: any[]) => { filters.push(['in', ...a]); return self },
      not: (...a: any[]) => { filters.push(['not', ...a]); return self },
      or: (...a: any[]) => { filters.push(['or', ...a]); return self },
      order: () => self,
      range: () => { ranged.push(table); return self },
      maybeSingle: async () => ({ data: (tables[table] ?? [])[0] ?? null, error: null }),
      then: (resolve: any, reject: any) => {
        applied[table] = filters.map(f => f.map(String))
        const r = head
          ? { data: null, count: rows().length, error: null }
          : { data: rows(), count: rows().length, error: null }
        return Promise.resolve(r).then(resolve, reject)
      },
    }
    return self
  }

  // The per-account counts the truncated Everyone view asks for (migration 104).
  const rpc = async (fn: string) => {
    if (fn !== 'monday_assignment_counts') throw new Error(`unexpected rpc ${fn}`)
    const accounts: Record<string, number> = {}
    for (const r of tables.monday_assignments ?? []) accounts[r.monday_user_id] = (accounts[r.monday_user_id] ?? 0) + 1
    return { data: { accounts, steps: {} }, error: null }
  }

  return { client: { from: (t: string) => builder(t), rpc } as any, applied, ranged }
}

const assignment = (over: Record<string, unknown>) => ({
  id: 1, board_id: 10, item_id: 100, item_name: 'Item', parent_item_name: null,
  parent_item_id: null, parent_board_id: null, group_title: null,
  people_col: 'people1', monday_user_id: 1, status_text: 'Working on it',
  status_done: false, status_color: '#fdab3d', due_date: null, item_updated_at: null,
  ...over,
})

const base = () => ({
  monday_boards: [
    { id: 10, name: 'Shown board', workspace_name: 'Graphics', included: true, items_synced_at: '2026-08-19T00:00:00Z', date_title: 'Due Date' },
    { id: 20, name: 'Switched off', workspace_name: 'Old stuff', included: false, items_synced_at: '2026-08-19T00:00:00Z', date_title: null },
  ],
  monday_board_steps: [
    { board_id: 10, people_col: 'people1', step_name: 'Design', position: 1, source: 'guess' },
    { board_id: 20, people_col: 'people1', step_name: 'Design', position: 1, source: 'guess' },
  ],
  monday_user_links: [{ monday_user_id: 1, person_id: 'p1' }, { monday_user_id: 2, person_id: 'p2' }],
  monday_users: [
    { id: 1, name: 'Shown person', is_external: false, hidden: false },
    { id: 2, name: 'Hidden person', is_external: false, hidden: true },
  ],
  people: [{ id: 'p1', full_name: 'Amy Prindle' }, { id: 'p2', full_name: 'Kim Wagner' }],
  app_settings: [{ monday_account_slug: 'truenorth' }],
  monday_assignments: [
    assignment({ id: 1, board_id: 10, monday_user_id: 1, item_name: 'On a shown board' }),
    assignment({ id: 2, board_id: 20, item_id: 200, monday_user_id: 1, item_name: 'On a board switched off' }),
    assignment({ id: 3, board_id: 10, monday_user_id: 2, item_name: 'Assigned to a hidden person' }),
  ],
})

describe('loadWorklist and the Settings switches', () => {
  it('keeps work from a board that is shown', async () => {
    const { client } = fakeClient(base())
    const r = await loadWorklist(client, { includeDone: true })
    expect(r.rows.map(x => x.itemName)).toContain('On a shown board')
  })

  // The switch has to make room, not just hide rows: the unfiltered view reads
  // a capped number of rows, so anything excluded after the fetch would go on
  // spending that budget and push real work off the page.
  it('never fetches work from a board switched off', async () => {
    const { client, applied } = fakeClient(base())
    const r = await loadWorklist(client, { includeDone: true })
    expect(r.rows.map(x => x.itemName)).not.toContain('On a board switched off')
    expect(applied.monday_assignments.some(f => f[0] === 'in' && f[1] === 'board_id')).toBe(true)
    expect(admin.calls[0].p_board_ids).toEqual([10])
  })

  it('never fetches work assigned to a hidden person', async () => {
    const { client, applied } = fakeClient(base())
    const r = await loadWorklist(client, { includeDone: true })
    expect(r.rows.map(x => x.itemName)).not.toContain('Assigned to a hidden person')
    expect(applied.monday_assignments.some(f => f[0] === 'not' && f[1] === 'monday_user_id')).toBe(true)
    expect(admin.calls[0].p_hidden_accounts).toEqual([2])
  })

  it('counts only what the switches allow', async () => {
    const { client } = fakeClient(base())
    const r = await loadWorklist(client, { includeDone: true })
    expect(r.rows).toHaveLength(1)
    expect(r.matching).toBe(1)
  })

  // Turning everything back on brings the work back, which is the other half
  // of the promise the settings page makes.
  it('brings the work back when the board is shown again', async () => {
    const t = base()
    t.monday_boards[1].included = true
    t.monday_users[1].hidden = false
    const { client } = fakeClient(t)
    const r = await loadWorklist(client, { includeDone: true })
    expect(r.rows).toHaveLength(3)
  })
})

describe('loadWorklist and steps read by deadline', () => {
  const stages = [
    { statusCol: 'status8', statusTitle: 'Audit', dateCol: 'date', dateTitle: 'Audit By' },
  ]
  const withSteps = () => {
    const t = base()
    t.monday_board_steps = [
      { board_id: 10, people_col: 'people1', step_name: 'Audit', position: 1, source: 'guess', stages } as any,
      { board_id: 10, people_col: 'assigner', step_name: 'Assigner', position: 0, source: 'guess', stages: [] } as any,
    ]
    t.monday_assignments = [
      assignment({ id: 1, people_col: 'people1', status_col: 'status8', due_col: 'date', item_name: 'Audit row' }),
      assignment({ id: 2, people_col: 'assigner', status_col: 'status', due_col: null, item_name: 'Assigner row' }),
    ]
    return t
  }

  // Stephanie's "No edits needed": the Assign column has no deadline, so the
  // Assigner is not a step, and the row goes the moment discovery says so.
  it('leaves out a people column that owns no status with a deadline', async () => {
    const { client } = fakeClient(withSteps())
    const r = await loadWorklist(client, { includeDone: true })
    expect(r.rows.map(x => x.itemName)).toEqual(['Audit row'])
  })

  // Four rows called "128 - How do Adventists view the concept of the end of the
  // world?" were one page in four languages, and looked like duplicates.
  it('carries the item\'s language, and nothing for a board without one', async () => {
    const t = withSteps()
    t.monday_assignments[0] = { ...t.monday_assignments[0], item_language: 'Portuguese' } as any
    const { client } = fakeClient(t)
    const [row] = (await loadWorklist(client, { includeDone: true })).rows
    expect(row.language).toBe('Portuguese')
    const plain = fakeClient(withSteps())
    expect((await loadWorklist(plain.client, { includeDone: true })).rows[0].language).toBeNull()
  })

  it('names the step and its deadline from the stage the row was read from', async () => {
    const { client } = fakeClient(withSteps())
    const [row] = (await loadWorklist(client, { includeDone: true })).rows
    expect(row.stepName).toBe('Audit')
    expect(row.dueLabel).toBe('Audit By')
  })

  // A1. app_settings is admin-only, so a team leader's own read comes back
  // empty. The link has to be built anyway.
  it('builds the Monday link for somebody who cannot read the settings themselves', async () => {
    const t = withSteps()
    t.app_settings = []
    adminSettings.slug = 'truenorthdigitalmarketing'
    const { client } = fakeClient(t)
    const [row] = (await loadWorklist(client, { includeDone: true })).rows
    expect(row.url).toBe('https://truenorthdigitalmarketing.monday.com/boards/10/pulses/100')
  })
})

// Item 3 of the 13 October audit: the list is one database call, not a read
// 1,000 rows at a time, and it asks for the same rows the paged read did.
describe('loadWorklist reads the list in one call (migration 110)', () => {
  const many = (n: number) => {
    const t = base()
    t.monday_assignments = Array.from({ length: n }, (_, i) =>
      assignment({ id: i + 1, item_id: 1000 + i, item_name: `Step ${i + 1}` }))
    return t
  }

  it('reads past 1,000 rows in a single call', async () => {
    const { client, ranged } = fakeClient(many(2500))
    const r = await loadWorklist(client, { personId: 'p1', includeDone: true })
    expect(admin.calls).toHaveLength(1)
    expect(r.rows).toHaveLength(2500)
    expect(r.truncated).toBe(false)
    // No page of rows over PostgREST: the count is the only other read.
    expect(ranged).not.toContain('monday_assignments')
  })

  it('asks for a person\'s accounts and every row', async () => {
    const { client } = fakeClient(base())
    await loadWorklist(client, { personId: 'p1', includeDone: true })
    expect(admin.calls[0]).toMatchObject({ p_accounts: [1], p_limit: null, p_done_since: null, p_open_only: false })
  })

  it('caps the unfiltered view at 5,000 and says so', async () => {
    const { client } = fakeClient(many(5200))
    const r = await loadWorklist(client, { includeDone: true })
    expect(admin.calls[0]).toMatchObject({ p_accounts: null, p_limit: 5000 })
    expect(r.rows).toHaveLength(5000)
    expect(r.truncated).toBe(true)
    expect(r.matching).toBe(5200)
  })

  it('does not cap the Report\'s uncapped read', async () => {
    const { client } = fakeClient(many(5200))
    const r = await loadWorklist(client, { uncapped: true, includeDone: true })
    expect(admin.calls[0].p_limit).toBeNull()
    expect(r.rows).toHaveLength(5200)
    expect(r.truncated).toBe(false)
  })

  it('keeps finished work out of an open-only read, and recent finished work in the default one', async () => {
    const t = base()
    t.monday_assignments = [
      assignment({ id: 1, item_name: 'Open' }),
      assignment({ id: 2, item_id: 201, item_name: 'Finished lately', status_done: true, item_updated_at: new Date().toISOString() }),
      assignment({ id: 3, item_id: 202, item_name: 'Finished long ago', status_done: true, item_updated_at: '2020-01-01T00:00:00Z' }),
    ]
    const open = fakeClient(t)
    expect((await loadWorklist(open.client, { personId: 'p1', openOnly: true })).rows.map(r => r.itemName)).toEqual(['Open'])
    expect(admin.calls[0].p_open_only).toBe(true)

    const recent = fakeClient(t)
    const r = await loadWorklist(recent.client, { personId: 'p1' })
    expect(admin.calls[0].p_done_since).toEqual(expect.any(String))
    expect(r.rows.map(x => x.itemName)).toEqual(['Open', 'Finished lately'])
  })

  it('a failed read stops the page instead of showing no work', async () => {
    const { client } = fakeClient(base())
    admin.error = 'permission denied'
    await expect(loadWorklist(client, { includeDone: true })).rejects.toThrow('permission denied')
  })
})
