/**
 * How often a sign-in code may be asked for, and tried (audit, 8 October 2026).
 *
 * The sign-in service sees every request coming from the portal's own server,
 * so its limits apply to everybody at once: one script asking for codes in a
 * loop would use up the hour's emails for the whole company. These limits are
 * per address and per visitor (their IP), kept in the server's memory: one
 * server, and a restart only forgets a few minutes of counting.
 */

export interface Window { limit: number; ms: number }

/** Codes asked for: per address, and per visitor across addresses. */
export const SEND_PER_ADDRESS: Window = { limit: 5, ms: 15 * 60_000 }
export const SEND_PER_VISITOR: Window = { limit: 20, ms: 15 * 60_000 }
/** Codes typed: per address, so six digits cannot be guessed by trying. */
export const TRY_PER_ADDRESS: Window = { limit: 10, ms: 15 * 60_000 }

/** A sliding-window counter. Pure apart from the clock it is given. */
export class Limiter {
  private hits = new Map<string, number[]>()

  /** Count one more for this key; false when the window is already full. */
  take(key: string, w: Window, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter(t => now - t < w.ms)
    if (recent.length >= w.limit) {
      this.hits.set(key, recent)
      return false
    }
    recent.push(now)
    this.hits.set(key, recent)
    // Keep the map from growing without end: drop keys whose window has passed.
    if (this.hits.size > 5000) {
      for (const [k, ts] of this.hits) if (!ts.some(t => now - t < w.ms)) this.hits.delete(k)
    }
    return true
  }
}

/**
 * The visitor's address as our own proxy saw it: the LAST entry of
 * x-forwarded-for, which the server's proxy appends. Earlier entries are
 * whatever the browser claimed, so they are never trusted.
 */
export function visitorOf(forwardedFor: string | null): string {
  const last = forwardedFor?.split(',').map(s => s.trim()).filter(Boolean).pop()
  return last || 'unknown'
}

// One per server process.
export const sendLimiter = new Limiter()
