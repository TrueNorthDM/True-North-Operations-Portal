// Login: split brand panel (handoff option 1a). Server Component shell; the
// form (client) is LoginForm. Left panel = navy gradient + animated "sunrise"
// (pure CSS, guarded by prefers-reduced-motion); right = logo + magic-link form.

import { Suspense } from 'react'
import { LoginForm } from '@/components/LoginForm'
import { AuthShell } from '@/components/AuthShell'

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  )
}
