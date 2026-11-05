import { describe, it, expect, vi } from 'vitest'

// The panel and every clock action stop a clock by themselves only when it is
// North Time's own and the person has started (audit, 5 November 2026).

const reads = vi.hoisted(() => ({ start: 0, dir: 0 }))
vi.mock('./waves-data', () => ({ startOf: async () => { reads.start++; return { startsOn: '2026-11-08', noWave: false } } }))
vi.mock('./clocky-context', async importOriginal => ({
  ...(await importOriginal<typeof import('./clocky-context')>()),
  db: () => ({}),
  loadDirectory: async () => { reads.dir++; throw new Error('not reached') },
  loadCatalog: async () => { throw new Error('not reached') },
}))

const { ownClockActs, stopOwnIfDue, northTimeStart } = await import('./clocky-panel')

const who = { personId: 'ana', level: 'team_leader' as const, leader: true, zone: 'America/New_York' }
const START = '2026-11-01T05:00:00.000Z'
const row = (source: 'portal' | 'tsheets') => ({ id: 1, person_id: 'ana', source, kind: 'clock', started_at: START, ended_at: null }) as never

describe('ownClockActs', () => {
  const started = { startsOn: '2026-11-08', noWave: false }
  it('only the portal\'s own clocks, from the start date', () => {
    expect(ownClockActs({ source: 'portal' }, started, '2026-11-08')).toBe(true)
    expect(ownClockActs({ source: 'tsheets' }, started, '2026-11-20')).toBe(false)
    expect(ownClockActs({ source: 'portal' }, started, '2026-11-07')).toBe(false)
    expect(ownClockActs({ source: 'portal' }, { startsOn: null, noWave: true }, '2026-11-20')).toBe(false)
    expect(ownClockActs({ source: 'portal' }, { ...started, unread: true }, '2026-11-20')).toBe(false)
  })
})

describe('stopOwnIfDue', () => {
  it('never stops a clock copied from TSheets: nothing is even read', async () => {
    expect(await stopOwnIfDue({} as never, row('tsheets'), new Date('2026-11-20T12:00:00Z'), who)).toBeNull()
    expect(reads).toEqual({ start: 0, dir: 0 })
  })

  it('leaves a portal clock alone before the start date', async () => {
    expect(await stopOwnIfDue({} as never, row('portal'), new Date('2026-11-05T12:00:00Z'), who)).toBeNull()
    expect(reads.start).toBe(1)
    expect(reads.dir).toBe(0)
    expect(await stopOwnIfDue({} as never, row('portal'), new Date('2026-11-20T12:00:00Z'), who, { startsOn: null, noWave: false, unread: true })).toBeNull()
    expect(reads.dir).toBe(0)
  })
})

describe('northTimeStart', () => {
  it('fails closed: a failed read comes back unread, never "no gate"', async () => {
    const wd = await import('./waves-data')
    vi.spyOn(wd, 'startOf').mockRejectedValueOnce(new Error('connection reset'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await northTimeStart(who)).toEqual({ startsOn: null, noWave: false, unread: true })
  })
})
