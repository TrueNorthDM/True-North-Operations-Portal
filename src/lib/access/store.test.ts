import { describe, it, expect } from 'vitest'
import { loadRules, loadSubject, loadSubjects } from './store'
import { decide, allowedKeys } from './decide'

/**
 * The step from the access tables to the rule: what a Super Admin saves on
 * Admin > Access levels (a tick, a tool's team list, an exception, a level, a
 * team position) is exactly what decides the next page a person opens. The
 * database is a small fake that answers the same queries store.ts sends, with
 * rows shaped like migration 094's.
 */

type Row = Record<string, unknown>
type Tables = Record<string, Row[]>

/** Just enough of the Supabase query builder for store.ts. */
function fakeDb(tables: Tables, broken: string[] = []) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])]
      const q = {
        select: () => q,
        order: () => q,
        eq: (col: string, v: unknown) => { rows = rows.filter(r => r[col] === v); return q },
        is: (col: string, v: unknown) => { rows = rows.filter(r => (r[col] ?? null) === v); return q },
        or: (expr: string) => {
          // Only the one store.ts sends: status.is.null,status.eq.active
          if (expr === 'status.is.null,status.eq.active') rows = rows.filter(r => r.status == null || r.status === 'active')
          return q
        },
        maybeSingle: () => Promise.resolve(broken.includes(table) ? { data: null, error: { message: 'boom' } } : { data: rows[0] ?? null, error: null }),
        then: (ok: (v: unknown) => unknown, ko?: (e: unknown) => unknown) =>
          Promise.resolve(broken.includes(table) ? { data: null, error: { message: 'boom' } } : { data: rows, error: null }).then(ok, ko),
      }
      return q
    },
  } as never
}

const T = '2026-10-07'
const SEO = 'team-seo'
const WRITERS = 'team-writers'

const base = (): Tables => ({
  access_rules: [],
  access_tool_scope: [],
  access_tool_teams: [],
  people: [
    { id: 'p-ana', full_name: 'Ana', access_level: null, profile_id: 'u-ana', status: 'active' },
    { id: 'p-bea', full_name: 'Bea', access_level: null, profile_id: 'u-bea', status: 'active' },
    { id: 'p-cai', full_name: 'Cai', access_level: 'admin', profile_id: 'u-cai', status: 'active' },
    { id: 'p-old', full_name: 'Old', access_level: null, profile_id: null, status: 'inactive' },
  ],
  team_members: [
    { person_id: 'p-ana', team_id: SEO, position: 'lead' },
    // The older position words still read as Lead until migration 095.
    { person_id: 'p-bea', team_id: WRITERS, position: 'collaborator' },
    { person_id: 'p-cai', team_id: SEO, position: 'member' },
  ],
  access_exceptions: [],
})

async function can(tables: Tables, personId: string, key: string) {
  const db = fakeDb(tables)
  const [rules, who] = await Promise.all([loadRules(db), loadSubject(db, personId)])
  return decide(who!, key, rules, { today: T }).ok
}

describe('levels and team positions', () => {
  it('reads Lead of any team as Team Leader, and the given level as given', async () => {
    const db = fakeDb(base())
    expect((await loadSubject(db, 'p-ana'))!.level).toBe('team_leader')
    expect((await loadSubject(db, 'p-bea'))!.level).toBe('user')
    expect((await loadSubject(db, 'p-cai'))!.level).toBe('admin')
  })

  it('reads the older words Founder, Manager and Team Leader as Lead', async () => {
    for (const position of ['founder', 'manager', 'team_leader']) {
      const t = base(); t.team_members[1].position = position
      expect((await loadSubject(fakeDb(t), 'p-bea'))!.level, position).toBe('team_leader')
    }
  })

  it('makes someone a Team Leader the moment they become Lead, and a User when they stop', async () => {
    const t = base()
    expect(await can(t, 'p-bea', 'directory')).toBe(false)
    t.team_members[1].position = 'lead'
    expect(await can(t, 'p-bea', 'directory')).toBe(true)
  })

  it('lists active people only, unless asked', async () => {
    expect((await loadSubjects(fakeDb(base()))).map(p => p.id)).not.toContain('p-old')
    expect((await loadSubjects(fakeDb(base()), { includeInactive: true })).map(p => p.id)).toContain('p-old')
  })
})

