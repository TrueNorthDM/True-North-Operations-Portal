/**
 * Sending an email from the portal itself, through Resend (the same service the
 * sign-in emails go through, via Supabase's SMTP settings).
 *
 * Needs RESEND_API_KEY in the environment: a Resend key with "Sending access"
 * to truenorthportal.online. Without it nothing is sent and the caller is told
 * why, so a missing key never breaks the action that wanted to send.
 */

export const PORTAL_SENDER = 'True North Operations Portal <portal@truenorthportal.online>'

export type SendResult = { sent: true } | { sent: false; reason: string }

export async function sendEmail(msg: { to: string; subject: string; html: string; text: string }): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  if (!key) return { sent: false, reason: 'the email service is not set up yet (RESEND_API_KEY)' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: PORTAL_SENDER, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text }),
    })
    if (res.ok) return { sent: true }
    const body = (await res.json().catch(() => null)) as { message?: string } | null
    return { sent: false, reason: body?.message ?? `the email service answered ${res.status}` }
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : 'the email service could not be reached' }
  }
}
