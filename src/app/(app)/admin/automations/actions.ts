'use server'

// Server action behind the "Run checks now" button on the Automations page.
// Gated by 'au-run'; runs the same health checks the cron does, then
// revalidates the page so fresh status shows.
//
// It answers with a message (audit, 10 October 2026): the button used to
// return nothing, so a refused run (a View Stage preview, a missing right)
// and a run that found problems both looked like a click that did nothing.

import { revalidatePath } from 'next/cache'
import { allowedTo } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { runHealthChecks } from '@/lib/health/checks'
import { notifyHealth } from '@/lib/notifications/run'

export interface RunChecksState {
  ok: boolean
  message: string
}

// Takes no arguments: useActionState passes the previous answer, which a new
// run does not need.
export async function runChecksNow(): Promise<RunChecksState> {
  if (!(await allowedTo('au-run'))) {
    return { ok: false, message: 'The checks were not run: this session cannot run them (a View Stage preview never does).' }
  }
  try {
    const admin = createAdminClient()
    const results = await runHealthChecks(admin)
    const problems = results.filter(r => !r.ok)
    if (problems.length) await notifyHealth(admin, results)
    revalidatePath('/admin/automations')
    return problems.length
      ? { ok: true, message: `Checks finished: ${problems.length} service${problems.length > 1 ? 's need' : ' needs'} attention.` }
      : { ok: true, message: 'Checks finished: every service is operational.' }
  } catch (e) {
    console.error('[health] run now:', (e as Error).message)
    return { ok: false, message: 'The checks could not be run just now. Try again in a minute.' }
  }
}
