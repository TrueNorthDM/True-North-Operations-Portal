'use client'

/**
 * 3C, the day timeline (Time Entries.dc.html, frames 3C1 to 3C4): one day on
 * a time axis, 6 AM to 10 PM or the whole 24 hours, 64 pixels to the hour.
 * "My" is one lane; "All" is a lane per person, grouped by team, each drawn
 * in the viewer's time with the person's own hours on the label. Blocks are
 * coloured by client; the running entry has a live edge; overlaps are red.
 *
 * Leaders drag on empty space to add time and drag a block or its edges to
 * change it, snapping to 15 minutes; every drag ends in 3E so the reason can
 * be typed. A User clicks a block to open 3E (shorten only).
 */

import type { MouseEvent as ReactMouseEvent } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { wallToInstant } from '@/lib/timeclock/clock'
import { overlapsAmong } from '@/lib/timeclock/entry-rules'
import { dayLabel, timeLabel } from '@/lib/timeclock/format'
import { formatDuration } from '@/lib/timeclock/rounding'
import type { ClockChoice, EntryView } from '@/lib/timeclock/clocky-types'
import { overlapAmong } from './form'
import {
  axisOf, axisSeconds, createSpan, dragSpan, hourTicks, isWork, liveSeconds, nameFor, secondsAt, snapQuarter, xOf, zoneCity,
} from './model'
import { Icon, ICON } from './ui'

export interface Ghost { personId: string; s: number; e: number }
/** A block being dragged, in seconds from the viewer's midnight; `warn` once it was let go on an overlap (3C4). */
export interface Drag { key: string; s: number; e: number; orig: { s: number; e: number }; warn: boolean }

const LEGEND = [
  { label: 'True North', bg: '#2b4f86', border: '#2b4f86' },
  { label: 'i7 Marketing', bg: '#1E7D7F', border: '#1E7D7F' },
  { label: 'HFA', bg: '#F2C40A', border: '#d9a400' },
  { label: 'Other', bg: '#5b6b82', border: '#5b6b82' },
  { label: 'Overlap', bg: '#fdeeef', border: '#c8323d' },
]

function blockStyle(client: string, overlap: boolean) {
  if (overlap) return { bg: '#fdeeef', border: '#c8323d', fg: '#c8323d' }
  if (client === 'True North') return { bg: '#2b4f86', border: '#2b4f86', fg: '#ffffff' }
  if (client === 'i7 Marketing') return { bg: '#1E7D7F', border: '#1E7D7F', fg: '#ffffff' }
  if (client === 'HFA') return { bg: '#F2C40A', border: '#d9a400', fg: '#012358' }
  return { bg: '#5b6b82', border: '#5b6b82', fg: '#ffffff' }
}

