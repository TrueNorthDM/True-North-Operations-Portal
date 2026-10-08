/**
 * Is this request the server's crontab (deploy/cron/run.sh)? It sends
 * `Authorization: Bearer ${CRON_SECRET}`. One check for every machine route
 * (the cron jobs and the backfill's self-chaining), in constant time: both
 * sides are hashed to the same length, so how long a wrong guess took says
 * nothing about how much of it was right. Closed when the secret is unset: a
 * missing variable must never open these routes. (Audit, 8 October 2026.)
 */

import { createHash, timingSafeEqual } from 'node:crypto'

const digest = (s: string) => createHash('sha256').update(s).digest()

export function isCronRequest(authorization: string | null, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !authorization) return false
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))
}
