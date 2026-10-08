import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database.types'

/**
 * A Supabase client typed by the generated schema (lib/types/database.generated.ts),
 * the session one or the privileged one. Every query names a real table and
 * real columns, checked at build time.
 */
export type Db = SupabaseClient<Database>
