import { describe, it, expect } from 'vitest'
import { cleanSettings, FAVOURITES_MAX } from './person'
import { pinnable, resolveFavourites } from './pages'
import { buildRail } from '@/lib/access/nav'

describe('what a browser may send to Settings', () => {
  it('reads each setting and maps it to its column', () => {
    expect(cleanSettings({ timeZone: 'America/Sao_Paulo' })).toEqual({ time_zone: 'America/Sao_Paulo' })
    expect(cleanSettings({ timeZone: null })).toEqual({ time_zone: null })
    expect(cleanSettings({ summaryHour: 7, startPage: 'my-work' })).toEqual({ summary_hour: 7, start_page: 'my-work' })
    expect(cleanSettings({ showBirthday: false, showAnniversary: true })).toEqual({ show_birthday: false, show_anniversary: true })
  })

  it('refuses what it does not know', () => {
    expect(cleanSettings({ timeZone: 'Mars/Olympus' })).toBeNull()
    expect(cleanSettings({ summaryHour: 3 })).toBeNull()
    expect(cleanSettings({ startPage: '/admin' })).toBeNull()
    expect(cleanSettings({ showBirthday: 'no' })).toBeNull()
    expect(cleanSettings({ favourites: ['ok', 'Not A Key!'] })).toBeNull()
    expect(cleanSettings({})).toBeNull()
  })

  it('keeps favourites unique and at most five', () => {
    expect(cleanSettings({ favourites: ['a', 'b', 'a', 'c', 'd', 'e', 'f'] })).toEqual({ favourites: ['a', 'b', 'c', 'd', 'e'] })
    expect(FAVOURITES_MAX).toBe(5)
  })
})

describe('the pages someone can pin', () => {
  const everything = buildRail({ can: () => true, canTool: () => true, level: 3 })
  const little = buildRail({ can: k => k === 'home' || k === 'my-work', canTool: () => false, level: 1 })

  it('never offers Home itself, or a page not built yet', () => {
    const rows = pinnable(everything).flatMap(g => g.rows)
    expect(rows.some(r => r.key === 'home')).toBe(false)
    expect(rows.some(r => r.soon)).toBe(false)
    expect(pinnable(everything)[0].label).toBe('Yours')
  })

  it('keeps favourites in their order, and drops pages the person cannot open', () => {
    const keys = pinnable(everything).flatMap(g => g.rows).map(r => r.key)
    const pick = [keys[3], keys[0]]
    expect(resolveFavourites(everything, pick).map(r => r.key)).toEqual(pick)
    expect(resolveFavourites(little, ['company-settings']).length).toBe(0)
  })
})
