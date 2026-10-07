/**
 * The key that lets the portal's own server through to the database API.
 *
 * The API's public address answers sign-in, public files and signed links to
 * anyone, and everything else (tables, other files) only to a request that
 * carries this header: the proxy in front of it (the host's .htaccess, see
 * deploy/README.md, "Database gate") refuses the rest. A signed-in person who
 * copies their own session from the browser therefore cannot read a table
 * directly, whatever its row-level rules say; what they see is what the portal's
 * pages decide to show them.
 *
 * Server only: the value lives in portal.env / staging.env, never NEXT_PUBLIC_.
 * Unset (local development against another project), no header is sent.
 */
export const GATE_HEADER = 'x-portal-key'

export function gateHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_GATE_KEY
  return key ? { [GATE_HEADER]: key } : {}
}
