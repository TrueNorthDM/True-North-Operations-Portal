/**
 * The database clients' fetch, timed: one [perf] line per call, with the page
 * that asked and the request's running count and total. Off unless PERF_DB=1
 * (set on staging while navigation speed is measured, owner 28 October 2026),
 * so production and local development fetch exactly as before.
 *
 *   docker logs tnportal-staging 2>&1 | grep "\[perf\] db"
 *
 * The last line of a page's request carries its totals: n (calls so far), sum
 * (milliseconds spent waiting on the database, overlapping calls counted each)
 * and since (milliseconds since the request's first call).
 */

import { cache } from 'react'
import { headers } from 'next/headers'

interface Tally { path: string; started: number; n: number; sum: number }

// One tally per request while rendering; outside a request (cron, scripts) each call stands alone.
const tally = cache(async (): Promise<Tally> => {
  let path = '?'
  try { path = (await headers()).get('x-perf-path') ?? '?' } catch { /* not in a request */ }
  return { path, started: performance.now(), n: 0, sum: 0 }
})

/** Table or endpoint and method, never the query string (it can carry ids and filters). */
function what(input: RequestInfo | URL, init?: RequestInit): string {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  return `${method} ${url.pathname.replace(/^\/(rest|auth|storage)\/v1/, '$1')}`
}

export const timedFetch: typeof fetch = async (input, init) => {
  if (process.env.PERF_DB !== '1') return fetch(input, init)
  const t = await tally().catch(() => ({ path: '?', started: performance.now(), n: 0, sum: 0 }))
  const t0 = performance.now()
  try {
    return await fetch(input, init)
  } finally {
    const ms = Math.round(performance.now() - t0)
    t.n += 1
    t.sum += ms
    console.log(`[perf] db ${t.path} ${what(input, init)} ${ms}ms n=${t.n} sum=${t.sum} since=${Math.round(performance.now() - t.started)}`)
  }
}
