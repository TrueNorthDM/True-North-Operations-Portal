'use client'

/**
 * Admin-only "Import from Monday" trigger for the Directory. POSTs to
 * /api/admin/import-monday-people (the one-off board → Directory import) and
 * shows a compact summary. Idempotent, so it's safe to run more than once.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Summary {
  ok: boolean
  error?: string
  created: number
  updated: number
  managersLinked: number
  docsImported: number
  docsFailed: number
  warnings: string[]
  elapsedMs: number
}

export function ImportFromMondayButton() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    if (!window.confirm(
      'Import all people from the True North Team board?\n\n'
      + 'Matching Directory people are refreshed with the board’s values, the no-longer-active people are added, and each person’s History documents are pulled in. '
      + 'Internal rates, portal logins, TSheets links and existing mailboxes are never touched.',
    )) return

    setError(null)
    setSummary(null)
    setRunning(true)
    try {
      const res = await fetch('/api/admin/import-monday-people', { method: 'POST' })
      const json = (await res.json()) as Summary
      if (!res.ok || !json.ok) {
        setError(json.error || 'Import failed')
        if (json.created != null) setSummary(json)
      } else {
        setSummary(json)
        startTransition(() => router.refresh())
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap justify-end">
      {summary && (
        <span className="text-[12px] text-muted tabular-nums">
          {summary.created} added · {summary.updated} updated · {summary.docsImported} docs
          {summary.warnings.length > 0 && <> · <span className="text-[#b8790a]">{summary.warnings.length} warnings</span></>}
        </span>
      )}
      {error && <span className="text-[12px] text-red-600 max-w-[320px] truncate" title={error}>{error}</span>}
      <button
        type="button"
        onClick={run}
        disabled={running}
        className="inline-flex items-center gap-2 font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink border border-slate-200 rounded-[10px] px-4 py-2.5 transition-all hover:border-tn-ink disabled:opacity-50"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={running ? 'animate-spin' : ''}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
        </svg>
        {running ? 'Importing…' : 'Import from Monday'}
      </button>
    </div>
  )
}
