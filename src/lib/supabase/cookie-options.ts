/**
 * The sign-in cookies' flags, for both places that create a session client
 * (lib/supabase/server.ts and the proxy). Merged over the library's defaults
 * (path /, SameSite lax, 400 days).
 *
 * httpOnly: no script in the page can read the session, so an injected script
 * could not lift it. Nothing in the browser needs it: the portal reads the
 * session only on the server (there is no browser Supabase client).
 * secure: sent over HTTPS only, on the deployed portal; local development runs
 * on plain http. (Audit, 8 October 2026.)
 */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
} as const
