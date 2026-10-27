'use client'

/**
 * Team priority: where a team leader, or an admin, sets the order their team's
 * open steps are worked in. The rules are in team-priority.ts.
 *
 * Built from the design approved on 16 September 2026
 * (/design-check/team-priority): a card on top comparing the team's order with
 * the default one, then every open step of the team with its place, its
 * default place and how far it was moved. The arrows move a step one place,
 * the handle drags it, and the number can be typed over for a long way. It
 * saves as the leader works, a moment after the last change.
 *
 * A team has up to a thousand open steps, so the list can be searched and
 * narrowed to one person. Moving a step in a narrowed list moves it past the
 * step shown above or below it, and its place is always its place in the whole
 * team's list.
 *
 * Three levels since 18 September 2026 (team-priority.ts): whole workspaces,
 * then the boards inside each, then single items. The first two are rules the
 * list is rebuilt from; items placed by hand keep their places above them. The
 * Workspace and Board tables are PriorityLevels.tsx.
 *
 * Two leaders can have the same team open. Each save says which saved order it
 * changes, and one that finds the order changed by someone else since is
 * refused (my-work/actions.ts): the editor then says so, stops saving, and
 * offers a reload, rather than quietly writing over the other leader's work
 * (audit, 10 October 2026).
 */

import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from 'react'
import { withViewAs } from '@/components/ViewAsKeeper'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { SearchField } from '@/components/ui/SearchField'
import { Segmented } from '@/components/ui/Segmented'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { chip, PRIORITY_CHIP } from './tokens'
import { BandHeader, BandMap, NextBandPill, OrderMark, type BandSummary } from './OrderBands'
import { ARROW, BoardLevel, HEAD, WorkspaceLevel, type BoardInfo } from './PriorityLevels'
import { dateLabel, n, useIsClient, workToday, WORK_ZONE } from './shared'
import { bandRange, bandReason, bandsOf, placedAbove } from '@/lib/monday/worklist/order-bands'
import {
  teamRanking, pinsFor, moveTo, agreement, displacement, updatedWhen, levelOrder, workspaceRanking, boardRanking,
  trueNorthWorkspaces, hasLevels, workspaceOf, type Levels, type SavedOrder,
} from '@/lib/monday/worklist/team-priority'
import { saveTeamPriority, type SaveResult } from '@/app/(app)/my-work/actions'

/** One open step, as the editor shows it. */
export interface EditorStep {
  key: string
  itemName: string
  language: string | null
  parentItemName: string | null
  boardName: string
  boardId: number
  workspaceName: string | null
  stepName: string
  who: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
  dueSuspect: boolean
  url: string | null
}

const FIRST_ROWS = 200
const COLS = '72px 72px minmax(0,1fr) minmax(120px,170px) 124px 112px 112px'
/** A symbol for each level of Order by: a grid of workspaces, a board's columns, a list of items. */
const LEVEL_ICON: Record<Level, React.ReactNode> = {
  workspace: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  board: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
  item: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
}

/**
 * How far a step nobody placed sits from True North's place: pushed down by
 * steps placed above it, or lifted by steps moved below it. Grey text, not a
 * chip, so it never reads as a move somebody made.
 */
function Drift({ from, to, levels }: { from: number; to: number; levels: boolean }) {
  const d = to - from
  if (!d || !from || !to) return <span className="text-[var(--faint)] text-[13px]">-</span>
  const text = levels ? `${n(Math.abs(d))} ${d > 0 ? 'lower' : 'higher'}` : d > 0 ? `pushed down ${n(d)}` : `moved up ${n(-d)}`
  return <span className="text-[11.5px] text-muted leading-tight block">{text}</span>
}

