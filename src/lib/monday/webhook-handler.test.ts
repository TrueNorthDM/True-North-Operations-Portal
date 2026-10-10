import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// The Monday webhook acts on what Monday says now (audit, 10 October 2026).

let fake: Fake
let item: { id: string; name: string; board: { id: string }; column_values: { id: string; text: string | null; value: string | null }[] } | null
let mondayDown = false
const flipped: string[] = []

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('./client', () => ({
  fetchItem: async () => { if (mondayDown) throw new Error('Monday API: rate limit'); return item },
  setStatusLabel: async (o: { itemId: string }) => { flipped.push(o.itemId) },
}))

const { handleMondayWebhook } = await import('./webhook-handler')

const BOARD = '462251934'
const COLS = { hrefLinksStatus: 'status_href', language: 'lang', pageLink: 'link', languageMap: { English: 'en', Spanish: 'es' } }
const mondayItem = (status: string, link = 'https://www.askanadventistfriend.com/page/', board = BOARD) => ({
  id: '100', name: 'Page A', board: { id: board },
  column_values: [
    { id: 'lang', text: 'English', value: null },
    { id: 'link', text: link, value: null },
    { id: 'status_href', text: status, value: null },
  ],
})
const post = (label: string, extra: Record<string, unknown> = {}) => handleMondayWebhook(JSON.stringify({
  event: { boardId: BOARD, pulseId: 100, columnId: 'status_href', value: { label: { text: label } }, triggerTime: '2026-10-10T12:00:00Z', ...extra },
}), 'secret-url')
const result = async (r: Response) => ((await r.json()) as { result: string }).result

beforeEach(() => {
  mondayDown = false
  flipped.length = 0
  item = mondayItem('Run Link')
  fake = fakeDb({
    app_settings: [{ singleton_id: 1, monday_api_token: 'token' }],
    sites: [{ id: 's1', code: 'aaaf', domain: 'https://www.askanadventistfriend.com', languages: ['en'], monday_board_id: BOARD, monday_column_ids: COLS, site_id: 's1' }],
    monday_events: [],
    pages: [],
    page_urls: [],
    confirmations: [],
  }, { unique: { monday_events: ['delivery_key'], pages: ['site_id', 'name'] } })
})

describe('the Monday webhook', () => {
  it('does nothing when the status in Monday is not what the delivery says', async () => {
    item = mondayItem('Working on it')
    expect(await result(await post('Done'))).toMatch(/label is now "Working on it"/)
    expect(fake.tables.confirmations).toEqual([])
  })

  it('does nothing for an item that is not on the board the delivery names', async () => {
    item = mondayItem('Run Link', undefined, '999')
    expect(await result(await post('Run Link'))).toMatch(/is not on board/)
    expect(fake.tables.pages).toEqual([])
  })

  it('processes one delivery once', async () => {
    await post('Run Link')
    const again = await post('Run Link')
    expect(await result(again)).toMatch(/duplicate delivery/)
    expect(fake.tables.monday_events).toHaveLength(1)
  })

  it('answers 200 and records the failure when Monday cannot be reached', async () => {
    mondayDown = true
    const r = await post('Run Link')
    expect(r.status).toBe(200)
    expect(String(fake.tables.monday_events[0].result)).toMatch(/error:monday/)
  })

  it('refuses a link that is not a page on the site, such as the test site', async () => {
    item = mondayItem('Run Link', 'https://devsite.askanadventistfriend.com/page/')
    expect(await result(await post('Run Link'))).toMatch(/link for en refused/)
    expect(fake.tables.page_urls).toEqual([])
  })
})
