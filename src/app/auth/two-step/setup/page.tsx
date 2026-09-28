// /auth/two-step/setup: setting up the authenticator app (plan step p4-2fa).
//
// Reached three ways: at the first sign-in of someone whose week to set it up is
// running (they can skip, with a reminder on every page), once that week is over
// (no skipping), and from the avatar menu by anyone who wants it on early.

import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/AuthShell'
import { TwoStepSetup } from '@/components/mfa/TwoStepSetup'
import { getSessionUser } from '@/lib/auth/session'
import { checkTwoStep } from '@/lib/auth/two-step'
import { daysLeft } from '@/lib/auth/two-step-rule'

export const dynamic = 'force-dynamic'

export default async function TwoStepSetupPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const status = await checkTwoStep()
  if (status.hasFactor) redirect(status.need === 'challenge' ? '/auth/two-step' : '/')

  // Skipping is offered unless the week is over. With no deadline yet (people who
  // were already here, before the cutoff) it simply says "later".
  const skipLabel = status.need === 'enroll-required'
    ? null
    : status.deadline
      ? `Skip for now (${daysLeft(status.deadline, new Date())} ${daysLeft(status.deadline, new Date()) === 1 ? 'day' : 'days'} left)`
      : 'Set it up later'

  return (
    <AuthShell>
      <TwoStepSetup email={user.email ?? ''} skipLabel={skipLabel} />
    </AuthShell>
  )
}
