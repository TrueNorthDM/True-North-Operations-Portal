import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeDb, type Fake } from '@/lib/directory/__fakes__/db'

let fake: Fake
let granted = new Set<string>()
let viewAs: object | null = null
const emails: string[] = []

vi.mock('next/cache', () => ({ revalidatePath: () => {} }))
vi.mock('next/headers', () => ({ headers: async () => new Map([['host', 'portal.test']]) }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => fake.db }))
vi.mock('@/lib/notifications/signed-in', () => ({
  NOT_SAVED: 'Not saved. Try again in a moment.',
  signedInPerson: async () => (viewAs ? { error: 'View Stage is only a preview.' } : { personId: 'me', name: 'Me', email: 'me@goodnewsadvocates.org' }),
}))
vi.mock('@/lib/access/resolve', () => ({
  allowedTo: async (k: string) => granted.has(k),
  loadAccess: async () => ({ isAdmin: false, can: (k: string) => granted.has(k) }),
}))
vi.mock('@/lib/email/resend', () => ({ sendEmail: async (m: { to: string }) => { emails.push(m.to); return { sent: true } } }))

const { saveNotificationPref, sendTestNotification } = await import('./actions')
const { saveNotificationRule } = await import('./rule-actions')

const rule = { enabled: false, timing: 'instant', channel: 'app', fixEnabled: true, fixTiming: false, fixChannel: false } as const

beforeEach(() => {
  fake = fakeDb({ notification_rules: [], notification_prefs: [{ person_id: 'me', type_key: 'step-late', enabled: true, timing: 'daily' }], team_members: [], notifications: [], person_settings: [] })
  granted = new Set()
  viewAs = null
  emails.length = 0
})

describe('notification rules for everyone (audit, 9 October 2026)', () => {
  it('needs the rules item', async () => {
    expect((await saveNotificationRule('step-late', rule)).ok).toBe(false)
    granted = new Set(['notification-rules'])
    expect(await saveNotificationRule('step-late', rule)).toEqual({ ok: true })
  })

  // An Admin could switch off what only Super Admins are told.
  it("refuses a rule for a notification that goes to holders of an item the admin lacks", async () => {
    granted = new Set(['notification-rules'])
    const r = await saveNotificationRule('access-rules-changed', rule)
    expect(r.ok).toBe(false)
    expect(fake.writes).toEqual([])
    granted = new Set(['notification-rules', 'access-levels'])
    expect((await saveNotificationRule('access-rules-changed', rule)).ok).toBe(true)
  })
})

describe("a person's own choices", () => {
  it('keeps what was not sent: switching off does not wipe the timing', async () => {
    expect(await saveNotificationPref('step-late', { enabled: false })).toEqual({ ok: true })
    expect(fake.tables.notification_prefs[0]).toMatchObject({ enabled: false, timing: 'daily' })
  })

  it('is refused in a View Stage preview', async () => {
    viewAs = {}
    expect((await saveNotificationPref('step-late', { enabled: false })).ok).toBe(false)
    expect(fake.tables.notification_prefs[0].enabled).toBe(true)
  })
})

describe('"Send me a test"', () => {
  it('by email: one a minute', async () => {
    expect((await sendTestNotification('step-late', 'email')).ok).toBe(true)
    const again = await sendTestNotification('step-late', 'email')
    expect(again).toEqual({ ok: false, error: 'One test email a minute. Try again shortly.' })
    expect(emails).toHaveLength(1)
  })

  it('no email test for a bell-only notification, and none for one that does not reach them', async () => {
    granted = new Set(['home-health'])
    expect((await sendTestNotification('integration-failed', 'email')).ok).toBe(false)
    granted = new Set()
    expect(await sendTestNotification('i7-budget', 'app')).toEqual({ ok: false, error: 'This notification does not come to you.' })
  })
})
