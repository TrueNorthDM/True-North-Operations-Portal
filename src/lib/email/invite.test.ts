import { describe, it, expect } from 'vitest'
import { renderInvite } from './invite'

const base = {
  firstName: 'Ana',
  invitedBy: 'Tina Gennette',
  email: 'ana@goodnewsadvocates.org',
  url: 'https://truenorthportal.online/login?email=ana%40goodnewsadvocates.org',
  origin: 'https://truenorthportal.online',
}

describe('renderInvite', () => {
  it('names who invited, greets the person and links to the sign-in page', () => {
    const m = renderInvite(base)
    expect(m.subject).toBe('Tina Gennette invited you to the True North Operations Portal')
    expect(m.html).toContain('Hi Ana,')
    expect(m.html).toContain('href="https://truenorthportal.online/login?email=ana%40goodnewsadvocates.org"')
    expect(m.html).toContain('https://truenorthportal.online/logos/true-north.png')
    expect(m.text).toContain(base.url)
  })

  it('leaves no template placeholders behind', () => {
    const m = renderInvite(base)
    expect(m.html).not.toMatch(/\{\{|\$\{/)
  })

  it('escapes names, so a name cannot inject markup', () => {
    const m = renderInvite({ ...base, firstName: '<b>Ana</b>', invitedBy: 'Tom & "Jerry"' })
    expect(m.html).not.toContain('<b>Ana</b>')
    expect(m.html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
    expect(m.html).toContain('Tom &amp; &quot;Jerry&quot;')
  })

  it('uses no dashes as punctuation (house rule)', () => {
    const m = renderInvite(base)
    expect(m.html + m.text + m.subject).not.toMatch(/[\u2014\u2013]/)
  })
})
