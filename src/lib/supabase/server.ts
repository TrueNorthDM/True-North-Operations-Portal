import { createServerClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'
import type { Database } from '@/lib/types/database.types'
import { gateHeaders } from './gate'
import { timedFetch } from './timed-fetch'
import { serverDbUrl, sessionCookieName } from './addresses'
import { SESSION_COOKIE_OPTIONS } from './cookie-options'

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()
  const perfPath = process.env.PERF_DB === '1' ? (await headers()).get('x-perf-path') : null

  // The internal address, with the cookie still named after the public one (lib/supabase/addresses.ts).
  return createServerClient<Database>(
    serverDbUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: gateHeaders(), fetch: timedFetch(perfPath) },
      cookieOptions: { ...SESSION_COOKIE_OPTIONS, name: sessionCookieName() },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component, mutations handled by middleware
          }
        },
      },
    }
  )
}
