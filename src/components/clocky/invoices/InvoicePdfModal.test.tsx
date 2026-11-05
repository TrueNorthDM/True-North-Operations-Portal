import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InvoicePdfModal } from './InvoicePdfModal'

// jsdom has no ResizeObserver; the window only uses it to fit the pages to a phone.
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} } as unknown as typeof ResizeObserver
vi.mock('@/components/ViewAsKeeper', () => ({ withViewAs: (h: string) => h }))
vi.mock('./InvoiceRecordSheet', () => ({ InvoiceRecordSheet: () => <div data-testid="record" /> }))

const base = {
  id: 9, number: 'INV-2026-003', date: 'Oct 1, 2026', period: 'September 2026', due: 'Oct 15, 2026',
  lines: [{ desc: 'i7 Marketing, September 2026', hrs: '10h', muted: false, rate: '$20.00', amt: '$200.00' }], reimb: [], total: '$200.00',
  from: { name: 'Sam', line: 'US', email: 's@x.org' }, to: { name: 'True North', line1: '', line2: '' }, paid: null,
}

describe('Preview invoice (owner, 5 November 2026)', () => {
  it('their own PDF comes first when they sent one', () => {
    const { container } = render(<InvoicePdfModal invoice={{ ...base, record: { madeBy: 'own_file' } as never, ownFile: { href: '/clocky-hours/invoices/9/own-pdf', name: 'their.pdf' } }} onClose={() => {}} />)
    expect(container.ownerDocument.querySelector('iframe')?.getAttribute('src')).toBe('/clocky-hours/invoices/9/own-pdf')
    expect(container.ownerDocument.querySelector('[data-invoice-number]')).toBeNull()
    expect(screen.getByTestId('record')).toBeInTheDocument()
  })
  it('the portal sheet for the builder and the old portal invoices', () => {
    const { container } = render(<InvoicePdfModal invoice={{ ...base, record: { madeBy: 'builder' } as never }} onClose={() => {}} />)
    expect(container.ownerDocument.querySelector('iframe')).toBeNull()
    expect(container.ownerDocument.querySelector('[data-invoice-number]')?.textContent).toBe('INV-2026-003')
    expect(screen.getByRole('button', { name: /Download/ })).toBeInTheDocument()
  })
})
