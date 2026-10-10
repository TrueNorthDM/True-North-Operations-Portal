import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const actions = vi.hoisted(() => ({
  savePageUrls: vi.fn(),
  toggleConfirmation: vi.fn(),
  setPageNotRelevant: vi.fn(),
  deletePage: vi.fn(),
}))
vi.mock('@/app/(app)/seo/href-links/actions', () => actions)
const refresh = vi.fn()
const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh, push }) }))

import { PageDetail, changedLiveLanguages } from './PageDetail'

const PAGE_ID = '00000000-0000-0000-0000-000000000001'

function setup(over: Partial<React.ComponentProps<typeof PageDetail>> = {}) {
  return render(
    <PageDetail
      pageId={PAGE_ID}
      siteCode="aaaf"
      pageName="Who is God?"
      languages={['en', 'es']}
      domain="https://www.askanadventistfriend.com"
      savedUrls={[{ language_code: 'en', url: 'https://www.askanadventistfriend.com/god' }]}
      confirmations={[{ language_code: 'en', confirmed_on_live: true }]}
      accent="aaaf"
      {...over}
    />,
  )
}

beforeEach(() => {
  Object.values(actions).forEach(f => f.mockReset())
  refresh.mockReset()
})

describe('PageDetail (audit, 10 October 2026)', () => {
  it('labels each link field by language and says what a link must be', () => {
    setup()
    expect(screen.getByLabelText('English link')).toHaveValue('https://www.askanadventistfriend.com/god')
    expect(screen.getByLabelText('Spanish link')).toHaveValue('')
    expect(screen.getByText('A link must be https and a page on www.askanadventistfriend.com.')).toBeInTheDocument()
  })

  it('names each confirmation box', () => {
    setup()
    expect(screen.getByRole('checkbox', { name: 'English confirmed live on WordPress' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Spanish confirmed live on WordPress' })).toBeDisabled()
  })

  it('shows why a link was refused under its field and keeps what was typed', async () => {
    actions.savePageUrls.mockResolvedValue({
      ok: false,
      error: 'Nothing was saved: fix the links marked below.',
      rejected: [{ language_code: 'es', reason: 'The link is not a page on www.askanadventistfriend.com.' }],
    })
    setup()
    fireEvent.change(screen.getByLabelText('Spanish link'), { target: { value: 'https://elsewhere.com/x' } })
    fireEvent.click(screen.getByRole('button', { name: /save urls/i }))
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(1))
    expect(actions.savePageUrls).toHaveBeenCalledWith({
      pageId: PAGE_ID,
      urls: [
        { language_code: 'en', url: 'https://www.askanadventistfriend.com/god' },
        { language_code: 'es', url: 'https://elsewhere.com/x' },
      ],
    })
    expect(screen.getByText('The link is not a page on www.askanadventistfriend.com.')).toBeInTheDocument()
    expect(screen.getByLabelText('Spanish link')).toHaveValue('https://elsewhere.com/x')
    expect(screen.getByLabelText('Spanish link')).toHaveAttribute('aria-invalid', 'true')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('warns when a live link is being changed', () => {
    setup()
    const note = /takes its confirmation away and flags the page/
    expect(screen.queryByText(note)).toBeNull()
    fireEvent.change(screen.getByLabelText('English link'), { target: { value: 'https://www.askanadventistfriend.com/other' } })
    expect(screen.getByText(note)).toBeInTheDocument()
  })

  it('confirms with the page and the language only', async () => {
    actions.toggleConfirmation.mockResolvedValue({ ok: true })
    setup()
    fireEvent.click(screen.getByRole('checkbox', { name: 'English confirmed live on WordPress' }))
    await waitFor(() => expect(actions.toggleConfirmation).toHaveBeenCalledWith({ pageId: PAGE_ID, languageCode: 'en', value: false }))
  })

  it('shows the done date on the New York day', () => {
    setup({ done: true, confirmedDoneAt: '2026-10-10T02:00:00Z', confirmations: [{ language_code: 'en', confirmed_on_live: true }, { language_code: 'es', confirmed_on_live: true }] })
    expect(screen.getByText('Done Oct 9, 2026')).toBeInTheDocument()
  })
})

describe('changedLiveLanguages', () => {
  it('lists only live languages whose link differs from the saved one', () => {
    const saved = [{ language_code: 'en', url: 'a' }, { language_code: 'es', url: 'b' }]
    const conf = [{ language_code: 'en', confirmed_on_live: true }, { language_code: 'es', confirmed_on_live: false }]
    expect(changedLiveLanguages(['en', 'es'], { en: 'a', es: 'c' }, saved, conf)).toEqual([])
    expect(changedLiveLanguages(['en', 'es'], { en: '', es: 'b' }, saved, conf)).toEqual(['en'])
  })
})
