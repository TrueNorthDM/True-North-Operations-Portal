import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SystemManual } from './SystemManual'

beforeAll(() => {
  // jsdom has no IntersectionObserver; the manual uses one for its scroll-spy.
  globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } } as unknown as typeof IntersectionObserver
})

const SUPER = ['Access levels', 'Company settings > APIs & tokens', 'System manual > How it runs']

describe('SystemManual, Access section (audit, 10 October 2026)', () => {
  it('describes the four levels and no longer the team-grant model', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    const access = container.querySelector('#access')!
    for (const level of ['Super Admin', 'Admin', 'Team Leader', 'User']) expect(access).toHaveTextContent(level)
    expect(access).not.toHaveTextContent('granted role on')
    expect(access).not.toHaveTextContent('Everything is managed from the Directory')
  })

  it('lists the Super Admin only items it is given (the page reads them from the catalogue)', () => {
    render(<SystemManual superOnly={SUPER} />)
    for (const label of SUPER) expect(screen.getByText(label)).toBeInTheDocument()
  })

  it('no longer mentions Tickets', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    expect(container).not.toHaveTextContent(/Tickets/)
  })
})
