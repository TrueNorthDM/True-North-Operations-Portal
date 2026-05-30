'use client'

/**
 * LoginForm — magic-link request form.
 *
 * Layer 1 of defense-in-depth: client-side email domain validation for instant
 * feedback. The server (sendMagicLink) and the DB trigger re-validate.
 */

import { useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { sendMagicLink } from '@/app/auth/actions'
import { isAllowedEmail, ALLOWED_EMAIL_DOMAINS } from '@/lib/auth-constants'

export function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, startSend] = useTransition()
  // Pre-populate with any ?error= the auth callback may have set.
  const [error, setError] = useState<string | null>(searchParams.get('error'))

  const trimmed = email.trim().toLowerCase()
  const looksLikeEmail = /\S+@\S+\.\S+/.test(trimmed)
  const domainOk = looksLikeEmail && isAllowedEmail(trimmed)
  const canSubmit = domainOk && !sending

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    startSend(async () => {
      const res = await sendMagicLink({ email: trimmed })
      if (!res.ok) {
        setError(res.error ?? 'Failed to send link.')
        return
      }
      setSent(true)
    })
  }

  if (sent) {
    return (
      <div className="rounded-xl bg-white border border-slate-200 p-6 space-y-3 text-center">
        <div className="text-4xl">📬</div>
        <h2 className="font-semibold text-slate-900">Check your inbox</h2>
        <p className="text-sm text-slate-600">
          We sent a magic link to <strong>{trimmed}</strong>. Click it to sign in.
        </p>
        <p className="text-xs text-slate-400">
          Didn&apos;t arrive? Check spam, or{' '}
          <button onClick={() => { setSent(false); setEmail('') }} className="text-slate-700 underline hover:text-slate-900">
            try a different email
          </button>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Work email
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={`you@${ALLOWED_EMAIL_DOMAINS[0]}`}
          autoComplete="email"
          autoFocus
          className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        {/* Inline hint about domain restriction */}
        {looksLikeEmail && !domainOk && (
          <p className="text-xs text-amber-700 mt-2">
            Only @{ALLOWED_EMAIL_DOMAINS[0]} addresses can sign in.
          </p>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full px-4 py-2.5 rounded-lg bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {sending ? 'Sending…' : 'Send magic link'}
      </button>

      <p className="text-xs text-slate-400 text-center">
        We&apos;ll email you a link that signs you in — no password needed.
      </p>
    </form>
  )
}
