import { describe, it, expect } from 'vitest'
import { loadWorklist } from './data'

/* eslint-disable @typescript-eslint/no-explicit-any */

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
      range: () => self,
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

  return { client: { from: (t: string) => builder(t) } as any, applied }
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
    assignment({ id: 2, board_id: 20, monday_user_id: 1, item_name: 'On a board switched off' }),
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
  })

  it('never fetches work assigned to a hidden person', async () => {
    const { client, applied } = fakeClient(base())
    const r = await loadWorklist(client, { includeDone: true })
    expect(r.rows.map(x => x.itemName)).not.toContain('Assigned to a hidden person')
    expect(applied.monday_assignments.some(f => f[0] === 'not' && f[1] === 'monday_user_id')).toBe(true)
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