export function DayTimeline({
  day, today, rows, all, viewer, teams, canAdd, canChange, combos, nowMs, full, setFull,
  ghost, setGhost, drag, setDrag, onOpen, onCreate, onMoved, onUndo, onFix,
}: {
  day: string
  today: string
  rows: readonly EntryView[]
  all: boolean
  viewer: { personId: string; name: string; zone: string }
  teams: readonly { id: string; name: string; color: string | null }[]
  /** Team Leader and up. */
  canAdd: boolean
  /** Whether the viewer may change this person's hours. */
  canChange: (personId: string) => boolean
  combos: readonly ClockChoice[]
  nowMs: number
  full: boolean
  setFull: (full: boolean) => void
  ghost: Ghost | null
  setGhost: (g: Ghost | null) => void
  drag: Drag | null
  setDrag: (d: Drag | null) => void
  onOpen: (r: EntryView) => void
  onCreate: (personId: string, start: string, end: string) => void
  onMoved: (r: EntryView, start: string, end: string) => void
  onUndo: () => void
  onFix: (r: EntryView, other: EntryView, start: string, end: string) => void
}) {
  const ax = axisOf(full)
  const midnight = wallToInstant(day, '00:00', viewer.zone) ?? `${day}T00:00:00Z`
  const iso = (s: number) => new Date(Date.parse(midnight) + s * 1000).toISOString()
  const nowIso = new Date(nowMs).toISOString()

  // The rows of the day, with a dragged block where it was dragged to.
  const dayRows = rows
    .filter(r => r.date === day && isWork(r) && r.start)
    .map(r => (drag && r.key === drag.key ? { ...r, start: iso(drag.s), end: iso(drag.e) } : r))
  const overlapping = overlapsAmong(dayRows.map(r => ({ id: r.key, personId: r.personId, start: r.start, end: r.end })), new Date(nowMs))

  const peopleOfDay = [...new Set(rows.filter(r => r.date === day && r.rowType !== 'time_off').map(r => r.personId))]
  const nameOf = (id: string) => rows.find(r => r.personId === id)?.personName ?? (id === viewer.personId ? viewer.name : '')
  type Lane = { head: true; key: string; name: string; color: string } | { head: false; key: string; personId: string }
  const lanes: Lane[] = []
  if (all) {
    const teamOf = (id: string) => rows.find(r => r.personId === id)?.team?.id ?? null
    for (const t of [...teams.map(t => t.id), null]) {
      const ps = peopleOfDay.filter(p => teamOf(p) === t).sort((a, b) => nameOf(a).localeCompare(nameOf(b)))
      if (!ps.length) continue
      const team = teams.find(x => x.id === t)
      lanes.push({ head: true, key: `t${t}`, name: team?.name ?? 'No team', color: team?.color ?? 'var(--faint)' })
      for (const p of ps) lanes.push({ head: false, key: p, personId: p })
    }
  } else {
    lanes.push({ head: false, key: viewer.personId, personId: viewer.personId })
  }
  const laneH = all ? 52 : 76

  const laneRows = (p: string) => dayRows.filter(r => r.personId === p).sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))
  const editable = (p: string) => canAdd && canChange(p) && !rows.some(r => r.personId === p && r.date === day && r.locked)

  const startCreate = (e: ReactMouseEvent<HTMLDivElement>, personId: string) => {
    if (e.button !== 0 || !editable(personId)) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    const toSec = (cx: number) => snapQuarter(secondsAt(cx - rect.left, ax.from))
    const t0 = toSec(e.clientX)
    const x0 = e.clientX
    let moved = false
    let g: Ghost = { personId, ...createSpan(t0, t0) }
    setGhost(g)
    const mm = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - x0) > 3) moved = true
      if (!moved) return
      g = { personId, ...createSpan(t0, toSec(ev.clientX)) }
      setGhost(g)
    }
    const mu = () => {
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', mu)
      setGhost(null)
      onCreate(personId, iso(g.s), iso(g.e))
    }
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
  }

  const startMove = (e: ReactMouseEvent<HTMLDivElement>, r: EntryView, orig: { s: number; e: number }) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const block = e.currentTarget.getBoundingClientRect()
    const ox = e.clientX - block.left
    const mode = ox < 7 ? 'l' : ox > block.width - 7 ? 'r' : 'move'
    const rect = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const toSec = (cx: number) => snapQuarter(secondsAt(cx - rect.left, ax.from))
    const t0 = toSec(e.clientX)
    const x0 = e.clientX
    let moved = false
    let span = orig
    const mm = (ev: MouseEvent) => {
      if (Math.abs(ev.clientX - x0) > 3) moved = true
      if (!moved) return
      span = dragSpan(mode, orig, toSec(ev.clientX) - t0)
      setDrag({ key: r.key, ...span, orig, warn: false })
    }
    const mu = () => {
      window.removeEventListener('mousemove', mm)
      window.removeEventListener('mouseup', mu)
      if (!moved) { setDrag(null); onOpen(r); return }
      const hit = overlapAmong({ start: iso(span.s), end: iso(span.e) }, r.personId, rows, r.key, nowMs)
      if (hit) { setDrag({ key: r.key, ...span, orig, warn: true }); return }
      setDrag(null)
      onMoved(r, iso(span.s), iso(span.e))
    }
    window.addEventListener('mousemove', mm)
    window.addEventListener('mouseup', mu)
  }

  // 3C4: the block let go on another entry.
  const moved = drag?.warn ? dayRows.find(r => r.key === drag.key) : undefined
  const other = moved ? overlapping.get(moved.key) : undefined
  const otherRow = other ? dayRows.find(r => r.key === other.id) : undefined
  let warnText = ''
  if (moved && otherRow) {
    const shared = Math.min(Date.parse(moved.end!), Date.parse(otherRow.end ?? nowIso)) - Math.max(Date.parse(moved.start!), Date.parse(otherRow.start!))
    warnText = `${nameFor(moved, combos)} now overlaps ${nameFor(otherRow, combos)} by ${formatDuration(shared / 1000)}. Overlaps are not saved.`
  }

  const nowSec = axisSeconds(nowIso, midnight)
  const showNow = day === today && nowSec > ax.from && nowSec < ax.to
  const durationOnly = rows.filter(r => r.personId === viewer.personId && r.date === day && isWork(r) && !r.start)
  const help = (!canAdd
    ? 'Click a block to edit it: you can shorten it or fix its details, with a reason. To add time, ask your Team Leader. '
    : (all ? "Each lane is drawn in your time; the label shows the person's own hours. " : '') + 'Drag on empty space to add time, drag a block or its edges to change it, or click it. Every change asks for a reason. ')
    + (durationOnly.length ? `Logged as duration only, not on the timeline: ${durationOnly.map(r => `${nameFor(r, combos)} ${formatDuration(liveSeconds(r, nowMs))}`).join(', ')}.` : '')

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{dayLabel(day)}{all ? ` · everyone, drawn in your time (${zoneCity(viewer.zone)})` : ''}</span>
        <Segmented label="Hours shown" options={[{ key: 'day', label: '6 AM to 10 PM' }, { key: 'full', label: '24 h' }]} value={full ? 'full' : 'day'} onChange={k => setFull(k === 'full')} />
        <span className="flex-1" />
        {LEGEND.map(l => (
          <span key={l.label} className="flex items-center gap-1.5 text-[12px] text-foreground whitespace-nowrap">
            <span className="w-3.5 h-2.5 rounded-[3px] border" style={{ background: l.bg, borderColor: l.border }} />{l.label}
          </span>
        ))}
      </div>

      {moved && otherRow && (
        <div role="alert" className="flex gap-2.5 items-center flex-wrap rounded-[11px] bg-[#fdeeef] border border-[#f3c6ca] px-3 py-2.5 text-[13px] text-[#c8323d] font-bold">
          <Icon d={ICON.warn} size={17} />
          <span className="flex-1 min-w-[200px]">{warnText}</span>
          <button type="button" onClick={onUndo} className="border border-slate-200 rounded-[9px] px-3 py-[7px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] hover:border-tn-teal">Undo</button>
          <button type="button" onClick={() => onFix(moved, otherRow, moved.start!, moved.end!)} className="border-0 rounded-[9px] px-[13px] py-2 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[12.5px] hover:bg-[#0a2f6b]">Fix overlap</button>
        </div>
      )}

      <div className="flex bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
        <div className="w-[191px] flex-none border-r border-[var(--row-rule)]">
          <div className="h-[34px] border-b border-[var(--row-rule)] bg-subtle" />
          {lanes.map(l => {
            if (l.head) {
              return (
                <div key={l.key} className="h-[30px] flex items-center gap-[7px] px-3 bg-[var(--row-hover)] border-b border-[var(--row-rule)]">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="font-(family-name:--font-display) font-extrabold text-[12px] text-tn-ink">{l.name}</span>
                </div>
              )
            }
            const lr = laneRows(l.personId)
            const last = lr[lr.length - 1]
            const hours = lr.length
              ? `${timeLabel(lr[0].start!, lr[0].zone)} to ${last.running ? 'now' : timeLabel(last.end!, last.zone)}${lr[0].zoneAbbr ? ` ${lr[0].zoneAbbr}` : ''}`
              : 'No time'
            return (
              <div key={l.key} style={{ height: laneH }} className="flex flex-col justify-center gap-0.5 px-3 border-b border-[var(--row-rule)]">
                <span className="font-(family-name:--font-display) font-bold text-[13px] text-tn-ink truncate">{nameOf(l.personId)}</span>
                <span className="text-[11px] text-muted tabular-nums">{hours}</span>
              </div>
            )
          })}
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto">
          <div className="relative select-none" style={{ width: xOf(ax.to, ax.from) }}>
            <div className="h-[34px] relative border-b border-[var(--row-rule)] bg-subtle">
              {hourTicks(ax).map(t => (
                <span key={t.x} style={{ left: t.x }} className="absolute top-0 bottom-0 border-l border-[var(--panel-border)] pt-[9px] pl-[5px] text-[11px] font-semibold text-muted whitespace-nowrap tabular-nums">{t.label}</span>
              ))}
            </div>
            {lanes.map(l => {
              if (l.head) return <div key={l.key} className="h-[30px] bg-[var(--row-hover)] border-b border-[var(--row-rule)]" />
              const can = editable(l.personId)
              const g = ghost && ghost.personId === l.personId ? ghost : null
              const zone = laneRows(l.personId)[0]?.zone ?? viewer.zone
              return (
                <div key={l.key} onMouseDown={e => startCreate(e, l.personId)}
                  className="relative border-b border-[var(--row-rule)]"
                  style={{ height: laneH, cursor: can ? 'crosshair' : 'default', backgroundImage: 'repeating-linear-gradient(90deg,transparent 0 63px,#f1f3f6 63px 64px)' }}>
                  {laneRows(l.personId).map(r => {
                    const sv = axisSeconds(r.start!, midnight)
                    const ev = axisSeconds(r.end ?? nowIso, midnight)
                    if (ev <= ax.from || sv >= ax.to) return null
                    const L = Math.max(ax.from, sv)
                    const R = Math.min(ax.to, ev)
                    const ov = overlapping.has(r.key)
                    const st = blockStyle(r.client, ov)
                    const movable = can && !r.running && !r.locked && r.canEdit && !r.shortenOnly
                    const sub = `${timeLabel(r.start!, r.zone)} to ${r.running ? 'now' : timeLabel(r.end!, r.zone)}`
                    return (
                      <div key={r.key}
                        onMouseDown={e => { if (movable) startMove(e, r, { s: sv, e: ev }); else { e.stopPropagation(); onOpen(r) } }}
                        onMouseMove={e => { if (!movable) return; const b = e.currentTarget.getBoundingClientRect(); const ox = e.clientX - b.left; e.currentTarget.style.cursor = ox < 7 || ox > b.width - 7 ? 'ew-resize' : 'grab' }}
                        title={`${r.path} · ${r.activity || 'Activity missing'} · ${sub}${ov ? ' · overlaps another entry' : ''}`}
                        className="absolute top-[9px] bottom-[9px] rounded-[8px] border overflow-hidden flex flex-col justify-center px-2 box-border"
                        style={{
                          left: xOf(L, ax.from), width: Math.max(6, xOf(R, ax.from) - xOf(L, ax.from) - 2),
                          background: st.bg, borderColor: st.border, color: st.fg, cursor: movable ? 'grab' : 'pointer',
                          boxShadow: ov ? '0 0 0 2px rgba(200,50,61,.25)' : 'none',
                        }}>
                        <span className="font-(family-name:--font-display) font-extrabold text-[11.5px] whitespace-nowrap overflow-hidden text-ellipsis">{nameFor(r, combos)}</span>
                        <span className="text-[10.5px] whitespace-nowrap overflow-hidden text-ellipsis opacity-90 tabular-nums">{sub}</span>
                        {r.running && <span className="absolute right-0 top-0 bottom-0 w-1 bg-tn-green" />}
                      </div>
                    )
                  })}
                  {g && (
                    <div className="absolute top-[7px] bottom-[7px] rounded-[8px] border-2 border-dashed border-tn-teal bg-[rgba(30,125,127,.12)] flex flex-col justify-center px-2 box-border pointer-events-none"
                      style={{ left: xOf(g.s, ax.from), width: Math.max(8, xOf(g.e, ax.from) - xOf(g.s, ax.from)) }}>
                      <span className="font-(family-name:--font-display) font-extrabold text-[11.5px] text-tn-teal whitespace-nowrap tabular-nums">{timeLabel(iso(g.s), zone)} to {timeLabel(iso(g.e), zone)} · {formatDuration(g.e - g.s)}</span>
                      <span className="text-[10.5px] text-tn-teal whitespace-nowrap">Release to add time</span>
                    </div>
                  )}
                </div>
              )
            })}
            {showNow && (
              <div className="absolute top-0 bottom-0 w-0.5 bg-[#c8323d] pointer-events-none z-[4]" style={{ left: xOf(nowSec, ax.from) }}>
                <span className="absolute top-1.5 left-1 text-[10.5px] font-bold text-[#ffffff] bg-[#c8323d] rounded-[5px] px-[5px] py-0.5 whitespace-nowrap tabular-nums">{timeLabel(nowIso, viewer.zone)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="text-[12px] text-muted leading-normal">{help}</div>
    </>
  )
}
