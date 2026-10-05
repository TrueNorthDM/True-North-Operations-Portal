import { describe, it, expect, afterEach } from 'vitest'
import { publicOrigin, internalOrigin } from './public-origin'

const behindProxy = 'https://localhost:3000/auth/callback?code=x'

afterEach(() => {
  delete process.env.APP_URL
  delete process.env.INTERNAL_ORIGIN
})

describe('publicOrigin', () => {
  it('is the request origin where APP_URL is not set (Vercel)', () => {
    expect(publicOrigin('https://truenorthoperationsportal.vercel.app/x')).toBe('https://truenorthoperationsportal.vercel.app')
  })

  it('is APP_URL on the own server, not the localhost the proxy hands over', () => {
    process.env.APP_URL = 'https://staging.truenorthportal.online'
    expect(publicOrigin(behindProxy)).toBe('https://staging.truenorthportal.online')
  })

  it('keeps only the origin of APP_URL', () => {
    process.env.APP_URL = 'https://truenorthportal.online/anything/'
    expect(publicOrigin(behindProxy)).toBe('https://truenorthportal.online')
  })
})

describe('internalOrigin', () => {
  it('is the request origin where INTERNAL_ORIGIN is not set (Vercel)', () => {
    expect(internalOrigin('https://truenorthoperationsportal.vercel.app/x')).toBe('https://truenorthoperationsportal.vercel.app')
  })

  it('is the container itself, in plain http, on the own server', () => {
    process.env.INTERNAL_ORIGIN = 'http://127.0.0.1:3000'
    expect(internalOrigin(behindProxy)).toBe('http://127.0.0.1:3000')
  })
})
