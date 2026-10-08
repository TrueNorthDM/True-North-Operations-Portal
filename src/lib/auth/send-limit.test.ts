import { describe, it, expect } from 'vitest'
import { Limiter, visitorOf, SEND_PER_ADDRESS } from './send-limit'

describe('the sign-in code limits', () => {
  it('lets the window fill, then refuses, then frees up as it slides', () => {
    const l = new Limiter()
    const w = { limit: 3, ms: 1000 }
    expect([0, 10, 20].map(t => l.take('a', w, t))).toEqual([true, true, true])
    expect(l.take('a', w, 30)).toBe(false)
    expect(l.take('a', w, 1001)).toBe(true) // the first one has left the window
  })

  it('counts each address on its own', () => {
    const l = new Limiter()
    for (let i = 0; i < SEND_PER_ADDRESS.limit; i++) l.take('send:ana@x', SEND_PER_ADDRESS, i)
    expect(l.take('send:ana@x', SEND_PER_ADDRESS, 10)).toBe(false)
    expect(l.take('send:joao@x', SEND_PER_ADDRESS, 10)).toBe(true)
  })

  it('a refused request does not count against the window', () => {
    const l = new Limiter()
    const w = { limit: 1, ms: 100 }
    l.take('k', w, 0)
    for (let t = 1; t < 50; t++) l.take('k', w, t)
    expect(l.take('k', w, 100)).toBe(true)
  })
})

describe('visitorOf', () => {
  it('trusts only the address our own proxy appended (the last one)', () => {
    expect(visitorOf('1.2.3.4, 203.0.113.9')).toBe('203.0.113.9')
    expect(visitorOf('203.0.113.9')).toBe('203.0.113.9')
  })
  it('falls back when there is none', () => {
    expect(visitorOf(null)).toBe('unknown')
    expect(visitorOf('')).toBe('unknown')
  })
})
