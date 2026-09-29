import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// The portal's scheduled jobs are listed twice until the move: vercel.json for
// Vercel Cron, deploy/cron/portal.crontab for the portal's own server (plan step
// p4-crontab). They must say the same thing.

const root = join(__dirname, '..', '..')

function fromVercel(): Map<string, string> {
  const cfg = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { crons: { path: string; schedule: string }[] }
  return new Map(cfg.crons.map(c => [c.path, c.schedule]))
}

function fromCrontab(): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of readFileSync(join(root, 'deploy/cron/portal.crontab'), 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#') || /^[A-Z_]+=/.test(t)) continue
    const parts = t.split(/\s+/)
    const job = parts[parts.length - 1]
    out.set(job, parts.slice(0, 5).join(' '))
  }
  return out
}

describe('the server crontab', () => {
  it('runs the same jobs on the same schedules as vercel.json', () => {
    expect(Object.fromEntries(fromCrontab())).toEqual(Object.fromEntries(fromVercel()))
  })

  it('keeps the times in UTC, as Vercel Cron does', () => {
    expect(readFileSync(join(root, 'deploy/cron/portal.crontab'), 'utf8')).toMatch(/^CRON_TZ=UTC$/m)
  })
})
