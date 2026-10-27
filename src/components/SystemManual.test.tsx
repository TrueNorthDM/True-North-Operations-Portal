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

describe('SystemManual, Home and North Time (27 October 2026)', () => {
  it('has the Home, North Time, quick start, transition and Where do I find sections, each in the table of contents', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    for (const id of ['home', 'north-time', 'quick-start', 'transition', 'where']) {
      expect(container.querySelector(`section#${id}`)).not.toBeNull()
      expect(container.querySelector(`nav a[href="#${id}"]`)).not.toBeNull()
    }
  })

  it('gives a quick start to each audience', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    const qs = container.querySelector('#quick-start')!
    for (const who of ['Everyone', 'Contractors', 'Team Leaders', 'Admins, Super Admins and Finance']) expect(qs).toHaveTextContent(who)
  })

  it('names the two waves and keeps old hours in the old structure', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    const t = container.querySelector('#transition')!
    expect(t).toHaveTextContent('Sunday, Nov 8')
    expect(t).toHaveTextContent('Sunday, Nov 22')
    expect(t).toHaveTextContent('Old entries keep their TSheets job and fields for good')
  })

  it('no longer says the rail carries no counts, nor that Reports is coming soon', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    expect(container).not.toHaveTextContent('never on the rail’s icons')
    expect(container).not.toHaveTextContent('Reports (coming soon)')
  })

  it('never uses the em dash', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    expect(container.textContent).not.toContain('—')
  })
})
