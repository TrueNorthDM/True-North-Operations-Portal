'use client'

/**
 * LoginForm: asks for a sign-in email, then takes the 6-digit code from it
 * (plan step p4-code). The same email has a one-click button, for whoever
 * prefers it; either way works on any device.
 *
 * Layer 1 of defense-in-depth: client-side check of the address's shape (a
 * GoodNews mailbox) for instant feedback. The server (sendMagicLink) checks the
 * invitation, and the DB trigger re-validates both.
 */

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { sendMagicLink, verifyCode } from '@/app/auth/actions'
import { isAllowedEmail, ALLOWED_EMAIL_DOMAINS, SHAPE_MESSAGE } from '@/lib/auth-constants'

const LOGIN_ERRORS: Record<string, string> = {
  link: 'That sign-in link has expired or was already used. Ask for a new one below.',
  missing: 'That sign-in link is incomplete. Ask for a new one below.',
}

export function LoginForm() {
  const searchParams = useSearchParams()
  // ?email= comes from the invitation email's button, so the address is filled in.
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [sent, setSent] = useState(false)
  const [sending, startSend] = useTransition()
  const [code, setCode] = useState('')
  const [checking, startCheck] = useTransition()
  // The auth callback sends a code in ?error=, and only these codes show
  // anything: the address is anybody's to write, so its text never reaches the page.
  const [error, setError] = useState<string | null>(LOGIN_ERRORS[searchParams.get('error') ?? ''] ?? null)
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

  function handleCode(e: React.FormEvent) {
    e.preventDefault()
    if (code.replace(/\D/g, '').length < 6 || checking) return
    setError(null)
    startCheck(async () => {
      const res = await verifyCode({ email: trimmed, code })
      if (res && !res.ok) setError(res.error)
    })
  }

  if (sent) {
    return (
      <form onSubmit={handleCode} role="status" className="space-y-4 text-center">
        {/* Custom line-icon (system style) in a teal-soft chip; floats gently,
            the animation is disabled under prefers-reduced-motion. */}
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
          We sent a code to <strong className="text-tn-ink">{trimmed}</strong>. Type it here, or press the button in the email.
        </p>
        <div className="pt-1 text-left">
          <label htmlFor="code" style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800, letterSpacing: '.06em' }} className="mb-2 block text-center text-xs uppercase text-tn-ink">
            Sign-in code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 12))}
            placeholder="123456"
            autoFocus
            className="w-full rounded-xl border-[1.5px] border-slate-300 bg-card px-4 py-3 text-center font-mono text-[22px] tracking-[.35em] text-tn-ink transition-colors focus:border-tn-teal focus:outline-none focus:ring-[3px] focus:ring-tn-teal/20"
          />
        </div>
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            {error}
          </div>
        )}
        <button
          type="submit"
          disabled={code.replace(/\D/g, '').length < 6 || checking}
          style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }}
          className="w-full rounded-xl bg-primary px-4 py-3.5 text-[15px] text-[#ffffff] transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed"
        >
          {checking ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-xs text-muted">
          Didn&apos;t arrive? Check spam, or{' '}
          <button type="button" onClick={() => { setSent(false); setCode(''); setError(null) }} className="text-tn-teal underline hover:text-tn-primary">
            send a new code
          </button>.
        </p>
      </form>
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
        {sending ? 'Sending…' : 'Email me a sign-in code'}
      </button>

      <p className="text-xs text-muted">
        We&apos;ll email you a code and a sign-in button. No password needed.
      </p>
    </form>
  )
}
