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
 * list is rebuilt from; items placed by hand keep their places above them.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { SearchField } from '@/components/ui/SearchField'
import { chip, PRIORITY_CHIP } from './tokens'
import {
  teamRanking, pinsFor, moveTo, agreement, displacement, updatedWhen, levelOrder, workspaceRanking, boardRanking,
  trueNorthWorkspaces, hasLevels, workspaceOf, type Levels, type SavedOrder,
} from '@/lib/monday/worklist/team-priority'
import { todayIso } from '@/lib/monday/worklist/list-view'
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
const HEAD = 'px-3 py-[11px] min-w-0 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted whitespace-nowrap'
/** The Workspace and Board levels share one set of columns. */
const LEVEL_COLS = '52px 72px minmax(0,1fr) 110px 110px 90px 120px'
const n = (v: number) => v.toLocaleString('en-US')

// True in the browser, false while rendering on the server, without an effect.
const noSubscribe = () => () => {}
function useIsClient() {
  return useSyncExternalStore(noSubscribe, () => true, () => false)
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

function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

type SaveState = { state: 'idle' | 'waiting' | 'saving' | 'saved' | 'error'; error?: string }
type Level = 'workspace' | 'board' | 'item'

/** How far a workspace or board sits from True North's place for it. Nothing when it has not moved. */
function LevelDelta({ by }: { by: number }) {
  if (!by) return <span className="text-[var(--faint)] text-[13px]">-</span>
  return by > 0
    ? <span className={`${chip} bg-[rgba(30,125,127,.12)] text-tn-teal`}>{`up ${by}`}</span>
    : <span className={`${chip} bg-[rgba(224,138,30,.16)] text-[#b06d0a]`}>{`down ${-by}`}</span>
}

function swap<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}

