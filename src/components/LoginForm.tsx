'use client'

/**
 * LoginForm: magic-link request form.
 *
 * Layer 1 of defense-in-depth: client-side check of the address's shape (a
 * GoodNews mailbox) for instant feedback. The server (sendMagicLink) checks the
 * invitation, and the DB trigger re-validates both.
 */

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { sendMagicLink } from '@/app/auth/actions'
import { isAllowedEmail, ALLOWED_EMAIL_DOMAINS, SHAPE_MESSAGE } from '@/lib/auth-constants'

export function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, startSend] = useTransition()
  // Pre-populate with any ?error= the auth callback may have set.
  const [error, setError] = useState<string | null>(searchParams.get('error'))
  // Where to land after login, captured by the proxy as ?next=… (validated
  // server-side and again in the callback before it's used for a redirect).
  const next = searchParams.get('next') ?? undefined

  const trimmed = email.trim().toLowerCase()
  const looksLikeEmail = /\S+@\S+\.\S+/.test(trimmed)
  const domainOk = looksLikeEmail && isAllowedEmail(trimmed)
  const canSubmit = domainOk && !sending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    startSend(async () => {
      const res = await sendMagicLink({ email: trimmed, next })
      if (!res.ok) {
        setError(res.error ?? 'Failed to send link.')
        return
      }
      setSent(true)
    })
  }

  if (sent) {
    return (
      <div role="status" className="space-y-3 text-center">
        {/* Custom line-icon (system style) in a teal-soft chip; floats gently
, the animation is disabled under prefers-reduced-motion. */}
        <div className="flex justify-center">
          <span className="tn-mail inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-tn-teal-soft text-tn-teal">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <path d="m3.5 7.5 8.5 5.5 8.5-5.5" />
            </svg>
          </span>
        </div>
        <h2 style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }} className="text-xl text-tn-ink">Check your inbox</h2>
        <p className="text-sm text-foreground">
          We sent a magic link to <strong className="text-tn-ink">{trimmed}</strong>. Click it to sign in.
        </p>
        <p className="text-xs text-muted">
          Didn&apos;t arrive? Check spam, or{' '}
          <button onClick={() => { setSent(false); setEmail('') }} className="text-tn-teal underline hover:text-tn-primary">
            try a different email
          </button>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-center">
      <div>
        <h1 style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }} className="text-2xl text-tn-ink">Welcome back</h1>
        <p className="mt-2 text-sm text-foreground">
          Use your Good News Advocates email.
        </p>
      </div>

      <div className="pt-3 text-left">
        <label htmlFor="email" style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800, letterSpacing: '.06em' }} className="mb-2 block text-center text-xs uppercase text-tn-ink">
          Your GNA email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={`you@${ALLOWED_EMAIL_DOMAINS[0]}`}
          autoComplete="email"
          autoFocus
          className="w-full rounded-xl border-[1.5px] border-slate-300 bg-card px-4 py-3 text-center text-[15px] text-tn-ink transition-colors focus:border-tn-teal focus:outline-none focus:ring-[3px] focus:ring-tn-teal/20"
        />
        {looksLikeEmail && !domainOk && (
          <p className="mt-2 text-center text-xs text-amber-700">
            {SHAPE_MESSAGE}
          </p>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }}
        className="w-full rounded-xl bg-primary px-4 py-3.5 text-[15px] text-[#ffffff] transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed"
      >
        {sending ? 'Sending…' : 'Send magic link'}
      </button>

      <p className="text-xs text-muted">
        We&apos;ll email you a link that signs you in, no password needed.
      </p>
    </form>
  )
}
