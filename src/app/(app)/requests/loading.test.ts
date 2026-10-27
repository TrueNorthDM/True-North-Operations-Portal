import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Requests answers a click at once (audit, 27 October 2026): every folder of
 * it where two of its pages meet on a navigation has its own loading file,
 * since one above the layout the two pages share is never seen
 * ((app)/loading.tsx). The list and a reimbursement document meet in
 * reimbursements/, which had none.
 */
describe('Requests loading states', () => {
  const pagesUnder = (d: string): number => readdirSync(d).reduce((n, f) => {
    const p = join(d, f)
    return n + (statSync(p).isDirectory() ? pagesUnder(p) : f === 'page.tsx' ? 1 : 0)
  }, 0)

  it('has a loading file wherever two of its pages meet', () => {
    const missing: string[] = []
    const walk = (d: string) => {
      const subs = readdirSync(d).map(f => join(d, f)).filter(p => statSync(p).isDirectory())
      const meeting = (existsSync(join(d, 'page.tsx')) ? 1 : 0) + subs.filter(s => pagesUnder(s) > 0).length
      if (meeting > 1 && !existsSync(join(d, 'loading.tsx'))) missing.push(d.slice(__dirname.length) || '/')
      subs.forEach(walk)
    }
    walk(__dirname)
    expect(missing).toEqual([])
  })
})
