'use client'

/**
 * Option 4 (marks and bands) with the two things asked for on 18 September
 * 2026, after choosing it:
 *
 *   - every band collapses and expands from its header;
 *   - the top of the table says how many stretches the list has, in order, so
 *     nobody has to scroll through 126 hand-placed steps to find out there is
 *     a True North stretch after them. The bar is to scale; a chip jumps to
 *     its band and opens it.
 *
 * And one more, for the long bands: while a band fills the screen, its header
 * stays at the top and the next band is announced at the bottom, one click
 * from being opened.
 *
 * The middle ground (asked for the same day, when five bands for Jeannette
 * read as too many): with `minBand`, a stretch shorter than that stays inside
 * the band around it instead of opening one of its own. Its rows keep their
 * pin or compass, the band header counts them, and the map marks them on the
 * bar as ticks.
 *
 * Jeannette's and Arnaldo's real lists (lists.ts). Design check only.
 */

import { useRef, useState } from 'react'
import { chip } from '@/components/monday/tokens'
import { Mark } from '../order-clarity/OrderClarity'
import type { OrderRow } from '../order-clarity/data'

const COLS = '64px 104px minmax(0,1fr) 190px 150px 150px 80px'
/** Narrow enough for two lists side by side: team, item, status. */
const COMPACT = '100px minmax(0,1fr) 150px'
const H = 'px-3 py-2.5 font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted'

interface Stretch { placed: boolean; rows: OrderRow[] }

function stretches(rows: OrderRow[]): Stretch[] {
  const out: Stretch[] = []
  for (const r of rows) {
    const last = out[out.length - 1]
    if (last && last.placed === r.placed) last.rows.push(r)
    else out.push({ placed: r.placed, rows: [r] })
  }
  return out
}

/**
 * The middle ground: a stretch shorter than `min` joins the band before it (the
 * first joins the one after), and bands of the same kind that end up touching
 * become one.
 */
function mergeSmall(runs: Stretch[], min: number): Stretch[] {
  if (!runs.some(r => r.rows.length >= min)) return runs
  const out: Stretch[] = []
  let before: OrderRow[] = []
  for (const r of runs) {
    const last = out[out.length - 1]
    if (r.rows.length >= min) {
      if (last && last.placed === r.placed) last.rows.push(...r.rows)
      else out.push({ placed: r.placed, rows: [...before, ...r.rows] })
      before = []
    } else if (last) last.rows.push(...r.rows)
    else before.push(...r.rows)
  }
  return out
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`
const range = (s: Stretch) => (s.rows.length === 1 ? `#${s.rows[0].team}` : `#${s.rows[0].team} to #${s.rows[s.rows.length - 1].team}`)

function Row({ r, compact }: { r: OrderRow; compact: boolean }) {
  const c = 'px-3 py-2.5 text-[13px] min-w-0'
  if (compact) {
    return (
      <div className={`grid items-center border-b border-[var(--row-rule)] ${r.placed ? 'bg-[rgba(1,35,88,.025)]' : 'bg-white'}`} style={{ gridTemplateColumns: COMPACT }}>
        <div className={`${c} flex items-center gap-2`}>
          <Mark placed={r.placed} />
          <span className="flex flex-col leading-none">
            <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.team}</span>
            <span className="text-[10.5px] font-bold text-tn-teal mt-1">{`TN #${r.tn}`}</span>
          </span>
        </div>
        <div className={`${c} text-tn-ink font-medium truncate`}>{r.item}</div>
        <div className={c}>{r.status && <span className={`${chip} text-white whitespace-nowrap`} style={{ background: r.colour }}>{r.status}</span>}</div>
      </div>
    )
  }
  return (
    <div className={`grid items-center border-b border-[var(--row-rule)] ${r.placed ? 'bg-[rgba(1,35,88,.025)]' : 'bg-white'}`} style={{ gridTemplateColumns: COLS }}>
      <div className="flex items-center gap-1.5 pl-3">
        <span className="w-6 h-6 rounded-full bg-[var(--chip-neutral-bg)]" />
        <span className="w-6 h-6 rounded-full bg-[var(--chip-neutral-bg)]" />
      </div>
      <div className={`${c} flex items-center gap-2`}>
        <Mark placed={r.placed} />
        <span className="flex flex-col leading-none">
          <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.team}</span>
          <span className="text-[10.5px] font-bold text-tn-teal mt-1">{`TN #${r.tn}`}</span>
        </span>
      </div>
      <div className={`${c} text-tn-ink font-medium truncate`}>{r.item}{r.language && <span className="text-muted font-normal">{` · ${r.language}`}</span>}</div>
      <div className={`${c} text-muted truncate`}>{r.board}</div>
      <div className={`${c} text-muted truncate`}>{r.step}</div>
      <div className={c}>{r.status && <span className={`${chip} text-white whitespace-nowrap`} style={{ background: r.colour }}>{r.status}</span>}</div>
      <div className={`${c} text-right text-tn-ink`}>{r.due ?? <span className="text-[var(--faint)]">-</span>}</div>
    </div>
  )
}

