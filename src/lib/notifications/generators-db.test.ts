import { describe, it, expect, beforeEach } from 'vitest'
import { fakeDb } from '@/lib/directory/__fakes__/db'
import { fakeAudience, recipient } from './__fakes__/audience'
import { firstLoginDrafts, integrationDrafts, makeCtx, syncDrafts, levelDrafts, unlinkedDrafts } from './generators'
import { deliver, type Draft } from './deliver'
import type { HealthResult } from '@/lib/health/checks'
import { TYPE_BY_KEY } from './catalogue'

const NOW = new Date('2026-10-14T13:30:00Z')
const can = (...keys: string[]) => (k: string) => keys.includes(k)

describe('who the system notifications go to: the access items (audit, 9 October 2026)', () => {
  const people = [
    recipient('sa', { isAdmin: true, roleType: 'super_admin', canTool: can('home-health', 'automations', 'settings', 'd-log', 'monday-accounts', 'access-levels') }),
    // An Admin with the integration alert but not Automations or Company settings.
    recipient('ad', { isAdmin: true, roleType: 'admin', canTool: can('home-health') }),
    // An Admin with everything taken away.
    recipient('bare', { isAdmin: true, roleType: 'admin', canTool: can() }),
    recipient('user'),
  ]
  const ctx = makeCtx(fakeDb({}).db, fakeAudience(people), NOW)
  const to = (ds: Draft[]) => ds.map(d => `${d.personId} ${d.href}`)

  it('an integration down: whoever sees the alert, linked where they can go', () => {
    const down: HealthResult[] = [{ service: 'monday_api', ok: false, status: 'down', detail: 'no answer', checked_at: '' }]
    expect(to(integrationDrafts(ctx, down))).toEqual(['sa /admin/automations', 'ad /'])
  })

  it("a sync that didn't finish: the same people, Company settings only for who opens it", () => {
    expect(to(syncDrafts(ctx, { since: NOW.toISOString(), remaining: 2, reason: 'time ran out' }))).toEqual(['sa /admin/settings#my-work', 'ad /'])
  })

  it('an access level changed: whoever keeps the Access log, and the person', () => {
    const ds = levelDrafts(ctx, { personId: 'user', name: 'User', from: 'user', to: 'team_leader', actorProfileId: null })
    expect(ds.map(d => d.personId).sort()).toEqual(['sa', 'user'])
  })

  it('a new Monday account: whoever opens Monday accounts', async () => {
    const db = fakeDb({ notification_state: [{ key: 'monday-unlinked-seen', value: [1] }] }).db
    const ds = await unlinkedDrafts(makeCtx(db, fakeAudience(people), NOW), [{ id: 1, name: 'Old', email: null }, { id: 2, name: 'New', email: null }])
    expect(ds.map(d => d.personId)).toEqual(['sa'])
  })

  it('a team late pile: leaders with My Team open only', () => {
    const pile = TYPE_BY_KEY.get('team-late-pile')!
    const lead = recipient('lead', { teams: new Map([['w', true]]), canTool: can() })
    const aud = fakeAudience([lead])
    expect(aud.reached(pile, lead)).toBe(false)
    expect(aud.reached(pile, { ...lead, canTool: can('my-team') })).toBe(true)
  })
})

describe('first sign-ins (S3)', () => {
  const people = [recipient('sa', { isAdmin: true, canTool: can('d-log') })]
  const log = [
    { profile_id: 'new', person_id: null, name: 'New Person', email: 'n@x.org', accessed_at: '2026-10-13T10:00:00Z' },
    { profile_id: 'back', person_id: null, name: 'Back Again', email: 'b@x.org', accessed_at: '2026-10-13T10:00:00Z' },
    { profile_id: 'back', person_id: null, name: 'Back Again', email: 'b@x.org', accessed_at: '2026-09-01T10:00:00Z' },
  ]

  it('names only who had never visited before', async () => {
    const ctx = makeCtx(fakeDb({ access_log: log }).db, fakeAudience(people), NOW)
    const ds = await firstLoginDrafts(ctx)
    expect(ds.map(d => d.body)).toEqual(['New Person signed in for the first time, as no Directory person yet.'])
  })

  // An empty read used to make every recent visitor look new.
  it('throws when the access log cannot be read, instead of calling everyone new', async () => {
    const ctx = makeCtx(fakeDb({ access_log: log }, { fail: ['access_log'] }).db, fakeAudience(people), NOW)
    await expect(firstLoginDrafts(ctx)).rejects.toThrow(/access log could not be read/)
  })
})

describe('writing notifications (deliver)', () => {
  let drafts: Draft[]
  beforeEach(() => {
    drafts = ['ana', 'bo'].map(p => ({ personId: p, type: 'step-late', title: 'Late', body: 'b', href: '/my-work', dedupeKey: '2026-10-13' }))
  })

  it('one bad row costs only itself: the rest of the batch is still written', async () => {
    const f = fakeDb({ notifications: [], notification_rules: [], notification_prefs: [], person_settings: [] },
      { rejectRow: (t, r) => t === 'notifications' && r.person_id === 'bo' })
    const res = await deliver(f.db, drafts, { now: NOW })
    expect(res.rows).toBe(1)
    expect(res.error).toMatch(/1 not written/)
    expect(f.tables.notifications.map(r => r.person_id)).toEqual(['ana'])
  })

  it('throws when the rules cannot be read, rather than delivering what an admin turned off', async () => {
    const f = fakeDb({ notifications: [], notification_rules: [], notification_prefs: [], person_settings: [] }, { fail: ['notification_rules'] })
    await expect(deliver(f.db, drafts, { now: NOW })).rejects.toThrow(/rules could not be read/)
  })
})
