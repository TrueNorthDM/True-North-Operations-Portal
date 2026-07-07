'use client'

/**
 * TargetsEditor — edit weekly publishing targets (Boards Review · Targets).
 *
 * Admins get inline edit / add / remove (Server Actions, RLS-enforced). Viewers
 * get a read-only list. Replaces the COE admin panel's targets editor, now
 * writing to the portal's own publishing_targets + audit_log.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { BOARDS, PUBLISHING_BOARD_IDS } from '@/lib/boards/config'
import { saveTargetValue, addTarget, deleteTarget } from '@/app/(app)/boards-beta/targets/actions'
import type { PublishingTargetRow, AuditLogRow } from '@/lib/types/database.types'

export function TargetsEditor({
  targets,
  isAdmin,
  audit,
  grid = false,
}: {
  targets: PublishingTargetRow[]
  isAdmin: boolean
  audit: AuditLogRow[]
  grid?: boolean          // when true, lay the board cards out side by side
}) {
  const byBoard = new Map<string, PublishingTargetRow[]>()
  for (const t of targets) {
    const arr = byBoard.get(t.board_id) ?? []
    arr.push(t)
    byBoard.set(t.board_id, arr)
  }
  const boardIds = [...new Set([...PUBLISHING_BOARD_IDS.filter((b) => byBoard.has(b)), ...byBoard.keys()])]

  return (
    <div className="space-y-6">
      {!isAdmin && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          View-only — ask an admin to change targets.
        </div>
      )}

      <div className={grid ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start' : 'space-y-6'}>
        {boardIds.map((bid) => (
          <BoardTargets key={bid} boardId={bid} rows={byBoard.get(bid) ?? []} isAdmin={isAdmin} />
        ))}
      </div>

      {boardIds.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-400">
          No targets yet.
        </div>
      )}

      {isAdmin && <AuditHistory audit={audit} />}
    </div>
  )
}

function BoardTargets({ boardId, rows, isAdmin }: { boardId: string; rows: PublishingTargetRow[]; isAdmin: boolean }) {
  const config = BOARDS[boardId]
  const sorted = [...rows].sort((a, b) => a.language.localeCompare(b.language))
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-800">{config?.name ?? boardId}</h2>
      <div className="space-y-2">
        {sorted.map((row) => (
          <TargetRow key={row.id} row={row} isAdmin={isAdmin} />
        ))}
      </div>
      {isAdmin && <AddTargetForm boardId={boardId} boardShort={config?.short ?? ''} />}
    </div>
  )
}

function TargetRow({ row, isAdmin }: { row: PublishingTargetRow; isAdmin: boolean }) {
  const router = useRouter()
  const [value, setValue] = useState(String(row.target_value))
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const dirty = value !== String(row.target_value)

  function save() {
    setError(null)
    start(async () => {
      const res = await saveTargetValue({ id: row.id, targetValue: Number(value) })
      if (!res.ok) setError(res.error ?? 'Failed')
      else router.refresh()
    })
  }

  function remove() {
    setError(null)
    start(async () => {
      const res = await deleteTarget({ id: row.id })
      if (!res.ok) setError(res.error ?? 'Failed')
      else router.refresh()
    })
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-between border-b border-slate-100 py-1.5 text-sm last:border-0">
        <span className="font-medium text-slate-700">{row.language}</span>
        <span className="text-slate-600">
          <strong className="text-slate-800">{row.target_value}</strong> / week
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-1.5 last:border-0">
      <span className="w-28 text-sm font-medium text-slate-700">{row.language}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
      <span className="text-xs text-slate-400">/ week</span>
      <button
        onClick={save}
        disabled={!dirty || pending}
        className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-900 disabled:opacity-30"
      >
        {pending ? '…' : 'Save'}
      </button>
      <button onClick={remove} disabled={pending} className="px-2 py-1 text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-30">
        Remove
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

function AddTargetForm({ boardId, boardShort }: { boardId: string; boardShort: string }) {
  const router = useRouter()
  const [language, setLanguage] = useState('')
  const [value, setValue] = useState('')
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function add() {
    setError(null)
    start(async () => {
      const res = await addTarget({ boardId, boardShort, language, targetValue: Number(value) })
      if (!res.ok) {
        setError(res.error ?? 'Failed')
        return
      }
      setLanguage('')
      setValue('')
      router.refresh()
    })
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
      <input
        value={language}
        onChange={(e) => setLanguage(e.target.value)}
        placeholder="Language (e.g. French)"
        className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="0"
        className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-slate-400"
      />
      <span className="text-xs text-slate-400">/ week</span>
      <button
        onClick={add}
        disabled={pending || language.trim() === '' || value === ''}
        className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-30"
      >
        + Add language
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  )
}

function AuditHistory({ audit }: { audit: AuditLogRow[] }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-3 font-semibold text-slate-800">Change history</h2>
      {audit.length === 0 ? (
        <p className="text-sm text-slate-400">No changes recorded yet.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {audit.map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline gap-2 border-b border-slate-100 py-1.5 last:border-0">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                  e.action === 'insert'
                    ? 'bg-emerald-50 text-emerald-700'
                    : e.action === 'delete'
                      ? 'bg-red-50 text-red-700'
                      : 'bg-sky-50 text-sky-700'
                }`}
              >
                {e.action}
              </span>
              <span className="text-slate-700">{describeAudit(e)}</span>
              <span className="ml-auto text-xs text-slate-400">
                {e.user_email ?? 'system'} · {new Date(e.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Human-readable one-liner for an audit row, reading before/after JSON. */
function describeAudit(e: AuditLogRow): string {
  const row = (e.after ?? e.before ?? {}) as { board_short?: string; language?: string; target_value?: number }
  const where = [row.board_short, row.language].filter(Boolean).join(' · ')
  if (e.action === 'update') {
    const before = (e.before as { target_value?: number } | null)?.target_value
    const after = (e.after as { target_value?: number } | null)?.target_value
    return `${where}: ${before} → ${after}/wk`
  }
  if (e.action === 'insert') return `${where}: set to ${row.target_value}/wk`
  return `${where}: removed`
}
