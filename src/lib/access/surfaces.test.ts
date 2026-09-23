import { describe, it, expect } from 'vitest'

import {
  SURFACES, SURFACE_KEYS, CONFIGURABLE_ROLES, SURFACE_GROUPS, PRIORITY_OWN, PRIORITY_ALL,
  surfaceAllowed, directoryLevel,
} from './surfaces'
import { buildRail, RAIL, surfaceForPath, type ResolvedEntry } from './nav'

// The rules the whole portal gates on. These are pure, so they are cheap to
// pin down, and every case below is one that actually went wrong at some point:
// a level that saw the interface without the power, a locked row that a stored
// row could have overridden, a sidebar key that no longer matched a surface.

const NONE = new Map<string, boolean>()

describe('surfaceAllowed', () => {
  it('lets admin through every surface, including admin-locked ones', () => {
    // This is the lock-out guarantee: there must be no configuration, and no
    // stored row, that can shut an admin out of the screen that undoes it.
    for (const s of SURFACES) {
      expect(surfaceAllowed('admin', s.key, NONE), s.key).toBe(true)
    }
  })

  it('lets admin through even when a row says otherwise', () => {
    const denied = new Map(SURFACES.map(s => [`admin:${s.key}`, false]))
    for (const s of SURFACES) {
      expect(surfaceAllowed('admin', s.key, denied), s.key).toBe(true)
    }
  })

  it('grants always-on surfaces to every level', () => {
    for (const s of SURFACES.filter(s => s.locked === 'always')) {
      for (const role of CONFIGURABLE_ROLES) {
        expect(surfaceAllowed(role, s.key, NONE), `${role}:${s.key}`).toBe(true)
      }
    }
  })

  it('denies admin-locked surfaces to every configurable level, even with a row allowing it', () => {
    // A locked row is structural, not policy: a stray row in the table (or a
    // hand-written insert) must not be able to hand out Settings or Admin.
    for (const s of SURFACES.filter(s => s.locked === 'admin')) {
      for (const role of CONFIGURABLE_ROLES) {
        const allowed = new Map([[`${role}:${s.key}`, true]])
        expect(surfaceAllowed(role, s.key, allowed), `${role}:${s.key}`).toBe(false)
      }
    }
  })

  it('falls back to the catalogue default when no row is stored', () => {
    for (const s of SURFACES.filter(s => !s.locked)) {
      for (const role of CONFIGURABLE_ROLES) {
        expect(surfaceAllowed(role, s.key, NONE), `${role}:${s.key}`).toBe(s.defaults[role])
      }
    }
  })

  it('lets a stored row override the default in both directions', () => {
    const configurable = SURFACES.find(s => !s.locked)!
    const on = new Map([[`user:${configurable.key}`, true]])
    const off = new Map([[`user:${configurable.key}`, false]])
    expect(surfaceAllowed('user', configurable.key, on)).toBe(true)
    expect(surfaceAllowed('user', configurable.key, off)).toBe(false)
  })

  it('denies an unknown surface rather than defaulting to allowed', () => {
    expect(surfaceAllowed('admin', 'no-such-surface', NONE)).toBe(false)
    expect(surfaceAllowed('user', 'no-such-surface', NONE)).toBe(false)
  })
})

describe('directoryLevel', () => {
  const can = (...allowed: string[]) => (key: string) => allowed.includes(key)

  it('is level 1 with neither row', () => {
    expect(directoryLevel(can())).toBe(1)
  })

  it('is level 2 with the tool-access row only', () => {
    expect(directoryLevel(can('dir-teams-config'))).toBe(2)
  })

  it('is level 3 with the full-directory row, with or without level 2', () => {
    expect(directoryLevel(can('dir-full'))).toBe(3)
    expect(directoryLevel(can('dir-teams-config', 'dir-full'))).toBe(3)
  })
})

