'use client'

/**
 * The one button on /auth/confirm: signs in with the link from the email. See
 * the page for why this is a button and not an automatic sign-in.
 */

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { confirmLink } from '@/app/auth/actions'

export function ConfirmForm() {
  const params = useSearchParams()
  const tokenHash = params.get('token_hash') ?? ''
  const type = params.get('type') ?? ''
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(tokenHash ? null : 'This sign-in link is incomplete. Ask for a new one.')

  function go() {
    setError(null)
    start(async () => {
      const res = await confirmLink({ tokenHash, type })
      if (res && !res.ok) setError(res.error)
    })
  }

  return (
    <div className="space-y-4 text-center">
      <h1 style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }} className="text-2xl text-tn-ink">Sign in to the portal</h1>
      <p className="text-sm text-foreground">One more click and you&apos;re in.</p>
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}
      {tokenHash && (
        <button
          type="button"
          onClick={go}
          disabled={pending}
          style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }}
          className="w-full rounded-xl bg-primary px-4 py-3.5 text-[15px] text-[#ffffff] transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      )}
      <p className="text-xs text-muted">
        Not working? <Link href="/login" className="text-tn-teal underline hover:text-tn-primary">Ask for a new code</Link>.
      </p>
    </div>
  )
}
