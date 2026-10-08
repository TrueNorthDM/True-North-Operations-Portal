'use client'

/**
 * The live half of /auth/two-step/setup: asks the server for a fresh factor when
 * the page opens (not while it renders, so a prefetch never creates one), then
 * shows TwoStepEnroll with it.
 */

import { useEffect, useState } from 'react'
import { TwoStepEnroll } from './TwoStepEnroll'
import { startEnroll, verifyEnroll, skipTwoStep, type EnrollStart } from '@/app/auth/two-step-actions'
import { signOut } from '@/app/auth/actions'
import { BTN } from '@/lib/ui/buttons'

export function TwoStepSetup({ email, skipLabel }: { email: string; skipLabel: string | null }) {
  const [factor, setFactor] = useState<EnrollStart | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Bumped by "Try again", which runs the effect once more.
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let live = true
    startEnroll().then(r => {
      if (!live) return
      if ('error' in r) setError(r.error)
      else setFactor(r)
    }).catch(() => { if (live) setError('Could not start the setup. Check your connection and try again.') })
    return () => { live = false }
  }, [attempt])

  if (error) {
    // Never a dead end: the page offers no other way out (audit, 8 October 2026).
    return (
      <div className="flex flex-col gap-4">
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className={BTN.navy} onClick={() => { setError(null); setAttempt(a => a + 1) }}>Try again</button>
          <button type="button" className={BTN.white} onClick={() => { void signOut() }}>Sign out</button>
        </div>
      </div>
    )
  }
  if (!factor) {
    return <p role="status" className="text-sm text-muted">Preparing your QR code…</p>
  }
  return (
    <TwoStepEnroll
      qr={factor.qr}
      secret={factor.secret}
      uri={factor.uri}
      email={email}
      verify={code => verifyEnroll({ factorId: factor.factorId, code })}
      signOut={() => { void signOut() }}
      skip={skipLabel ? { label: skipLabel, action: () => { void skipTwoStep() } } : null}
    />
  )
}
