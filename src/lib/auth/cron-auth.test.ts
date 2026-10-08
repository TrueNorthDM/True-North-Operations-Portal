import { describe, it, expect } from 'vitest'
import { isCronRequest } from './cron-auth'

describe('isCronRequest', () => {
  it('accepts the crontab\'s bearer secret', () => {
    expect(isCronRequest('Bearer s3cret', 's3cret')).toBe(true)
  })
  it('refuses a wrong, partial or missing one', () => {
    expect(isCronRequest('Bearer s3cre', 's3cret')).toBe(false)
    expect(isCronRequest('s3cret', 's3cret')).toBe(false)
    expect(isCronRequest(null, 's3cret')).toBe(false)
  })
  it('stays closed when the secret is not set, even to an empty bearer', () => {
    expect(isCronRequest('Bearer ', '')).toBe(false)
    expect(isCronRequest('Bearer undefined', undefined)).toBe(false)
  })
})
