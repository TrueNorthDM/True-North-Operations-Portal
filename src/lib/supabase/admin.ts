/**
 * Admin Supabase client, bypasses RLS.
 *
 * Use only on the server: in machine endpoints (webhooks, cron jobs), or for a
 * person AFTER their access was checked (requireSurface, allowedTo, or
 * access.can for the item the data belongs to). Then the access item decides
 * what they reach, not the database role. Never from a Client Component.
 *
 * The service_role key is a privileged secret. It is set in the server's
 * /opt/tnportal/portal.env (NOT prefixed with NEXT_PUBLIC_) so it never leaks
 * into client bundles. If this key ever shows up in a browser DevTools
 * Network tab, every RLS guarantee in the system is dead.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'
import { gateHeaders } from './gate'
import { timedFetch } from './timed-fetch'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'createAdminClient: missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  return createClient<Database>(url, key, {
    global: { headers: gateHeaders(), fetch: timedFetch() },
    auth: {
      // No cookie/session storage, service_role doesn't need to be a "user".
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * The admin client for putting a file in storage (a receipt, a photo). The
 * host's firewall (ModSecurity rule 390614, "Null Byte Attack") refuses any
 * binary body on the public address, so the portal's server sends files over
 * the Docker network instead: SUPABASE_INTERNAL_URL (http://kong:8000 on the
 * server), which never passes the firewall or the gate. Unset (local
 * development), it is the public address. Only for upload and remove: a link
 * made with it (getPublicUrl) would name the internal address.
 */
export function createUploadClient() {
  const url = process.env.SUPABASE_INTERNAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'createUploadClient: missing SUPABASE_INTERNAL_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
    )
  }
  return createClient<Database>(url, key, {
    global: { headers: gateHeaders() },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
