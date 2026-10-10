// What the health results add up to, for the Automations header and the Home
// banner alike (audit, 10 October 2026, decided by Arnaldo):
//   - every service counts, not only the ones shown on an Automations card;
//   - a warning is shown (amber), not only a failure (red);
//   - results older than STALE_HOURS mean the checks stopped running: that is
//     a failure of its own, or the page stays green on old news.

import { HEALTH_LABEL, type HealthResult, type HealthStatus } from './checks'
import { formatEt } from '@/lib/format/et'

/** The checks run every four hours; two missed runs and a margin. */
export const STALE_HOURS = 9

export interface HealthProblem { service: string; label: string; status: Exclude<HealthStatus, 'ok'>; detail: string }

export interface HealthSummary {
  status: HealthStatus
  problems: HealthProblem[]
  /** The newest check time, or null when none was ever recorded. */
  lastChecked: string | null
  stale: boolean
}

export function healthSummary(results: Record<string, HealthResult>, now: Date = new Date()): HealthSummary {
  const rows = Object.values(results)
  const lastChecked = rows.map(r => r.checked_at).sort().pop() ?? null
  const stale = !!lastChecked && now.getTime() - Date.parse(lastChecked) > STALE_HOURS * 3_600_000
  const problems: HealthProblem[] = rows
    .filter(r => r.status !== 'ok')
    .map(r => ({ service: r.service, label: HEALTH_LABEL[r.service] ?? r.service, status: r.status as 'warn' | 'down', detail: r.detail }))
    .sort((a, b) => (a.status === b.status ? a.label.localeCompare(b.label) : a.status === 'down' ? -1 : 1))
  if (stale) {
    problems.unshift({
      service: 'health_runs', label: 'Health checks', status: 'down',
      detail: `The checks have not run since ${formatEt(lastChecked)}. Is the health job still scheduled?`,
    })
  }
  const status: HealthStatus = problems.some(p => p.status === 'down') ? 'down' : problems.length ? 'warn' : 'ok'
  return { status, problems, lastChecked, stale }
}