describe('catalogue integrity', () => {
  it('has no duplicate surface keys', () => {
    const keys = SURFACES.map(s => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every configurable surface a default for every level', () => {
    for (const s of SURFACES.filter(s => !s.locked)) {
      for (const role of CONFIGURABLE_ROLES) {
        expect(typeof s.defaults[role], `${s.key}.${role}`).toBe('boolean')
      }
    }
  })

  it('backs every rail item and panel row with a real surface', () => {
    // A typo here would silently drop an icon from the rail for everyone.
    for (const e of RAIL) {
      if (e.kind === 'rule') continue
      if (e.surface) expect(SURFACE_KEYS.has(e.surface), e.key).toBe(true)
      if (e.kind === 'hub') {
        for (const i of e.groups.flatMap(g => g.items)) {
          if (i.surface) expect(SURFACE_KEYS.has(i.surface), `${e.key} > ${i.key}`).toBe(true)
        }
      }
    }
  })

  it('maps every guarded route prefix to a real surface', () => {
    for (const path of ['/admin', '/settings', '/human-resources', '/directory', '/my-work', '/ops/publishing', '/ops/client-reports/i7', '/seo/href-links', '/seo/href-links/aaaf', '/chat', '/emails', '/organization']) {
      const surface = surfaceForPath(path)
      expect(surface, path).not.toBeNull()
      expect(SURFACE_KEYS.has(surface!), `${path} -> ${surface}`).toBe(true)
    }
  })

  it('matches a route prefix on its own path and its children, not on a lookalike', () => {
    expect(surfaceForPath('/settings')).toBe('settings')
    expect(surfaceForPath('/settings/anything')).toBe('settings')
    expect(surfaceForPath('/settings-other')).toBeNull()
  })
})

describe('My Work, Report and My Team as three grants', () => {
  const keys = SURFACES.map(s => s.key)

  it('lists all three separately', () => {
    expect(keys).toContain('my-work')
    expect(keys).toContain('report')
    expect(keys).toContain('my-team')
  })

  // The three were one row until Report existed. Splitting them must not
  // change what anybody reaches on the day of the split, so all three default
  // the same way; migration 073 copies the explicit rows across.
  it('gives all three the same default, so the split changes nothing by itself', () => {
    const of = (k: string) => SURFACES.find(s => s.key === k)!.defaults
    expect(of('report')).toEqual(of('my-work'))
    expect(of('my-team')).toEqual(of('my-work'))
  })

  // One module, one icon: a hub whose panel holds the three views.
  const myWork = (can: (k: string) => boolean) =>
    buildRail({ can: k => k === 'home' || can(k), canTool: () => false, level: 1 })
      .find((e): e is Extract<ResolvedEntry, { kind: 'hub' }> => e.kind === 'hub' && e.key === 'my-work')

  it('shows one rail item, not three', () => {
    const rail = buildRail({ can: () => true, canTool: () => true, level: 3 })
    const keys = rail.map(e => (e.kind === 'page' ? e.item.key : e.kind === 'hub' ? e.key : '|'))
    expect(keys).toContain('my-work')
    expect(keys).not.toContain('report')
    expect(keys).not.toContain('my-team')
  })

  it('shows the hub when any one of the three is granted', () => {
    expect(myWork(k => k === 'report')).toBeTruthy()
    expect(myWork(k => k === 'my-team')).toBeTruthy()
    expect(myWork(() => false)).toBeUndefined()
  })

  // With a single view there is nothing to choose: the hub goes straight there,
  // and never to a view they cannot open, which would be a link to the login page.
  it('goes straight to the one view the person is allowed, and opens the panel otherwise', () => {
    expect(myWork(() => true)?.direct).toBeUndefined()
    expect(myWork(k => k === 'report')?.direct).toBe('/report')
    expect(myWork(k => k === 'my-team')?.direct).toBe('/my-work?tab=team')
  })

  it('guards /report with report and /my-work with my-work', () => {
    expect(surfaceForPath('/report')).toBe('report')
    expect(surfaceForPath('/report/csv')).toBe('report')
    expect(surfaceForPath('/my-work')).toBe('my-work')
  })
})

describe('Team priority as two rows of the matrix', () => {
  const row = (k: string) => SURFACES.find(s => s.key === k)!

  it('has its own group, drawn in the table', () => {
    expect(row(PRIORITY_OWN).group).toBe('Team priority')
    expect(row(PRIORITY_ALL).group).toBe('Team priority')
    expect(SURFACE_GROUPS).toContain('Team priority')
  })

  // Shipping the rows must not change who could set an order the day before:
  // anyone leading a team, at any level. Admin Assistant was decided on
  // 16 September 2026 to set every team's.
  it('defaults to what was decided', () => {
    expect(row(PRIORITY_OWN).defaults).toEqual({ admin_assistant: true, team_leader: true, user: true })
    expect(row(PRIORITY_ALL).defaults).toEqual({ admin_assistant: true, team_leader: false, user: false })
  })

  it('stays configurable, so an admin can hand it to a level', () => {
    expect(row(PRIORITY_OWN).locked).toBeUndefined()
    expect(row(PRIORITY_ALL).locked).toBeUndefined()
    expect(surfaceAllowed('team_leader', PRIORITY_ALL, new Map([['team_leader:priority-all', true]]))).toBe(true)
    expect(surfaceAllowed('user', PRIORITY_OWN, new Map([['user:priority-own', false]]))).toBe(false)
  })
})
