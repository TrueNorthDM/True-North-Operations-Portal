import { describe, it, expect } from 'vitest'
import { NOTIFICATION_TYPES, TYPE_BY_KEY, cleanPref, cleanRule, defaultRule, effective, ruleScope, type Rule } from './catalogue'
import { addDays, deliverAt, weekOf, zoneDate, zoneTime } from './schedule'
import { plan, type Draft } from './deliver'
import { crossed, expectedSoFar, listOf } from './generators'
import { grantedTools } from '@/lib/access/tool-grants'

const rule = (key: string, patch: Partial<Rule> = {}): Rule => ({ ...defaultRule(TYPE_BY_KEY.get(key)!), ...patch })
const allRules = (patch: Record<string, Partial<Rule>> = {}) =>
  Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, rule(t.key, patch[t.key])]))

describe('the catalogue', () => {
  it('has four blocks worth of types, none in the removed Admin block', () => {
    expect(NOTIFICATION_TYPES.every(t => ['tools', 'system', 'chat', 'email'].includes(t.block))).toBe(true)
  })

  it('starts integration failures fixed on, everything else open', () => {
    expect(ruleScope(rule('integration-failed'))).toBe('partial')
    expect(rule('integration-failed').fixEnabled).toBe(true)
    expect(ruleScope(rule('step-late'))).toBe('full')
  })
})

describe('effective: the admin rule over the person', () => {
  it('uses the default when the person never chose', () => {
    expect(effective(rule('step-late'), undefined)).toEqual({ enabled: true, timing: 'daily', channel: 'app' })
  })

  it("uses the person's choice where the rule is open", () => {
    expect(effective(rule('step-late'), { timing: 'instant', enabled: false }).timing).toBe('instant')
    expect(effective(rule('step-late'), { enabled: false }).enabled).toBe(false)
  })

  it('ignores the person on a fixed setting, and gives their choice back when it opens again', () => {
    const pref = { timing: 'instant' as const }
    expect(effective(rule('step-late', { fixTiming: true }), pref).timing).toBe('daily')
    expect(effective(rule('step-late', { fixTiming: false }), pref).timing).toBe('instant')
  })

  it('an admin turning a type off and fixing it turns it off for everyone', () => {
    expect(effective(rule('step-late', { enabled: false, fixEnabled: true }), { enabled: true }).enabled).toBe(false)
  })
})

describe('what a browser may send', () => {
  it('reads a partial choice and refuses unknown values', () => {
    expect(cleanPref({ timing: 'daily' })).toEqual({ timing: 'daily' })
    expect(cleanPref({ timing: 'hourly' })).toBeNull()
    expect(cleanPref({ enabled: 'yes' })).toBeNull()
  })

  it('refuses email until email delivery exists', () => {
    expect(cleanPref({ channel: 'email' })).toBeNull()
    expect(cleanPref({ channel: 'app' })).toEqual({ channel: 'app' })
    expect(cleanRule({ ...rule('step-late'), channel: 'both' })).toBeNull()
  })

  it('needs a whole rule', () => {
    expect(cleanRule(rule('step-late'))).toEqual(rule('step-late'))
    expect(cleanRule({ enabled: true, timing: 'daily' })).toBeNull()
  })
})

describe('the calendar (New York)', () => {
  it('knows the day in New York, not in UTC', () => {
    // 02:00 UTC on the 23rd is still the evening of the 22nd in New York.
    expect(zoneDate(new Date('2026-09-23T02:00:00Z'))).toBe('2026-09-22')
  })

  it('puts 8:00 at 12:00 UTC in summer and 13:00 UTC in winter', () => {
    expect(zoneTime('2026-09-23', 8).toISOString()).toBe('2026-09-23T12:00:00.000Z')
    expect(zoneTime('2026-12-01', 8).toISOString()).toBe('2026-12-01T13:00:00.000Z')
  })

  it('handles the days the clocks change', () => {
    expect(zoneTime('2026-03-08', 8).toISOString()).toBe('2026-03-08T12:00:00.000Z')
    expect(zoneTime('2026-11-01', 8).toISOString()).toBe('2026-11-01T13:00:00.000Z')
  })

  it('lands "as it happens" at once and the summary at the next 8:00', () => {
    const early = new Date('2026-09-23T10:00:00Z') // 6:00 in New York
    const late = new Date('2026-09-23T15:00:00Z') // 11:00 in New York
    expect(deliverAt('instant', late)).toEqual(late)
    expect(deliverAt('daily', early).toISOString()).toBe('2026-09-23T12:00:00.000Z')
    expect(deliverAt('daily', late).toISOString()).toBe('2026-09-24T12:00:00.000Z')
  })

  it('finds the Monday of a week', () => {
    expect(weekOf('2026-09-23')).toBe('2026-09-21')
    expect(weekOf('2026-09-27')).toBe('2026-09-21')
    expect(weekOf('2026-09-21')).toBe('2026-09-21')
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
  })
})

