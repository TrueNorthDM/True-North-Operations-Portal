/**
 * Admin Supabase client, bypasses RLS.
 *
 * Use ONLY in server-side machine-to-machine endpoints (webhooks, cron jobs,
 * background jobs). Never instantiate from a Server Action that runs on
 * behalf of a user, or from any Client Component, ever.
 *
 * The service_role key is a privileged secret. It is set in the server's
 * /opt/tnportal/portal.env (NOT prefixed with NEXT_PUBLIC_) so it never leaks
 * into client bundles. If this key ever shows up in a browser DevTools
 * Network tab, every RLS guarantee in the system is dead.
 */

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  return createClient(url, key, {
    auth: {
      // No cookie/session storage, service_role doesn't need to be a "user".
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
