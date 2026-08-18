'use client'

/**
 * TranslationView: the Boards Review "Translation" pipeline, native React.
 *
 * Fetches the translation boards' snapshot once, enriches client-side with the
 * ported evalPipeline engine, and renders a filterable table: current stage,
 * who has the ball, per-language progress, and time-in-stage.
 *
 * Phase B3 staging view at /boards-beta/translation.
 */

import { useEffect, useMemo, useState } from 'react'
import { SearchField } from '@/components/ui/SearchField'
import { Select } from '@/components/ui/Select'
import { BOARDS } from '@/lib/boards/config'
import { fetchSnapshot } from '@/lib/boards/data'
import {
  enrichTranslationBoard,
  businessDays,
  fmtDays,
  TRANSLATION_BOARD_IDS,
  type TranslationItem,
  type StatusKind,
} from '@/lib/boards/translation'
import { BoardsTabs } from './BoardsTabs'
import { downloadCsv } from '@/lib/boards/csv'

const KIND_LABEL: Record<StatusKind, string> = {
  done: 'Done',
  progress: 'In progress',
  pending: 'Not started',
  stuck: 'Stuck',
  warn: 'Waiting',
}

const KIND_CHIP: Record<StatusKind, string> = {
  done: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  progress: 'bg-sky-50 text-sky-700 border-sky-200',
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
  stuck: 'bg-red-50 text-red-700 border-red-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
}

const KIND_ORDER: StatusKind[] = ['stuck', 'warn', 'progress', 'pending', 'done']

const selectCls =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400'

export function TranslationView() {
  const [items, setItems] = useState<TranslationItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [boardFilter, setBoardFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<'all' | StatusKind>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSnapshot(TRANSLATION_BOARD_IDS)
      .then((snap) => {
        if (cancelled) return
        const enriched: TranslationItem[] = []
        for (const board of snap.boards) {
          const config = BOARDS[board.id]
          if (config) enriched.push(...enrichTranslationBoard(board, config))
        }
        setItems(enriched)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const counts = useMemo(() => {
    const c: Record<StatusKind, number> = { done: 0, progress: 0, pending: 0, stuck: 0, warn: 0 }
    for (const it of items ?? []) c[it.statusKind]++
    return c
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return []
    const q = query.trim().toLowerCase()
    return items
      .filter((it) => boardFilter === 'all' || it.boardId === boardFilter)
      .filter((it) => statusFilter === 'all' || it.statusKind === statusFilter)
      .filter((it) => !q || (it.name + ' ' + it.people.join(' ') + ' ' + it.stageName).toLowerCase().includes(q))
      .sort((a, b) => KIND_ORDER.indexOf(a.statusKind) - KIND_ORDER.indexOf(b.statusKind))
  }, [items, boardFilter, statusFilter, query])

  function exportCsv() {
    const rows = filtered.map((it): (string | number)[] => [
      it.name,
      it.boardShort,
      it.stageName,
      it.currentOwners.join('; '),
      it.subitemProgress ? `${it.subitemProgress.done}/${it.subitemProgress.total}` : '',
      fmtDays(businessDays(it.stageDays)),
    ])
    downloadCsv('translation.csv', ['Item', 'Board', 'Stage', 'Owner', 'Languages', 'In stage'], rows)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Boards Review</h1>
        <p className="mt-1 text-sm text-slate-500">Translation pipeline <span className="text-slate-400">(beta, native rewrite)</span></p>
      </div>

      <BoardsTabs />

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Loading Monday data… (first load can take ~50s)
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <div className="font-semibold">Couldn&apos;t load data</div>
          <div className="mt-1 text-red-600">{error}</div>
          <div className="mt-2 text-xs text-red-500">
            The Monday token is read from the Settings page. Live data works in production; local dev needs{' '}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> (or a <code>MONDAY_TOKEN</code> fallback).
          </div>
        </div>
      )}

      {items && !loading && (
        <>
          {/* Status summary chips */}
          <div className="flex flex-wrap gap-2">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                onClick={() => setStatusFilter((cur) => (cur === k ? 'all' : k))}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${KIND_CHIP[k]} ${
                  statusFilter === k ? 'ring-2 ring-slate-400' : ''
                }`}
              >
                {KIND_LABEL[k]} · {counts[k]}
              </button>
            ))}
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <SearchField
              value={query}
              onChange={setQuery}
              placeholder="Search items, people, stage…"
              className="flex-1 min-w-[200px]"
              focus="focus:ring-2 focus:ring-slate-400"
            />
            <Select
              value={boardFilter}
              onChange={setBoardFilter}
              options={[{ value: 'all', label: 'All boards' }, ...TRANSLATION_BOARD_IDS.map((bid) => ({ value: String(bid), label: BOARDS[bid].short }))]}
              className={selectCls}
              ariaLabel="Board"
            />
            <button
              onClick={exportCsv}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Export CSV
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5">Board</th>
                  <th className="px-4 py-2.5">Stage</th>
                  <th className="px-4 py-2.5">Owner</th>
                  <th className="px-4 py-2.5">Languages</th>
                  <th className="px-4 py-2.5 text-right">In stage</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((it) => (
                  <tr key={`${it.boardId}-${it.id}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{it.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{it.boardShort}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${KIND_CHIP[it.statusKind]}`}>
                        {it.stageName}
                      </span>
                      {it.stageValue && it.stageValue !== it.stageName && (
                        <span className="ml-2 text-xs text-slate-400">{it.stageValue}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{it.currentOwners.join(', ') || <span className="text-slate-300">-</span>}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {it.subitemProgress ? `${it.subitemProgress.done}/${it.subitemProgress.total}` : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{fmtDays(businessDays(it.stageDays))}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                      No items match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-400">
            {filtered.length} of {items.length} items
          </p>
        </>
      )}
    </div>
  )
}
