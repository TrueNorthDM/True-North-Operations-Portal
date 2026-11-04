import { describe, it, expect } from 'vitest'
import { homeCardsFor, showsCard } from './cards'
import { readHidden } from '@/lib/settings/columns'

// Home's cards are each person's choice (leadership, 4 November 2026).

const all = { hasClock: true, seesI7: true, seesPublishing: true }
const user = { hasClock: true, seesI7: false, seesPublishing: false }

describe('the cards a person can have', () => {
  it('offers only what their level shows', () => {
    expect(homeCardsFor(all).map(c => c.key)).toEqual(['needs', 'pay', 'agenda', 'goals', 'i7', 'publishing'])
    expect(homeCardsFor(user).map(c => c.key)).toEqual(['needs', 'pay', 'agenda', 'goals'])
    expect(homeCardsFor({ ...user, hasClock: false }).map(c => c.key)).not.toContain('pay')
  })
})

describe('what Home draws', () => {
  it('everything they can have, until they turn a card off', () => {
    expect(showsCard('needs', all, {})).toBe(true)
    const hidden = readHidden({ home: ['needs', 'publishing'] })
    expect(showsCard('needs', all, hidden)).toBe(false)
    expect(showsCard('publishing', all, hidden)).toBe(false)
    expect(showsCard('agenda', all, hidden)).toBe(true)
  })

  it('never a card their level does not show, whatever was stored', () => {
    expect(showsCard('i7', user, {})).toBe(false)
  })

  it('drops unknown keys from what was stored', () => {
    expect(readHidden({ home: ['banner', 'needs'] })).toEqual({ home: ['needs'] })
  })
})
