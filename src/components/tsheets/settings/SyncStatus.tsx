'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { syncAllFromTsheets } from '@/lib/tsheets/sync-actions'
import { formatEt } from '@/lib/format/et'

// The sync time is written as a moment in New York, 12-hour, "ET" (audit,
// 10 October 2026). A relative "X ago" computed during render differed between
// the server and the browser, and needed a timer to stay true.

interface Props {
  syncedAt: string | null
  /** Admins get a clickable "sync now"; everyone else sees a read-only badge. */
  interactive?: boolean
  /**
   * The last import attempt failed, so `syncedAt` is older than it reads.
   * Worth its own state: a timestamp that only moves on success makes a
   * failure look identical to a quiet hour.
   */
  failed?: boolean
}

export function SyncStatus({ syncedAt, interactive = false, failed = false }: Props) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const label = failed
    ? (syncedAt ? `Import failed, data from ${formatEt(syncedAt)}` : 'Import failed, no data yet')
    : syncedAt ? `Last synced ${formatEt(syncedAt)}` : 'Never synced'

  async function onClick() {
    if (!interactive || syncing) return
    setSyncing(true)
    setError(null)
    const res = await syncAllFromTsheets()
    setSyncing(false)
    if (res.ok) router.refresh()
    else setError(res.error ?? 'Sync failed.')
  }

  const inner = (
    <>
      <svg className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992V4.356M2.985 14.652H7.977v4.992M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 14.652l3.181 3.182a8.25 8.25 0 0013.803-3.7" />
      </svg>
      <span>{syncing ? 'Syncing…' : label}</span>
    </>
  )

  const base = failed
    ? 'inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 text-[#7a4e05] px-3 py-1.5 text-xs'
    : 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {interactive ? (
        <button
          onClick={onClick}
          disabled={syncing}
          title="Syncs automatically every 4 hours · click to sync now"
          className={`${base} text-slate-600 hover:bg-slate-50 disabled:opacity-60`}
        >
          {inner}
        </button>
      ) : (
        <span title="Syncs automatically every 4 hours" className={`${base} text-slate-500`}>
          {inner}
        </span>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}
