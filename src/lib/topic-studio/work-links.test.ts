import { describe, expect, it } from 'vitest'
import { pulseId } from './work-links'

describe('pulseId', () => {
  it('reads the item id from a Monday task link', () => {
    expect(pulseId('https://truenorthdigitalmarketing.monday.com/boards/1764094550/pulses/9876543210')).toBe(9876543210)
    expect(pulseId('https://x.monday.com/boards/1/pulses/22?term=a')).toBe(22)
    expect(pulseId('https://x.monday.com/boards/1/pulses/22/')).toBe(22)
    expect(pulseId('https://x.monday.com/boards/1/views/5/pulses/22#c')).toBe(22)
  })
  it('is null when the link has no item', () => {
    for (const u of [null, undefined, '', 'https://x.monday.com/boards/1', 'https://x.test/pulses/abc', 'https://x.test/pulses/']) expect(pulseId(u)).toBeNull()
  })
})
