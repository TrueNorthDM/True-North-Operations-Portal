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
 * One component for every credential on the page. MondayTokenField and
 * TsheetsTokenField were near-identical copies of this (the second's own
 * comment said it "mirrors MondayTokenField exactly"), and a third credential
 * would have meant a third copy.
 */

import { useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useEditing } from './editing-context'

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
  const [warnOpen, setWarnOpen] = useState(false)
  const [clearWarnOpen, setClearWarnOpen] = useState(false)

  function persist(next: string, onDone: () => void) {
    setError(null)
    startSave(async () => {
      const res = await save({ value: next })
      if (!res.ok) {
        setError(res.error ?? 'Failed to save.')
        return
      }
      onDone()
      router.refresh()
    })
  }

  const handleSave = () => persist(value, () => {
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
    setIsEditing(false)
    setReveal(false)
    setValue('')
  })

  const confirmClear = () => {
    setClearWarnOpen(false)
    persist('', () => setIsEditing(true))
  }

  return (
    <section className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
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
                aria-label={reveal ? 'Hide value' : 'Show value'}
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
            {info.exists && (
              <button
                onClick={() => { setIsEditing(false); setValue(''); setError(null) }}
                className="text-sm font-medium px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800"
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

      {warnOpen && (
        <Modal onClose={() => setWarnOpen(false)}>
          <h3 className="text-lg font-bold text-slate-900">{changeWarning.title}</h3>
          <div className="text-sm text-slate-600 space-y-2">{changeWarning.body}</div>
          <p className="text-sm text-slate-500">
            You won&apos;t see the old value again, make sure you have the new one ready.
          </p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setWarnOpen(false)} className="text-sm font-medium px-3 py-1.5 text-slate-600 hover:text-slate-900">Cancel</button>
            <button
              onClick={() => { setWarnOpen(false); setValue(''); setIsEditing(true) }}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white"
            >
              {changeWarning.confirm}
            </button>
          </div>
        </Modal>
      )}

      {clearWarnOpen && (
        <Modal onClose={() => setClearWarnOpen(false)}>
          <h3 className="text-lg font-bold text-slate-900">{clearWarning.title}</h3>
          <div className="text-sm text-slate-600 space-y-2">{clearWarning.body}</div>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setClearWarnOpen(false)} className="text-sm font-medium px-3 py-1.5 text-slate-600 hover:text-slate-900">Cancel</button>
            <button onClick={confirmClear} className="text-sm font-medium px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white">
              {clearWarning.confirm}
            </button>
          </div>
        </Modal>
      )}

      {note}
      {footer}
    </section>
  )
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
