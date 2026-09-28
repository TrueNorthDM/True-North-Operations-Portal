// /auth/two-step: the second step of a sign-in (plan step p4-2fa). The app
// layout sends a session here when the account has an authenticator app set up
// and this session has not given its code yet.

import { redirect } from 'next/navigation'
import { AuthShell } from '@/components/AuthShell'
import { TwoStepChallenge } from '@/components/mfa/TwoStepChallenge'
import { getSessionUser } from '@/lib/auth/session'
import { checkTwoStep } from '@/lib/auth/two-step'
import { verifyTwoStep } from '@/app/auth/two-step-actions'
import { signOut } from '@/app/auth/actions'

export const dynamic = 'force-dynamic'

export default async function TwoStepPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  const status = await checkTwoStep()
  if (!status.hasFactor) redirect('/auth/two-step/setup')
  if (status.need === 'ok') redirect('/')
  return (
    <AuthShell>
      <TwoStepChallenge email={user.email ?? ''} verify={verifyTwoStep} signOut={signOut} />
    </AuthShell>
  )
}
