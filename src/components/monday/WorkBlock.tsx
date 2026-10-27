'use client'

/**
 * The blocks of My Work (Unknown user, On-going, Completed) and the cells of a
 * row. Split out of WorkList.tsx (audit, 10 October 2026), behaviour unchanged.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { chip, PRIORITY_CHIP, DUE_BADGE, DUE_TIME } from './tokens'
import { StatusChip } from './StatusChip'
import { BandHeader, BandMap, NextBandPill, OrderMark, type BandSummary } from './OrderBands'
import { OpenHistory, OpenInMonday } from './RowLinks'
import { n, type readDue } from './shared'
import { bandRange, bandReason, bandsOf } from '@/lib/monday/worklist/order-bands'
import type { Sort, SortKey } from '@/lib/monday/worklist/list-view'
import type { ColumnDef } from '@/lib/monday/worklist/columns'
import type { WorkRow } from '@/lib/monday/worklist/data'

export interface Prepared { row: WorkRow; due: ReturnType<typeof readDue> | null; hay: string }

// min-w-0 on every cell, so a grid column can never be widened by its content,
// and overflow-hidden so nothing can be drawn outside the column that owns it.
// Without the pair, one long unbreakable word reaches into its neighbour and
// the reader sees two facts on top of each other.
const HEAD_CELL = "px-3 py-[11px] min-w-0 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted"
const CELL = 'px-3 py-2.5 min-w-0 overflow-hidden text-[13px] leading-[1.4] break-words'

/**
 * How many rows a block draws before asking.
 *
 * Twelve cells per row, so 1,280 on-going steps is fifteen thousand DOM nodes
 * for one block, and building them is most of the wait when a tab changes.
 * Nobody reads past the first screen anyway; the rest is a click away and the
 * count is always on the header, so nothing is hidden by it.
 */
const FIRST_ROWS = 200

