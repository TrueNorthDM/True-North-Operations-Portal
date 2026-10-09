/**
 * Sending an email from the portal itself, through Resend (the same service the
 * sign-in emails go through, via Supabase's SMTP settings).
 *
 * Needs RESEND_API_KEY in the environment: a Resend key with "Sending access"
 * to truenorthportal.online. Without it nothing is sent and the caller is told
 * why, so a missing key never breaks the action that wanted to send.
 *
 * On the staging copy only the addresses on STAGING_EMAIL_ALLOWLIST get mail
 * (lib/environment.ts): its data is a copy of the real team.
 */

import { IS_STAGING, stagingMayEmail } from '@/lib/environment'

export const PORTAL_SENDER = 'True North Operations Portal <portal@truenorthportal.online>'

/**
 * `blocked`: this copy of the portal cannot email this address at all (the
 * staging copy and an address not on its list, or no email service on a
 * developer's machine), as opposed to a send that failed and may work if
 * tried again. `busy`: the service was busy or out of reach (rate limit, its
 * own error, a timeout), so trying again later is the answer.
 *
 * In production a missing key is a failure, not "blocked": the portal must
 * email there, and a summary run that quietly let everything go would hide it
 * (audit, 9 October 2026).
 */
export type SendResult = { sent: true } | { sent: false; reason: string; blocked?: true; busy?: true }

/** How long one send may take before it counts as busy. */
const SEND_TIMEOUT_MS = 15_000

export async function sendEmail(msg: {
  to: string; subject: string; html: string; text: string
  /** The same key twice within a day is sent once (Resend idempotency): a retry after a crash never doubles. */
  idempotencyKey?: string
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    const reason = 'the email service is not set up (RESEND_API_KEY)'
    return !IS_STAGING && process.env.NODE_ENV === 'production' ? { sent: false, reason } : { sent: false, reason, blocked: true }
  }
  if (IS_STAGING && !stagingMayEmail(msg.to, process.env.STAGING_EMAIL_ALLOWLIST)) {
    return { sent: false, reason: `this is the staging copy, which only emails ${process.env.STAGING_EMAIL_ALLOWLIST || 'nobody'}`, blocked: true }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(msg.idempotencyKey ? { 'Idempotency-Key': msg.idempotencyKey } : {}),
      },
      body: JSON.stringify({ from: PORTAL_SENDER, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    })
    if (res.ok) return { sent: true }
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    const reason = body?.message ?? `the email service answered ${res.status}`
    return res.status === 429 || res.status >= 500 ? { sent: false, reason, busy: true } : { sent: false, reason }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'the email service could not be reached', busy: true }
  }
}
