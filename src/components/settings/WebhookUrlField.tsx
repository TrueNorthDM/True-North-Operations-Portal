'use client'

/**
 * The Monday webhook URL, with its secret embedded.
 *
 * Unlike SecretField, nothing is typed here. The secret is generated server-side
 * (see lib/monday/webhook-secret.ts) and this shows the finished URL, because
 * the URL is the thing that actually gets pasted into Monday. Making someone
 * assemble `origin + path + secret` by hand is how a trailing space ends up in
 * a webhook config and nobody can work out why deliveries stopped.
 *
 * Audit, 10 October 2026:
 *   - the URL shows masked (the address, bullets, the last 4 characters) until
 *     "Show" is pressed: it is a password, and Settings is often on a shared
 *     screen. "Copy" always copies the whole URL, so it never has to be shown;
 *   - the origin comes from the server as a prop. Reading window.location in
 *     render gave the server an empty origin and the browser a full one, a
 *     hydration mismatch;
 *   - "Generate a new secret" asks first in the portal's own dialog (Escape,
 *     focus kept inside), not a hand-built overlay.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useEditing } from './editing-context'
import { useConfirm } from '@/components/ui/useConfirm'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'

export const WEBHOOK_PATH = '/api/monday/webhook/'

/** The URL as shown while hidden: everything but the secret, then its last 4. */
export function maskedWebhookUrl(origin: string, secret: string): string {
  return `${origin}${WEBHOOK_PATH}${'•'.repeat(12)}${secret.slice(-4)}`
}

export function WebhookUrlField({
  origin,
  secret,
  regenerate,
}: {
  /** The portal's public origin, worked out on the server (lib/auth/origin requestOrigin). */
  origin: string
  secret: string | null
  /** Server Action. Returns the new secret so the URL updates without a reload. */
  regenerate: () => Promise<{ ok: boolean; secret?: string; error?: string }>
}) {
  const router = useRouter()
  const editing = useEditing()
  const [confirmDialog, confirm] = useConfirm()

  const [current, setCurrent] = useState(secret)
  const [shown, setShown] = useState(false)
  const [copy, setCopy] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [working, startWork] = useTransition()

  const url = current ? `${origin}${WEBHOOK_PATH}${current}` : null

  function run() {
    setError(null)
    startWork(async () => {
      try {
        const res = await regenerate()
        if (!res.ok) {
          setError(res.error ?? 'The secret was not generated. Try again in a moment.')
          return
        }
        setCurrent(res.secret ?? null)
        setShown(false)
        router.refresh()
      } catch {
        setError('The secret was not generated. Try again in a moment.')
      }
    })
  }

  async function askThenRun() {
    const yes = await confirm({
      title: 'Generate a new secret?',
      body: (
        <>
          <p className="m-0">The current webhook URL stops working at once. Monday deliveries to the old address will be refused until you paste the new one in Monday.</p>
          <p className="mt-2 mb-0">Only do this if the current URL has leaked.</p>
        </>
      ),
      action: 'Generate a new secret',
      danger: true,
    })
    if (yes) run()
  }

  async function copyUrl() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopy('copied')
    } catch {
      setCopy('failed')
    }
    setTimeout(() => setCopy('idle'), 2500)
  }

  return (
    <section className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
      {confirmDialog}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Monday webhook URL</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          The address Monday delivers events to. The random part at the end is what proves a delivery is really from your Monday account,
          so treat the whole URL as a password.
        </p>
      </div>

      {url && current ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <code
              className="flex-1 min-w-[280px] px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[12.5px] font-mono text-slate-700 break-all"
              aria-label={shown ? 'Monday webhook URL' : 'Monday webhook URL, secret hidden'}
            >
              {shown ? url : maskedWebhookUrl(origin, current)}
            </code>
            <button type="button" onClick={() => setShown(v => !v)} aria-pressed={shown} className={BTN.white}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
              Show
            </button>
            <button type="button" onClick={copyUrl} className={BTN.navy}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
              <span className="text-[#ffffff]">{copy === 'copied' ? 'Copied' : 'Copy'}</span>
            </button>
            {editing && (
              <button type="button" onClick={askThenRun} disabled={working} className={`${BTN.white} disabled:opacity-50`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
                {working ? 'Generating…' : 'Generate a new secret'}
              </button>
            )}
          </div>
          <p aria-live="polite" className="text-xs m-0 text-slate-600">
            {copy === 'copied' && 'The full URL is on the clipboard.'}
            {copy === 'failed' && <span className="text-red-700">Copy failed. Press Show, then select the URL and copy it by hand.</span>}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="px-3 py-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500 italic">
            No webhook URL yet.
          </div>
          <button type="button" onClick={run} disabled={working} className={`${BTN.navy} disabled:opacity-50`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            <span className="text-[#ffffff]">{working ? 'Generating…' : 'Generate the webhook URL'}</span>
          </button>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        Monday does not sign webhooks created with a personal API token, only ones that belong to a Monday app.
        This account has no app, so the secret in the URL is what keeps strangers out.
      </div>
    </section>
  )
}
