'use client'

/**
 * Two-step sign-in on My profile (plan step p4-2fa): whether it is on, and the
 * way to set it up, or to move it to a new phone. A lost phone is not handled
 * here: without the old app nobody gets this far, so that is an admin's Reset.
 */

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { moveTwoStep } from '@/app/auth/two-step-actions'
import { PILL_CLASS, formatDate } from '@/lib/directory/people-types'

const btn = 'font-(family-name:--font-display) font-extrabold text-[12.5px] rounded-[9px] px-3.5 py-2 transition-all disabled:opacity-50'

export function TwoStepSelf({ since, daysLeft }: {
  /** When their app was set up; null if it is not. */
  since: string | null
  /** Days left of their week to set it up, when that week is running. */
  daysLeft: number | null
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function move() {
    if (!window.confirm('Move two-step sign-in to a new phone? The app on your current phone stops working for the portal, and you scan a new QR code with the new one.')) return
    setError(null)
    start(async () => {
      const res = await moveTwoStep()
      if (res && !res.ok) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] ${since ? PILL_CLASS.green : PILL_CLASS.amber}`}>
            {since ? 'On' : 'Not set up'}
          </span>
          <span className="text-[13px] text-muted">
            {since
              ? `Since ${formatDate(since)}. Every sign-in asks for the code from your authenticator app.`
              : daysLeft !== null
                ? `${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left to set it up.`
                : 'A code from an app on your phone at every sign-in. It takes a minute.'}
          </span>
        </div>
        {since ? (
          <button type="button" onClick={move} disabled={pending} className={`${btn} text-tn-ink border border-slate-200 hover:border-tn-ink`}>
            {pending ? 'Moving…' : 'Move to a new phone'}
          </button>
        ) : (
          <Link href="/auth/two-step/setup" className={`${btn} text-[#ffffff] bg-tn-primary hover:brightness-110`}>Set it up</Link>
        )}
      </div>
      {since && <p className="text-[12px] text-muted m-0">Lost your phone? Ask an admin to reset your second step from the Directory.</p>}
      {error && <p className="text-[12.5px] text-red-600 m-0">{error}</p>}
    </div>
  )
}
