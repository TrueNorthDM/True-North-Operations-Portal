'use server'

// Server action behind the "Run checks now" button on the Automations page.
// Admin-gated; runs the same health checks the cron does, then revalidates the
// page so fresh status shows.

import { revalidatePath } from 'next/cache'
import { isSecurityAdmin } from '@/lib/auth/role'
import { createAdminClient } from '@/lib/supabase/admin'
import { runHealthChecks } from '@/lib/health/checks'
import { notifyHealth } from '@/lib/notifications/run'

export async function runChecksNow(): Promise<void> {
  if (!(await isSecurityAdmin())) return
  const admin = createAdminClient()
  const results = await runHealthChecks(admin)
  if (results.some(r => !r.ok)) await notifyHealth(admin, results)
  revalidatePath('/admin/automations')
}
