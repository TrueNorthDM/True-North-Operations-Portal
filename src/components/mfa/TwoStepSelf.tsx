'use client'

/**
 * Two-step sign-in in Settings (plan step p4-2fa): whether it is on, and the
 * way to set it up, to move it to a new phone, or to turn it off. It is
 * optional since 17 November 2026 (owner). A lost phone is not handled
 * here: without the old app nobody gets this far, so that is an admin's Reset.
 * In a View Stage preview nothing here acts: it would act on the Super
 * Admin's own account, not the person on screen.
 */

import { staleOr } from '@/lib/ui/action-error'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { moveTwoStep, turnOffTwoStep } from '@/app/auth/two-step-actions'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ui/useConfirm'
import { formatDate } from '@/lib/directory/people-types'
import { pillClass } from '@/components/ui/Pill'
import { BTN } from '@/lib/ui/buttons'


export function TwoStepSelf({ since, blocked }: {
  /** When their app was set up; null if it is not. */
  since: string | null
  /** No longer used: there is no week to set it up since it became optional. */
  daysLeft?: number | null
  /** Why nothing here can be done (View Stage). */
  blocked?: string
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, confirm] = useConfirm()
  const router = useRouter()

  async function turnOff() {
    if (blocked) return
    const yes = await confirm({
      title: 'Turn off two-step sign-in?',
      body: 'The portal stops asking for the code from your app. You sign in with the code sent to your email only. You can turn it on again here any time.',
      action: 'Turn it off',
    })
    if (!yes) return
    setError(null)
    start(async () => {
      const res = await turnOffTwoStep().catch(e => ({ ok: false as const, error: staleOr(e, 'Could not turn it off. Try again in a moment.') }))
      if (res.ok) router.refresh()
      else setError(res.error)
    })
  }

  async function move() {
    if (blocked) return
    const yes = await confirm({
      title: 'Move two-step sign-in to a new phone?',
      body: 'The app on your current phone stops working for the portal, and you scan a new QR code with the new one.',
      action: 'Move to a new phone',
    })
    if (!yes) return
    setError(null)
    start(async () => {
      const res = await moveTwoStep().catch(e => ({ ok: false as const, error: staleOr(e, 'Could not move it. Try again in a moment.') }))
      if (res && !res.ok) setError(res.error)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      {confirmDialog}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className={pillClass(since ? 'green' : 'gray')}>
            {since ? 'On' : 'Off'}
          </span>
          <span className="text-[13px] text-muted">
            {since
              ? `Since ${formatDate(since)}. Every sign-in asks for the code from your authenticator app.`
              : 'Optional: a code from an app on your phone at every sign-in, on top of the code by email. It takes a minute.'}
          </span>
        </div>
        {since ? (
          <span className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={move} disabled={pending || !!blocked} title={blocked} className={`${BTN.smallWhite} disabled:opacity-50`}>Move to a new phone</button>
            <button type="button" onClick={turnOff} disabled={pending || !!blocked} title={blocked} className={`${BTN.smallWhite} disabled:opacity-50`}>Turn it off</button>
          </span>
        ) : (
          blocked
            ? <span title={blocked} className={`${BTN.smallNavy} opacity-50 cursor-not-allowed`}>Set it up</span>
            : <Link href="/auth/two-step/setup" className={BTN.smallNavy}>Set it up</Link>
        )}
      </div>
      {since && <p className="text-[12px] text-muted m-0">Lost your phone? Ask an admin to reset your second step from the Directory.</p>}
      {error && <p className="text-[12.5px] text-[#c8323d] m-0">{error}</p>}
    </div>
  )
}
