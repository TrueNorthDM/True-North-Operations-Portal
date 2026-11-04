/**
 * The pass that lets the scheduled Drive copy print a document with no one
 * signed in (owner, 31 October 2026). The invoice and RMB PDFs are the print
 * page in headless Chromium, which normally goes with the caller's cookies;
 * the cron has none. So the server signs, for one document, a pass that lasts
 * two minutes, and only the Drive print page (app/api/cron/drive-print) takes
 * it, only for that kind and that id. The normal print pages never read it.
 *
 * Signed with HMAC-SHA256 under a key made from CRON_SECRET (never the secret
 * itself, so a pass is no use as the cron's Authorization), compared in
 * constant time; closed when the secret is not set. It travels in a request
 * header, not in the address, so it never lands in a log.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

export type PrintKind = 'invoice' | 'rmb' | 'review'
export const PRINT_HEADER = 'x-drive-print'
const LIFE_MS = 2 * 60_000

const keyOf = (secret: string) => createHmac('sha256', secret).update('drive-print pass v1').digest()
const sign = (secret: string, body: string) => createHmac('sha256', keyOf(secret)).update(body).digest('base64url')

/** A pass for one document, good for two minutes. Throws when CRON_SECRET is not set. */
export function printPass(kind: PrintKind, id: number, now = Date.now(), secret = process.env.CRON_SECRET): string {
  if (!secret) throw new Error('CRON_SECRET is not set: the Drive copy cannot print documents.')
  const exp = now + LIFE_MS
  return `${exp}.${sign(secret, `${kind}:${id}:${exp}`)}`
}

/** Whether `pass` was signed for this kind and id and has not run out. */
export function checkPass(pass: string | null | undefined, kind: PrintKind, id: number, now = Date.now(), secret = process.env.CRON_SECRET): boolean {
  if (!secret || !pass) return false
  const m = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(pass)
  if (!m) return false
  const exp = Number(m[1])
  if (!(exp > now) || exp - now > LIFE_MS) return false
  const want = Buffer.from(sign(secret, `${kind}:${id}:${exp}`))
  const got = Buffer.from(m[2])
  return want.length === got.length && timingSafeEqual(want, got)
}