export function TeamPriorityEditor({
  team, teams, steps, saved, savedAt, savedBy, savedBySelf, preview = false, stickyTop = 65, levelsAvailable = false,
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
  /** Migration 087 is in: whole workspaces and boards can be ordered. */
  levelsAvailable?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isClient = useIsClient()

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
  const queued = useRef<SavedOrder | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sending = useRef(0)
  const inFlight = useRef(false)

  const send = async () => {
    const body = queued.current as (SavedOrder & { levels?: Levels | null }) | null
    if (!body) return
    queued.current = null
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const mine = ++sending.current
    inFlight.current = true
    setSave({ state: 'saving' })
    let res: SaveResult
    try {
      res = await saveTeamPriority(team.id, body.order, body.pinned, levelsAvailable ? body.levels ?? undefined : undefined)
    } catch {
      res = { ok: false, error: 'The connection dropped before it saved.' }
    }
    inFlight.current = false
    // A later change is already queued or on its way; it reports for both.
    if (mine !== sending.current || queued.current) return
    if (res.ok) {
      setSave({ state: 'saved' })
      setFresh(new Set())
    } else {
      queued.current = body
      setSave({ state: 'error', error: res.error })
    }
  }

  const queue = (order: string[], pins: string[], lv: Levels = levels) => {
    if (preview) { setSave({ state: 'saved' }); setFresh(new Set()); return }
    queued.current = { order, pinned: pins, levels: lv }
    setSave({ state: 'waiting' })
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { void send() }, 700)
  }

  // Leaving the page with a change still waiting asks first.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (queued.current || inFlight.current) e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  /**
   * Moving to another view sends a waiting change first, so nothing is lost on
   * the way out. If that save fails, the order stays queued and so does the
   * leader: leaving would throw away what they just arranged.
   */
  const go = async (href: string) => {
    if (queued.current && !preview) {
      await send()
      if (queued.current) return
    }
    startTransition(() => router.push(href))
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
  const today0 = todayIso()
  const wsRank = useMemo(() => workspaceRanking(steps, levels), [steps, levels])
  const tnWs = useMemo(() => trueNorthWorkspaces(steps), [steps])
  const boardRank = useMemo(() => boardRanking(steps, levels), [steps, levels])
  const tnBoardRank = useMemo(() => boardRanking(steps, null), [steps])
  const boardInfo = useMemo(() => {
    const m = new Map<number, { name: string; ws: string; priority: EditorStep['priority']; open: number; late: number }>()
    for (const st of steps) {
      const b = m.get(st.boardId) ?? { name: st.boardName, ws: workspaceOf(st), priority: st.priority, open: 0, late: 0 }
      b.open++
      if (st.dueDate && !st.dueSuspect && st.dueDate < today0) b.late++
      m.set(st.boardId, b)
    }
    return m
  }, [steps, today0])
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
  const today = todayIso()

  const status = (() => {
    if (save.state === 'waiting' || save.state === 'saving') return <span className="text-[12.5px] text-muted">Saving…</span>
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
          {`Set by ${savedBySelf ? 'you' : savedBy ?? 'a team leader'}${isClient ? ` · updated ${updatedWhen(savedAt)}` : ''}`}
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
      className="shrink-0 inline-flex items-center gap-2 rounded-full px-[17px] py-2 font-(family-name:--font-display) font-extrabold text-[12.5px] bg-tn-primary border border-tn-primary text-white shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-px disabled:opacity-50 disabled:translate-y-0"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
      <span className="text-[#ffffff]">{busy ? 'Saving…' : 'Save and close'}</span>
    </button>
  )

  const segment = 'font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] transition-colors'
  const arrow = 'w-6 h-[18px] inline-flex items-center justify-center rounded-[5px] text-[10px] text-muted hover:bg-subtle hover:text-tn-ink disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <div className={`space-y-3.5 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        {level === 'item'
          ? <SearchField value={q} onChange={setQ} placeholder="Search the team's steps…" className="flex-1 min-w-[220px]" />
          : <div className="flex-1" />}

        <div className="flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
          <button type="button" onClick={() => void go(`/my-work?tab=work&pteam=${team.id}`)} className={`${segment} text-muted hover:text-tn-ink`}>Mine</button>
          <button type="button" onClick={() => void go('/my-work?tab=work&person=')} className={`${segment} text-muted hover:text-tn-ink`}>Everyone</button>
          <span aria-current="page" className={`${segment} bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]`}>Team priority</span>
        </div>

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

      <div className="flex items-center gap-3 flex-wrap border-t border-[var(--panel-border)] pt-3">
        {status}
        <span className="text-[13px] text-muted ml-auto">
          {narrowed ? `${n(visible.length)} of ${n(list.length)} open steps shown` : `${n(list.length)} open steps on the ${team.name} team`}
        </span>
      </div>

      {levelsAvailable && (
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 flex items-center gap-4 flex-wrap">
          <div>
            <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">Order by</div>
            <div className="mt-1.5 inline-flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
              {([['workspace', 'Workspace', wsRank.length], ['board', 'Board', boardRank.length], ['item', 'Item', list.length]] as const).map(([k, label, count]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setLevel(k)}
                  aria-pressed={level === k}
                  className={`${segment} ${level === k ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]' : 'text-muted hover:text-tn-ink'}`}
                >
                  {label} <span className="text-[11px] font-bold text-muted ml-0.5">{n(count)}</span>
                </button>
              ))}
            </div>
          </div>
          <p className="flex-1 min-w-[300px] text-[12.5px] text-muted leading-relaxed m-0">
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
      )}

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
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-white">
          <div className="grid bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]" style={{ gridTemplateColumns: LEVEL_COLS }}>
            <div className={HEAD}><span className="sr-only">Move</span></div>
            <div className={HEAD}>Team #</div>
            <div className={HEAD}>Workspace</div>
            <div className={HEAD}>Boards</div>
            <div className={HEAD}>Open steps</div>
            <div className={HEAD}>Late</div>
            <div className={HEAD}>vs True North</div>
          </div>
          {wsRank.map((ws, i) => {
            const t = wsTotals(ws)
            return (
              <div key={ws} className="grid items-center border-b border-[var(--row-rule)] last:border-b-0 hover:bg-[var(--row-hover)]" style={{ gridTemplateColumns: LEVEL_COLS }}>
                <div className="pl-3 py-1.5">
                  <span className="inline-flex flex-col">
                    <button type="button" onClick={() => moveWorkspace(i, -1)} disabled={i === 0} aria-label={`Move ${ws} up`} className={arrow}>▲</button>
                    <button type="button" onClick={() => moveWorkspace(i, 1)} disabled={i === wsRank.length - 1} aria-label={`Move ${ws} down`} className={arrow}>▼</button>
                  </span>
                </div>
                <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{i + 1}</div>
                <div className="px-3 py-3 text-[13.5px] font-semibold text-tn-ink">{ws}</div>
                <div className="px-3 text-[13px] text-muted">{t.boards}</div>
                <div className="px-3 text-[13px] text-foreground">{n(t.open)}</div>
                <div className="px-3 text-[13px] font-semibold text-[#c2410c]">{t.late ? n(t.late) : <span className="text-[var(--faint)] font-normal">0</span>}</div>
                <div className="px-3"><LevelDelta by={tnWs.indexOf(ws) - i} /></div>
              </div>
            )
          })}
        </div>
      )}

      {level === 'board' && (
        <div className="space-y-3">
          <div className="grid" style={{ gridTemplateColumns: LEVEL_COLS }}>
            <div className={HEAD}><span className="sr-only">Move</span></div>
            <div className={HEAD}>Team #</div>
            <div className={HEAD}>Board</div>
            <div className={HEAD}>Priority</div>
            <div className={HEAD}>Open steps</div>
            <div className={HEAD}>Late</div>
            <div className={HEAD}>vs True North</div>
          </div>
          {wsRank.map((ws, wi) => {
            const group = boardsIn(ws, boardRank)
            const tnGroup = boardsIn(ws, tnBoardRank)
            return (
              <div key={ws} className="rounded-[14px] border border-[var(--panel-border)] bg-white">
                <div className="flex items-center gap-2.5 px-4 py-2.5 bg-subtle border-b border-[var(--panel-border)] rounded-t-[14px]">
                  <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">{`${wi + 1}. ${ws}`}</span>
                  <span className="text-[12px] text-muted">{`${n(wsTotals(ws).open)} open ${wsTotals(ws).open === 1 ? 'step' : 'steps'}`}</span>
                </div>
                {group.map((b, i) => {
                  const info = boardInfo.get(b)!
                  return (
                    <div key={b} className="grid items-center border-b border-[var(--row-rule)] last:border-b-0 hover:bg-[var(--row-hover)]" style={{ gridTemplateColumns: LEVEL_COLS }}>
                      <div className="pl-3 py-1.5">
                        <span className="inline-flex flex-col">
                          <button type="button" onClick={() => moveBoard(ws, i, -1)} disabled={i === 0} aria-label={`Move ${info.name} up`} className={arrow}>▲</button>
                          <button type="button" onClick={() => moveBoard(ws, i, 1)} disabled={i === group.length - 1} aria-label={`Move ${info.name} down`} className={arrow}>▼</button>
                        </span>
                      </div>
                      <div className="px-3 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{`${wi + 1}.${i + 1}`}</div>
                      <div className="px-3 py-2.5 text-[13px] font-semibold text-tn-ink">{info.name}</div>
                      <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[info.priority]}`}>{info.priority}</span></div>
                      <div className="px-3 text-[13px] text-foreground">{n(info.open)}</div>
                      <div className="px-3 text-[13px] font-semibold text-[#c2410c]">{info.late ? n(info.late) : <span className="text-[var(--faint)] font-normal">0</span>}</div>
                      <div className="px-3"><LevelDelta by={tnGroup.indexOf(b) - i} /></div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
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
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-white">
          {/* Pinned under the portal's top bar, like the column heading on My Work. */}
          <div
            className="grid sticky z-10 bg-subtle border-b border-[var(--panel-border)] border-l-[3px] border-l-transparent rounded-t-[14px]"
            style={{ top: stickyTop, gridTemplateColumns: COLS }}
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

          {shown.map((key, i) => {
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
                    <button type="button" onClick={() => nudge(key, -1)} disabled={i === 0} aria-label={`Move ${s.itemName} up`} className={arrow}>▲</button>
                    <button type="button" onClick={() => nudge(key, 1)} disabled={i === visible.length - 1} aria-label={`Move ${s.itemName} down`} className={arrow}>▼</button>
                  </span>
                </div>

                <div className="px-3 min-w-0">
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
                        <span className={late ? 'text-[#c2410c] font-semibold' : ''}>{`due ${shortDate(s.dueDate)}${late ? ', late' : ''}`}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="px-3 text-[13px] text-foreground truncate">{s.who}</div>
                <div className="px-3"><span className={`${chip} ${PRIORITY_CHIP[s.priority]}`}>{s.priority}</span></div>
                <div className="px-3 text-[13px] text-muted">{n(defaultPlace.get(key) ?? 0)}</div>
                <div className="px-3">
                  {isPinned ? <Delta by={by} /> : isFresh ? <span className="text-[11.5px] text-muted leading-tight block">{levelsOn ? 'follows your order' : 'follows True North'}</span> : <span className="text-[var(--faint)] text-[13px]">-</span>}
                </div>
              </div>
            )
          })}

          {!all && visible.length > FIRST_ROWS && (
            <button
              type="button"
              onClick={() => setAll(true)}
              className="w-full px-5 py-[13px] text-[13.5px] font-semibold text-tn-teal hover:bg-subtle transition-colors border-t border-[var(--row-rule)] rounded-b-[14px]"
            >
              {`Show the other ${n(visible.length - FIRST_ROWS)}`}
            </button>
          )}
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
