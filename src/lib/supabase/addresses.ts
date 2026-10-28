/**
 * Where the portal's server reaches the database API, and the names that must
 * not move when that address does.
 *
 * On the server the API answers on the Docker network (SUPABASE_INTERNAL_URL,
 * http://kong:8000): measured on staging, 28 October 2026, about 8 ms a call
 * against 22 to 51 ms on the public address, which goes out through HTTPS, the
 * host's proxy and its firewall and back into the same machine. Unset (local
 * development) it is the public address.
 *
 * Two things still come from the public address:
 * - the sign-in cookie's name: the library names it after the address it is
 *   given ("sb-staging-auth-token"), so a client on the internal address would
 *   look for "sb-kong-auth-token" and find nobody signed in;
 * - any link a browser will open (a public file's address).
 */

export const serverDbUrl = (): string => process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!

/** The library's own default name for the public address, so a session client on any address reads the same cookie. */
export const sessionCookieName = (): string =>
  `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`

/** A public file's address for the browser, as getPublicUrl writes it, always on the public address. */
export const publicFileUrl = (bucket: string, path: string): string =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
