import { describe, expect, it } from 'vitest'
import { checkPass, printPass } from './print-token'

const S = 'a-test-secret-that-is-long-enough'
const NOW = 1_793_000_000_000

describe('the Drive print pass', () => {
  it('opens the one document it was signed for', () => {
    const p = printPass('invoice', 12, NOW, S)
    expect(checkPass(p, 'invoice', 12, NOW + 1000, S)).toBe(true)
    expect(checkPass(p, 'invoice', 13, NOW + 1000, S)).toBe(false)
    expect(checkPass(p, 'rmb', 12, NOW + 1000, S)).toBe(false)
  })

  it('runs out after two minutes', () => {
    const p = printPass('rmb', 4, NOW, S)
    expect(checkPass(p, 'rmb', 4, NOW + 119_000, S)).toBe(true)
    expect(checkPass(p, 'rmb', 4, NOW + 121_000, S)).toBe(false)
  })

  it('refuses another secret, a changed expiry, garbage, and no secret at all', () => {
    const p = printPass('invoice', 1, NOW, S)
    expect(checkPass(p, 'invoice', 1, NOW, 'another-secret')).toBe(false)
    const [exp, sig] = p.split('.')
    expect(checkPass(`${Number(exp) + 1}.${sig}`, 'invoice', 1, NOW, S)).toBe(false)
    expect(checkPass('nonsense', 'invoice', 1, NOW, S)).toBe(false)
    expect(checkPass(null, 'invoice', 1, NOW, S)).toBe(false)
    expect(checkPass(p, 'invoice', 1, NOW, '')).toBe(false)
    expect(() => printPass('invoice', 1, NOW, '')).toThrow()
  })

  it('refuses a pass that claims to last longer than two minutes', () => {
    const p = printPass('invoice', 1, NOW + 10 * 60_000, S)
    expect(checkPass(p, 'invoice', 1, NOW, S)).toBe(false)
  })
})
