import { describe, it, expect } from 'vitest'
import { fakeDb } from '@/lib/directory/__fakes__/db'
import { pagesWithUrls } from './site-pages'

// The pages adding a language flags (audit, 10 October 2026).

describe('pagesWithUrls', () => {
  it('lists the pages of the site that have at least one URL, and only those', async () => {
    const { db } = fakeDb({
      pages: [{ id: 'a', site_id: 's1' }, { id: 'b', site_id: 's1' }, { id: 'c', site_id: 's2' }],
      page_urls: [
        { page_id: 'a', language_code: 'en' }, { page_id: 'a', language_code: 'pt' },
        { page_id: 'c', language_code: 'en' },
      ],
    })
    expect([...await pagesWithUrls(db, 's1')]).toEqual(['a'])
  })

  it('stops when a read fails, instead of flagging nothing', async () => {
    const { db } = fakeDb({ pages: [{ id: 'a', site_id: 's1' }] }, { fail: ['page_urls'] })
    await expect(pagesWithUrls(db, 's1')).rejects.toThrow(/page URLs/)
  })
})
