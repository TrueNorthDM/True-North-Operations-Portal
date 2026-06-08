'use client'

/**
 * GoalsView — the Boards Review "Goals" (Publishing) dashboard, native React.
 *
 * Fetches the Monday snapshot + targets once, enriches client-side with the
 * ported pure logic, and recomputes pace-vs-target whenever the period/board
 * filter changes (no refetch — the snapshot already spans 180 days).
 *
 * Phase B2: this is the staging view at /boards-beta. The legacy boards.html
 * stays the live Boards Review until cutover (B6).
 */

import { useEffect, useMemo, useState } from 'react'
import { BOARDS, PUBLISHING_BOARD_IDS } from '@/lib/boards/config'
import { fetchSnapshot, fetchTargets } from '@/lib/boards/data'
import {
  enrichPublishingBoard,
  computePublishingMetrics,
  getDateRange,
  type Period,
  type PublishedItem,
} from '@/lib/boards/publishing'
import type { TargetsMap } from '@/lib/boards/types'
import { GoalsChart } from './GoalsChart'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'lastweek', label: 'Last week' },
  { value: '2weeks', label: 'Last 2 weeks' },
  { value: 'month', label: 'This month' },
  { value: 'quarter', label: 'Last quarter' },
  { value: 'all', label: 'Last 90d (ref.)' },
]

const round1 = (n: number) => Math.round(n * 10) / 10

/** Progress-bar color by completion %, mirroring the COE thresholds. */
function barClass(pct: number): string {
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 70) return 'bg-sky-500'
  if (pct >= 40) return 'bg-amber-500'
  return 'bg-red-500'
}

const selectCls =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400'

export function GoalsView() {
  const [period, setPeriod] = useState<Period>('month')
  const [boardFilter, setBoardFilter] = useState('all')
  const [items, setItems] = useState<PublishedItem[] | null>(null)
  const [targets, setTargets] = useState<TargetsMap>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Runs once on mount; initial state is already loading=true / error=null,
    // so there's no need to set them synchronously here (which the
    // react-hooks/set-state-in-effect rule flags).
    let cancelled = false
    Promise.all([fetchSnapshot(PUBLISHING_BOARD_IDS), fetchTargets()])
      .then(([snap, tg]) => {
        if (cancelled) return
        const enriched: PublishedItem[] = []
        for (const board of snap.boards) {
          const config = BOARDS[board.id]
          if (config) enriched.push(...enrichPublishingBoard(board, config))
        }
        setItems(enriched)
        setTargets(tg)
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

  const metrics = useMemo(() => {
    if (!items) return null
    const { from, to } = getDateRange(period)
    return computePublishingMetrics(items, targets, period, from, to, boardFilter)
  }, [items, targets, period, boardFilter])

  return (
    <div className="space-y-6">
      {/* Header + filters */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Boards Review · Goals</h1>
          <p className="mt-1 text-sm text-slate-500">
            Weekly publishing pace vs target <span className="text-slate-400">(beta — native rewrite)</span>
          </p>
        </div>
        <div className="flex gap-2">
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className={selectCls} aria-label="Period">
            {PERIODS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
          <select value={boardFilter} onChange={(e) => setBoardFilter(e.target.value)} className={selectCls} aria-label="Board">
            <option value="all">All boards</option>
            {PUBLISHING_BOARD_IDS.map((bid) => (
              <option key={bid} value={bid}>
                {BOARDS[bid].short}
              </option>
            ))}
          </select>
        </div>
      </div>

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
            The Monday token is read from the Settings page. Live data works automatically in production. In local dev,
            reading it also needs <code>SUPABASE_SERVICE_ROLE_KEY</code> in .env.local (or set <code>MONDAY_TOKEN</code>{' '}
            directly as a fallback).
          </div>
        </div>
      )}

      {metrics && !loading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <SummaryCard label="Published" value={String(metrics.totals.done)} sub={metrics.periodLabel} />
            <SummaryCard label="Target" value={String(round1(metrics.totals.target))} sub={`pages for ${metrics.periodLabel}`} />
            <SummaryCard label="Completion" value={`${metrics.totals.pct}%`} sub={`of ${metrics.periodLabel} target`} />
          </div>

          {/* Chart */}
          {metrics.boards.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <GoalsChart metrics={metrics} />
            </div>
          )}

          {/* Per-board pace matrix */}
          {metrics.boards.map((b) => (
            <div key={b.boardId} className="rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold text-slate-800">{b.name}</h2>
                <span className="text-sm text-slate-500">
                  {b.done}/{round1(b.target)} · {b.pct}%
                </span>
              </div>
              <div className="space-y-3">
                {b.langs.map((l) => (
                  <div key={l.lang}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{l.lang}</span>
                      <span className="text-slate-500">
                        <strong className="text-slate-800">{l.done}</strong> of{' '}
                        <strong className="text-slate-800">{round1(l.target)}</strong> ·{' '}
                        <span className="text-slate-400">{l.perWeek}/wk</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full ${barClass(l.pct)}`} style={{ width: `${Math.min(100, l.pct)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {metrics.boards.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No targets configured for this filter.
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-extrabold tabular-nums text-slate-900">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  )
}
