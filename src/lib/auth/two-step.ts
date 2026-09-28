/**
 * Two-step sign-in, server side (plan step p4-2fa, migration 090).
 *
 * The second step is Supabase's own MFA with an authenticator app (TOTP). This
 * reads what the rule in two-step-rule.ts needs for the signed-in session: does
 * the account have a verified app, did this session give its code (the aal2
 * claim), and when does the second step become required for this person.
 */

import { cache } from 'react'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/auth/session'
import { twoStepDeadline, twoStepNeed, type TwoStepNeed } from '@/lib/auth/two-step-rule'

/** Set when someone presses "Skip for now"; lasts the browser session. */
export const SKIP_COOKIE = 'tn_2fa_later'

export interface TwoStepStatus {
  need: TwoStepNeed
  hasFactor: boolean
  deadline: Date | null
  /** They skipped the setup screen this browser session. */
  skipped: boolean
}

type Row = { user_id: string; account_created: string; factor_since: string | null; launch: string | null; cutoff: string | null }

/** Every account's second step, by account id: since when it is set up, or null. */
export async function loadTwoStepByAccount(): Promise<Map<string, string | null> | null> {
  const db = createAdminClient()
  const { data, error } = await db.rpc('portal_two_step_status', { p_user: null })
  if (error) return null // migration 090 not run yet: the Directory hides the column
  return new Map((data as Row[]).map(r => [r.user_id, r.factor_since]))
}

/** The signed-in session's two-step status. Asked once per request by the app layout. */
export const checkTwoStep = cache(async function checkTwoStep(): Promise<TwoStepStatus> {
  const none: TwoStepStatus = { need: 'ok', hasFactor: false, deadline: null, skipped: false }
  const user = await getSessionUser()
  if (!user) return none
  const db = createAdminClient()
  const { data, error } = await db.rpc('portal_two_step_status', { p_user: user.id })
  if (error || !data?.length) return none // before migration 090, or a passing error: never lock people out
  const r = (data as Row[])[0]
  const hasFactor = !!r.factor_since
  const deadline = twoStepDeadline({
    accountCreated: new Date(r.account_created),
    launch: r.launch ? new Date(r.launch) : null,
    cutoff: r.cutoff ? new Date(r.cutoff) : null,
  })
  const skipped = (await cookies()).get(SKIP_COOKIE)?.value === '1'
  return { need: twoStepNeed({ hasFactor, aal: user.aal, deadline, now: new Date() }), hasFactor, deadline, skipped }
})
