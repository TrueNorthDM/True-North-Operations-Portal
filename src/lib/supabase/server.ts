import { createServerClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database.types'
import { gateHeaders } from './gate'

export async function createClient(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: gateHeaders() },
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
