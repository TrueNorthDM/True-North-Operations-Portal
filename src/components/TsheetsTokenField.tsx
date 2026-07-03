'use client'

// TSheets API token field on Settings — mirrors MondayTokenField exactly:
// full token never leaves the server, client only sees { exists, last4 }.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveTsheetsApiToken } from '@/app/actions'

interface Props {
  tokenInfo: { exists: boolean; last4: string | null }
}

export function TsheetsTokenField({ tokenInfo }: Props) {
  const router = useRouter()
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
      const res = await saveTsheetsApiToken({ token: value })
      if (!res.ok) { setError(res.error ?? 'Failed to save.'); return }
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
      setIsEditing(false); setReveal(false); setValue('')
      router.refresh()
    })
  }

  function confirmClear() {
    setClearWarnOpen(false)
    startSave(async () => {
      const res = await saveTsheetsApiToken({ token: '' })
      if (!res.ok) { setError(res.error ?? 'Failed to clear.'); return }
      setIsEditing(true); router.refresh()
    })
  }

  return (
    <section className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-slate-900">QuickBooks Time (TSheets) API</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Static API token — used by the Budget Usage Report tool to pull hours from TSheets.
        </p>
      </div>

      {!isEditing && tokenInfo.exists && (
        <div className="flex items-center gap-3 flex-wrap">
          <div
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm font-mono text-slate-700 flex items-center gap-2"
            aria-label="Saved token (hidden)"
          >
            <span
              className="select-none [-webkit-user-select:none] tracking-widest"
              style={{ filter: 'blur(4px)' }}
              onCopy={e => e.preventDefault()}
              onCut={e => e.preventDefault()}
            >
              ••••••••••••••••••••
            </span>
            <span className="text-xs text-slate-400 ml-auto select-none">···{tokenInfo.last4}</span>
          </div>
          <button onClick={() => setWarnOpen(true)} disabled={saving}
            className="text-sm font-medium px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors">
            Change
          </button>
          <button onClick={() => setClearWarnOpen(true)} disabled={saving}
            className="text-sm font-medium px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
            Remove
          </button>
        </div>
      )}

      {isEditing && (
        <div className="space-y-3">
          {tokenInfo.exists && (
            <div className="text-xs text-slate-500">Replacing the existing token. Paste the new one below.</div>
          )}
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <input
                type={reveal ? 'text' : 'password'}
                value={value}
                onChange={e => setValue(e.target.value)}
                placeholder="Paste your TSheets API access token…"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 pr-10 rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <button type="button" onClick={() => setReveal(v => !v)}
                aria-label={reveal ? 'Hide token' : 'Show token'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700">
                {reveal ? '🙈' : '👁'}
              </button>
            </div>
            <button onClick={handleSave} disabled={saving || value.trim() === ''}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-slate-800 text-white hover:bg-slate-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {saving ? 'Saving…' : savedFlash ? '✓ Saved' : 'Save'}
            </button>
            {tokenInfo.exists && (
              <button onClick={() => { setIsEditing(false); setValue(''); setError(null) }}
                className="text-sm font-medium px-3 py-2 rounded-lg text-slate-500 hover:text-slate-800">
                Cancel
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            In TSheets: top-right menu → <strong>Company Settings</strong> → <strong>Add-ons</strong> → <strong>API Access</strong> → generate a token.
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
      )}

      {warnOpen && (
        <Modal onClose={() => setWarnOpen(false)}>
          <h3 className="text-lg font-bold text-slate-900">Change the TSheets token?</h3>
          <p className="text-sm text-slate-600">The Budget Usage Report tool will stop working until you save a new valid token.</p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setWarnOpen(false)} className="text-sm font-medium px-3 py-1.5 text-slate-600 hover:text-slate-900">Cancel</button>
            <button onClick={() => { setWarnOpen(false); setValue(''); setIsEditing(true) }}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white">
              I understand, let me change it
            </button>
          </div>
        </Modal>
      )}

      {clearWarnOpen && (
        <Modal onClose={() => setClearWarnOpen(false)}>
          <h3 className="text-lg font-bold text-slate-900">Remove the TSheets token?</h3>
          <p className="text-sm text-slate-600">The Budget Usage Report tool won't be able to fetch data until a token is added again.</p>
          <div className="flex items-center justify-end gap-3 pt-2">
            <button onClick={() => setClearWarnOpen(false)} className="text-sm font-medium px-3 py-1.5 text-slate-600 hover:text-slate-900">Cancel</button>
            <button onClick={confirmClear} className="text-sm font-medium px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white">Remove token</button>
          </div>
        </Modal>
      )}
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
