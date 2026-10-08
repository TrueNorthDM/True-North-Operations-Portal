/**
 * Home address, date of birth, personal email and phone.
 *
 * The last columns on `people` that any signed-in session could read straight
 * from PostgREST. Migration 054 took pay out of reach and the callout on Admin
 * → Access levels said so, while admitting these four were still open. This
 * closes that gap; migration 056 does the revoking.
 *
 * WHY THESE FOUR AND NOT `location`. Address, birth date, a personal mailbox
 * and a personal number are the columns someone would be upset to find a
 * colleague had pulled. `location` is a city, it labels people all over the
 * product, and locking it would cost a lot for very little.
 *
 * Same shape and the same reasoning as hr/compensation.ts: the service-role
 * client, no user input anywhere (fixed table, fixed columns, an optional id
 * list drawn from our own data), and the gate stays where it already is, in
 * the pages and actions that call this.
 *
 * WATCH OUT for date_of_birth. It is read for EVERYONE on the Home page, by
 * everyone, to build the birthdays board. That is deliberate and fine: those
 * widgets are server components and only ever render "Apr 7", so the year never
 * reaches a browser. It does mean this reader runs on the busiest page in the
 * portal, which is why it takes an id list rather than always fetching all.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import type { PersonAddress } from '@/lib/address'

export interface Contact {
  /** JSON column (migration 042), not text. */
  address: PersonAddress | null
  dateOfBirth: string | null
  emailPersonal: string | null
  phone: string | null
}

/**
 * Contact details keyed by people.id.
 *
 * Pass `personIds` to narrow it to the people the caller may actually show;
 * omit it only where the whole directory is legitimately in scope.
 */
/**
 * Dates of birth alone, for the Home birthdays card (audit, 8 October 2026):
 * it read every person's address, phone and personal email to use one date.
 */
export async function loadBirthDates(): Promise<Map<string, string>> {
  const { data } = await createAdminClient().from('people').select('id, date_of_birth').not('date_of_birth', 'is', null)
  return new Map(((data ?? []) as { id: string; date_of_birth: string }[]).map(r => [r.id, r.date_of_birth]))
}

export async function loadContactByPerson(
  personIds?: readonly string[],
): Promise<Map<string, Contact>> {
  // An explicit empty list means "nobody", not "everybody". Without this the
  // caller that filters down to zero people would silently fetch the lot.
  if (personIds && personIds.length === 0) return new Map()

  const admin = createAdminClient()
  let q = admin.from('people').select('id, address, date_of_birth, email_personal, phone')
  if (personIds) q = q.in('id', [...personIds])

  const { data } = await q
  const rows = (data ?? []) as {
    id: string; address: PersonAddress | null; date_of_birth: string | null
    email_personal: string | null; phone: string | null
  }[]
  return new Map(
    rows.map(r => [r.id, {
      address: r.address,
      dateOfBirth: r.date_of_birth,
      emailPersonal: r.email_personal,
      phone: r.phone,
    }]),
  )
}
