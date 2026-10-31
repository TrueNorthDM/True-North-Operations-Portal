import { describe, expect, it } from 'vitest'
import { quoted } from './google-drive'

describe('names in a Drive search', () => {
  it('keep quotes and backslashes from breaking the query', () => {
    expect(quoted("Ana O'Neil")).toBe("'Ana O\\'Neil'")
    expect(quoted('a\\b')).toBe("'a\\\\b'")
  })
})
