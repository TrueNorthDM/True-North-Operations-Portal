import { describe, it, expect, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ManualSection } from './SystemManual'
import { PAGES } from '@/lib/manual/registry'
import { SECTION_OF } from './manual/ManualContent'

beforeAll(() => {
  // jsdom has no IntersectionObserver; some sections may use one.
  globalThis.IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return [] } } as unknown as typeof IntersectionObserver
})

// Every section of the old one-page manual, now a page each (4 November 2026).
const IDS = ['overview', 'navigation', 'pages', 'access', 'monday', 'sources', 'home', 'north-time', 'quick-start', 'transition', 'where', 'annual-review']
function SystemManual({ superOnly }: { superOnly: readonly string[] }) {
  return <>{IDS.map(id => <ManualSection key={id} id={id} superOnly={superOnly} />)}</>
}

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
  it('has the Home, North Time, quick start, transition and Where do I find sections, each a page of the manual', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    const listed = new Set(PAGES.map(p => SECTION_OF[p.slug]).filter(Boolean))
    for (const id of ['home', 'north-time', 'quick-start', 'transition', 'where']) expect(container.querySelector(`section#${id}`)).not.toBeNull()
    // Home and Where do I find... are guides now; North Time and the move from TSheets keep these sections.
    for (const id of ['north-time', 'quick-start', 'transition']) expect(listed.has(id)).toBe(true)
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
    expect(t).toHaveTextContent('TSheets entries keep their job and fields for good')
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

describe('SystemManual, North Time rules of 4 November 2026', () => {
  it('describes the 12h stop and no longer the 5-hour window or "Still working?"', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    expect(container.querySelector('#north-time')).toHaveTextContent('12h 00m')
    expect(container).not.toHaveTextContent('Still working')
    expect(container).not.toHaveTextContent('4h 30m')
  })

  it('lets everyone add their own time: no "Request to add time" and no "shorten"', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    expect(container).not.toHaveTextContent('Request to add time')
    expect(container).not.toHaveTextContent(/only shorten/)
  })

  it('has contractors send their own invoice, step by step', () => {
    const { container } = render(<SystemManual superOnly={SUPER} />)
    const qs = container.querySelector('#qs-contractors')!
    for (const t of ['Sending your invoice (contractors)', 'Upload my own invoice', 'Build it here', 'Reset to my timesheet', 'the rate in your contract', 'This is my invoice']) expect(qs).toHaveTextContent(t)
    expect(container).not.toHaveTextContent('invoice is made')
    expect(container).not.toHaveTextContent('made by itself on the 1st')
  })
})