describe('a saved tick', () => {
  it('opens and closes an item for the whole level, over the starting answer', async () => {
    const t = base()
    expect(await can(t, 'p-ana', 'report')).toBe(false)
    t.access_rules.push({ level: 'team_leader', item_key: 'report', allowed: true })
    expect(await can(t, 'p-ana', 'report')).toBe(true)
    expect(await can(t, 'p-ana', 'rp-overview')).toBe(true)
    t.access_rules.push({ level: 'team_leader', item_key: 'rp-overview', allowed: false })
    expect(await can(t, 'p-ana', 'rp-overview')).toBe(false)
  })

  it('closes what was open by default, for an Admin as well', async () => {
    const t = base()
    expect(await can(t, 'p-cai', 'd-rates')).toBe(true)
    t.access_rules.push({ level: 'admin', item_key: 'd-rates', allowed: false })
    expect(await can(t, 'p-cai', 'd-rates')).toBe(false)
  })
})

describe('a tool\'s team list', () => {
  it('opens a tool to the listed team, whole team or Leads only', async () => {
    const t = base()
    expect(await can(t, 'p-ana', 'href-links')).toBe(false)
    t.access_tool_teams.push({ item_key: 'href-links', team_id: SEO, audience: 'lead' })
    expect(await can(t, 'p-ana', 'href-links')).toBe(true)   // Lead of SEO
    expect(await can(t, 'p-cai', 'href-links')).toBe(false)  // Member of SEO, Leads only
    t.access_tool_teams[0].audience = 'team'
    expect(await can(t, 'p-cai', 'href-links')).toBe(true)
    expect(await can(t, 'p-bea', 'href-links')).toBe(false)  // Writers is not listed
  })

  it('opens a tool to every team with "every team"', async () => {
    const t = base()
    t.access_tool_scope.push({ item_key: 'href-links', every_team: true })
    expect(await can(t, 'p-bea', 'href-links')).toBe(true)
  })
})

describe('exceptions', () => {
  it('opens one item for one person, until its date', async () => {
    const t = base()
    t.access_exceptions.push({ person_id: 'p-bea', item_key: 'directory', effect: 'grant', until: '2026-10-31', ended_at: null })
    expect(await can(t, 'p-bea', 'directory')).toBe(true)
    expect(await can(t, 'p-ana', 'directory')).toBe(true) // her own level
    const db = fakeDb(t)
    const [rules, bea] = await Promise.all([loadRules(db), loadSubject(db, 'p-bea')])
    expect(decide(bea!, 'directory', rules, { today: '2026-11-01' }).ok).toBe(false)
  })

  it('closes one item for one person, even an Admin\'s', async () => {
    const t = base()
    t.access_exceptions.push({ person_id: 'p-cai', item_key: 'd-rates', effect: 'deny', until: null, ended_at: null })
    expect(await can(t, 'p-cai', 'd-rates')).toBe(false)
    expect(await can(t, 'p-cai', 'd-emails')).toBe(true)
  })

  it('stops counting the moment it is ended', async () => {
    const t = base()
    t.access_exceptions.push({ person_id: 'p-cai', item_key: 'd-rates', effect: 'deny', until: null, ended_at: '2026-10-07T12:00:00Z' })
    expect(await can(t, 'p-cai', 'd-rates')).toBe(true)
  })

  it('opens a tool past its team list for that person only', async () => {
    const t = base()
    t.access_tool_teams.push({ item_key: 'href-links', team_id: SEO, audience: 'team' })
    t.access_exceptions.push({ person_id: 'p-bea', item_key: 'href-links', effect: 'grant', until: null, ended_at: null })
    expect(await can(t, 'p-bea', 'href-links')).toBe(true)
  })

  it('is everyone\'s own: the same rows give each person their own answer', async () => {
    const t = base()
    t.access_exceptions.push({ person_id: 'p-cai', item_key: 'd-rates', effect: 'deny', until: null, ended_at: null })
    const db = fakeDb(t)
    const rules = await loadRules(db)
    const everyone = await loadSubjects(db)
    const cai = everyone.find(p => p.id === 'p-cai')!
    expect(allowedKeys(cai, rules, { today: T }).has('d-rates')).toBe(false)
    const other = { ...cai, exceptions: [] }
    expect(allowedKeys(other, rules, { today: T }).has('d-rates')).toBe(true)
  })
})

describe('a failed read', () => {
  // Never a fallback: the starting answers and "no exceptions" could both open
  // what a Super Admin closed.
  it('refuses rather than falling back to the starting answers', async () => {
    await expect(loadRules(fakeDb(base(), ['access_rules']))).rejects.toThrow(/access rules/)
    await expect(loadRules(fakeDb(base(), ['access_tool_teams']))).rejects.toThrow(/access rules/)
  })

  it('refuses rather than dropping the exceptions', async () => {
    await expect(loadSubject(fakeDb(base(), ['access_exceptions']), 'p-cai')).rejects.toThrow(/exceptions/)
    await expect(loadSubjects(fakeDb(base(), ['access_exceptions']))).rejects.toThrow(/exceptions/)
  })
})
