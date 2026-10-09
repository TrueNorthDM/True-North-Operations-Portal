import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'
import type { WorkRow } from '@/lib/monday/worklist/data'

// The Report's loaders on a fake database (audit, 9 October 2026). They had
// no tests, which is how the 1,000-row cap, the failed reads read as zero and
// the mixed windows got through.

let fake: Fake
let openRows: Partial<WorkRow>[] = []
const worklistAsked: unknown[] = []

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/monday/worklist/data', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/monday/worklist/data')>()),
  loadWorklist: async (_db: unknown, f: unknown) => {
    worklistAsked.push(f)
    return { rows: openRows, open: openRows.length }
  },
}))

const { loadSpans, loadReportOverview, heldByPerson } = await import('./data')
const { loadReportPeople } = await import('./people')
const { estimatedAhead } = await import('./workload-data')

const ev = (o: Record<string, unknown>) => ({ board_id: 7, item_id: 1, people_col: 'writer', monday_user_id: 42, due_date: null, ...o })

// A span finished yesterday, handed over the working day before.
const now = Date.now()
const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString()

function seed(rpc: Record<string, (a: Record<string, unknown>) => unknown> = {}, rows: Record<string, Record<string, unknown>[]> = {}) {
  fake = fakeDb({
    monday_assignment_events: [{ detected_at: '2026-08-21T05:16:33Z' }],
    monday_user_links: [
      { monday_user_id: 42, person_id: 'ana' },
      { monday_user_id: 43, person_id: 'ana' },
      { monday_user_id: 50, person_id: 'bo' },
    ],
    people: [
      { id: 'ana', full_name: 'Ana', status: 'active', weekly_hours: 40 },
      { id: 'bo', full_name: 'Bo', status: 'inactive', weekly_hours: 40 },
      { id: 'cy', full_name: 'Cy', status: 'inactive', weekly_hours: 40 },
    ],
    team_members: [
      { team_id: 'seo', person_id: 'ana', is_primary: true, teams: { name: 'SEO' } },
      { team_id: 'seo', person_id: 'bo', is_primary: true, teams: { name: 'SEO' } },
      { team_id: 'seo', person_id: 'cy', is_primary: true, teams: { name: 'SEO' } },
    ],
    teams: [{ id: 'seo', name: 'SEO', color: '#123456' }],
    monday_users: [{ id: 99, name: 'Client account' }],
    ...rows,
  }, {
    rpc: {
      report_span_events: () => [],
      report_open_since: () => [],
      report_hours: () => ({}),
      ...rpc,
    },
  })
}

beforeEach(() => {
  openRows = []
  worklistAsked.length = 0
  seed()
})

describe('the change log, read by the database', () => {
  it('asks for the scope and the period, and keeps only what finished inside it', async () => {
    seed({
      report_span_events: () => [
        ev({ event: 'assigned', occurred_at: iso(200) }),
        ev({ event: 'done', occurred_at: iso(100) }),
        ev({ event: 'assigned', occurred_at: iso(5), item_id: 2 }),
        ev({ event: 'done', occurred_at: iso(1), item_id: 2 }),
      ],
    })
    const spans = await loadSpans([42], new Date(now - 90 * 86_400_000))
    expect(spans.map(s => s.item_id)).toEqual([2])
    expect(fake.rpcs[0]).toMatchObject({ fn: 'report_span_events', args: { p_accounts: [42] } })
  })

  it('stops the page when the read fails, rather than reporting nothing delivered', async () => {
    fake = fakeDb({}, { rpcError: 'connection lost' })
    await expect(loadSpans(null, new Date())).rejects.toThrow(/could not read/)
  })

  it('reads nobody for an empty scope without asking the database', async () => {
    expect(await loadSpans([], new Date())).toEqual([])
    expect(fake.rpcs).toEqual([])
  })
})

