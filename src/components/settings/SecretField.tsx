'use client'

/**
 * SecretField: a write-only credential input on Settings.
 *
 * SECURITY MODEL
 *   - The stored value NEVER leaves the server. This component only receives
 *     { exists, last4 }.
 *   - "Change" requires re-entering the whole value; nothing is pre-filled.
 *   - The saved state renders as a blurred mask that cannot be copied or
 *     selected.
 *   - Saving goes through a Server Action passed in by the page, which is
 *     where the admin check lives.
 *
 * Confirmations go through useConfirm (audit, 10 October 2026): the two
 * hand-built overlays here had no Escape, no focus trap and left focus behind
 * them. Buttons come from lib/ui/buttons like the rest of the portal.
 *
 * One component for every credential on the page. MondayTokenField and
 * TsheetsTokenField were near-identical copies of this (the second's own
 * comment said it "mirrors MondayTokenField exactly"), and a third credential
 * would have meant a third copy.
 */

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useEditing } from './editing-context'
import { useConfirm } from '@/components/ui/useConfirm'
import { BTN } from '@/lib/ui/buttons'

export interface SecretInfo {
  exists: boolean
  last4: string | null
}

interface Warning {
  title: string
  body: ReactNode
  /** Label for the destructive confirm button. */
  confirm: string
}

export function SecretField({
  title, description, info, placeholder, help, note, footer,
  changeWarning, clearWarning, save,
}: {
  title: string
  description: ReactNode
  info: SecretInfo
  placeholder: string
  /** Where to find the value, shown under the input. */
  help?: ReactNode
  /** Optional caveat box under the field. */
  note?: ReactNode
  footer?: ReactNode
  changeWarning: Warning
  clearWarning: Warning
  /** Server Action that persists it. Empty string clears. */
  save: (input: { value: string }) => Promise<{ ok: boolean; error?: string }>
}) {
  const router = useRouter()
  const editing = useEditing() // page-level Settings edit mode
  // Start in edit mode only when nothing is saved yet.
  const [isEditing, setIsEditing] = useState(!info.exists)

  const showMask = info.exists && !(editing && isEditing)
  const showInput = editing && (isEditing || !info.exists)
  const showEmpty = !editing && !info.exists

  const [value, setValue] = useState('')
  const [reveal, setReveal] = useState(false)
  const [saving, startSave] = useTransition()
  const [savedFlash, setSavedFlash] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, confirm] = useConfirm()

  function persist(next: string, onDone: () => void) {
    setError(null)
    startSave(async () => {
      try {
        const res = await save({ value: next })
        if (!res.ok) {
          // The action's own words: it says why (not allowed, a preview, a bad value).
          setError(res.error ?? 'Not saved. Try again in a moment.')
          return
        }
        onDone()
        router.refresh()
      } catch {
        setError('Not saved. Try again in a moment.')
      }
    })
  }

  const handleSave = () => persist(value, () => {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
    setIsEditing(false)
    setReveal(false)
    setValue('')
  })

  async function askChange() {
    const yes = await confirm({
      title: changeWarning.title,
      body: (
        <div className="space-y-2">
          {changeWarning.body}
          <p className="m-0">You won&apos;t see the old value again, so make sure you have the new one ready.</p>
        </div>
      ),
      action: changeWarning.confirm,
    })
    if (!yes) return
    setValue('')
    setIsEditing(true)
  }

  async function askClear() {
    const yes = await confirm({ title: clearWarning.title, body: <div className="space-y-2">{clearWarning.body}</div>, action: clearWarning.confirm, danger: true })
    if (yes) persist('', () => setIsEditing(true))
  }

  return (
    <section className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
      {confirmDialog}
      <div>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>

      {showMask && (
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-slate-700 flex items-center gap-2"
            aria-label={`${title}, saved and hidden`}
          >
            <span
              className="select-none [-webkit-user-select:none] tracking-widest"
              style={{ filter: 'blur(4px)' }}
              onCopy={e => e.preventDefault()}
              onCut={e => e.preventDefault()}
            >
              ••••••••••••••••••••
            </span>
            <span className="text-xs text-slate-400 ml-auto select-none">···{info.last4}</span>
          </div>
          {editing && (
            <>
              <button type="button" onClick={askChange} disabled={saving} className={`${BTN.white} disabled:opacity-50`}>
                Change
              </button>
              <button type="button" onClick={askClear} disabled={saving} className={`${BTN.white} disabled:opacity-50`}>
                Remove
              </button>
            </>
          )}
        </div>
      )}

      {showEmpty && (
        <div className="px-3 py-2 rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400 italic">
          Nothing set, click <span className="font-semibold not-italic text-slate-500">Edit</span> to add it.
        </div>
      )}

      {showInput && (
        <div className="space-y-3">
          {info.exists && (
            <div className="text-xs text-slate-500">
              You&apos;re replacing the saved value. Paste the new one below.
            </div>
          )}
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <input
                type={reveal ? 'text' : 'password'}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder={placeholder}
                aria-label={title}
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button
                type="button"
                onClick={() => setReveal(v => !v)}
                aria-label="Show value"
                aria-pressed={reveal}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
              >
                {reveal
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3l18 18" /><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>}
              </button>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || value.trim() === ''}
              className={`${BTN.navy} disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              <span className="text-[#ffffff]">{saving ? 'Saving…' : savedFlash ? 'Saved' : 'Save'}</span>
            </button>
            {info.exists && (
              <button
                type="button"
                onClick={() => { setIsEditing(false); setValue(''); setError(null) }}
                className={BTN.white}
              >
                Cancel
              </button>
            )}
          </div>
          {help && <p className="text-xs text-slate-500">{help}</p>}
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      {note}
      {footer}
    </section>
  )
}