export function BandedList({
  rows, who, leader, startCollapsed = false, minBand = 0, compact = false, mapOnly = false, placedLabel,
}: {
  rows: OrderRow[]; who: string; leader: string; startCollapsed?: boolean
  /** The middle ground: stretches shorter than this stay inside their neighbour. 0 keeps every stretch. */
  minBand?: number
  compact?: boolean
  /** The editor's preview: the map alone. */
  mapOnly?: boolean
  placedLabel?: string
}) {
  const bands = minBand ? mergeSmall(stretches(rows), minBand) : stretches(rows)
  const [closed, setClosed] = useState<Set<number>>(() => new Set(startCollapsed ? bands.map((_, i) => i) : []))
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const placedCount = rows.filter(r => r.placed).length
  const followCount = rows.length - placedCount

  const toggle = (i: number) => setClosed(prev => {
    const next = new Set(prev)
    if (next.has(i)) next.delete(i)
    else next.add(i)
    return next
  })
  const jump = (i: number) => {
    setClosed(prev => { const next = new Set(prev); next.delete(i); return next })
    requestAnimationFrame(() => refs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const title = (b: Stretch, i: number) => b.placed
    ? <><b>{`Placed by hand by ${leader}`}</b><span className="text-muted">{` · ${plural(b.rows.length, 'step', 'steps')} · ${range(b)}`}</span>{inside(b)}</>
    : <><b>Following True North&apos;s order</b><span className="text-muted">{` · ${plural(b.rows.length, 'step', 'steps')} · ${range(b)}`}</span>{inside(b)}{i === 0 || b.rows[0].placedAbove > 0 ? <span className="text-muted">{`. ${plural(b.rows[0].placedAbove, 'step', 'steps')} placed by hand come before these, so True North's #${b.rows[0].tn} is the team's #${b.rows[0].team}.`}</span> : null}</>

  /** The middle ground: say how many rows of the other kind a band holds. */
  const inside = (b: Stretch) => {
    const n = b.rows.filter(r => r.placed !== b.placed).length
    if (!n) return null
    return <span className="text-tn-ink font-semibold">{b.placed ? ` · ${n} following True North inside` : ` · ${n} placed by hand inside, marked with the pin`}</span>
  }

  return (
    <div className="rounded-[14px] border border-[var(--panel-border)] bg-white">
      {/* The map of the list: how many stretches, in order, to scale. */}
      <div className="px-4 pt-3 pb-3.5 border-b border-[var(--panel-border)] rounded-t-[14px]">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">
            {`${mapOnly ? "The team's order" : 'Your list'}, in ${bands.length === 1 ? 'one band' : `${bands.length} bands`}`}
          </span>
          <span className="inline-flex items-center gap-3 text-[12.5px] text-tn-ink">
            {placedCount > 0 && <span className="inline-flex items-center gap-1.5"><Mark placed size={18} />{placedLabel ?? `${placedCount} placed by ${leader.split(' ')[0]}`}</span>}
            {followCount > 0 && <span className="inline-flex items-center gap-1.5"><Mark placed={false} size={18} />{`${followCount} follow True North`}</span>}
          </span>
          {bands.length > 1 && (
            <span className="ml-auto inline-flex items-center gap-3">
              <button type="button" onClick={() => setClosed(new Set(bands.map((_, i) => i)))} className="text-[12.5px] font-semibold text-tn-teal hover:underline">Collapse all</button>
              <button type="button" onClick={() => setClosed(new Set())} className="text-[12.5px] font-semibold text-tn-teal hover:underline">Expand all</button>
            </span>
          )}
        </div>
        <div className="flex h-2.5 gap-[3px] mt-2.5">
          {bands.map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jump(i)}
              aria-label={`Go to stretch ${i + 1}`}
              title={`${i + 1}. ${b.placed ? 'Placed by hand' : "True North's order"} · ${plural(b.rows.length, 'step', 'steps')}`}
              className={`relative rounded-full min-w-[6px] hover:opacity-80 ${b.placed ? 'bg-tn-primary' : 'bg-tn-teal'}`}
              style={{ flexGrow: b.rows.length }}
            >
              {/* Rows of the other kind held inside the band, as ticks. */}
              {b.rows.map((r, k) => r.placed !== b.placed && (
                <span key={k} className={`absolute top-[-2px] bottom-[-2px] w-[2px] rounded ${r.placed ? 'bg-[#F2C40A]' : 'bg-white'}`} style={{ left: `${(k / b.rows.length) * 100}%` }} />
              ))}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {bands.map((b, i) => (
            <button
              key={i}
              type="button"
              onClick={() => jump(i)}
              className={`inline-flex items-center gap-2 rounded-full border pl-1 pr-3 py-1 text-[12px] transition-colors ${b.placed ? 'border-[rgba(1,35,88,.25)] hover:bg-[rgba(1,35,88,.05)]' : 'border-[rgba(30,125,127,.35)] hover:bg-[rgba(30,125,127,.07)]'}`}
            >
              <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted w-4 text-center">{i + 1}</span>
              <Mark placed={b.placed} size={18} />
              <span className="font-semibold text-tn-ink">{plural(b.rows.length, 'step', 'steps')}</span>
              <span className="text-muted">{range(b)}</span>
            </button>
          ))}
        </div>
      </div>

      {!mapOnly && (compact
        ? (
          <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: COMPACT }}>
            <div className={H}>Team</div>
            <div className={H}>Item</div>
            <div className={H}>Status</div>
          </div>
        )
        : (
          <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: COLS }}>
            <div />
            <div className={H}>Team</div>
            <div className={H}>Item</div>
            <div className={H}>Board</div>
            <div className={H}>Step</div>
            <div className={H}>Status</div>
            <div className={`${H} text-right`}>Due</div>
          </div>
        ))}

      {!mapOnly && bands.map((b, i) => {
        const open = !closed.has(i)
        const next = bands[i + 1]
        return (
          <div key={i} ref={el => { refs.current[i] = el }} className="scroll-mt-2">
            <button
              type="button"
              onClick={() => toggle(i)}
              aria-expanded={open}
              className={`sticky top-0 z-10 w-full flex items-center gap-2.5 px-4 py-2 border-b border-[var(--row-rule)] text-left border-l-[3px] ${b.placed ? 'bg-[#eef0f4] border-l-tn-primary' : 'bg-[#e9f2f2] border-l-tn-teal'}`}
            >
              <span className={`text-[11px] text-muted transition-transform ${open ? '' : '-rotate-90'}`} aria-hidden="true">▾</span>
              <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted">{i + 1}</span>
              <Mark placed={b.placed} size={22} />
              <span className="text-[12.5px] text-tn-ink leading-snug flex-1 min-w-0">{title(b, i)}</span>
              <span className="text-[12px] font-semibold text-tn-teal shrink-0">{open ? 'Collapse' : `Show ${plural(b.rows.length, 'step', 'steps')}`}</span>
            </button>
            {open && b.rows.map(r => <Row key={r.team} r={r} compact={compact} />)}
            {/* While a long band fills the screen, the next one is announced
                at the bottom of it, one click from being opened. */}
            {open && next && b.rows.length > 8 && (
              <div className="sticky bottom-3 z-10 flex justify-center py-2 pointer-events-none">
                <button
                  type="button"
                  onClick={() => jump(i + 1)}
                  className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-tn-primary pl-2 pr-4 py-1.5 shadow-[0_10px_24px_-10px_rgba(1,35,88,.7)] font-(family-name:--font-display) font-extrabold text-[12px]"
                >
                  <span className="text-[#F2C40A]" aria-hidden="true">↓</span>
                  <span className="text-[#ffffff]">{`Next: ${next.placed ? 'placed by hand' : "True North's order"} · ${plural(next.rows.length, 'step', 'steps')} · ${range(next)}`}</span>
                </button>
              </div>
            )}
          </div>
        )
      })}
      <div className="h-2" />
      <p className="sr-only">{`${who}'s list`}</p>
    </div>
  )
}
