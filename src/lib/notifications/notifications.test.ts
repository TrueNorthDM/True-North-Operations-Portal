import { describe, it, expect } from 'vitest'
import { NOTIFICATION_TYPES, TYPE_BY_KEY, channelFor, cleanPref, cleanRule, defaultRule, effective, type Rule } from './catalogue'
import { addDays, deliverAt, weekOf, zoneDate, zoneTime } from './schedule'
import { plan, type Draft } from './deliver'
import { crossed, expectedSoFar, listOf } from './generators'

const rule = (key: string, patch: Partial<Rule> = {}): Rule => ({ ...defaultRule(TYPE_BY_KEY.get(key)!), ...patch })
const allRules = (patch: Record<string, Partial<Rule>> = {}) =>
  Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, rule(t.key, patch[t.key])]))

describe('the catalogue', () => {
  it('has four blocks worth of types, none in the removed Admin block', () => {
    expect(NOTIFICATION_TYPES.every(t => ['tools', 'system', 'chat', 'email'].includes(t.block))).toBe(true)
  })

  it('starts integration failures fixed on, everything else open', () => {
    expect(rule('integration-failed').fixEnabled).toBe(true)
    expect(rule('step-late').fixEnabled || rule('step-late').fixTiming).toBe(false)
  })

  // Clocky's (16 October 2026): the bell only, as it happens, but the daily
  // line about automatic clock-outs.
  it('follows the table of 7 October 2026 for when each one may arrive', () => {
    const by = (w: string) => NOTIFICATION_TYPES.filter(t => t.timings === w).map(t => t.key).sort()
    expect(by('both')).toEqual(['first-login', 'i7-budget', 'step-assigned', 'sync-incomplete', 'team-order-changed'])
    expect(by('daily')).toEqual(['clocky-auto-stops', 'monday-account-unlinked', 'publishing-behind', 'step-due-tomorrow', 'step-late', 'team-late-pile'])
    expect(by('instant')).toEqual([
      'access-rules-changed', 'clocky-allowance', 'clocky-allowance-over', 'clocky-clocked-out-for', 'clocky-correction-decided',
      'clocky-correction-requested', 'clocky-extra-decided', 'clocky-extra-requested', 'clocky-invoice-approved', 'clocky-invoice-made', 'clocky-invoice-paid',
      'clocky-late', 'clocky-reimbursement-decided', 'clocky-reimbursement-requested', 'clocky-reminder', 'clocky-rmb-paid', 'clocky-rmb-ready', 'clocky-still-working',
      'clocky-stopped', 'clocky-timeoff-decided', 'clocky-timeoff-refused', 'clocky-timeoff-requested', 'clocky-timesheet-decided', 'clocky-timesheet-submitted', 'clocky-type-change',
      'integration-failed', 'level-changed', 'step-released',
    ])
  })

  it("starts every type on a timing it allows, with where following when", () => {
    for (const t of NOTIFICATION_TYPES) {
      const r = defaultRule(t)
      expect(t.timings === 'both' || t.timings === r.timing, t.key).toBe(true)
      expect(r.channel, t.key).toBe(channelFor(r.timing))
    }
    expect(channelFor('instant')).toBe('app')
    expect(channelFor('daily')).toBe('both')
  })

  it('gives every type an example, a section and a stat for the preview and the email', () => {
    for (const t of NOTIFICATION_TYPES) {
      expect(t.example.title && t.example.body && t.section && t.stat, t.key).toBeTruthy()
    }
  })
})

describe('effective: the admin rule over the person', () => {
  const T = (k: string) => TYPE_BY_KEY.get(k)!
  it('uses the default when the person never chose', () => {
    expect(effective(T('step-late'), rule('step-late'), undefined)).toEqual({ enabled: true, timing: 'daily', channel: 'both' })
    expect(effective(T('step-assigned'), rule('step-assigned'), undefined)).toEqual({ enabled: true, timing: 'instant', channel: 'app' })
  })

  it("uses the person's choice where the rule is open", () => {
    expect(effective(T('team-order-changed'), rule('team-order-changed'), { timing: 'instant' }).timing).toBe('instant')
    expect(effective(T('step-late'), rule('step-late'), { enabled: false }).enabled).toBe(false)
  })

  it('keeps a type to the timing it allows, whatever was chosen before', () => {
    expect(effective(T('step-late'), rule('step-late'), { timing: 'instant' }).timing).toBe('daily')
    expect(effective(T('level-changed'), rule('level-changed', { timing: 'daily' }), undefined).timing).toBe('instant')
  })

  it('ignores the person on a fixed setting, and gives their choice back when it opens again', () => {
    const pref = { timing: 'instant' as const }
    expect(effective(T('team-order-changed'), rule('team-order-changed', { fixTiming: true }), pref).timing).toBe('daily')
    expect(effective(T('team-order-changed'), rule('team-order-changed', { fixTiming: false }), pref).timing).toBe('instant')
  })

  it('an admin turning a type off and fixing it turns it off for everyone', () => {
    expect(effective(T('step-late'), rule('step-late', { enabled: false, fixEnabled: true }), { enabled: true }).enabled).toBe(false)
  })
})

