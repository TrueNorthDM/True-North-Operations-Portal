'use client'

/**
 * MondayTokenField — Monday API token input on Settings.
 *
 * SECURITY MODEL (current):
 *   - The full token value NEVER leaves the server.
 *   - This component only receives { exists, last4 } as props.
 *   - "Change" requires the user to re-enter the full token (we don't pre-fill).
 *   - Saved state is rendered as a blurred mask — no copy, no select.
 *   - Saving sends a NEW token via Server Action (which uses the supabase-js
 *     anon client to write to `app_settings`).
 *
 * Caveat: anyone with the public anon key + no RLS can still query
 * `app_settings` directly via the Supabase REST API. The proper fix is
 * Supabase Auth + an RLS policy "SELECT only if auth.uid() IS NOT NULL".
 */

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { saveMondayApiToken } from '@/app/actions'

interface Props {
  tokenInfo: {
    exists: boolean
    last4: string | null
  }
  footer?: ReactNode
}

export function MondayTokenField({ tokenInfo, footer }: Props) {
  const router = useRouter()
  // Default to edit mode only when no token is saved. If saved, show masked view.
  const [isEditing, setIsEditing] = useState(!tokenInfo.exists)
  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [saving, startSave] = useTransition()
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warnOpen, setWarnOpen] = useState(false)
  const [clearWarnOpen, setClearWarnOpen] = useState(false)

  function handleSave() {
    setError(null)
    startSave(async () => {
      const res = await saveMondayApiToken({ token: value })
      if (!res.ok) {
        setError(res.error ?? 'Failed to save.')
        return
      }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      setIsEditing(false)
      setReveal(false)
      setValue('')
      router.refresh()
    })
  }

  function confirmClear() {
    setClearWarnOpen(false)
    startSave(async () => {
      const res = await saveMondayApiToken({ token: '' })
      if (!res.ok) {
        setError(res.error ?? 'Failed to clear.')
        return
      }
      setIsEditing(true)
      router.refresh()
    })
  }

  function startChange() {
    setWarnOpen(false)
    setValue('')
    setIsEditing(true)
  }

  return (
    <section className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Monday API</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Personal API token from monday.com — used (later) to sync page implementation status.
        </p>
      </div>

      {/* Saved state — blurred mask, no copy, no select */}
      {!isEditing && tokenInfo.exists && (
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-slate-700 flex items-center gap-2"
            aria-label="Saved token (hidden)"
          >
            <span
              // blur + non-selectable + non-copyable mask
              className="select-none [-webkit-user-select:none] tracking-widest"
              style={{ filter: 'blur(4px)' }}
              onCopy={e => e.preventDefault()}
              onCut={e => e.preventDefault()}
            >
              ••••••••••••••••••••
            </span>
            <span className="text-xs text-slate-400 ml-auto select-none">···{tokenInfo.last4}</span>
          </div>
          <button
            onClick={() => setWarnOpen(true)}
            disabled={saving}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Change
          </button>
          <button
            onClick={() => setClearWarnOpen(true)}
            disabled={saving}
            className="text-sm font-medium px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
          >
            Remove
          </button>
        </div>
      )}

      {/* Edit state — enter a new token */}
      {isEditing && (
        <div className="space-y-3">
          {tokenInfo.exists && (
            <div className="text-xs text-slate-500">
              You&apos;re replacing the existing token. Paste the new one below.
            </div>
          )}
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <input
                type={reveal ? 'text' : 'password'}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="Paste your Monday personal API token…"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                type="button"
                onClick={() => setReveal(v => !v)}
                aria-label={reveal ? 'Hide token' : 'Show token'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              >
                {reveal ? '🙈' : '👁'}
              </button>
            </div>
            <button
              onClick={handleSave}
              disabled={saving || value.trim() === ''}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : savedFlash ? '✓ Saved' : 'Save'}
            </button>
            {tokenInfo.exists && (
              <button
                onClick={() => { setIsEditing(false); setValue(''); setError(null); }}
                className="text-sm font-medium px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Find your token at <a href="https://auth.monday.com/users/sign_in" target="_blank" rel="noopener noreferrer" className="text-slate-700 underline">monday.com</a> → Profile picture → Developers → My Access Tokens.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {/* Change warning modal */}
      {warnOpen && (
        <Modal onClose={() => setWarnOpen(false)}>
          <h3 className="text-lg font-bold text-slate-900">Change the Monday API token?</h3>
          <p className="text-sm text-slate-600">
            Replacing the current token will <strong>break the existing Monday connection</strong>.
            Any sync running with the current token will fail until you save a new one.
          </p>
          <p className="text-sm text-slate-500">
            You won&apos;t see the old token again — make sure you have a new one ready before continuing.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setWarnOpen(false)} className="text-sm font-medium px-3 py-1.5 text-slate-600 hover:text-slate-900">Cancel</button>
            <button onClick={startChange} className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white">
              I understand, let me change it
            </button>
          </div>
        </Modal>
      )}

      {/* Clear warning modal */}
      {clearWarnOpen && (
        <Modal onClose={() => setClearWarnOpen(false)}>
          <h3 className="text-lg font-bold text-slate-900">Remove the Monday API token?</h3>
          <p className="text-sm text-slate-600">
            Removing the token will <strong>break the Monday connection</strong>. The system won&apos;t sync implementation status until a token is added again.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setClearWarnOpen(false)} className="text-sm font-medium px-3 py-1.5 text-slate-600 hover:text-slate-900">Cancel</button>
            <button onClick={confirmClear} className="text-sm font-medium px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white">
              Remove token
            </button>
          </div>
        </Modal>
      )}

      {/* Security note — informational */}
      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
        <span aria-hidden="true">⚠</span>
        <span>
          Until login + RLS are in place, this token is technically reachable via the public Supabase anon key.
          Don&apos;t treat this as production-grade storage yet.
        </span>
      </div>

      {footer}
    </section>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
