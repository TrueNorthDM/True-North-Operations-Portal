'use client'

/**
 * The Workspace and Board levels of the team priority editor: whole workspaces
 * in the team's order, then the boards inside each. Split out of
 * TeamPriorityEditor.tsx (audit, 10 October 2026), behaviour unchanged; the
 * editor keeps the order and passes the moves in.
 *
 * The tables have fixed columns, so on a narrow screen they scroll sideways in
 * their own box rather than squeezing the names to nothing.
 */

import { chip, PRIORITY_CHIP } from './tokens'
import { n } from './shared'

export const HEAD = 'px-3 py-[11px] min-w-0 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted whitespace-nowrap'
export const ARROW = 'w-6 h-[18px] inline-flex items-center justify-center rounded-[5px] text-[10px] text-muted hover:bg-subtle hover:text-tn-ink disabled:opacity-30 disabled:hover:bg-transparent'

/** The Workspace and Board levels share one set of columns. */
const LEVEL_COLS = '52px 72px minmax(0,1fr) 110px 110px 90px 120px'
const MIN_WIDTH = 'min-w-[640px]'

export interface BoardInfo { name: string; ws: string; priority: 'high' | 'medium' | 'low'; open: number; late: number }
export interface LevelTotals { boards: number; open: number; late: number }

/** How far a workspace or board sits from True North's place for it. Nothing when it has not moved. */
function LevelDelta({ by }: { by: number }) {
  if (!by) return <span className="text-[var(--faint)] text-[13px]">-</span>
  return by > 0
    ? <span className={`${chip} bg-[rgba(30,125,127,.12)] text-tn-teal`}>{`up ${by}`}</span>
    : <span className={`${chip} bg-[rgba(224,138,30,.16)] text-[#b06d0a]`}>{`down ${-by}`}</span>
}

function Late({ count }: { count: number }) {
  return (
    <div className="px-3 text-[13px] font-semibold text-[#c2410c]">
      {count ? n(count) : <span className="text-[var(--faint)] font-normal">0</span>}
    </div>
  )
}

/** Whole workspaces, in the team's order. */
export function WorkspaceLevel({ workspaces, trueNorth, totals, onMove }: {
  /** The team's workspace order. */
  workspaces: string[]
  /** True North's order for the same workspaces. */
  trueNorth: string[]
  totals: (ws: string) => LevelTotals
  onMove: (i: number, dir: -1 | 1) => void
}) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-[var(--panel-border)] bg-white">
      <div className={MIN_WIDTH}>
        <div className="grid bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]" style={{ gridTemplateColumns: LEVEL_COLS }}>
          <div className={HEAD}><span className="sr-only">Move</span></div>
          <div className={HEAD}>Team #</div>
          <div className={HEAD}>Workspace</div>
          <div className={HEAD}>Boards</div>
          <div className={HEAD}>Open steps</div>
          <div className={HEAD}>Late</div>
          <div className={HEAD}>vs True North</div>
        </div>
        {workspaces.map((ws, i) => {
          const t = totals(ws)
          return (
            <div key={ws} className="grid items-center border-b border-[var(--row-rule)] last:border-b-0 hover:bg-[var(--row-hover)]" style={{ gridTemplateColumns: LEVEL_COLS }}>
              <div className="pl-3 py-1.5">
                <span className="inline-flex flex-col">
                  <button type="button" onClick={() => onMove(i, -1)} disabled={i === 0} aria-label={`Move ${ws} up`} className={ARROW}>▲</button>
                  <button type="button" onClick={() => onMove(i, 1)} disabled={i === workspaces.length - 1} aria-label={`Move ${ws} down`} className={ARROW}>▼</button>
                </span>
              </div>
              <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</div>
              <div className="px-3 py-3 text-[13.5px] font-semibold text-tn-ink">{ws}</div>
              <div className="px-3 text-[13px] text-muted">{n(t.boards)}</div>
              <div className="px-3 text-[13px] text-foreground">{n(t.open)}</div>
              <Late count={t.late} />
              <div className="px-3"><LevelDelta by={trueNorth.indexOf(ws) - i} /></div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** The boards inside each workspace, in the team's order. */
export function BoardLevel({ workspaces, boardsIn, boards, trueNorthBoards, info, totals, onMove }: {
  workspaces: string[]
  /** The boards of one workspace, in the order given. */
  boardsIn: (ws: string, order: number[]) => number[]
  /** The team's board order. */
  boards: number[]
  /** True North's board order. */
  trueNorthBoards: number[]
  info: Map<number, BoardInfo>
  totals: (ws: string) => LevelTotals
  onMove: (ws: string, i: number, dir: -1 | 1) => void
}) {
  return (
    <div className="overflow-x-auto">
      <div className={`space-y-3 ${MIN_WIDTH}`}>
        <div className="grid" style={{ gridTemplateColumns: LEVEL_COLS }}>
          <div className={HEAD}><span className="sr-only">Move</span></div>
          <div className={HEAD}>Team #</div>
          <div className={HEAD}>Board</div>
          <div className={HEAD}>Priority</div>
          <div className={HEAD}>Open steps</div>
          <div className={HEAD}>Late</div>
          <div className={HEAD}>vs True North</div>
        </div>
        {workspaces.map((ws, wi) => {
          const group = boardsIn(ws, boards)
          const tnGroup = boardsIn(ws, trueNorthBoards)
          const open = totals(ws).open
          return (
            <div key={ws} className="rounded-[14px] border border-[var(--panel-border)] bg-white">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]">
                <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">{`${wi + 1}. ${ws}`}</span>
                <span className="text-[12px] text-muted">{`${n(open)} open ${open === 1 ? 'step' : 'steps'}`}</span>
              </div>
              {group.map((b, i) => {
                const board = info.get(b)!
                return (
                  <div key={b} className="grid items-center border-b border-[var(--row-rule)] last:border-b-0 hover:bg-[var(--row-hover)]" style={{ gridTemplateColumns: LEVEL_COLS }}>
                    <div className="pl-3 py-1.5">
                      <span className="inline-flex flex-col">
                        <button type="button" onClick={() => onMove(ws, i, -1)} disabled={i === 0} aria-label={`Move ${board.name} up`} className={ARROW}>▲</button>
                        <button type="button" onClick={() => onMove(ws, i, 1)} disabled={i === group.length - 1} aria-label={`Move ${board.name} down`} className={ARROW}>▼</button>
                      </span>
                    </div>
                    <div className="px-3 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{`${wi + 1}.${i + 1}`}</div>
                    <div className="px-3 py-2.5 text-[13px] font-semibold text-tn-ink">{board.name}</div>
                    <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[board.priority]}`}>{board.priority}</span></div>
                    <div className="px-3 text-[13px] text-foreground">{n(board.open)}</div>
                    <Late count={board.late} />
                    <div className="px-3"><LevelDelta by={tnGroup.indexOf(b) - i} /></div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
