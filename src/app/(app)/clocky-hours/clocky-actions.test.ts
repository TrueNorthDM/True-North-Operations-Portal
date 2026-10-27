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
  it('a timesheet is decided by the owner of its step; only Super Admins reopen', () => {
    const a = read('approvals/actions.ts')
    // Approve and Return: the routing's owner of the current step, never the person themselves.
    for (const name of ['approveTimesheet', 'returnTimesheet']) {
      expect(body(a, name), name).toMatch(/step\.owner !== v\.personId \|\| t\.personId === v\.personId/)
    }
    expect(body(a, 'reopenTimesheet')).toMatch(/actor\('ck-reopen'\)/)
    expect(body(a, 'reopenTimesheet')).toMatch(/canReopen\(v\)/)
    // Returning and reopening need the reason the person reads.
    expect(body(a, 'returnTimesheet')).toMatch(/fail\(REASON_REQUIRED\)/)
    expect(body(a, 'reopenTimesheet')).toMatch(/fail\(REASON_REQUIRED\)/)
    // Over the allowance, approving the invoice needs a note.
    expect(body(a, 'approveTimesheet')).toMatch(/over the allowance were not approved in advance/)
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
  it('no North Time action writes with the signed-in session', () => {
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

describe('the full audit of 20 October 2026', () => {
  const entries = read('entries-actions.ts')

  it('trims the other entry only after its own write went through', () => {
    const add = body(entries, 'addTime')
    expect(add.indexOf('trimOther?.()')).toBeGreaterThan(add.indexOf(".from('tc_entries').insert("))
    const edit = body(entries, 'editEntry')
    expect(edit.indexOf('await trimOther?.()')).toBeGreaterThan(edit.indexOf(".from('tc_entries').update("))
    // A User's longer edit is refused before anything is written.
    expect(edit.indexOf('fail(SHORTEN_ONLY)')).toBeLessThan(edit.indexOf('await trimOther?.()'))
  })

  it('submitting checks that the period really moved', () => {
    expect(body(entries, 'submitPeriod')).toMatch(/if \(!moved\?\.length\)/)
  })

  it('the person hears when their time off is decided, or someone clocks them out', () => {
    expect(body(read('approvals/actions.ts'), 'decideTimeOff')).toMatch(/announceTimeOffDecided\(/)
    expect(body(read('whos-working/actions.ts'), 'clockOutFor')).toMatch(/announceClockedOutFor\(/)
  })

  it('a confirmed stop marks its bell row done, and Keep going names its row', () => {
    const clock = read('clock-actions.ts')
    expect(body(clock, 'confirmEnd')).toMatch(/type_key', 'clocky-stopped'\)\.eq\('dedupe_key', `stop:\$\{e\.id\}`\)/)
    expect(body(clock, 'keepGoing')).toMatch(/input\?\.notificationId/)
  })
})

describe('the allowance is a real limit (owner, 25 October 2026)', () => {
  it('the clock does not start or switch at the limit, and stops itself past it', () => {
    const clock = read('clock-actions.ts')
    expect(body(clock, 'clockIn')).toMatch(/limitAt\(v, date, now\)/)
    expect(body(clock, 'switchTo')).toMatch(/limitAt\(v, date, now\)/)
    expect(body(clock, 'confirmEnd')).toMatch(/limitRefusal\(v\.personId, \{ add, exclude: \[e\.id\] \}/)
    // Every action that finds the running clock asks first whether it is due to stop.
    expect(clock).toMatch(/const st = await stopOwnIfDue\(c, e, now\)\n\s+if \(st\) return stoppedFail\(st\)/)
  })

  it('adding, lengthening, the week grid and approving a correction are refused past it, whoever does it', () => {
    const e = read('entries-actions.ts')
    for (const name of ['addTime', 'editEntry', 'saveWeekGrid']) expect(body(e, name), name).toMatch(/limitRefusal\(/)
    expect(body(read('approvals/actions.ts'), 'decideCorrection')).toMatch(/limitRefusal\(r\.person_id/)
  })

  it('the safety job stops a running clock at the allowance too', () => {
    const run = readFileSync(join(DIR, '../../../lib/timeclock/clocky-safety-run.ts'), 'utf8')
    expect(run).toMatch(/stopClockIfDue\(c, e, now, dir, catalog, allowance\)/)
    expect(run).toMatch(/announceClockStop\(/)
  })

  it('a Team Leader adding to their own hours hears how to ask instead', () => {
    const e = read('entries-actions.ts')
    for (const name of ['addTime', 'saveWeekGrid']) expect(body(e, name), name).toMatch(/noAddOwn\(v\)/)
  })
})

describe('the 2026 structure by date (audit 2026-10-27)', () => {
  it('clock in and switch check the job against the day of the rounded start, the day the entry gets', () => {
    const clock = read('clock-actions.ts')
    for (const name of ['clockIn', 'switchTo']) {
      expect(body(clock, name), name).toMatch(/checkedChoice\(input, clockDay\(now, v\.zone\)\)/)
    }
  })
})

describe('the week grid keeps each 2026 Activity on its own row (audit 2026-10-27)', () => {
  it('a row is the job and the Activity of the job\'s structure, as the grid on screen keys it', () => {
    const b = body(read('entries-actions.ts'), 'saveWeekGrid')
    // With only the TSheets Activity, every Activity of a 2026 project was one row: saving one cell replaced the others.
    expect(b).not.toMatch(/const k = catalog\.keys\n/)
    expect(b).toMatch(/const k = keysOfJob\(catalog, catalog\.jobs\.get\(jobcode \?\? -1\)\)/)
  })
})

describe('an edit of a 2026 entry is saved (audit 2026-10-27)', () => {
  it('editEntry decides "Nothing changed" with both structures\' fields', () => {
    expect(body(read('entries-actions.ts'), 'editEntry')).toMatch(/changesBetween\([^\n]*\[catalog\.keys, catalog\.keys2026\], zone\)/)
  })
})
