// Login page — Server Component shell, Client Component for the form.
// Skips the sidebar/main layout (uses its own minimal layout via the route group).

import { Suspense } from 'react'
import { LoginForm } from '@/components/LoginForm'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-slate-50">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            True North <span className="text-slate-400 font-medium">/ Href Links</span>
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            Sign in with your <strong className="text-slate-700">@goodnewsadvocates.org</strong> email.
          </p>
        </div>
        {/* Suspense is required because LoginForm calls useSearchParams() */}
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