describe('plan: drafts into notifications', () => {
  const now = new Date('2026-09-23T15:00:00Z') // Wednesday 11:00 in New York
  const d = (o: Partial<Draft>): Draft => ({ personId: 'p1', type: 'step-assigned', title: 't', body: 'b', href: '/my-work', dedupeKey: 'k', ...o })

  it('sends "as it happens" types now and daily ones at the next summary', () => {
    const rows = plan([d({}), d({ type: 'step-late' })], allRules(), new Map(), now)
    expect(rows.map(r => [r.type_key, r.timing, r.deliver_at])).toEqual([
      ['step-assigned', 'instant', now.toISOString()],
      ['step-late', 'daily', '2026-09-24T12:00:00.000Z'],
    ])
  })

  it('drops what the person or the rule switched off', () => {
    const prefs = new Map([['p1', { 'step-assigned': { enabled: false } }]])
    expect(plan([d({})], allRules(), prefs, now)).toHaveLength(0)
    expect(plan([d({})], allRules({ 'step-assigned': { enabled: false, fixEnabled: true } }), new Map(), now)).toHaveLength(0)
  })

  it('never sends a type the portal cannot produce yet', () => {
    expect(plan([d({ type: 'step-released' })], allRules(), new Map(), now)).toHaveLength(0)
  })

  it('keeps "due tomorrow" to the day before', () => {
    // Daily summary lands Thursday 8:00: right for a Friday deadline, wrong for Thursday's.
    const fri = d({ type: 'step-due-tomorrow', dedupeKey: '2026-09-25', deliverDay: '2026-09-24' })
    const thu = d({ type: 'step-due-tomorrow', dedupeKey: '2026-09-24', deliverDay: '2026-09-23' })
    expect(plan([fri, thu], allRules(), new Map(), now).map(r => r.dedupe_key)).toEqual(['2026-09-25'])
    // As it happens, Thursday's deadline is told today, Friday's waits.
    const prefs = new Map([['p1', { 'step-due-tomorrow': { timing: 'instant' as const } }]])
    expect(plan([fri, thu], allRules(), prefs, now).map(r => r.dedupe_key)).toEqual(['2026-09-24'])
  })

  it('collapses the same thing found twice', () => {
    expect(plan([d({}), d({})], allRules(), new Map(), now)).toHaveLength(1)
  })
})

describe('the generators', () => {
  it('judges the running week on the weekdays already gone', () => {
    expect(expectedSoFar(10, '2026-09-21')).toBe(0) // Monday
    expect(expectedSoFar(10, '2026-09-24')).toBe(6) // Thursday
    expect(expectedSoFar(11, '2026-09-26')).toBe(11) // Saturday
  })

  it('reports the highest budget threshold crossed', () => {
    expect(crossed(70, 100)).toBeNull()
    expect(crossed(75, 100)).toBe(75)
    expect(crossed(95, 100)).toBe(90)
    expect(crossed(10, 0)).toBeNull()
  })

  it('writes lists the way people read them', () => {
    expect(listOf(['A'])).toBe('A')
    expect(listOf(['A', 'B'])).toBe('A and B')
    expect(listOf(['A', 'B', 'C', 'D'])).toBe('A, B and 2 more')
    // Two entries with one name are still two: the title counts them.
    expect(listOf(['A', 'A'])).toBe('A and 1 more')
    expect(listOf(['A', 'A', 'B', 'C'], 2)).toBe('A, B and 2 more')
  })
})

describe('grantedTools', () => {
  it('opens a team grant, and a lead grant only for a leader', () => {
    const grants = [
      { team_id: 't1', tool_key: 'publishing', audience: 'all' },
      { team_id: 't1', tool_key: 'i7-budget', audience: 'lead' },
      { team_id: 't2', tool_key: 'workload', audience: 'all' },
    ]
    expect([...grantedTools([{ team_id: 't1', position: 'collaborator' }], grants)]).toEqual(['publishing'])
    expect([...grantedTools([{ team_id: 't1', position: 'team_leader' }], grants)].sort()).toEqual(['i7-budget', 'publishing'])
  })

  it('ignores keys no longer in the catalogue', () => {
    expect(grantedTools([{ team_id: 't1' }], [{ team_id: 't1', tool_key: 'gone', audience: 'all' }]).size).toBe(0)
  })
})