describe('the Overview', () => {
  // A login linked to nobody read the whole company's Open now and Late now.
  it('hands the whole filter to the snapshot, so nobody reads as nobody', async () => {
    await loadReportOverview({ personIds: [], period: 90 })
    expect(worklistAsked[0]).toMatchObject({ personIds: [], openOnly: true, uncapped: true })
  })

  it('counts late on the New York day, and only plausible dates', async () => {
    openRows = [
      { itemId: 1, peopleCol: 'w', mondayUserId: 42, statusDone: false, dueDate: '2020-01-01', dueSuspect: false },
      { itemId: 2, peopleCol: 'w', mondayUserId: 42, statusDone: false, dueDate: '0202-01-01', dueSuspect: true },
      { itemId: 3, peopleCol: 'w', mondayUserId: 42, statusDone: false, dueDate: '2999-01-01', dueSuspect: false },
    ]
    const { overview } = await loadReportOverview({ period: 90 })
    expect(overview.kpis.find(k => k.label === 'Open now')?.value).toBe('3')
    expect(overview.kpis.find(k => k.label === 'Late now')?.value).toBe('1')
  })
})

describe('held time per person', () => {
  it('is one row per person, whatever number of Monday accounts they use', () => {
    const span = (id: number, held: number) => ({ monday_user_id: id, heldDays: held }) as never
    const owners = new Map([[42, { personId: 'ana', name: 'Ana', active: true }], [43, { personId: 'ana', name: 'Ana', active: true }]])
    const held = heldByPerson([span(42, 1), span(43, 3), span(99, 2)], owners, new Map([[99, 'Unlinked writer']]))
    expect(held.map(h => h.name).sort()).toEqual(['Ana', 'Unlinked writer'])
  })

  it('leaves an external account (a client) off the chart', () => {
    const span = { monday_user_id: 77, heldDays: 2 } as never
    expect(heldByPerson([span], new Map(), new Map([[77, null]]))).toEqual([])
  })
})

describe('the People tab', () => {
  it('keeps someone inactive who delivered in the period, marked, and drops one who did not', async () => {
    seed({
      report_span_events: () => [
        ev({ event: 'assigned', occurred_at: iso(6), monday_user_id: 50 }),
        ev({ event: 'done', occurred_at: iso(2), monday_user_id: 50 }),
      ],
      report_hours: () => ({ ana: 36_000 }),
    })
    const rows = await loadReportPeople({ teamId: 'seo', period: 90 })
    expect(rows.map(r => [r.name, r.inactive])).toEqual([['Ana', false], ['Bo', true]])
    expect(rows.find(r => r.name === 'Bo')?.delivered).toBe(1)
    // Summed by the database, rounded once.
    expect(rows.find(r => r.name === 'Ana')?.hours).toBe(10)
    expect(fake.rpcs.find(r => r.fn === 'report_hours')).toBeTruthy()
  })
})

describe('Load, estimated', () => {
  const owners = new Map([[42, { personId: 'ana' }]])
  const row = (o: Partial<WorkRow>) => ({ statusDone: false, dueSuspect: false, dueDate: '2026-10-10', mondayUserId: 42, boardId: 1, ...o })

  // It read 0% and "Spare" for somebody with forty steps nobody could estimate.
  it('is unknown, not zero, when a step ahead has no hours per step yet', () => {
    const none = { perBoard: new Map<number, number>(), fallback: null }
    expect(estimatedAhead([row({})], none, owners, '2026-11-09').get('ana')).toBeNull()
  })

  it('adds each step due inside the horizon, overdue ones included', () => {
    const table = { perBoard: new Map([[1, 4]]), fallback: 2 }
    const ahead = estimatedAhead(
      [row({ dueDate: '2026-01-01' }), row({ boardId: 2 }), row({ dueDate: '2027-01-01' })],
      table, owners, '2026-11-09',
    )
    expect(ahead.get('ana')).toBe(6)
  })
})
