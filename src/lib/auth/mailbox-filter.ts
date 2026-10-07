/**
 * The PostgREST filter "this address is one of the person's mailboxes", built
 * only from an address that cannot carry filter syntax. An address is put
 * inside an `.or()` string, where a comma or a parenthesis would start a
 * filter of its own, so anything outside the plain address shape is refused
 * (null) rather than escaped. Security review of 7 October 2026. Pure.
 */

const PLAIN_ADDRESS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

export function mailboxFilter(email: string | null | undefined): string | null {
  if (!email || !PLAIN_ADDRESS.test(email)) return null
  return `email_personal.eq.${email},email_true_north.eq.${email},email_goodnews.eq.${email},email_coe.eq.${email}`
}
