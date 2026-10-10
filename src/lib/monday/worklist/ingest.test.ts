import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// The sync writing one board (audit, 10 October 2026): what it does when
// Monday answers badly, how the history reaches the database, and work that
// comes back after leaving for a setting.

let fake: Fake
let answers: unknown[] = []
const written: { events: { event: string }[] }[] = []

vi.mock('./discover', () => ({ gql: async () => answers.shift() }))

const { ingestBoard } = await import('./ingest')

const STAGE = [{ statusCol: 'status', statusTitle: 'Status', dateCol: 'date', dateTitle: 'Due' }]
const COLUMNS = {
  boards: [{ columns: [
    { id: 'people', title: 'Writer', type: 'people', settings_str: null },
    { id: 'status', title: 'Status', type: 'status', settings_str: JSON.stringify({ done_colors: [1] }) },
    { id: 'date', title: 'Due', type: 'date', settings_str: null },
  ] }],
}
const item = (id: string, person: number, statusIndex = 0) => ({
  id, name: `Item ${id}`, updated_at: '2026-10-09T15:00:00Z', group: null, parent_item: null,
  column_values: [
    { id: 'people', text: 'Ana', value: JSON.stringify({ personsAndTeams: [{ id: person, kind: 'person' }] }) },
    { id: 'status', text: statusIndex === 1 ? 'Done' : 'Working on it', value: JSON.stringify({ index: statusIndex }) },
    { id: 'date', text: '2026-10-20', value: JSON.stringify({ date: '2026-10-20' }) },
  ],
})
const page = (items: unknown[]) => ({ boards: [{ items_page: { cursor: null, items } }] })

const BOARD = { id: 7, name: 'Writing', is_subitem_board: false, date_col: 'date', items_count: 2 }

function seed(o: { baseline?: boolean; before?: Record<string, unknown>[]; events?: Record<string, unknown>[] } = {}) {
  written.length = 0
  fake = fakeDb({
    monday_board_steps: [{ board_id: 7, people_col: 'people', status_col: 'status', source: 'guess', stages: STAGE, baseline_pending: o.baseline ?? false }],
    monday_assignments: o.before ?? [],
    monday_assignments_staging: [],
    monday_assignment_events: o.events ?? [],
    monday_boards: [{ id: 7 }],
  }, {
    rpc: { monday_write_board: (a: Record<string, unknown>) => { written.push({ events: a.p_events as { event: string }[] }); return 1 } },
  })
}

beforeEach(() => { answers = [] })

describe('a board Monday answers badly for', () => {
  // It used to read as an empty board: every row logged as taken off its
  // person, and the board emptied.
  it('fails and keeps the board as it was when Monday returns no page', async () => {
    seed({ before: [{ id: 1, board_id: 7, item_id: 1, people_col: 'people', monday_user_id: 42 }] })
    answers = [COLUMNS, { boards: [] }]
    await expect(ingestBoard(fake.db, 'token', BOARD)).rejects.toThrow(/no page/)
    expect(written).toEqual([])
    expect(fake.tables.monday_assignments).toHaveLength(1)
  })

  it('refuses no items for a board Monday lists with items', async () => {
    seed()
    answers = [COLUMNS, page([])]
    await expect(ingestBoard(fake.db, 'token', BOARD)).rejects.toThrow(/kept as it was/)
    expect(written).toEqual([])
  })
})

describe('the history and the board, written together', () => {
  it('hands the events to the same database call that writes the board', async () => {
    seed()
    answers = [COLUMNS, page([item('1', 42)])]
    await ingestBoard(fake.db, 'token', BOARD)
    expect(written).toHaveLength(1)
    expect(written[0].events.map(e => e.event)).toEqual(['assigned'])
    // Nothing written to the log on the side, where a failed board write
    // would leave it to be written again on the next try.
    expect(fake.writes.filter(w => w.table === 'monday_assignment_events')).toEqual([])
  })
})

describe('work that comes back after leaving for a setting (decided 10 October 2026)', () => {
  it('writes no hand-off, and clears the mark once written', async () => {
    seed({ baseline: true })
    answers = [COLUMNS, page([item('1', 42)])]
    await ingestBoard(fake.db, 'token', BOARD)
    expect(written[0].events).toEqual([])
    expect(fake.tables.monday_board_steps[0].baseline_pending).toBe(false)
  })

  it('logs the finish of a step finished while away, so the delivery counts', async () => {
    seed({ baseline: true, events: [{ id: 1, board_id: 7, item_id: 1, people_col: 'people', monday_user_id: 42, event: 'assigned', occurred_at: '2026-09-01T12:00:00Z' }] })
    answers = [COLUMNS, page([item('1', 42, 1)])]
    await ingestBoard(fake.db, 'token', BOARD)
    expect(written[0].events.map(e => e.event)).toEqual(['done'])
  })
})
