/**
 * Sends the annual review's emails once each (design handoff, B2). Every
 * notice has a key (review_notices); a key already there is never sent again,
 * so the daily job and a repeated click cannot send twice. A failed send frees
 * the key, so the next run tries again. Never throws: a notice that cannot go
 * out is logged and the step it belongs to still happens.
 */

import { sendEmail } from '@/lib/email/resend'
import { portalOrigin } from '@/lib/timeclock/clocky-notify'
import { renderReviewMail, type ReviewMail } from './emails'
import { rdb, type Roster } from './data'

export const firstName = (name: string) => name.split(/\s+/)[0] || name

export async function origin(): Promise<string> {
  return portalOrigin()
}

/** Sends `mail` to the person once for `key`. Returns whether it went out now. */
export async function noticeOnce(key: string, roster: Roster, personId: string | null, mail: (origin: string) => ReviewMail): Promise<boolean> {
  if (!personId) return false
  const to = roster.people.get(personId)?.emails[0]
  if (!to) return false
  try {
    const c = rdb()
    const claim = await c.from('review_notices').insert({ key })
    if (claim.error) return false // already sent (or the table refused): never twice
    const o = await origin()
    const r = renderReviewMail(mail(o), o)
    const sent = await sendEmail({ to, subject: r.subject, html: r.html, text: r.text, idempotencyKey: `review:${key}`.slice(0, 250) })
    if (!sent.sent) {
      await c.from('review_notices').delete().eq('key', key)
      if (!sent.blocked) console.error('[review] email not sent:', key, sent.reason)
      return false
    }
    return true
  } catch (e) {
    console.error('[review] notice:', key, e instanceof Error ? e.message : e)
    return false
  }
}
