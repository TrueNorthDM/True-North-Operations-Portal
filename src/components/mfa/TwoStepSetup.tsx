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

export function TwoStepSetup({ email, skipLabel }: { email: string; skipLabel: string | null }) {
  const [factor, setFactor] = useState<EnrollStart | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    startEnroll().then(r => {
      if (!live) return
      if ('error' in r) setError(r.error)
      else setFactor(r)
    })
    return () => { live = false }
  }, [])

  if (error) {
    return <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
  }
  if (!factor) {
    return <p className="text-sm text-muted">Preparing your QR code…</p>
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
