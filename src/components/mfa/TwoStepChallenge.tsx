'use client'

/**
 * The second step of every sign-in (plan step p4-2fa): the 6-digit code from
 * the authenticator app. Asked once per sign-in; the session then carries it
 * (Supabase's aal2) until the person signs out or the session ends.
 */

import { useState, useTransition } from 'react'

export interface TwoStepChallengeProps {
  email: string
  /** Checks the code against the person's factor. Null in design checks. */
  verify: ((code: string) => Promise<{ ok: false; error: string } | void>) | null
  signOut: (() => void) | null
}

export function TwoStepChallenge({ email, verify, signOut }: TwoStepChallengeProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const digits = code.replace(/\D/g, '')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (digits.length !== 6 || pending || !verify) return
    setError(null)
    start(async () => {
      const res = await verify(digits)
      if (res && !res.ok) setError(res.error)
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4 text-center">
      <div className="flex justify-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-tn-teal-soft text-tn-teal">
          {/* A phone with a shield: the code comes from the phone. */}
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="6" y="2.5" width="12" height="19" rx="2.5" />
            <path d="M12 8.5 9.5 9.6v2.1c0 1.6 1.1 2.9 2.5 3.3 1.4-.4 2.5-1.7 2.5-3.3V9.6Z" />
            <path d="M10.5 18.5h3" />
          </svg>
        </span>
      </div>
      <h1 style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }} className="text-2xl text-tn-ink">Two-step sign-in</h1>
      <p className="text-sm text-foreground">
        Open your authenticator app and type the 6‑digit code for <strong className="text-tn-ink">True North Operations Portal</strong>.
      </p>
      <input
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={e => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
        placeholder="123456"
        autoFocus
        aria-label="Code from the authenticator app"
        className="w-full rounded-xl border-[1.5px] border-slate-300 bg-card px-4 py-3 text-center font-mono text-[22px] tracking-[.35em] text-tn-ink transition-colors focus:border-tn-teal focus:outline-none focus:ring-[3px] focus:ring-tn-teal/20"
      />
      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}
      <button
        type="submit"
        disabled={digits.length !== 6 || pending}
        style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }}
        className="w-full rounded-xl bg-primary px-4 py-3.5 text-[15px] text-[#ffffff] transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed"
      >
        {pending ? 'Checking…' : 'Continue'}
      </button>
      <p className="text-xs text-muted">
        Lost or replaced your phone? Ask an admin to reset your second step.
      </p>
      <p className="text-xs text-muted">
        Signed in as <strong className="text-tn-ink">{email}</strong>.{' '}
        <button type="button" onClick={() => signOut?.()} className="text-tn-teal underline hover:text-tn-primary">Use another account</button>
      </p>
    </form>
  )
}
