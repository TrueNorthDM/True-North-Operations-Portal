/**
 * The invoice form's two secrets (owner, 1 November 2026, decision A): the
 * code a sender gets by email, kept only as a hash, and the cookie that
 * remembers on their device, for 30 days, the email they proved.
 *
 * Both are HMAC-SHA256 under keys made from CRON_SECRET (never the secret
 * itself, as lib/drive/print-token.ts does), one key each, compared in
 * constant time; closed when the secret is not set. Pure: the secret and the
 * time come in, so the tests can hold them.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { DEVICE_DAYS } from './rules'

/** The cookie, sent only to the form's own addresses. */
export const DEVICE_COOKIE = 'tn_send'
export const DEVICE_PATH = '/send'
export const DEVICE_MAX_AGE = DEVICE_DAYS * 86_400

const keyOf = (secret: string, what: string) => createHmac('sha256', secret).update(what).digest()
const mac = (secret: string, what: string, body: string) => createHmac('sha256', keyOf(secret, what)).update(body).digest('base64url')
const same = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** The hash a code is kept as, tied to its email. Throws when CRON_SECRET is not set. */
export function codeHash(email: string, code: string, secret = process.env.CRON_SECRET): string {
  if (!secret) throw new Error('CRON_SECRET is not set: the invoice form cannot send codes.')
  return mac(secret, 'invoice-form code v1', `${email}:${code}`)
}

/** Whether a typed code is the one kept. */
export function codeMatches(hash: string, email: string, code: string, secret = process.env.CRON_SECRET): boolean {
  if (!secret || !hash) return false
  return same(hash, codeHash(email, code, secret))
}

/** The cookie's value for a proved email: the email, when it runs out, and the signature. */
export function devicePass(email: string, now = Date.now(), secret = process.env.CRON_SECRET): string {
  if (!secret) throw new Error('CRON_SECRET is not set: the invoice form cannot remember a device.')
  const e = Buffer.from(email).toString('base64url')
  const exp = now + DEVICE_MAX_AGE * 1000
  return `${e}.${exp}.${mac(secret, 'invoice-form device v1', `${e}.${exp}`)}`
}

/** The email a cookie proves, or null (missing, changed, run out, or no secret). */
export function deviceEmail(value: string | null | undefined, now = Date.now(), secret = process.env.CRON_SECRET): string | null {
  if (!secret || !value) return null
  const m = /^([A-Za-z0-9_-]{1,400})\.(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(value)
  if (!m) return null
  const exp = Number(m[2])
  if (!(exp > now) || exp - now > DEVICE_MAX_AGE * 1000) return null
  if (!same(m[3], mac(secret, 'invoice-form device v1', `${m[1]}.${m[2]}`))) return null
  return Buffer.from(m[1], 'base64url').toString('utf8')
}
