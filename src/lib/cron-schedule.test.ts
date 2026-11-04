import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// The portal's scheduled jobs live in deploy/cron/portal.crontab, on its own
// server. Each line must call a job that exists, and the times stay in UTC.

const root = join(__dirname, '..', '..')
const crontab = readFileSync(join(root, 'deploy/cron/portal.crontab'), 'utf8')

function jobs(): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of crontab.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || /^[A-Z_]+=/.test(t)) continue
    const parts = t.split(/\s+/)
    out.set(parts[parts.length - 1], parts.slice(0, 5).join(' '))
  }
  return out
}

describe('the server crontab', () => {
  it('lists the nine jobs', () => {
    expect([...jobs().keys()].sort()).toEqual([
      '/api/cron/agenda-google-sync', '/api/cron/clocky-delta', '/api/cron/clocky-safety', '/api/cron/daily-summary', '/api/cron/health', '/api/cron/ingest',
      '/api/cron/monday-worklist', '/api/cron/review-notices', '/api/cron/tsheets-sync',
    ])
  })

  it('calls only jobs that exist', () => {
    for (const job of jobs().keys()) {
      expect(existsSync(join(root, 'src/app', job, 'route.ts')), job).toBe(true)
    }
  })

  it('runs the syncs six times a day, every 4 hours', () => {
    for (const [job, when] of jobs()) {
      if (job !== '/api/cron/health' && job !== '/api/cron/daily-summary' && job !== '/api/cron/clocky-safety' && job !== '/api/cron/agenda-google-sync' && job !== '/api/cron/review-notices') expect(when.split(' ')[1], job).toBe('1,5,9,13,17,21')
    }
  })

  it('looks for due summary emails every 15 minutes', () => {
    expect(jobs().get('/api/cron/daily-summary')).toBe('*/15 * * * *')
  })

  // A clock stops at the 5-hour mark: the job looks often enough that a stop
  // is never more than five minutes late (Clocky, 16 October 2026).
  // The annual review's notices once a day, in production since 4 November 2026.
  it('runs the review notices once a day at 13:00 UTC', () => {
    expect(jobs().get('/api/cron/review-notices')).toBe('0 13 * * *')
  })

  it("runs North Time's safety net every 5 minutes", () => {
    expect(jobs().get('/api/cron/clocky-safety')).toBe('*/5 * * * *')
  })

  it('keeps the times in UTC', () => {
    expect(crontab).toMatch(/^CRON_TZ=UTC$/m)
  })
})
