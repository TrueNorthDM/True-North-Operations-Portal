'use client'

/**
 * The three History options in one row, scaled to fit the screen so they can
 * be compared at a glance, with a switch to actual size (the row then scrolls
 * sideways) for reading the small print. Design check only.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

const COLUMN = 560
const GAP = 24

export function SideBySide({ columns }: { columns: { key: string; head: ReactNode; body: ReactNode }[] }) {
  const box = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(true)
  const [scale, setScale] = useState(1)
  const natural = columns.length * COLUMN + (columns.length - 1) * GAP

  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setScale(Math.min(1, el.clientWidth / natural))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [natural])

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="inline-flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
          {([[true, 'Fit to screen'], [false, 'Actual size']] as const).map(([v, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setFit(v)}
              aria-pressed={fit === v}
              className={`font-(family-name:--font-display) font-extrabold text-[12.5px] px-3 py-1.5 rounded-[8px] ${fit === v ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]' : 'text-muted hover:text-tn-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-muted">
          {fit && scale < 1 ? `Shown at ${Math.round(scale * 100)}%. Actual size scrolls sideways.` : 'Actual size.'}
        </span>
      </div>
      <div ref={box} className={fit ? 'overflow-hidden' : 'overflow-x-auto pb-3'}>
        <div
          className="grid items-start"
          style={{ gridTemplateColumns: `repeat(${columns.length}, ${COLUMN}px)`, gap: GAP, width: natural, zoom: fit ? scale : 1 }}
        >
          {columns.map(c => (
            <div key={c.key} className="space-y-2.5">
              {c.head}
              {c.body}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
