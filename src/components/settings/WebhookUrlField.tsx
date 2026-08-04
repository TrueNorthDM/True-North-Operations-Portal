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
 * The secret is visible rather than masked on purpose: this page is admin-only,
 * and a credential you cannot read is a credential you cannot install.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useEditing } from './editing-context'

export function WebhookUrlField({
  secret,
  regenerate,
}: {
  secret: string | null
  /** Server Action. Returns the new secret so the URL updates without a reload. */
  regenerate: () => Promise<{ ok: boolean; secret?: string; error?: string }>
}) {
  const router = useRouter()
  const editing = useEditing()

  const [current, setCurrent] = useState(secret)
  const [copied, setCopied] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [working, startWork] = useTransition()

  // Built in the browser so it is always the origin the admin is actually on,
  // rather than a base URL guessed from an env var that drifts per environment.
  const url = current ? `${typeof window === 'undefined' ? '' : window.location.origin}/api/monday/webhook/${current}` : null

  function run() {
    setError(null)
    startWork(async () => {
      const res = await regenerate()
      if (!res.ok) {
        setError(res.error ?? 'Failed to generate.')
        return
      }
      setCurrent(res.secret ?? null)
      router.refresh()
    })
  }

  async function copy() {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy. Select the URL and copy it manually.')
    }
  }

  return (
    <section className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Monday webhook URL</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          The address Monday delivers events to. The random part at the end is what proves a delivery is really from your Monday account,
          so treat the whole URL as a password.
        </p>
      </div>

      {url ? (
        <div className="flex items-center gap-3 flex-wrap">
          <code className="flex-1 min-w-[280px] px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-[12.5px] font-mono text-slate-700 break-all">
            {url}
          </code>
          <button
            onClick={copy}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          {editing && (
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={working}
              className="text-sm font-medium px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              Generate a new one
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="px-3 py-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400 italic">
            No webhook URL yet.
          </div>
          <button
            onClick={run}
            disabled={working}
            className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors disabled:opacity-40"
          >
            {working ? 'Generating…' : 'Generate the webhook URL'}
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

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={() => setConfirmOpen(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Generate a new webhook URL?</h3>
            <div className="text-sm text-slate-600 space-y-2">
              <p>The current URL <strong>stops working immediately</strong>.</p>
              <p>
                Href Links will not sync until you delete both webhooks in Monday and recreate them with the new URL.
                Only do this if the current one has leaked.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setConfirmOpen(false)} className="text-sm font-medium px-3 py-1.5 text-slate-600 hover:text-slate-900">Cancel</button>
              <button
                onClick={() => { setConfirmOpen(false); run() }}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white"
              >
                Generate a new URL
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
