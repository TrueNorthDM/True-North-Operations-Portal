import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Clocky's rules, held in the actions' source (README "Rules": enforced on the
 * server, not only in the UI). These read the files as text: they prove each
 * check is asked where it must be; the pure modules' tests prove the checks.
 */

const DIR = __dirname
const read = (f: string) => readFileSync(join(DIR, f), 'utf8')
const FILES = ['clock-actions.ts', 'entries-actions.ts', 'approvals/actions.ts', 'whos-working/actions.ts', 'safety/actions.ts', 'periods/actions.ts']

/** The body of one exported function (up to the next export). */
function body(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`)
  if (start < 0) throw new Error(`${name} not found`)
  const next = src.indexOf('\nexport ', start + 10)
  return src.slice(start, next < 0 ? undefined : next)
}

describe('every change to hours needs a reason (Rules 7)', () => {
  const entries = read('entries-actions.ts')
  for (const name of ['addTime', 'editEntry', 'deleteEntry', 'saveWeekGrid']) {
    it(name, () => {
      expect(body(entries, name)).toMatch(/reasonOf\(input\.reason\)/)
      expect(body(entries, name)).toMatch(/fail\(REASON_REQUIRED\)/)
    })
  }

  it('"Clock out for them" (2E)', () => {
    expect(body(read('whos-working/actions.ts'), 'clockOutFor')).toMatch(/fail\(REASON_REQUIRED\)/)
  })

  it('denying a correction or time off', () => {
    const a = read('approvals/actions.ts')
    expect(body(a, 'decideCorrection')).toMatch(/fail\(REASON_REQUIRED\)/)
    expect(body(a, 'decideTimeOff')).toMatch(/fail\(REASON_REQUIRED\)/)
  })

  it('and the trail keeps it', () => {
    for (const name of ['addTime', 'editEntry', 'deleteEntry', 'saveWeekGrid']) {
      expect(body(read('entries-actions.ts'), name), name).toMatch(/audit\([^)]*[\s\S]*?reason/)
    }
  })
})

describe('Users only shorten (Rules 6)', () => {
  it('editEntry refuses anything but shorter for a User', () => {
    const b = body(read('entries-actions.ts'), 'editEntry')
    expect(b).toMatch(/right === 'shorten'/)
    expect(b).toMatch(/onlyShorter\(/)
    expect(b).toMatch(/fail\(SHORTEN_ONLY\)/)
  })

  it('a User never adds time, in the form or in the week grid', () => {
    const e = read('entries-actions.ts')
    expect(body(e, 'addTime')).toMatch(/canAddFor\(/)
    expect(body(e, 'saveWeekGrid')).toMatch(/canAddFor\(/)
  })
})

describe('locked periods (Rules 9)', () => {
  const e = read('entries-actions.ts')
  for (const name of ['addTime', 'editEntry', 'deleteEntry', 'saveWeekGrid', 'requestCorrection']) {
    it(`${name} refuses a locked period`, () => expect(body(e, name)).toMatch(/lockedMessage\(/))
  }
  it('clocking in, approving a correction and approving time off too', () => {
    expect(body(read('clock-actions.ts'), 'clockIn')).toMatch(/lockedMessage\(/)
    expect(body(read('approvals/actions.ts'), 'decideCorrection')).toMatch(/lockedMessage\(/)
    expect(body(read('approvals/actions.ts'), 'decideTimeOff')).toMatch(/lockedMessage\(/)
  })
  it('only Super Admins reopen', () => {
    expect(body(e, 'reopenPeriod')).toMatch(/actor\('ck-reopen'\)/)
  })
})

describe('no overlaps (Rules 8)', () => {
  it('adding, editing, a correction and its approval check them', () => {
    const e = read('entries-actions.ts')
    expect(body(e, 'addTime')).toMatch(/resolveOverlap\(/)
    expect(body(e, 'editEntry')).toMatch(/resolveOverlap\(/)
    expect(body(e, 'requestCorrection')).toMatch(/overlapFor\(/)
    expect(body(read('approvals/actions.ts'), 'decideCorrection')).toMatch(/overlapFor\(/)
  })
})

describe('writes go through the server only (migration 113)', () => {
  it('no Clocky action writes with the signed-in session', () => {
    for (const f of FILES) expect(read(f), f).not.toMatch(/@\/lib\/supabase\/server/)
  })

  it('nothing saves during a View Stage preview', () => {
    for (const f of ['clock-actions.ts', 'entries-actions.ts', 'approvals/actions.ts', 'whos-working/actions.ts', 'periods/actions.ts']) {
      const s = read(f)
      expect(s, f).toMatch(/getViewAs\(\)/)
      expect(s, f).toMatch(/writerAccess\(\)/)
    }
  })
})
