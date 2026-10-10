import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const data = vi.hoisted(() => ({
  loadSite: vi.fn(),
  mayOpenSite: vi.fn(),
  getSitePageData: vi.fn(),
  loadSitePage: vi.fn(),
}))
vi.mock('@/lib/href-links/data', () => data)
vi.mock('@/lib/auth/view-as-server', () => ({ previewHref: async (h: string) => h }))
const nav = vi.hoisted(() => ({
  redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`) }),
  notFound: vi.fn(() => { throw new Error('NOT_FOUND') }),
}))
vi.mock('next/navigation', () => nav)

import { SiteListPage } from './SiteListPage'
import { SitePageDetail } from './SitePageDetail'
import { READ_ERROR } from './ReadError'

const SITE = { id: 's1', code: 'aaaf', name: 'Ask An Adventist Friend', domain: 'https://www.askanadventistfriend.com', languages: ['en'], wp_dev_url: null, wp_live_url: null, monday_board_id: '1' }

beforeEach(() => {
  Object.values(data).forEach(f => f.mockReset())
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// Href Links route pages (audit, 10 October 2026).
describe('SiteListPage', () => {
  it('says the read failed instead of crashing or showing no pages', async () => {
    data.loadSite.mockRejectedValue(new Error('boom'))
    render(await SiteListPage({ code: 'aaaf' }))
    expect(screen.getByRole('alert')).toHaveTextContent(READ_ERROR)
  })

  it('sends someone without the site Home before reading its pages', async () => {
    data.loadSite.mockResolvedValue(SITE)
    data.mayOpenSite.mockResolvedValue(false)
    await expect(SiteListPage({ code: 'aaaf' })).rejects.toThrow('REDIRECT /')
    expect(data.getSitePageData).not.toHaveBeenCalled()
  })

  it('says so when the pages cannot be read', async () => {
    data.loadSite.mockResolvedValue(SITE)
    data.mayOpenSite.mockResolvedValue(true)
    data.getSitePageData.mockRejectedValue(new Error('boom'))
    render(await SiteListPage({ code: 'aaaf' }))
    expect(screen.getByRole('alert')).toHaveTextContent(READ_ERROR)
  })
})

describe('SitePageDetail', () => {
  it('is not found when the page is not one of this site', async () => {
    data.loadSite.mockResolvedValue(SITE)
    data.mayOpenSite.mockResolvedValue(true)
    data.loadSitePage.mockResolvedValue(null)
    await expect(SitePageDetail({ code: 'aaaf', id: 'x' })).rejects.toThrow('NOT_FOUND')
  })

  it('sends someone without the site Home', async () => {
    data.loadSite.mockResolvedValue(SITE)
    data.mayOpenSite.mockResolvedValue(false)
    await expect(SitePageDetail({ code: 'aaaf', id: 'x' })).rejects.toThrow('REDIRECT /')
    expect(data.loadSitePage).not.toHaveBeenCalled()
  })
})
