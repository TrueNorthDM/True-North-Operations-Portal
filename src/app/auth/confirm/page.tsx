// /auth/confirm: where the button in the sign-in email lands (plan step p4-code).
//
// It does NOT sign in on arrival. Mail security scanners open every link in an
// email to check it, and a link that signed in on sight would be used up by the
// scanner before the person ever clicked. So the page shows one button, and the
// sign-in happens when a person presses it (ConfirmForm → confirmLink).

import { Suspense } from 'react'
import { AuthShell } from '@/components/AuthShell'
import { ConfirmForm } from '@/components/ConfirmForm'

export default function ConfirmPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <ConfirmForm />
      </Suspense>
    </AuthShell>
  )
}
