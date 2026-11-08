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

/**
 * Codes asked for: per address from one visitor, per address from everyone, and
 * per visitor across addresses. The first is the tight one, so a stranger asking
 * for someone else's codes uses up only their own allowance and cannot keep the
 * real person from getting a code (security audit, 8 November 2026); the second
 * still stops a flood of emails to one inbox.
 */
export const SEND_PER_ADDRESS: Window = { limit: 5, ms: 15 * 60_000 }
export const SEND_PER_ADDRESS_ALL: Window = { limit: 15, ms: 15 * 60_000 }
export const SEND_PER_VISITOR: Window = { limit: 20, ms: 15 * 60_000 }
/** Codes typed: per address, so six digits cannot be guessed by trying. */
export const TRY_PER_ADDRESS: Window = { limit: 10, ms: 15 * 60_000 }
/**
 * Authenticator codes typed, per account. The sign-in service's own limit counts
 * by address, and every request reaches it from the portal's server, so without
 * this a first-step session could keep guessing (security audit, 8 November 2026).
 */
export const TWO_STEP_TRIES: Window = { limit: 5, ms: 5 * 60_000 }

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

/**
 * Cloudflare's published address ranges (cloudflare.com/ips, read 8 November
 * 2026). Traffic reaches the portal through Cloudflare, so the hop the server's
 * proxy sees is one of these and the real visitor is in cf-connecting-ip.
 */
const CF_V4 = ['173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22', '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20', '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13', '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22']
const CF_V6 = ['2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32', '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32']

function v4(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const p = m.slice(1).map(Number)
  return p.some(n => n > 255) ? null : ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0
}

// BigInt() calls, not literals: the project compiles to ES2017.
const ZERO = BigInt(0), SIXTEEN = BigInt(16), SIXTY_FOUR = BigInt(64)

function v6(ip: string): bigint | null {
  if (!/^[0-9a-f:]+$/i.test(ip) || !ip.includes(':')) return null
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const fill = 8 - head.length - tail.length
  if (halves.length === 1 ? fill !== 0 : fill < 1) return null
  const parts = [...head, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...tail]
  if (parts.some(x => !/^[0-9a-f]{1,4}$/i.test(x))) return null
  return parts.reduce((n, x) => (n << SIXTEEN) | BigInt(parseInt(x, 16)), ZERO)
}

function inRange(ip: string, cidr: string): boolean {
  const [base, bits] = cidr.split('/')
  const n = Number(bits)
  const a4 = v4(ip), b4 = v4(base)
  if (a4 !== null && b4 !== null) return n === 0 || (a4 >>> (32 - n)) === (b4 >>> (32 - n))
  const a6 = v6(ip), b6 = v6(base)
  if (a6 !== null && b6 !== null) return (a6 >> BigInt(128 - n)) === (b6 >> BigInt(128 - n))
  return false
}

export const isCloudflare = (ip: string): boolean => (ip.includes(':') ? CF_V6 : CF_V4).some(c => inRange(ip, c))

/**
 * The visitor's address for a limit (security audit, 8 November 2026). When the
 * hop our proxy saw is Cloudflare, the visitor is the address Cloudflare names
 * in cf-connecting-ip; anything else (someone reaching the server directly) is
 * counted by the address our proxy saw, so a made-up header changes nothing.
 * An IPv6 address is counted by its /64 network, since one connection usually
 * holds a whole /64 and could otherwise start afresh with every address.
 */
export function visitorFrom(h: { get(name: string): string | null }): string {
  const peer = visitorOf(h.get('x-forwarded-for'))
  const cf = h.get('cf-connecting-ip')?.trim() ?? ''
  const ip = peer !== 'unknown' && isCloudflare(peer) && (v4(cf) !== null || v6(cf) !== null) ? cf : peer
  const n6 = v6(ip)
  return n6 === null ? ip : `${(n6 >> SIXTY_FOUR).toString(16)}::/64`
}

// One per server process.
export const sendLimiter = new Limiter()
