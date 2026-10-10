import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const actions = vi.hoisted(() => ({
  updateSiteLanguages: vi.fn(),
  setLanguagePaused: vi.fn(),
  saveMondayBoardId: vi.fn(),
  saveSiteWpUrls: vi.fn(),
}))
vi.mock('@/app/actions', () => actions)
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

import { SiteCard } from './SiteCard'

const SITE = {
  code: 'aaaf' as const, name: 'Ask An Adventist Friend', domain: 'https://www.askanadventistfriend.com',
  languages: ['en', 'es'], paused_languages: ['sw'], language_paths: {}, pagesWithUrlsCount: 3,
  monday_board_id: '462251934', wp_dev_url: null, wp_live_url: null,
}

beforeEach(() => Object.values(actions).forEach(f => f.mockReset()))

describe('SiteCard (audit, 10 October 2026)', () => {
  it('labels its fields and names its switches by language', () => {
    render(<SiteCard site={SITE} />)
    expect(screen.getByLabelText('Monday board ID')).toHaveValue('462251934')
    expect(screen.getByLabelText('WordPress Dev')).toBeInTheDocument()
    expect(screen.getByLabelText('WordPress Live')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Track Spanish' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('switch', { name: 'Track Swahili' })).toHaveAttribute('aria-checked', 'false')
  })

  it('asks before adding a language, in a named modal dialog that Escape closes', async () => {
    render(<SiteCard site={SITE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add language' }))
    fireEvent.change(screen.getByLabelText('Language to add'), { target: { value: 'French' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    const dialog = screen.getByRole('dialog', { name: 'Add French?' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveTextContent('3 pages with URLs will be flagged')
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(actions.updateSiteLanguages).not.toHaveBeenCalled()
  })

  it('adds the language once confirmed', async () => {
    actions.updateSiteLanguages.mockResolvedValue({ ok: true })
    render(<SiteCard site={SITE} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add language' }))
    fireEvent.change(screen.getByLabelText('Language to add'), { target: { value: 'fr' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add and flag pages' }))
    await waitFor(() => expect(actions.updateSiteLanguages).toHaveBeenCalledWith({ siteCode: 'aaaf', newLanguages: ['en', 'es', 'fr'] }))
  })
})
