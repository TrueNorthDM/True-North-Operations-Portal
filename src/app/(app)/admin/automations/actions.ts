'use server'

// Server action behind the "Run checks now" button on the Automations page.
// Admin-gated; runs the same health checks the cron does, then revalidates the
// page so fresh status shows.

import { revalidatePath } from 'next/cache'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { runHealthChecks } from '@/lib/health/checks'

export async function runChecksNow(): Promise<void> {
  if (!(await isCurrentUserAdmin())) return
  const admin = createAdminClient()
  await runHealthChecks(admin)
  revalidatePath('/admin/automations')
}
