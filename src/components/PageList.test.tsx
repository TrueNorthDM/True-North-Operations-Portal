import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import type { PageListRow } from '@/lib/href-links/data'

let params = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/seo/href-links/aaaf',
  useSearchParams: () => params,
}))

import { PageList, groupOf, formatDoneDate } from './PageList'

const LANGS = ['en', 'es']
const row = (id: string, over: Partial<PageListRow>): PageListRow => ({
  id, name: `Page ${id}`,
  langStatus: { en: { hasUrl: true, confirmed: true }, es: { hasUrl: true, confirmed: true } },
  done: true,
  ...over,
})

// A page that was done, then lost a language: it keeps its done date, but it
// is not done (audit, 10 October 2026: one rule for done).
const reopened = row('2', {
  langStatus: { en: { hasUrl: true, confirmed: true }, es: { hasUrl: false, confirmed: false } },
  done: false,
  confirmedDoneAt: '2026-09-01T12:00:00Z',
})

describe('PageList (audit, 10 October 2026)', () => {
  it('groups by row.done, not by the done date', () => {
    expect(groupOf(reopened, LANGS)).toBe('ongoing')
    expect(groupOf(row('1', { confirmedDoneAt: null }), LANGS)).toBe('completed')
    expect(groupOf(row('3', { notRelevant: true, done: true }), LANGS)).toBe('not_relevant')
  })

  it('dates on the New York day', () => {
    expect(formatDoneDate('2026-10-10T02:00:00Z')).toBe('Oct 9, 2026')
    expect(formatDoneDate(null)).toBeNull()
  })

  it('agrees between the pill and the Done filter', () => {
    params = new URLSearchParams('status=done')
    render(<PageList rows={[row('1', {}), reopened]} languages={LANGS} siteCode="aaaf" accent="aaaf" />)
    // Completed is closed by default; open it to see its rows.
    fireEvent.click(screen.getByRole('button', { name: /completed/i }))
    const table = screen.getByRole('table')
    expect(within(table).getByText('Page 1')).toBeInTheDocument()
    expect(within(table).queryByText('Page 2')).toBeNull()
    expect(within(table).getByText('✓ Done')).toBeInTheDocument()
    params = new URLSearchParams()
  })

  it('has no listbox in its filters', () => {
    render(<PageList rows={[reopened]} languages={LANGS} siteCode="aaaf" accent="aaaf" />)
    fireEvent.click(screen.getByRole('button', { name: /status:/i }))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(screen.queryByRole('option')).toBeNull()
    expect(screen.getByRole('button', { name: /^All pages/ })).toHaveAttribute('aria-pressed', 'true')
  })
})
