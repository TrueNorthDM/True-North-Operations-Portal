'use client'

/**
 * Setting up two-step sign-in (plan step p4-2fa): shown once, at the first
 * sign-in after two-step sign-in goes live, and again after an admin resets it.
 *
 * The QR code and the key come from Supabase MFA (TOTP): the QR is an SVG data
 * URL, the key the same secret spelled out for whoever cannot scan. The person
 * proves the app works by typing the code it shows; only then is the factor on.
 */

import { useState, useTransition } from 'react'

export interface TwoStepEnrollProps {
  /** Supabase's totp.qr_code: an SVG data URL. */
  qr: string
  /** Supabase's totp.secret, for typing into the app by hand. */
  secret: string
  /** Supabase's totp.uri (otpauth://): on a phone, one tap adds the portal to the app. */
  uri: string
  email: string
  /** Checks the first code and turns the factor on. Null in design checks. */
  verify: ((code: string) => Promise<{ ok: false; error: string } | void>) | null
  signOut: (() => void) | null
  /** "Skip for now, N days left": only while their week to set it up runs. */
  skip?: { label: string; action: () => void } | null
}

const APPS = ['Google Authenticator', 'Microsoft Authenticator', 'iPhone Passwords', '1Password']

export function TwoStepEnroll({ qr, secret, uri, email, verify, signOut, skip }: TwoStepEnrollProps) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()
  const digits = code.replace(/\D/g, '')
  const grouped = secret.replace(/(.{4})/g, '$1 ').trim()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (digits.length !== 6 || pending || !verify) return
    setError(null)
    start(async () => {
      const res = await verify(digits)
      if (res && !res.ok) setError(res.error)
    })
  }

  function copy() {
    navigator.clipboard?.writeText(secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }

  const step = (n: number, title: string) => (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tn-primary text-[12px] text-[#ffffff]" style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }}>{n}</span>
      <span className="text-[14px] text-tn-ink" style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }}>{title}</span>
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-5 text-left">
      <div className="text-center">
        <h1 style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }} className="text-2xl text-tn-ink">Add a second step</h1>
        <p className="mt-2 text-sm text-foreground">
          Every sign-in will also ask for a code from an app on your phone. You set it up once, and it takes a minute.
        </p>
      </div>

      <div className="space-y-2">
        {step(1, 'Install an authenticator app')}
        <div className="flex flex-wrap gap-1.5 pl-[34px]">
          {APPS.map(a => (
            <span key={a} className="rounded-full border border-slate-200 bg-card px-2.5 py-1 text-[11.5px] font-semibold text-muted">{a}</span>
          ))}
        </div>
        <p className="pl-[34px] text-[12px] text-muted">Any of them works. Skip this if you already have one.</p>
      </div>

      <div className="space-y-2.5">
        {step(2, 'Scan this code with the app')}
        <div className="pl-[34px]">
          {/* On a phone the QR is on the same screen as the app, so there is
              nothing to scan: the otpauth link hands the key to the app. */}
          <a
            href={uri}
            className="mb-3 flex w-full items-center justify-center rounded-xl border-[1.5px] border-tn-teal px-4 py-3 text-[14px] text-tn-teal md:hidden"
            style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }}
          >
            On this phone? Tap to add it to your app
          </a>
          <div className="inline-flex rounded-2xl border border-slate-200 bg-[#ffffff] p-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- an SVG data URL from Supabase, not a file to optimise */}
            <img src={qr} alt="QR code to add the portal to your authenticator app" width={168} height={168} className="block h-[168px] w-[168px]" />
          </div>
          <p className="mt-2 text-[12px] text-muted">Can&apos;t scan? Type this key in the app instead:</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded-lg bg-subtle px-2.5 py-1.5 font-mono text-[12.5px] tracking-wide text-tn-ink">{grouped}</code>
            <button type="button" onClick={copy} className="text-[12px] font-semibold text-tn-teal hover:text-tn-primary">{copied ? 'Copied' : 'Copy'}</button>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {step(3, 'Type the 6‑digit code the app shows')}
        <div className="pl-[34px]">
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={e => setCode(e.target.value.replace(/[^\d ]/g, '').slice(0, 7))}
            placeholder="123456"
            aria-label="Code from the authenticator app"
            className="w-full rounded-xl border-[1.5px] border-slate-300 bg-card px-4 py-3 text-center font-mono text-[22px] tracking-[.35em] text-tn-ink transition-colors focus:border-tn-teal focus:outline-none focus:ring-[3px] focus:ring-tn-teal/20"
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      <button
        type="submit"
        disabled={digits.length !== 6 || pending}
        style={{ fontFamily: 'var(--font-raleway)', fontWeight: 800 }}
        className="w-full rounded-xl bg-primary px-4 py-3.5 text-[15px] text-[#ffffff] transition hover:opacity-90 active:translate-y-px disabled:cursor-not-allowed"
      >
        {pending ? 'Checking…' : 'Turn on two-step sign-in'}
      </button>

      {skip && (
        <button type="button" onClick={skip.action} className="w-full text-center text-[13px] font-semibold text-tn-teal hover:text-tn-primary">
          {skip.label}
        </button>
      )}

      <p className="text-center text-xs text-muted">
        Signed in as <strong className="text-tn-ink">{email}</strong>.{' '}
        <button type="button" onClick={() => signOut?.()} className="text-tn-teal underline hover:text-tn-primary">Sign out</button>
      </p>
    </form>
  )
}
