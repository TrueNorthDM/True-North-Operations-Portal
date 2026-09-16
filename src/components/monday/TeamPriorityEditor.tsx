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
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition, type DragEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { SearchField } from '@/components/ui/SearchField'
import { chip, PRIORITY_CHIP } from './tokens'
import {
  teamRanking, pinsFor, moveTo, agreement, displacement, updatedWhen, type SavedOrder,
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
  stepName: string
  who: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
  dueSuspect: boolean
  url: string | null
}

const FIRST_ROWS = 200
const COLS = '72px 64px minmax(0,1fr) minmax(120px,170px) 88px 72px 104px'
const HEAD = 'px-3 py-[11px] min-w-0 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted whitespace-nowrap'
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

export function TeamPriorityEditor({
  team, teams, steps, saved, savedAt, savedBy, savedBySelf, preview = false, stickyTop = 65,
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
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const isClient = useIsClient()

  const defaultKeys = useMemo(() => steps.map(s => s.key), [steps])
  const byKey = useMemo(() => new Map(steps.map(s => [s.key, s])), [steps])
  const defaultPlace = useMemo(() => new Map(defaultKeys.map((k, i) => [k, i + 1])), [defaultKeys])
  const [initial] = useState(() => teamRanking(defaultKeys, saved))

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
    const body = queued.current
    if (!body) return
    queued.current = null
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
    const mine = ++sending.current
    inFlight.current = true
    setSave({ state: 'saving' })
    let res: SaveResult
    try {
      res = await saveTeamPriority(team.id, body.order, body.pinned)
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

  const queue = (order: string[], pins: string[]) => {
    if (preview) { setSave({ state: 'saved' }); setFresh(new Set()); return }
    queued.current = { order, pinned: pins }
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

  /** Moving to another view sends a waiting change first, so nothing is lost on the way out. */
  const go = async (href: string) => {
    if (queued.current && !preview) await send()
    startTransition(() => router.push(href))
  }

  // ── Moving ────────────────────────────────────────────────────────────────
  const apply = (next: string[], moved: string | null) => {
    if (next === list) return
    const pins = moved === null ? [] : pinsFor(next, defaultKeys, { keep: pinned, moved })
    setList(next)
    setPinned(pins)
    queue(next, pins)
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
  const isDefault = pinned.length === 0 && list.every((k, i) => k === defaultKeys[i])

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
    if (initial.pinned.size > 0 && savedAt) {
      return (
        <span className="text-[12.5px] text-muted">
          {`Set by ${savedBySelf ? 'you' : savedBy ?? 'a team leader'}${isClient ? ` · updated ${updatedWhen(savedAt)}` : ''}`}
        </span>
      )
    }
    return <span className="text-[12.5px] text-muted">No order set yet: board priority, then deadline</span>
  })()

  const segment = 'font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] transition-colors'
  const arrow = 'w-6 h-[18px] inline-flex items-center justify-center rounded-[5px] text-[10px] text-muted hover:bg-subtle hover:text-tn-ink disabled:opacity-30 disabled:hover:bg-transparent'

  return (
    <div className={`space-y-3.5 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <SearchField value={q} onChange={setQ} placeholder="Search the team's steps…" className="flex-1 min-w-[220px]" />

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
        <Select
          value={person}
          onChange={setPerson}
          options={[{ value: '', label: 'Anyone on the team' }, ...people]}
          ariaLabel="Person"
          searchable
          className={`gap-2 px-3 py-[9px] rounded-[10px] border bg-white font-(family-name:--font-display) font-semibold text-[13px] ${person ? 'border-tn-teal text-tn-teal' : 'border-[var(--panel-border)] text-muted'}`}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap border-t border-[var(--panel-border)] pt-3">
        {status}
        <span className="text-[13px] text-muted ml-auto">
          {narrowed ? `${n(visible.length)} of ${n(list.length)} open steps shown` : `${n(list.length)} open steps on the ${team.name} team`}
        </span>
      </div>

      {/* The agreement card: the team's order against the default one, and the
          steps placed furthest from where the default order would put them. */}
      <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 grid gap-5 grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted">Agreement with the default order</div>
          <div className="font-(family-name:--font-display) font-extrabold text-[30px] leading-none text-tn-ink mt-2">{`${score}%`}</div>
          <div className="h-1.5 rounded-full bg-subtle mt-2 overflow-hidden"><div className="h-full rounded-full bg-tn-teal" style={{ width: `${score}%` }} /></div>
          <div className="text-[12px] text-muted mt-2 leading-snug">
            {`${n(pinned.length)} of ${n(list.length)} ${list.length === 1 ? 'step' : 'steps'} placed by hand · the rest follow board priority, then deadline`}
          </div>
          {!isDefault && (
            <button type="button" onClick={() => apply(defaultKeys, null)} className="text-[12.5px] font-semibold text-tn-teal hover:underline mt-1.5">
              Reset to the default order
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
            <div className={HEAD}>Team</div>
            <div className={HEAD}>Step</div>
            <div className={HEAD}>Person</div>
            <div className={HEAD}>Priority</div>
            <div className={HEAD}>Default</div>
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
                    {[s.language, s.parentItemName, s.boardName, s.stepName].filter(Boolean).join(' · ')}
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
                  {isPinned ? <Delta by={by} /> : isFresh ? <span className="text-[11.5px] text-muted leading-tight block">by default</span> : <span className="text-[var(--faint)] text-[13px]">-</span>}
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

      <p className="text-[12px] text-muted leading-[1.65] m-0">
        {`A step you move keeps the place you gave it, and moves up as the work above it is finished. Every other step follows board priority, then deadline, so it keeps up with Monday. A step marked new arrived after the order was last saved, and sits where the default order puts it. Finished steps leave the list on their own. Everyone on the ${team.name} team sees their own steps in this order on My Work.`}
      </p>
    </div>
  )
}
