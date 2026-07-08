'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { syncAllFromTsheets } from '@/lib/tsheets/sync-actions'

interface Props {
  syncedAt: string | null
  /** Admins get a clickable "sync now"; everyone else sees a read-only badge. */
  interactive?: boolean
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} minute${min !== 1 ? 's' : ''} ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hour${hr !== 1 ? 's' : ''} ago`
  const day = Math.floor(hr / 24)
  return `${day} day${day !== 1 ? 's' : ''} ago`
}

export function SyncStatus({ syncedAt, interactive = false }: Props) {
  const router = useRouter()
  const [, setTick] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-render every minute so the relative label stays fresh.
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const label = syncedAt ? `Last synced ${timeAgo(syncedAt)}` : 'Never synced'

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

  const base = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs'

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