function Delta({ by }: { by: number }) {
  if (by === 0) return <span className={`${chip} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>placed</span>
  return by > 0
    ? <span className={`${chip} bg-[rgba(30,125,127,.12)] text-tn-teal`}>{`up ${n(by)}`}</span>
    : <span className={`${chip} bg-[rgba(224,138,30,.16)] text-[#b06d0a]`}>{`down ${n(-by)}`}</span>
}

function GripIcon() {
  return (
    <svg width="12" height="18" viewBox="0 0 12 18" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="3" r="1.6" /><circle cx="9" cy="3" r="1.6" />
      <circle cx="3" cy="9" r="1.6" /><circle cx="9" cy="9" r="1.6" />
      <circle cx="3" cy="15" r="1.6" /><circle cx="9" cy="15" r="1.6" />
    </svg>
  )
}

type SaveState = { state: 'idle' | 'waiting' | 'saving' | 'saved' | 'error' | 'conflict'; error?: string }
type Level = 'workspace' | 'board' | 'item'

function swap<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function TeamPriorityEditor({
  team, teams, steps, saved, savedAt, savedBy, savedBySelf, preview = false, stickyTop,
  canSeeEveryone = true, today: givenToday,
}: {
  team: { id: string; name: string }
  /** Every team this person may set. */
  teams: { value: string; label: string }[]
  /** The team's open steps, in the default order. */
  steps: EditorStep[]
  saved: SavedOrder | null
  savedAt: string | null
  savedBy: string | null
  savedBySelf: boolean
  /** Design check only: nothing is saved. */
  preview?: boolean
  stickyTop?: number
  /** "See everyone's list" (mw-everyone). Off: no Everyone to go back to. */
  canSeeEveryone?: boolean
  /** Today in New York, YYYY-MM-DD, from the server. A design check leaves it out. */
  today?: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isClient = useIsClient()
  const [fallbackToday] = useState(() => workToday())
  const today = givenToday ?? fallbackToday

  // True North's order: the steps as they arrive. The team's own base order is
  // that, rebuilt by its workspace and board order when it has one.
  const defaultKeys = useMemo(() => steps.map(s => s.key), [steps])
  const byKey = useMemo(() => new Map(steps.map(s => [s.key, s])), [steps])
  const defaultPlace = useMemo(() => new Map(defaultKeys.map((k, i) => [k, i + 1])), [defaultKeys])
  const [initial] = useState(() => teamRanking(levelOrder(steps, saved?.levels ?? null).map(s => s.key), saved))

  const [wsSet, setWsSet] = useState<string[]>(() => saved?.levels?.workspaces ?? [])
  const [boardSet, setBoardSet] = useState<number[]>(() => saved?.levels?.boards ?? [])
  const levels = useMemo<Levels>(() => ({ workspaces: wsSet, boards: boardSet }), [wsSet, boardSet])
  const levelsOn = hasLevels(levels)
  const baseKeys = useMemo(() => levelOrder(steps, levels).map(s => s.key), [steps, levels])
  const [level, setLevel] = useState<Level>('item')

  const [list, setList] = useState<string[]>(initial.keys)
  const [pinned, setPinned] = useState<string[]>(() => [...initial.pinned])
  const [fresh, setFresh] = useState<Set<string>>(initial.fresh)
  const [save, setSave] = useState<SaveState>({ state: 'idle' })

  const [q, setQ] = useState('')
  const [person, setPerson] = useState('')
  const [all, setAll] = useState(false)
  const [typing, setTyping] = useState<{ key: string; value: string } | null>(null)
  const [dragKey, setDragKey] = useState<string | null>(null)
  const [dropAt, setDropAt] = useState<{ key: string; after: boolean } | null>(null)

  // ── Saving ────────────────────────────────────────────────────────────────
  // The latest arrangement waits here until the leader pauses, then goes. A
  // save that fails keeps it, so "Try again" sends what is on screen.
  //
  // One save at a time. Each carries the stamp of the order it changes
  // (`version`: the one the page loaded, then the one each save returns), so
  // two in flight at once would refuse each other. A change made while one is
  // on its way waits and goes the moment it lands.
  const queued = useRef<SavedOrder | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flight = useRef<Promise<void> | null>(null)
  const version = useRef<string | null>(savedAt)
  const conflicted = useRef(false)

  const call = async (body: SavedOrder & { levels: Levels }): Promise<SaveResult> => {
    try {
      return await saveTeamPriority(team.id, body.order, body.pinned, body.levels, version.current)
    } catch {
      return { ok: false, error: 'The connection dropped before it saved.' }
    }
  }

  const send = (): Promise<void> => {
    if (flight.current) return flight.current
    const run = (async () => {
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
      let sent = false
      while (queued.current && !conflicted.current) {
        const body = queued.current as SavedOrder & { levels: Levels }
        queued.current = null
        setSave({ state: 'saving' })
        const res = await call(body)
        if (res.ok) {
          if (res.savedAt) version.current = res.savedAt
          sent = true
          continue
        }
        if (res.conflict) {
          // Someone else saved this team's order since it was loaded. Nothing
          // more is sent: the screen no longer shows what is saved.
          conflicted.current = true
          queued.current = null
          if (timer.current) { clearTimeout(timer.current); timer.current = null }
          setSave({ state: 'conflict', error: res.error })
          return
        }
        // Kept for "Try again", unless a newer arrangement is already waiting.
        if (!queued.current) queued.current = body
        setSave({ state: 'error', error: res.error })
        return
      }
      if (sent) {
        setSave({ state: 'saved' })
        setFresh(new Set())
      }
    })()
    flight.current = run
    return run.finally(() => { flight.current = null })
  }

  const queue = (order: string[], pins: string[], lv: Levels = levels) => {
    if (preview) { setSave({ state: 'saved' }); setFresh(new Set()); return }
    if (conflicted.current) return
    queued.current = { order, pinned: pins, levels: lv }
    setSave({ state: 'waiting' })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void send() }, 700)
  }

  // Leaving the page with a change still waiting asks first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (queued.current || flight.current) e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  /**
   * Moving to another view sends a waiting change first, so nothing is lost on
   * the way out. If that save fails, the order stays queued and so does the
   * leader: leaving would throw away what they just arranged.
   */
  const go = async (href: string) => {
    if (!preview && (queued.current || flight.current)) {
      await send()
      if (queued.current) return
    }
    startTransition(() => router.push(withViewAs(href)))
  }

  // ── Moving ────────────────────────────────────────────────────────────────
  const apply = (next: string[], moved: string | null) => {
    if (next === list) return
    // Placed by hand means placed against the team's own base order: a step
    // where its workspace and board would put it anyway is not pinned.
    const pins = moved === null ? [] : pinsFor(next, baseKeys, { keep: pinned, moved })
    setList(next)
    setPinned(pins)
    queue(next, pins)
  }

  /**
   * A new workspace or board order. The list is rebuilt from it, and every step
   * placed by hand keeps the place it had: decided on 18 September 2026, what
   * was placed by hand stays above the levels.
   */
  const changeLevels = (nextWs: string[], nextBoards: number[]) => {
    const nextLevels = { workspaces: nextWs, boards: nextBoards }
    const nextBase = levelOrder(steps, nextLevels).map(s => s.key)
    const next = teamRanking(nextBase, { order: list, pinned }).keys
    setWsSet(nextWs)
    setBoardSet(nextBoards)
    setList(next)
    queue(next, pinned, nextLevels)
  }

  /** Everything back to True North's order: no levels, nothing placed by hand. */
  const resetAll = () => {
    setWsSet([])
    setBoardSet([])
    setList(defaultKeys)
    setPinned([])
    queue(defaultKeys, [], { workspaces: [], boards: [] })
  }

  const needle = q.trim().toLowerCase()
  const visible = useMemo(() => list.filter(k => {
    const s = byKey.get(k)
    if (!s) return false
    if (person && s.who !== person) return false
    if (!needle) return true
    return [s.itemName, s.language, s.parentItemName, s.boardName, s.stepName, s.who]
      .filter(Boolean).join(' ').toLowerCase().includes(needle)
  }), [list, byKey, person, needle])
  const narrowed = !!needle || !!person

  /** One place up or down, past the step shown next to it. */
  const nudge = (key: string, dir: -1 | 1) => {
    const i = visible.indexOf(key)
    const target = visible[i + dir]
    if (i === -1 || !target) return
    const without = list.filter(k => k !== key)
    apply(moveTo(list, key, without.indexOf(target) + (dir > 0 ? 1 : 0)), key)
  }

  const typePlace = () => {
    if (!typing) return
    const place = Number(typing.value)
    setTyping(null)
    if (!Number.isFinite(place) || place < 1) return
    apply(moveTo(list, typing.key, place - 1), typing.key)
  }

  const onDragStart = (e: DragEvent<HTMLElement>, key: string) => {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', key)
    const row = (e.currentTarget as HTMLElement).closest('[data-step-row]')
    if (row) e.dataTransfer.setDragImage(row, 28, 22)
    setDragKey(key)
  }
  const onDragOver = (e: DragEvent<HTMLElement>, key: string) => {
    if (!dragKey) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const box = e.currentTarget.getBoundingClientRect()
    const after = e.clientY > box.top + box.height / 2
    if (dropAt?.key !== key || dropAt.after !== after) setDropAt({ key, after })
  }
  const endDrag = () => { setDragKey(null); setDropAt(null) }
  const onDrop = (e: DragEvent<HTMLElement>, key: string) => {
    e.preventDefault()
    const moving = dragKey
    const at = dropAt
    endDrag()
    if (!moving || moving === key) return
    const without = list.filter(k => k !== moving)
    apply(moveTo(list, moving, without.indexOf(key) + (at?.key === key && at.after ? 1 : 0)), moving)
  }

  // ── The card ──────────────────────────────────────────────────────────────
  const score = agreement(list, defaultKeys)
  const moves = useMemo(() => displacement(list, defaultKeys), [list, defaultKeys])
  const pinnedSet = useMemo(() => new Set(pinned), [pinned])
  const placedMoves = pinned.map(k => ({ key: k, by: moves.get(k) ?? 0 }))
  const up = placedMoves.filter(d => d.by > 0).sort((a, b) => b.by - a.by).slice(0, 3)
  const down = placedMoves.filter(d => d.by < 0).sort((a, b) => a.by - b.by).slice(0, 3)
  const isDefault = pinned.length === 0 && !levelsOn && list.every((k, i) => k === defaultKeys[i])

  // ── The levels ──────────────────────────────────────────────────────────
  const wsRank = useMemo(() => workspaceRanking(steps, levels), [steps, levels])
  const tnWs = useMemo(() => trueNorthWorkspaces(steps), [steps])
  const boardRank = useMemo(() => boardRanking(steps, levels), [steps, levels])
  const tnBoardRank = useMemo(() => boardRanking(steps, null), [steps])
  const boardInfo = useMemo(() => {
    const m = new Map<number, BoardInfo>()
    for (const st of steps) {
      const b = m.get(st.boardId) ?? { name: st.boardName, ws: workspaceOf(st), priority: st.priority, open: 0, late: 0 }
      b.open++
      if (st.dueDate && !st.dueSuspect && st.dueDate < today) b.late++
      m.set(st.boardId, b)
    }
    return m
  }, [steps, today])
  const boardsIn = (ws: string, order: number[]) => order.filter(b => boardInfo.get(b)?.ws === ws)
  const wsTotals = (ws: string) => {
    const bs = boardsIn(ws, boardRank).map(b => boardInfo.get(b)!)
    return { boards: bs.length, open: bs.reduce((t, b) => t + b.open, 0), late: bs.reduce((t, b) => t + b.late, 0) }
  }
  const moveWorkspace = (i: number, dir: -1 | 1) => {
    const next = swap(wsRank, i, dir)
    if (next !== wsRank) changeLevels(next, boardSet)
  }
  const moveBoard = (ws: string, i: number, dir: -1 | 1) => {
    const group = boardsIn(ws, boardRank)
    const moved = swap(group, i, dir)
    if (moved === group) return
    let k = 0
    changeLevels(wsSet, boardRank.map(b => (boardInfo.get(b)?.ws === ws ? moved[k++] : b)))
  }

  const people = useMemo(() => {
    const counts = new Map<string, number>()
    for (const s of steps) counts.set(s.who, (counts.get(s.who) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([who, c]) => ({ value: who, label: `${who} (${n(c)})` }))
  }, [steps])

  const place = useMemo(() => new Map(list.map((k, i) => [k, i + 1])), [list])
  const shown = all ? visible : visible.slice(0, FIRST_ROWS)

  // Which order each step follows, in bands where that changes (order-bands.ts):
  // drawn once anything is placed by hand, since before that every step is
  // True North's and a single band would say nothing.
  const showOrigin = pinned.length > 0
  const shownIndex = useMemo(() => new Map(shown.map((k, i) => [k, i])), [shown])
  const above = useMemo(() => placedAbove({ keys: list, pinned: pinnedSet }), [list, pinnedSet])
  const itemBands = useMemo(() => bandsOf(visible, k => pinnedSet.has(k)), [visible, pinnedSet])
  const bandSummaries: BandSummary[] = useMemo(() => itemBands.map(b => ({
    placed: b.placed,
    count: b.items.length,
    range: bandRange(place.get(b.items[0]) ?? 0, place.get(b.items[b.items.length - 1]) ?? 0),
  })), [itemBands, place])
  const [closedBands, setClosedBands] = useState<Set<number>>(new Set())
  const bandEls = useRef<(HTMLElement | null)[]>([])
  const toggleBand = (i: number) => setClosedBands(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    return next
  })
  const jumpToBand = (i: number) => {
    setAll(true)
    setClosedBands(prev => { const next = new Set(prev); next.delete(i); return next })
    requestAnimationFrame(() => bandEls.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const status = (() => {
    if (save.state === 'waiting' || save.state === 'saving') return <span className="text-[12.5px] text-muted">Saving…</span>
    if (save.state === 'conflict') return <span className="text-[12.5px] text-[var(--warn-fg)]">Not saved</span>
    if (save.state === 'error') {
      return (
        <span className="inline-flex items-center gap-2 text-[12.5px] text-[var(--warn-fg)]">
          {`Not saved: ${save.error ?? 'something went wrong'}`}
          <button type="button" onClick={() => void send()} className="font-semibold underline hover:no-underline">Try again</button>
        </span>
      )
    }
    if (save.state === 'saved') {
      return (
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-muted">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="stroke-tn-teal"><polyline points="20 6 9 17 4 12" /></svg>
          {preview ? 'Saved (design check: not really)' : `Saved · the ${team.name} team sees this order`}
        </span>
      )
    }
    if ((initial.pinned.size > 0 || hasLevels(saved?.levels)) && savedAt) {
      return (
        <span className="text-[12.5px] text-muted">
          {`Set by ${savedBySelf ? 'you' : savedBy ?? 'a team leader'}${isClient ? ` · updated ${updatedWhen(savedAt, new Date(), WORK_ZONE)}` : ''}`}
        </span>
      )
    }
    return <span className="text-[12.5px] text-muted">No order set yet: the list follows True North&apos;s order</span>
  })()

  // The way out, said in words. The order saves as the leader works, but a page
  // with no button to leave read as one with nothing saved (18 September 2026):
  // this sends anything still waiting and goes back to the list, in this order.
  const busy = pending || save.state === 'waiting' || save.state === 'saving'
  const saveAndClose = (
    <button
      type="button"
      onClick={() => void go(`/my-work?tab=work&pteam=${team.id}`)}
      disabled={pending}
      className={`${BTN.navy} shrink-0 disabled:opacity-50 disabled:translate-y-0`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
      <span className="text-[#ffffff]">{busy ? 'Saving…' : save.state === 'conflict' ? 'Close' : 'Save and close'}</span>
    </button>
  )

  /** One step's row: the grip, the arrows, its place, what it is, and how far it sits from True North's place. */
  const stepRow = (key: string, i: number) => {
    const s = byKey.get(key)!
    const by = moves.get(key) ?? 0
    const isPinned = pinnedSet.has(key)
    const isFresh = fresh.has(key) && !isPinned
    const mark = isPinned
      ? by > 0 ? 'border-l-tn-teal' : by < 0 ? 'border-l-[#E08A1E]' : 'border-l-[var(--chip-neutral-fg)]'
      : isFresh ? 'border-l-tn-primary' : 'border-l-transparent'
    const drop = dropAt?.key === key ? (dropAt.after ? 'shadow-[inset_0_-2px_0_#1E7D7F]' : 'shadow-[inset_0_2px_0_#1E7D7F]') : ''
    const late = s.dueDate && !s.dueSuspect && s.dueDate < today
    return (
      <div
        key={key}
        data-step-row
        onDragOver={e => onDragOver(e, key)}
        onDrop={e => onDrop(e, key)}
        className={`grid items-center border-b border-[var(--row-rule)] last:border-b-0 last:rounded-b-[14px] border-l-[3px] ${mark} ${drop} ${dragKey === key ? 'opacity-40' : ''} hover:bg-[var(--row-hover)] transition-colors`}
        style={{ gridTemplateColumns: COLS }}
      >
        <div className="pl-2 pr-1 py-1.5 flex items-center gap-1">
          <span
            draggable
            onDragStart={e => onDragStart(e, key)}
            onDragEnd={endDrag}
            title="Drag to move"
            className="px-1 py-1.5 cursor-grab active:cursor-grabbing text-[var(--faint)] hover:text-tn-ink"
          >
            <GripIcon />
          </span>
          <span className="inline-flex flex-col">
            <button type="button" onClick={() => nudge(key, -1)} disabled={i === 0} aria-label={`Move ${s.itemName} up`} className={ARROW}>▲</button>
            <button type="button" onClick={() => nudge(key, 1)} disabled={i === visible.length - 1} aria-label={`Move ${s.itemName} down`} className={ARROW}>▼</button>
          </span>
        </div>

        <div className="px-3 min-w-0 flex items-center gap-2">
          {showOrigin && <OrderMark placed={isPinned} size={20} title={isPinned ? 'Placed by hand' : levelsOn ? "Follows the team's workspace and board order" : "Follows True North's order"} />}
          {typing?.key === key ? (
            <input
              autoFocus
              type="number"
              min={1}
              max={list.length}
              value={typing.value}
              onChange={e => setTyping({ key, value: e.target.value })}
              onKeyDown={e => {
                if (e.key === 'Enter') typePlace()
                if (e.key === 'Escape') setTyping(null)
              }}
              onBlur={typePlace}
              aria-label={`New place for ${s.itemName}`}
              className="w-full rounded-[7px] border border-tn-teal px-1.5 py-1 text-[13px] font-bold text-tn-ink outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setTyping({ key, value: String(place.get(key) ?? '') })}
              title="Type a place to move it there"
              aria-label={`Place ${n(place.get(key) ?? 0)}, type a new place for ${s.itemName}`}
              className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink rounded-[6px] px-1 -mx-1 hover:bg-subtle hover:text-tn-teal"
            >
              {n(place.get(key) ?? 0)}
            </button>
          )}
        </div>

        <div className="px-3 py-2.5 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {s.url ? (
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-tn-ink truncate hover:text-tn-teal hover:underline" title={s.itemName}>{s.itemName}</a>
            ) : (
              <span className="text-[13px] font-semibold text-tn-ink truncate" title={s.itemName}>{s.itemName}</span>
            )}
            {isFresh && <span className={`${chip} bg-[rgba(1,35,88,.08)] text-tn-ink shrink-0`}>new</span>}
          </div>
          <div className="text-[11.5px] text-muted truncate">
            {[levelsOn ? workspaceOf(s) : null, s.language, s.parentItemName, s.boardName, s.stepName].filter(Boolean).join(' · ')}
            {s.dueDate && (
              <>
                {' · '}
                <span className={late ? 'text-[#c2410c] font-semibold' : ''}>{`due ${dateLabel(s.dueDate)}${late ? ', late' : ''}`}</span>
              </>
            )}
          </div>
        </div>

        <div className="px-3 text-[13px] text-foreground truncate">{s.who}</div>
        <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[s.priority]}`}>{s.priority}</span></div>
        <div className={`px-3 text-[13px] ${showOrigin ? 'font-bold text-tn-teal' : 'text-muted'}`}>{n(defaultPlace.get(key) ?? 0)}</div>
        <div className="px-3">
          {isPinned ? <Delta by={by} /> : <Drift from={defaultPlace.get(key) ?? 0} to={place.get(key) ?? 0} levels={levelsOn} />}
        </div>
      </div>
    )
  }

  // The column heading pins under the portal's chrome, as the list's does on
  // My Work: --chrome-top already counts the staging strip (audit, 10 October 2026).
  const stickTo = stickyTop ?? 'var(--chrome-top)'
  const views = [
    { key: 'mine' as const, label: 'Mine' },
    ...(canSeeEveryone ? [{ key: 'all' as const, label: 'Everyone' }] : []),
    { key: 'priority' as const, label: 'Team priority' },
  ]

  return (
    <div className={`space-y-3.5 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        {level === 'item'
          ? <SearchField value={q} onChange={setQ} placeholder="Search the team's steps…" className="flex-1 min-w-[220px]" />
          : <div className="flex-1" />}

        {/* Which view: the list (Mine, or Everyone for those who may see it) or
            this editor. Choosing a list sends any waiting change first. */}
        <Segmented
          label="View"
          value="priority"
          options={views}
          onChange={k => {
            if (k === 'mine') void go(`/my-work?tab=work&pteam=${team.id}`)
            if (k === 'all') void go('/my-work?tab=work&person=')
          }}
        />

        <Select
          value={team.id}
          onChange={id => { if (id !== team.id) void go(`/my-work?tab=work&view=priority&pteam=${id}`) }}
          options={teams}
          ariaLabel="Team"
          searchable={teams.length > 8}
          className="gap-2 px-3 py-[9px] rounded-[10px] border border-tn-teal bg-white font-(family-name:--font-display) font-semibold text-[13px] text-tn-teal"
        />
        {level === 'item' && <Select
          value={person}
          onChange={setPerson}
          options={[{ value: '', label: 'Anyone on the team' }, ...people]}
          ariaLabel="Person"
          searchable
          className={`gap-2 px-3 py-[9px] rounded-[10px] border bg-white font-(family-name:--font-display) font-semibold text-[13px] ${person ? 'border-tn-teal text-tn-teal' : 'border-[var(--panel-border)] text-muted'}`}
        />}
        {saveAndClose}
      </div>

      {/* Someone else saved this team's order after this page loaded it. Said
          once, where it cannot be missed, with the one way forward. */}
      {save.state === 'conflict' && (
        <div role="alert" className="flex items-center gap-3 flex-wrap rounded-[10px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-4 py-3 text-[13.5px] leading-[1.55] text-[var(--warn-fg)]">
          <span className="flex-1 min-w-0">{save.error}</span>
          <button type="button" onClick={() => window.location.reload()} className={BTN.white}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" /></svg>
            Reload
          </button>
        </div>
      )}

      {/* Who set the order on the left; Order by on the right, under Save and
          close, since 18 September 2026. It was a small grey control in a card
          of its own and read as a filter, when it decides what the whole page
          below is ordering. */}
      <div className="flex items-start gap-4 flex-wrap border-t border-[var(--panel-border)] pt-3">
        <div className="flex flex-col gap-1 pt-1.5">
          {/* Read out as it changes, without taking focus: Saving, Saved, Not saved. */}
          <div role="status" aria-live="polite">{status}</div>
          <span className="text-[13px] text-muted">
            {narrowed ? `${n(visible.length)} of ${n(list.length)} open steps shown` : `${n(list.length)} open steps on the ${team.name} team`}
          </span>
        </div>

        <div className="ml-auto flex flex-col items-end gap-2 max-w-full">
          <div className="flex items-center justify-end gap-x-3 gap-y-1.5 flex-wrap max-w-full">
            <span aria-hidden="true" className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">Order by</span>
            <Segmented<Level>
              label="Order by"
              value={level}
              onChange={setLevel}
              options={([['workspace', 'Workspace', wsRank.length], ['board', 'Board', boardRank.length], ['item', 'Item', list.length]] as const).map(([k, label, count]) => ({
                key: k,
                label: `${label} · ${n(count)}`,
                glyph: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="hidden sm:block">{LEVEL_ICON[k]}</svg>,
              }))}
            />
          </div>
          <p className="text-[12.5px] text-muted leading-relaxed m-0 text-right">
            {level === 'workspace' && (wsSet.length
              ? 'Whole workspaces, in your order: everything in the first comes before anything in the second. Every board and item inside moves with its workspace.'
              : "Not set yet: workspaces follow True North's order. Moving one here starts your team's own order.")}
            {level === 'board' && (boardSet.length
              ? 'Boards in your order, inside their workspace. Every item on a board moves with it; inside a board, the soonest deadline comes first.'
              : "Not set yet: boards follow True North's order inside each workspace. Moving one here starts your team's own order.")}
            {level === 'item' && 'Single steps. A step you move here keeps its place above everything, even other workspaces.'}
          </p>
          {level === 'workspace' && wsSet.length > 0 && (
            <button type="button" onClick={() => changeLevels([], boardSet)} className="text-[12.5px] font-semibold text-tn-teal hover:underline">
              Reset workspaces to True North&apos;s order
            </button>
          )}
          {level === 'board' && boardSet.length > 0 && (
            <button type="button" onClick={() => changeLevels(wsSet, [])} className="text-[12.5px] font-semibold text-tn-teal hover:underline">
              Reset boards to True North&apos;s order
            </button>
          )}
        </div>
      </div>

      {/* The agreement card: the team's order against the default one, and the
          steps placed furthest from where the default order would put them. */}
      <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 grid gap-5 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">Agreement with True North&apos;s order</div>
          <div className="font-(family-name:--font-display) font-extrabold text-[30px] leading-none text-tn-ink mt-2">{`${score}%`}</div>
          <div className="h-1.5 rounded-full bg-subtle mt-2 overflow-hidden"><div className="h-full rounded-full bg-tn-teal" style={{ width: `${score}%` }} /></div>
          <div className="text-[12px] text-muted mt-2 leading-snug">
            {`${n(pinned.length)} of ${n(list.length)} ${list.length === 1 ? 'step' : 'steps'} placed by hand · the rest follow ${levelsOn ? "your workspace and board order, then True North's" : "True North's order"}`}
          </div>
          {!isDefault && (
            <button type="button" onClick={resetAll} className="text-[12.5px] font-semibold text-tn-teal hover:underline mt-1.5">
              Reset to True North&apos;s order
            </button>
          )}
        </div>
        {([['Moved up', up], ['Moved down', down]] as const).map(([title, moved]) => (
          <div key={title} className="min-w-0">
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">{title}</div>
            {moved.length === 0 && <div className="text-[12.5px] text-muted mt-2">Nothing</div>}
            {moved.map(d => (
              <div key={d.key} className="flex items-center gap-2 mt-2 min-w-0">
                <Delta by={d.by} />
                <span className="text-[12.5px] text-tn-ink truncate">{byKey.get(d.key)?.itemName}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {level === 'workspace' && (
        <WorkspaceLevel workspaces={wsRank} trueNorth={tnWs} totals={wsTotals} onMove={moveWorkspace} />
      )}

      {level === 'board' && (
        <BoardLevel
          workspaces={wsRank}
          boardsIn={boardsIn}
          boards={boardRank}
          trueNorthBoards={tnBoardRank}
          info={boardInfo}
          totals={wsTotals}
          onMove={moveBoard}
        />
      )}

      {level === 'item' && <>
      {/* What the numbers mean, once, where they are read. "Default" said
          nothing about whose order it was; it is True North's. */}
      <p className="text-[12.5px] text-muted leading-relaxed m-0">
        <strong className="font-semibold text-tn-ink">Team #</strong> is the order your team sees on My Work.{' '}
        <strong className="font-semibold text-tn-ink">True North #</strong> is True North&apos;s order: the board&apos;s priority, set by admins, then the soonest deadline.{' '}
        <strong className="font-semibold text-tn-ink">Change</strong> is how far you moved a step from it.
      </p>

      {list.length === 0 ? (
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-white px-5 py-10 text-center text-[13.5px] text-muted">
          {`Nobody on the ${team.name} team has an open step right now.`}
        </div>
      ) : (
        // Sideways scrolling only where the columns do not fit: a scrolling box
        // would hold the sticky heading inside it, so from md up, where the
        // table fits, there is none and the heading pins to the page.
        <div className="overflow-x-auto md:overflow-x-visible rounded-[14px] border border-[var(--panel-border)] bg-white">
          <div className="min-w-[760px] md:min-w-0">
          {showOrigin && (
            <BandMap
              bands={bandSummaries}
              title={narrowed ? 'The steps shown' : "The team's order"}
              placedLabel="placed by hand"
              followLabel={levelsOn ? "follow your workspace and board order" : 'follow True North'}
              onJump={jumpToBand}
              onCollapseAll={() => setClosedBands(new Set(bandSummaries.map((_, i) => i)))}
              onExpandAll={() => setClosedBands(new Set())}
            />
          )}
          {/* Pinned under the portal's top bar, like the column heading on My Work. */}
          <div
            className="grid sticky z-10 bg-subtle border-b border-[var(--panel-border)] border-l-[3px] border-l-transparent rounded-t-[14px]"
            style={{ top: stickTo, gridTemplateColumns: COLS }}
          >
            <div className={HEAD}><span className="sr-only">Move</span></div>
            <div className={HEAD}>Team #</div>
            <div className={HEAD}>Step</div>
            <div className={HEAD}>Person</div>
            <div className={HEAD}>Board priority</div>
            <div className={HEAD}>True North #</div>
            <div className={HEAD}>Change</div>
          </div>

          {visible.length === 0 && (
            <div className="px-5 py-8 text-center text-[13.5px] text-muted">No step matches.</div>
          )}

          {showOrigin ? itemBands.map((b, bi) => {
            const first = b.items[0]
            const reason = !b.placed && !levelsOn
              ? bandReason({ team: place.get(first) ?? 0, tn: defaultPlace.get(first) ?? 0, placedAbove: above.get(first) ?? 0 })
              : null
            const isOpen = !closedBands.has(bi)
            return (
              <div key={bi} ref={el => { bandEls.current[bi] = el }} style={{ scrollMarginTop: `calc(${typeof stickTo === 'number' ? `${stickTo}px` : stickTo} + 44px)` }}>
                <BandHeader
                  index={bi}
                  band={bandSummaries[bi]}
                  label={b.placed ? 'Placed by hand' : levelsOn ? "Your workspace and board order" : "True North's order"}
                  reason={reason}
                  open={isOpen}
                  onToggle={() => toggleBand(bi)}
                />
                {isOpen && b.items.filter(k => shownIndex.has(k)).map(k => stepRow(k, shownIndex.get(k)!))}
              </div>
            )
          }) : shown.map((key, i) => stepRow(key, i))}

          {!all && visible.length > FIRST_ROWS && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="w-full px-5 py-[13px] text-[13.5px] font-semibold text-tn-teal hover:bg-subtle transition-colors border-t border-[var(--row-rule)] rounded-b-[14px]"
            >
              {`Show the other ${n(visible.length - FIRST_ROWS)}`}
            </button>
          )}
          {showOrigin && bandSummaries.length > 1 && (
            <NextBandPill
              sections={bandEls}
              bands={bandSummaries}
              closed={closedBands}
              onJump={jumpToBand}
              followLabel={levelsOn ? 'your workspace and board order' : "True North's order"}
            />
          )}
          </div>
        </div>
      )}
      </>}

      <div className="flex items-start gap-5 flex-wrap">
        <p className="flex-1 min-w-[280px] text-[12px] text-muted leading-[1.65] m-0">
          {`A step you move keeps the place you gave it, and moves up as the work above it is finished. Every other step follows ${levelsOn ? "your workspace and board order, and inside a board True North's order (the soonest deadline first)" : "True North's order (board priority, then deadline)"}, so it keeps up with Monday. A step marked new arrived after the order was last saved, and sits where that order puts it. Finished steps leave the list on their own. Everyone on the ${team.name} team sees their own steps in this order on My Work.`}
        </p>
        {saveAndClose}
      </div>
    </div>
  )
}