/** A column heading that sorts. Arrow shown only on the column in use, so the row of headings stays quiet. */
function SortHead({ label, k, sort, onSort, align = 'left' }: {
  label: string
  k: SortKey
  sort: Sort | null
  onSort: (k: SortKey) => void
  align?: 'left' | 'right'
}) {
  const on = sort?.key === k
  const next = !on ? 'ascending' : sort?.dir === 'asc' ? 'descending' : 'the list order'
  return (
    <button
      type="button"
      onClick={() => onSort(k)}
      title={`Sort by ${label.toLowerCase()}, ${next}`}
      className={`${HEAD_CELL} flex items-center gap-1 whitespace-nowrap transition-colors hover:text-tn-ink ${align === 'right' ? 'justify-end text-right' : 'text-left'} ${on ? 'text-tn-ink' : ''}`}
    >
      {/* Not truncated: the handoff's widths leave "Workspace" a few pixels
          wider than its column, and it has always run into the padding beside
          it rather than being cut to "Worksp…". */}
      <span>{label}</span>
      {on && <span aria-hidden="true" className="text-tn-teal text-[11px] leading-none">{sort!.dir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  )
}

/** The heading of one column: a sort button, a plain label, or nothing a reader needs to see. */
export function HeadCell({ col, sort, onSort }: { col: ColumnDef; sort: Sort | null; onSort: (k: SortKey) => void }) {
  if (col.key === 'monday' || col.key === 'history') {
    return <div className="px-2 py-[11px] min-w-0"><span className="sr-only">{col.label}</span></div>
  }
  if (col.sort) return <SortHead label={col.label} k={col.sort} sort={sort} onSort={onSort} align={col.align} />
  return <div className={`${HEAD_CELL} ${col.align === 'right' ? 'text-right' : ''}`}>{col.label}</div>
}

/** One row's cells, only for the columns being shown. */
function RowCells({ r, d, columns, onPick, marks = false }: {
  r: WorkRow
  d: Prepared['due']
  columns: ColumnDef[]
  onPick: (r: WorkRow) => void
  /** The list follows an order a leader set: mark each row and give True North's place. */
  marks?: boolean
}) {
  const faint = <span className="text-[var(--faint)]">-</span>
  return (
    <>
      {columns.map(c => {
        switch (c.key) {
          case 'monday':
            return (
              <div key={c.key} className="px-2 py-2.5 min-w-0 flex justify-center">
                {r.url ? <OpenInMonday href={r.url} label={r.itemName} /> : <span className="text-[var(--faint)] leading-7">-</span>}
              </div>
            )
          case 'history':
            return (
              <div key={c.key} className="px-2 py-2.5 min-w-0 flex justify-center">
                <OpenHistory label={r.itemName} onOpen={() => onPick(r)} />
              </div>
            )
          case 'team':
            // The place in the whole team's list, so a 6 is sixth for the team.
            // With an order a leader set, the mark says whether it was placed by
            // hand or follows True North, and True North's place sits under it.
            if (marks && r.teamRank != null) {
              return (
                <div key={c.key} className="px-3 py-2 min-w-0 overflow-hidden flex items-center gap-2">
                  <OrderMark placed={!!r.placedByHand} />
                  <span className="flex flex-col leading-none min-w-0">
                    <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{n(r.teamRank)}</span>
                    {r.tnRank != null && <span className="text-[10.5px] font-bold text-tn-teal mt-1 whitespace-nowrap" title="True North's place for this step">{`TN #${n(r.tnRank)}`}</span>}
                  </span>
                </div>
              )
            }
            return (
              <div key={c.key} className="px-3 py-2.5 min-w-0 overflow-hidden font-(family-name:--font-display) font-extrabold text-[15px] leading-[1.25] text-tn-ink">
                {r.teamRank != null ? n(r.teamRank) : faint}
              </div>
            )
          case 'item':
            return (
              <div key={c.key} className={`${CELL} font-semibold text-tn-ink`} title={r.itemName}>
                <span className="line-clamp-2">{r.itemName}</span>
              </div>
            )
          case 'language':
            return <div key={c.key} className={`${CELL} text-muted`}>{r.language ?? faint}</div>
          case 'parent':
            // Only a subitem has one, and the parent is the name a person
            // recognises: "Portuguese" means nothing without its page.
            return (
              <div key={c.key} className={`${CELL} text-muted`} title={r.parentItemName ?? undefined}>
                {r.parentItemName ? <span className="line-clamp-2">{r.parentItemName}</span> : faint}
              </div>
            )
          case 'board':
            return (
              <div key={c.key} className={`${CELL} text-muted`} title={r.boardName}>
                <span className="line-clamp-2">{r.boardName}</span>
              </div>
            )
          case 'workspace':
            return <div key={c.key} className={`${CELL} text-muted`}>{r.workspaceName ?? '-'}</div>
          case 'who':
            return <div key={c.key} className={`${CELL} text-foreground`}>{r.who}</div>
          case 'priority':
            return (
              <div key={c.key} className="px-3 py-2.5 min-w-0 overflow-hidden">
                <span className={`${chip} ${PRIORITY_CHIP[r.priority]}`}>{r.priority}</span>
              </div>
            )
          case 'step':
            return <div key={c.key} className={`${CELL} text-muted`}>{r.stepName}</div>
          case 'status':
            return (
              <div key={c.key} className="px-3 py-2.5 min-w-0 overflow-hidden">
                {r.statusText ? <StatusChip text={r.statusText} colour={r.statusColor} /> : <span className="text-[var(--faint)] text-[13px]">-</span>}
              </div>
            )
          case 'due':
            return (
              <div key={c.key} className={`${CELL} text-tn-ink text-right whitespace-nowrap`} title={r.dueLabel ?? undefined}>
                {d ? d.date : faint}
              </div>
            )
          case 'time':
            // The time and the badge in one cell. They were two columns, and
            // the badge's own column was most of the empty band between
            // Assignee and the end of the row.
            return (
              <div key={c.key} className="px-3 py-2.5 min-w-0 overflow-hidden flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[12px]">
                {d ? (
                  <>
                    {d.time && <span className={`whitespace-nowrap ${DUE_TIME[d.state]}`}>{d.time}</span>}
                    <span className={`${chip} ${DUE_BADGE[d.state].className}`}>{DUE_BADGE[d.state].label}</span>
                  </>
                ) : faint}
              </div>
            )
        }
      })}
    </>
  )
}

/** How the On-going block draws the bands of a team order (order-bands.ts). */
export interface BandsConfig {
  /** Who set the order: "Placed by hand by Jeannette Owens". */
  leader: string
  /** The team orders workspaces and boards: rows that were not placed follow that, not True North alone. */
  levels: boolean
  /** "Your list" on someone's own work, "This list" otherwise. */
  title: string
  /** Room the sticky column heading takes, so a jump lands below it. */
  offset: number | string
}

export function Block({
  title, note, rows, open, onToggle, onPick, columns, template, tone = 'default', marks = false, bands = null,
}: {
  title: string
  note?: string
  rows: Prepared[]
  open: boolean
  onToggle: () => void
  onPick: (r: WorkRow) => void
  columns: ColumnDef[]
  template: string
  tone?: 'default' | 'quiet'
  /** Pin or compass on every row, with True North's place. */
  marks?: boolean
  /** Cut the rows into bands where the order changes kind. Only in the team's own order. */
  bands?: BandsConfig | null
}) {
  const [all, setAll] = useState(false)
  const [closed, setClosed] = useState<Set<number>>(new Set())
  const sections = useRef<(HTMLElement | null)[]>([])
  const grouped = useMemo(() => (bands ? bandsOf(rows, p => !!p.row.placedByHand) : null), [rows, bands])
  const summaries: BandSummary[] = useMemo(() => (grouped ?? []).map(g => ({
    placed: g.placed,
    count: g.items.length,
    range: bandRange(g.items[0].row.teamRank ?? 0, g.items[g.items.length - 1].row.teamRank ?? 0),
  })), [grouped])

  const shown = all ? rows : rows.slice(0, FIRST_ROWS)
  const row = ({ row: r, due: d }: Prepared) => (
    <div
      key={r.id}
      className="grid border-b border-[var(--row-rule)] last:border-b-0 hover:bg-[var(--row-hover)] transition-colors"
      style={{ gridTemplateColumns: template }}
    >
      <RowCells r={r} d={d} columns={columns} onPick={onPick} marks={marks} />
    </div>
  )
  const toggle = (i: number) => setClosed(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    return next
  })
  const jump = (i: number) => {
    setAll(true)
    setClosed(prev => { const next = new Set(prev); next.delete(i); return next })
    requestAnimationFrame(() => sections.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  // Bands, and how many rows the first screen draws across them: FIRST_ROWS in
  // all, and a band past that point waits for "Show the other".
  // `waiting` is what "Show the other" still holds: rows past the first screen,
  // not the rows of a band someone collapsed.
  let waiting = 0
  const banded = (() => {
    if (!grouped || !bands) return null
    let left = all ? Number.POSITIVE_INFINITY : FIRST_ROWS
    const out: ReactNode[] = []
    grouped.forEach((g, i) => {
      if (left <= 0) { waiting += g.items.length; return }
      const first = g.items[0].row
      const label = g.placed
        ? `Placed by hand by ${bands.leader}`
        : bands.levels ? "Following the team's workspace and board order" : "Following True North's order"
      const reason = !g.placed && !bands.levels && first.teamRank != null && first.tnRank != null && first.placedAbove != null
        ? bandReason({ team: first.teamRank, tn: first.tnRank, placedAbove: first.placedAbove })
        : null
      const isOpen = !closed.has(i)
      const take = isOpen ? g.items.slice(0, left) : []
      left -= take.length
      if (isOpen) waiting += g.items.length - take.length
      out.push(
        <div key={i} ref={el => { sections.current[i] = el }} style={{ scrollMarginTop: bands.offset }}>
          <BandHeader index={i} band={summaries[i]} label={label} reason={reason} open={isOpen} onToggle={() => toggle(i)} />
          {take.map(row)}
        </div>,
      )
    })
    return out
  })()

  return (
    <section className={`rounded-[14px] border ${tone === 'quiet' ? 'border-[var(--warn-border)]' : 'border-[var(--panel-border)]'} bg-white overflow-hidden`}>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`w-full flex items-center gap-3 px-5 py-[13px] text-left transition-colors ${tone === 'quiet' ? 'bg-[rgba(242,196,10,.09)] hover:bg-[rgba(242,196,10,.16)]' : 'hover:bg-[var(--row-hover)]'}`}
      >
        <span className="shrink-0 text-muted text-[15px] leading-none" aria-hidden="true">{open ? '⌄' : '›'}</span>
        <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{title}</span>
        <span className="text-[12px] font-bold text-muted">{n(rows.length)}</span>
        {note && <span className="text-[12px] text-muted ml-auto text-right">{note}</span>}
      </button>

      {open && rows.length === 0 && (
        <div className="px-5 py-8 text-center text-[13.5px] text-muted border-t border-[var(--row-rule)]">Nothing here.</div>
      )}

      {open && rows.length > 0 && banded && bands && (
        <div className="border-t border-[var(--row-rule)]">
          {/* The map first: every band, in order, to scale, before any scrolling. */}
          <BandMap
            bands={summaries}
            title={bands.title}
            placedLabel={`placed by ${bands.leader === 'you' ? 'you' : bands.leader.split(' ')[0]}`}
            followLabel={bands.levels ? "follow the team's order" : 'follow True North'}
            onJump={jump}
            onCollapseAll={() => setClosed(new Set(summaries.map((_, i) => i)))}
            onExpandAll={() => setClosed(new Set())}
          />
          {banded}
          {!all && waiting > 0 && (
            <button
              onClick={() => setAll(true)}
              className="w-full px-5 py-[13px] text-[13.5px] font-semibold text-tn-teal hover:bg-subtle transition-colors border-t border-[var(--row-rule)]"
            >
              {`Show the other ${n(waiting)}`}
            </button>
          )}
          {summaries.length > 1 && (
            <NextBandPill
              sections={sections}
              bands={summaries}
              closed={closed}
              onJump={jump}
              followLabel={bands.levels ? "the team's workspace and board order" : "True North's order"}
            />
          )}
        </div>
      )}

      {open && rows.length > 0 && !banded && (
        <div className="border-t border-[var(--row-rule)]">
          {/* A grid, not a table, and no heading of its own: the one heading
              above every block uses the same template, so the columns line up. */}
          {shown.map(row)}

          {!all && rows.length > FIRST_ROWS && (
            <button
              onClick={() => setAll(true)}
              className="w-full px-5 py-[13px] text-[13.5px] font-semibold text-tn-teal hover:bg-subtle transition-colors border-t border-[var(--row-rule)]"
            >
              {`Show the other ${n(rows.length - FIRST_ROWS)}`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
