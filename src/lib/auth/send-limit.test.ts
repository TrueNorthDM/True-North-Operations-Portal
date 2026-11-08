import { describe, it, expect } from 'vitest'
import { Limiter, isCloudflare, visitorFrom, visitorOf, SEND_PER_ADDRESS } from './send-limit'

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

const hdrs = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null })

describe('visitorFrom (security audit, 8 November 2026)', () => {
  it('knows Cloudflare addresses, IPv4 and IPv6', () => {
    expect(isCloudflare('172.69.4.10')).toBe(true)
    expect(isCloudflare('104.23.1.1')).toBe(true)
    expect(isCloudflare('2606:4700:10::ac43:1')).toBe(true)
    expect(isCloudflare('203.0.113.9')).toBe(false)
    expect(isCloudflare('2804:814::1')).toBe(false)
    expect(isCloudflare('not an ip')).toBe(false)
  })
  it('takes the visitor Cloudflare names when the hop our proxy saw is Cloudflare (what the staging server receives)', () => {
    expect(visitorFrom(hdrs({ 'x-forwarded-for': '198.51.100.7, 198.51.100.7,172.69.4.10', 'cf-connecting-ip': '198.51.100.7' }))).toBe('198.51.100.7')
  })
  it('ignores cf-connecting-ip from anyone who reaches the server directly', () => {
    expect(visitorFrom(hdrs({ 'x-forwarded-for': '1.2.3.4, 203.0.113.9', 'cf-connecting-ip': '1.2.3.4' }))).toBe('203.0.113.9')
  })
  it('ignores a cf-connecting-ip that is not an address', () => {
    expect(visitorFrom(hdrs({ 'x-forwarded-for': '172.69.4.10', 'cf-connecting-ip': 'x, y' }))).toBe('172.69.4.10')
  })
  it('counts an IPv6 visitor by its /64, so changing the last half starts nothing new', () => {
    const a = visitorFrom(hdrs({ 'x-forwarded-for': '172.69.4.10', 'cf-connecting-ip': '2804:814:4073:df00:dc7f:e8ec:a7ba:a87d' }))
    const b = visitorFrom(hdrs({ 'x-forwarded-for': '172.69.4.10', 'cf-connecting-ip': '2804:814:4073:df00::1' }))
    expect(a).toBe(b)
    expect(a).toBe('280408144073df00::/64')
    expect(visitorFrom(hdrs({ 'x-forwarded-for': '172.69.4.10', 'cf-connecting-ip': '2804:814:4073:df01::1' }))).not.toBe(a)
  })
  it('is unknown with no headers', () => {
    expect(visitorFrom(hdrs({}))).toBe('unknown')
  })
})
