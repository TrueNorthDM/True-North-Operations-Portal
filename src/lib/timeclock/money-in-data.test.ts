import { describe, it, expect } from 'vitest'
import { parseMoney } from './money-in-data'

describe('parseMoney', () => {
  // The distinction the whole feature rests on. The report draws a month
  // nobody has entered differently from a month where nothing came in, so an
  // empty field cannot become 0: it would turn "nobody has said" into "none",
  // and there would be no way left to undo a figure entered by mistake.
  it('reads an empty field as nothing entered, not as zero', () => {
    expect(parseMoney('', 'The amount').value).toBeNull()
    expect(parseMoney('   ', 'The amount').value).toBeNull()
  })

  it('reads a real zero as zero', () => {
    expect(parseMoney('0', 'The amount').value).toBe(0)
  })

  // These figures are pasted out of a bank statement, so they arrive wearing
  // whatever the statement put on them.
  it('takes a figure with a dollar sign, commas and spaces', () => {
    expect(parseMoney('$1,234.56', 'The amount').value).toBe(1234.56)
    expect(parseMoney(' 2,000 ', 'The amount').value).toBe(2000)
  })

  it('rounds to the cent', () => {
    expect(parseMoney('10.005', 'The amount').value).toBe(10.01)
    expect(parseMoney('33.333', 'The amount').value).toBe(33.33)
  })

  it('refuses what is not a number, and says which field', () => {
    expect(parseMoney('two thousand', 'The amount').error).toBe('The amount has to be a number.')
    expect(parseMoney('abc', 'The hours').error).toBe('The hours has to be a number.')
  })

  // Money in is money in. A negative is a typo or a refund, and a refund is not
  // something this table knows how to mean.
  it('refuses a negative', () => {
    expect(parseMoney('-50', 'The amount').error).toBe('The amount cannot be negative.')
  })

  it('gives no value back when it refuses', () => {
    expect(parseMoney('-50', 'The amount').value).toBeNull()
    expect(parseMoney('nope', 'The amount').value).toBeNull()
  })
})
