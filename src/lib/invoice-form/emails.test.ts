import { describe, expect, it } from 'vitest'
import { renderFormMail } from './emails'

describe("the invoice form's emails", () => {
  it('sends the code, in the subject and the body', () => {
    const m = renderFormMail({ kind: 'code', code: '482913' }, 'https://truenorthportal.online')
    expect(m.subject).toBe('Your True North code: 482913')
    expect(m.text).toContain('482913')
    expect(m.text).toContain('10 minutes')
  })

  it('says the number comes later for a new sender', () => {
    const m = renderFormMail({ kind: 'received', number: null, month: 'October 2026', total: '$65.00', lines: [{ text: 'About us, Spanish (translated page)', amount: '$30.00' }] }, 'https://x.test')
    expect(m.subject).toBe('We have received your invoice')
    expect(m.text).toContain('Its number comes by email')
    expect(m.text).toContain('Total due: $65.00')
  })

  it('gives the reason and the link when it is returned, escaped in the HTML', () => {
    const m = renderFormMail({ kind: 'returned', number: 'INV-2026-014', month: 'October 2026', reason: 'Wrong <amount>', link: 'https://x.test/send/abc' }, 'https://x.test')
    expect(m.text).toContain('"Wrong <amount>"')
    expect(m.html).toContain('Wrong &lt;amount&gt;')
    expect(m.html).toContain('https://x.test/send/abc')
  })

  it('never uses the em dash', () => {
    for (const kind of ['approved', 'paid'] as const) {
      const m = renderFormMail(kind === 'paid' ? { kind, number: 'INV-1', month: 'October 2026', total: '$1.00', paidOn: 'Nov 3, 2026', ref: 'W-1' } : { kind, number: 'INV-1', month: 'October 2026', total: '$1.00' }, 'https://x.test')
      expect(m.html + m.text).not.toContain(String.fromCharCode(0x2014))
    }
  })
})
