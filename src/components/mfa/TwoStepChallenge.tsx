'use client'

/**
 * The second step of every sign-in (plan step p4-2fa): the 6-digit code from
 * the authenticator app. Asked once per sign-in; the session then carries it
 * (Supabase's aal2) until the person signs out or the session ends.
 *
 * Drawn as two codes side by side (owner, 19 November 2026, option C): the
 * email code already accepted, the app code lit, and six boxes for its digits.
 * Someone typed the email code here again and again (18 November), so the
 * screen shows plainly that this is a second, different code.
 */

import { useState, useTransition } from 'react'
import { ERROR_BOX } from '@/lib/ui/feedback'
import { CodeBoxes, CODE_LENGTH } from '@/components/ui/CodeBoxes'

export interface TwoStepChallengeProps {
  email: string
  /** Checks the code against the person's factor. Null in design checks. */
  verify: ((code: string) => Promise<{ ok: false; error: string } | void>) | null
  signOut: (() => void) | null
}

const DISPLAY = { fontFamily: 'var(--font-raleway)', fontWeight: 800 } as const

function Icon({ children, size = 22, stroke = 1.75 }: { children: React.ReactNode; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

const MAIL = <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7.5 8.5 5.5 8.5-5.5" /></>
// A phone with a shield: the code comes from the phone.
const PHONE = <><rect x="6" y="2.5" width="12" height="19" rx="2.5" /><path d="M12 8.5 9.5 9.6v2.1c0 1.6 1.1 2.9 2.5 3.3 1.4-.4 2.5-1.7 2.5-3.3V9.6Z" /><path d="M10.5 18.5h3" /></>

export function TwoStepChallenge({ email, verify, signOut }: TwoStepChallengeProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== CODE_LENGTH || pending || !verify) return
    setError(null)
    start(async () => {
      const res = await verify(code)
      if (res && !res.ok) setError(res.error)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-center">
      <h1 style={DISPLAY} className="text-2xl text-tn-ink">One more code</h1>
      <p className="text-sm text-foreground">Your account uses two codes to sign in.</p>

      <div className="flex items-center gap-2" role="list" aria-label="Sign-in codes">
        <div role="listitem" className="flex-1 rounded-[14px] border-[1.5px] border-[var(--ok-fg)]/20 bg-[var(--ok-bg)]/60 px-2.5 py-3">
          <span className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ok-bg)] text-[var(--ok-fg)]">
            <Icon>{MAIL}</Icon>
            <span className="absolute -bottom-1.5 -right-1.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-card bg-[var(--ok-fg)] text-[#ffffff]">
              <Icon size={10} stroke={3.5}><path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>
            </span>
          </span>
          <div style={DISPLAY} className="mt-1.5 text-[13px] text-[var(--ok-fg)]">Email code</div>
          <div className="text-[11.5px] text-[var(--ok-fg)]">Accepted</div>
        </div>
        <span className="shrink-0 text-muted"><Icon size={18} stroke={2}><path d="M5 12h14M13 6l6 6-6 6" /></Icon></span>
        <div role="listitem" aria-current="step" className="flex-1 rounded-[14px] border-2 border-tn-teal bg-card px-2.5 py-3 shadow-[0_6px_16px_rgba(30,125,127,.14)]">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-tn-teal-soft text-tn-teal">
            <Icon>{PHONE}</Icon>
          </span>
          <div style={DISPLAY} className="mt-1.5 text-[13px] text-tn-ink">App code</div>
          <div className="text-[11.5px] font-bold text-tn-teal">Type it below</div>
        </div>
      </div>

      <p className="text-sm text-foreground">
        Open your authenticator app and type the 6‑digit code next to <strong className="text-tn-ink">True North Portal</strong>.
      </p>
      <CodeBoxes value={code} onChange={setCode} label="Code from the authenticator app" autoFocus disabled={pending} />
      {error && (
        <div role="alert" className={ERROR_BOX}>{error}</div>
      )}
      <button
        type="submit"
        disabled={code.length !== CODE_LENGTH || pending}
        style={DISPLAY}
        className="w-full rounded-xl bg-primary px-4 py-3.5 text-[15px] text-[#ffffff] transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:opacity-50 disabled:active:translate-y-0"
      >
        {pending ? 'Checking…' : 'Continue'}
      </button>
      <p className="text-xs text-muted">
        Lost or replaced your phone? Ask an admin to reset your second step. Once you are in, you can turn two-step sign-in off in Settings.
      </p>
      <p className="text-xs text-muted">
        Signed in as <strong className="text-tn-ink">{email}</strong>.{' '}
        <button type="button" onClick={() => signOut?.()} className="text-tn-teal underline hover:text-tn-primary">Use another account</button>
      </p>
    </form>
  )
}
