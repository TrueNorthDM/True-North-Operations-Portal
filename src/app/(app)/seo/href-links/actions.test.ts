import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

// The Href Links page actions (audit, 10 October 2026).

let fake: Fake
let mayOpen = true
const P = '11111111-1111-4111-8111-111111111111'

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('@/lib/access/resolve', () => ({ allowedTo: async () => true }))
vi.mock('@/lib/auth/access', () => ({ canAccessSite: async () => mayOpen }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { email: 'ana@tn.org' } } }) } }) }))

const { savePageUrls, toggleConfirmation, deletePage } = await import('./actions')

const SITE = { id: 's1', code: 'aaaf', languages: ['en', 'es'], domain: 'https://www.askanadventistfriend.com', monday_board_id: '1' }

beforeEach(() => {
  mayOpen = true
  fake = fakeDb({
    sites: [SITE],
    pages: [{ id: P, name: 'Page A', confirmed_done_at: null, needs_hreflang_update: false, site_id: 's1' }],
    page_urls: [{ page_id: P, language_code: 'en', url: 'https://www.askanadventistfriend.com/a/' }],
    confirmations: [{ page_id: P, language_code: 'en', confirmed_on_live: true }],
    monday_events: [],
  })
})

describe('per-site access', () => {
  it('refuses a page of a site the person may not open, whatever the address', async () => {
    mayOpen = false
    expect((await deletePage({ pageId: P })).error).toMatch(/not open to your access/)
    expect(fake.tables.pages).toHaveLength(1)
  })
})

describe('saving links', () => {
  it('refuses a link that is not https on the site, and saves nothing', async () => {
    const r = await savePageUrls({ pageId: P, urls: [{ language_code: 'es', url: 'https://devsite.askanadventistfriend.com/es/a/' }] })
    expect(r.ok).toBe(false)
    expect(r.rejected?.[0]).toMatchObject({ language_code: 'es' })
    expect(fake.tables.page_urls).toHaveLength(1)
  })

  it('takes the confirmation away and flags the page when a live link changes', async () => {
    expect(await savePageUrls({ pageId: P, urls: [{ language_code: 'en', url: 'https://askanadventistfriend.com/b/' }] })).toEqual({ ok: true })
    expect(fake.tables.page_urls[0].url).toBe('https://www.askanadventistfriend.com/b/')
    expect(fake.tables.confirmations[0].confirmed_on_live).toBe(false)
    expect(fake.tables.pages[0].needs_hreflang_update).toBe(true)
  })
})

describe('confirming live', () => {
  it('needs a saved link first', async () => {
    expect((await toggleConfirmation({ pageId: P, languageCode: 'es', value: true })).error).toMatch(/link first/)
  })
})
