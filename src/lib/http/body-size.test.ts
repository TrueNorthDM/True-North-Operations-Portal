import { describe, expect, it } from 'vitest'
import { bodyTooBig } from './body-size'

const req = (len?: string) => ({ headers: new Headers(len === undefined ? {} : { 'content-length': len }) })

describe('bodyTooBig', () => {
  it('refuses a body announced as bigger than the route takes', () => {
    expect(bodyTooBig(req('50000001'), 50_000_000)).toBe(true)
    expect(bodyTooBig(req('1000'), 50_000_000)).toBe(false)
  })
  it('lets through a body that announces no size, or a nonsense one (the proxy still caps it)', () => {
    expect(bodyTooBig(req(), 10)).toBe(false)
    expect(bodyTooBig(req('abc'), 10)).toBe(false)
  })
})
