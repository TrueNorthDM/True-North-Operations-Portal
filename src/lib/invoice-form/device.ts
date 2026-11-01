/**
 * The email this device proved with a code (lib/invoice-form/secrets.ts), read
 * from its signed cookie, for the public page, its actions and its route.
 * Not a "use server" file: nothing here is callable from the browser.
 */

import { cookies } from 'next/headers'
import { DEVICE_COOKIE, deviceEmail } from './secrets'

/** The proved email, or null (no cookie, or one that does not check out). */
export async function provedEmail(): Promise<string | null> {
  return deviceEmail((await cookies()).get(DEVICE_COOKIE)?.value)
}