describe('what a browser may send', () => {
  it('reads a partial choice and refuses unknown values', () => {
    expect(cleanPref({ timing: 'daily' })).toEqual({ timing: 'daily' })
    expect(cleanPref({ timing: 'hourly' })).toBeNull()
    expect(cleanPref({ enabled: 'yes' })).toBeNull()
  })

  it('never takes a channel: it follows when', () => {
    expect(cleanPref({ channel: 'email' })).toEqual({})
    expect(cleanRule({ ...rule('step-assigned'), timing: 'daily', channel: 'app' })?.channel).toBe('both')
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
    // It only comes in the summary: an old "as it happens" choice changes nothing.
    const prefs = new Map([['p1', { 'step-due-tomorrow': { timing: 'instant' as const } }]])
    expect(plan([fri, thu], allRules(), prefs, now).map(r => r.dedupe_key)).toEqual(['2026-09-25'])
  })

  it("lands the summary at 8:00 in the person's own time zone", () => {
    // Wednesday 11:00 in New York is 12:00 in Sao Paulo: both summaries are tomorrow at 8:00, an hour apart.
    const delivery = new Map([['p1', { zone: 'America/Sao_Paulo', hour: 8 }]])
    const [r] = plan([d({ type: 'step-late' })], allRules(), new Map(), now, delivery)
    expect(r.deliver_at).toBe('2026-09-24T11:00:00.000Z')
    // And at the hour they chose: 6:00 in Sao Paulo is 09:00 UTC.
    const [early] = plan([d({ type: 'step-late' })], allRules(), new Map(), now, new Map([['p1', { zone: 'America/Sao_Paulo', hour: 6 }]]))
    expect(early.deliver_at).toBe('2026-09-24T09:00:00.000Z')
    const [ny] = plan([d({ type: 'step-late' })], allRules(), new Map(), now)
    expect(ny.deliver_at).toBe('2026-09-24T12:00:00.000Z')
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


describe("Clocky's notifications (16 October 2026)", () => {
  const T = (k: string) => TYPE_BY_KEY.get(k)!

  it('are in the bell only, as it happens, but the daily line for Super Admins', () => {
    for (const k of ['clocky-still-working', 'clocky-stopped', 'clocky-correction-requested', 'clocky-correction-decided', 'clocky-timeoff-requested', 'clocky-timeoff-decided', 'clocky-clocked-out-for', 'clocky-timesheet-submitted', 'clocky-timesheet-decided']) {
      expect(T(k).timings, k).toBe('instant')
      expect(defaultRule(T(k)).channel, k).toBe('app')
    }
    expect(T('clocky-auto-stops').timings).toBe('daily')
  })

  it('each carry the one button the bell shows', () => {
    expect(T('clocky-still-working').button).toEqual({ label: 'Keep going', action: 'keep-going' })
    expect(T('clocky-stopped').button).toEqual({ label: 'Confirm end time', action: 'open-clock' })
    expect(T('clocky-correction-requested').button).toEqual({ label: 'Review', href: '/clocky-hours/approvals' })
    expect(T('clocky-timeoff-requested').button).toEqual({ label: 'Review', href: '/clocky-hours/approvals' })
    expect(T('clocky-correction-decided').button).toEqual({ label: 'Open time entries', href: '/clocky-hours' })
    expect(T('clocky-timeoff-decided').button).toEqual({ label: 'Open time entries', href: '/clocky-hours' })
    // No address of its own: the row's, that entry's history.
    expect(T('clocky-clocked-out-for').button).toEqual({ label: 'Open entry' })
    expect(T('clocky-timesheet-submitted').button).toEqual({ label: 'Review', href: '/clocky-hours/approvals' })
    expect(T('clocky-timesheet-decided').button).toEqual({ label: 'Open time entries', href: '/clocky-hours' })
    // Sent timesheets reach whoever decides them (the routing), so the rule is open to everyone.
    expect(T('clocky-timesheet-submitted').audience).toEqual({ kind: 'everyone' })
    expect(T('clocky-auto-stops').button).toEqual({ label: 'Open Clock safety', href: '/clocky-hours/safety' })
  })

  it('reach the right people', () => {
    expect(T('clocky-still-working').audience).toEqual({ kind: 'everyone' })
    expect(T('clocky-correction-requested').audience).toEqual({ kind: 'tool', tool: 'clocky-approvals' })
    expect(T('clocky-timeoff-requested').audience).toEqual({ kind: 'tool', tool: 'ck-timeoff' })
    expect(T('clocky-auto-stops').audience).toEqual({ kind: 'tool', tool: 'access-levels' })
  })

  it('use no dashes as punctuation', () => {
    for (const t of NOTIFICATION_TYPES.filter(x => x.key.startsWith('clocky-'))) {
      expect(JSON.stringify(t), t.key).not.toMatch(/[—–]/)
    }
  })
})
