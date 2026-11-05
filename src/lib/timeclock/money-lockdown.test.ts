import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// pay-terms reads the database for the live pages; the rules tested here are pure.
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/notifications/audience', () => ({ loadAudience: vi.fn() }))

import { ITEM, type AccessLevel } from '@/lib/access/catalogue'
import { canAs, NO_RULES } from '@/lib/access/simulate'
import { MONEY_KEY, paysWhat, seesAllMoney, seesMoney } from './pay-terms'
import { newSenderRights } from '@/lib/invoice-form/rules'
import { seesOthersMoney } from '@/lib/notifications/generators'

/**
 * The money lockdown (owner, 5 November 2026): nobody below Super Admin sees
 * other people's money, unless they are Finance (Company settings >
 * Invoices). Everyone sees their own. Team Leaders never, Admins never unless
 * Finance. Held here per level, for Finance, and for the owner of the data.
 */

const LEVELS: readonly AccessLevel[] = ['super_admin', 'admin', 'team_leader', 'user']
const settings = { finance: ['tina'], defaultApprover: 'david' }
const viewer = (level: AccessLevel, personId: string) => ({ personId, can: canAs(level, { teams: level === 'team_leader' ? [['web', true]] : [['web', false]] }) })

describe('the catalogue', () => {
  it('makes See other people\'s money, Rates & Costs and someone else\'s Payments Super Admin only', () => {
    for (const key of [MONEY_KEY, 'd-rates', 'p-payments']) {
      expect(ITEM.get(key)?.superOnly, key).toBe(true)
      expect(ITEM.get(key)?.defaults, key).toBeUndefined()
    }
  })

  it('never gives ck-money to another level, even with a saved tick', () => {
    const rules = { levels: new Map([['admin|ck-money', true], ['team_leader|ck-money', true], ['user|ck-money', true]]), tools: NO_RULES.tools }
    for (const level of ['admin', 'team_leader', 'user'] as const) expect(canAs(level, { rules })(MONEY_KEY), level).toBe(false)
    expect(canAs('super_admin')(MONEY_KEY)).toBe(true)
  })
})

describe('seesMoney, per level', () => {
  // Who sees Pat's money: [Super Admin, Admin, Team Leader, User] as someone else.
  const EXPECTED: Record<AccessLevel, boolean> = { super_admin: true, admin: false, team_leader: false, user: false }

  it('someone else\'s money: Super Admins only', () => {
    for (const level of LEVELS) expect(seesMoney(viewer(level, 'x'), 'pat', settings), level).toBe(EXPECTED[level])
  })

  it('their own money: every level', () => {
    for (const level of LEVELS) expect(seesMoney(viewer(level, 'pat'), 'pat', settings), level).toBe(true)
  })

  it('Finance: everyone\'s, at any level', () => {
    for (const level of LEVELS) expect(seesMoney(viewer(level, 'tina'), 'pat', settings), level).toBe(true)
  })

  it('nobody linked: nothing of anyone\'s', () => {
    expect(seesMoney({ personId: null, can: canAs('admin') }, 'pat', settings)).toBe(false)
    expect(seesMoney({ personId: null, can: canAs('admin') }, null, settings)).toBe(false)
  })

  it('seesAllMoney: Super Admins and Finance', () => {
    for (const level of LEVELS) {
      expect(seesAllMoney(viewer(level, 'x'), settings), level).toBe(EXPECTED[level])
      expect(seesAllMoney(viewer(level, 'tina'), settings), `${level} Finance`).toBe(true)
    }
  })
})

describe('what waits to be paid (Home\'s To pay and the rail\'s count)', () => {
  it('Super Admins and Finance; never an Admin, a Team Leader or a User', () => {
    for (const level of LEVELS) {
      const sees = level === 'super_admin'
      expect(paysWhat(viewer(level, 'x'), settings), level).toEqual({ invoices: sees, documents: sees })
    }
    // Finance as a User: invoices and documents, where the pages are open to them.
    expect(paysWhat(viewer('user', 'tina'), settings)).toEqual({ invoices: true, documents: true })
  })
})

describe('the invoice form\'s new senders (their lines and total)', () => {
  it('only who sees everyone\'s money sees one waiting', () => {
    for (const level of LEVELS) expect(newSenderRights(viewer(level, 'x'), settings).see, level).toBe(level === 'super_admin')
    expect(newSenderRights(viewer('user', 'tina'), settings).see).toBe(true)
    // The default approver who is an Admin and not Finance: no amounts, so nothing to link.
    expect(newSenderRights(viewer('admin', 'david'), settings)).toEqual({ see: false, link: false })
  })
})

describe('bells about someone else\'s money', () => {
  const r = (level: AccessLevel, personId: string) => ({ personId, canTool: canAs(level) })
  it('carry the amount only to Super Admins and Finance', () => {
    for (const level of LEVELS) expect(seesOthersMoney(r(level, 'x'), settings.finance), level).toBe(level === 'super_admin')
    expect(seesOthersMoney(r('admin', 'tina'), settings.finance)).toBe(true)
    expect(seesOthersMoney(undefined, settings.finance)).toBe(false)
  })
})

describe('no level decides money any more', () => {
  // The loaders and actions that return amounts ask seesMoney (or seesAllMoney), never the level.
  const SRC = join(__dirname, '..', '..')
  const FILES = [
    'lib/timeclock/pay-terms.ts', 'lib/timeclock/invoices-view.ts', 'lib/timeclock/requests-data.ts', 'lib/timeclock/payments-view.ts',
    'lib/timeclock/pay-docs.ts', 'lib/timeclock/reports-data.ts', 'lib/timeclock/approval-queue.ts', 'lib/timeclock/request-cards.ts',
    'lib/timeclock/timesheet-review.ts', 'lib/timeclock/invoices-data.ts', 'lib/access/nav-facts.ts', 'lib/invoice-form/rules.ts',
    'app/(app)/directory/[id]/pay.ts', 'lib/home/needs-you.ts', 'lib/home/needs-you-model.ts',
  ]
  it('reads no isAdmin in the money loaders', () => {
    for (const f of FILES) expect(readFileSync(join(SRC, f), 'utf8'), f).not.toMatch(/\bisAdmin\b/)
  })
  it('the bells with amounts pass a line without them', () => {
    const notify = readFileSync(join(SRC, 'lib/timeclock/clocky-notify.ts'), 'utf8')
    expect(notify.match(/plain:/g)?.length ?? 0).toBeGreaterThanOrEqual(4)
  })
})
