'use server'

/**
 * The invoice form's public actions (owner, 1 November 2026, forms mockup
 * v3): anyone with the link asks for a code, types it, and from then on this
 * device knows their email for 30 days.
 *
 * No session here on purpose, so every action checks the rest itself: North
 * Time is open (the form follows its lock), the email was proved (the signed cookie), and nobody asks
 * too often (codes an hour for an email and for a network address). Nothing
 * of anyone else's ever comes back: an item sent before names only the item
 * and the day. Generic errors to the page, details in the server log. The
 * invoice itself is sent by the route next to the page (submit/route.ts), as
 * its receipts and PDF are bigger than an action takes.
 */

import { createHash, randomInt } from 'node:crypto'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { IS_STAGING } from '@/lib/environment'
import { northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { loadInvoiceSettings } from '@/lib/timeclock/pay-terms'
import { periodLabel } from '@/lib/timeclock/periods'
import { findSender, formToday, mailSender, monthFor, sentBefore } from '@/lib/invoice-form/data'
import { CODE_LIFE_MS, MAX_TRIES, codeOf, codeVerdict, emailOf, firstDuplicate, isDeliverable, itemKey, itemName, monthBounds, monthOk, monthTakenText, overCodeCap, resendWait } from '@/lib/invoice-form/rules'
import { DEVICE_COOKIE, DEVICE_MAX_AGE, DEVICE_PATH, codeHash, codeMatches, devicePass } from '@/lib/invoice-form/secrets'
import { provedEmail } from '@/lib/invoice-form/device'

type Fail = { ok: false; error: string }
const no = (error: string): Fail => ({ ok: false, error })
const TRY_AGAIN = 'Something went wrong. Try again in a moment.'
const NOT_OPEN = 'The invoice form is not open yet.'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
async function clientKey(): Promise<string> {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  return sha(`invoice-form:${ip}`)
}

/** The lock, before anything else. */
async function gate(): Promise<Fail | null> {
  if (!(await northTimeOpen())) return no(NOT_OPEN)
  return null
}

export type CodeSent = { ok: true; email: string; waitSeconds: number } | Fail

/** "Send me a code" and "send it again": a new 6-digit code by email (the one before stops working). */
export async function requestCode(input: { email: string }): Promise<CodeSent> {
  const g = await gate()
  if (g) return g
  const email = emailOf(input?.email)
  if (!email) return no('Write your email, like name@example.com.')
  const c = createAdminClient()
  try {
    const key = await clientKey()
    const since = new Date(Date.now() - 3600e3).toISOString()
    const [byEmail, byClient, last] = await Promise.all([
      c.from('invoice_form_codes').select('id', { count: 'exact', head: true }).eq('email', email).gt('created_at', since),
      c.from('invoice_form_codes').select('id', { count: 'exact', head: true }).eq('client_key', key).gt('created_at', since),
      c.from('invoice_form_codes').select('created_at').eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    if (byEmail.error || byClient.error || last.error) throw new Error((byEmail.error ?? byClient.error ?? last.error)!.message)
    const wait = resendWait(last.data?.created_at ?? null)
    if (wait > 0) return no(`Wait ${wait} seconds, then send it again.`)
    if (overCodeCap(byEmail.count ?? 0, byClient.count ?? 0)) return no('Too many codes in the last hour. Try again later.')
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    const now = Date.now()
    const { error } = await c.from('invoice_form_codes').insert({ email, code_hash: codeHash(email, code), client_key: key, expires_at: new Date(now + CODE_LIFE_MS).toISOString() })
    if (error) throw new Error(error.message)
    // Never shown on the page, not even on the staging copy (which emails only its own list): the code is the proof.
    const sent = await mailSender(email, { kind: 'code', code }, `code:${email}:${now}`)
    if (!sent) return no(IS_STAGING ? 'This staging copy only emails the addresses on its list.' : 'The email could not be sent. Check the address and try again.')
    return { ok: true, email, waitSeconds: 60 }
  } catch (e) {
    console.error('[invoice form] code:', e instanceof Error ? e.message : e)
    return no(TRY_AGAIN)
  }
}

export type Checked = { ok: true } | Fail

/** "Continue": the code against the newest one of that email. Right: this device remembers the email for 30 days. */
export async function checkCode(input: { email: string; code: string }): Promise<Checked> {
  const g = await gate()
  if (g) return g
  const email = emailOf(input?.email)
  const code = codeOf(input?.code)
  if (!email) return no(TRY_AGAIN)
  if (!code) return no('The code is 6 digits.')
  const c = createAdminClient()
  try {
    const { data: row, error } = await c.from('invoice_form_codes').select('id, code_hash, tries, expires_at, used_at').eq('email', email).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new Error(error.message)
    const verdict = codeVerdict(row)
    if (verdict === 'none' || verdict === 'used') return no('Ask for a code first.')
    if (verdict === 'expired') return no('That code ran out (10 minutes). Send it again.')
    if (verdict === 'locked') return no('Too many wrong tries. Send a new code.')
    // Counted before it is compared: two tries at once cannot both slip through.
    const { data: counted, error: tErr } = await c.from('invoice_form_codes').update({ tries: row!.tries + 1 }).eq('id', row!.id).eq('tries', row!.tries).is('used_at', null).select('id')
    if (tErr) throw new Error(tErr.message)
    if (!counted?.length) return no('Try the code again.')
    if (!codeMatches(row!.code_hash, email, code)) {
      const left = MAX_TRIES - row!.tries - 1
      return no(left > 0 ? `That is not the code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Too many wrong tries. Send a new code.')
    }
    await c.from('invoice_form_codes').update({ used_at: new Date().toISOString() }).eq('id', row!.id)
    ;(await cookies()).set(DEVICE_COOKIE, devicePass(email), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: DEVICE_PATH, maxAge: DEVICE_MAX_AGE,
    })
    return { ok: true }
  } catch (e) {
    console.error('[invoice form] check:', e instanceof Error ? e.message : e)
    return no(TRY_AGAIN)
  }
}

/** "Change email" or "Not you?": this device forgets the email. */
export async function forgetDevice(): Promise<Checked> {
  ;(await cookies()).delete({ name: DEVICE_COOKIE, path: DEVICE_PATH })
  return { ok: true }
}

export type LineChecked = { ok: true; name: string } | Fail

/** "+ Add the line": refuses an item already sent with the same kind (by anyone), naming only the item and the day. */
export async function checkLine(input: { name: string; kind: string; others: { name: string; kind: string }[]; month: string }): Promise<LineChecked> {
  const g = await gate()
  if (g) return g
  const email = await provedEmail()
  if (!email) return no('Confirm your email first.')
  const name = itemName(String(input?.name ?? '')).slice(0, 200)
  if (name.length < 2) return no("Paste the Monday item's name.")
  if (!isDeliverable(input?.kind)) return no('Choose Translated page or Design asset.')
  const others = (Array.isArray(input?.others) ? input.others : []).slice(0, 200).filter(o => isDeliverable(o?.kind)).map(o => ({ name: String(o.name ?? '').slice(0, 200), kind: o.kind as 'page' | 'asset' }))
  try {
    const sender = await findSender(email)
    const ym = String(input?.month ?? '')
    const month = monthOk(ym, formToday()) ? await monthFor(email, sender?.personId ?? null, ym) : null
    const sent = await sentBefore([itemKey(name)], month?.kind === 'again' ? month.invoiceId : null)
    const dup = firstDuplicate([...others, { name, kind: input.kind }], sent, formToday())
    return dup ? no(dup.error) : { ok: true, name }
  } catch (e) {
    console.error('[invoice form] line:', e instanceof Error ? e.message : e)
    return no(TRY_AGAIN)
  }
}

export type MonthChecked = { ok: true; again: string | null } | Fail

/** The month picked: free, theirs to send again (returned, the number it keeps), or already sent. */
export async function checkMonth(input: { month: string }): Promise<MonthChecked> {
  const g = await gate()
  if (g) return g
  const email = await provedEmail()
  if (!email) return no('Confirm your email first.')
  const ym = String(input?.month ?? '')
  if (!monthOk(ym, formToday())) return no('Pick this month or one of the last twelve.')
  try {
    const sender = await findSender(email)
    const st = await monthFor(email, sender?.personId ?? null, ym)
    if (st.kind === 'taken') {
      const s = await loadInvoiceSettings()
      return no(monthTakenText(periodLabel(monthBounds(ym)).full, s.billingEmail))
    }
    return { ok: true, again: st.kind === 'again' ? st.number : null }
  } catch (e) {
    console.error('[invoice form] month:', e instanceof Error ? e.message : e)
    return no(TRY_AGAIN)
  }
}
