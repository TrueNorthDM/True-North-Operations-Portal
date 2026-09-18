'use client'

/** A screen drawn at its real width, scaled down to fit a narrower window. Design check only. */

import { useEffect, useRef, useState, type ReactNode } from 'react'

export function FitWidth({ width, children }: { width: number; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const measure = () => setScale(Math.min(1, el.clientWidth / width))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [width])
  return (
    <div ref={box} className="overflow-clip">
      <div style={{ width, zoom: scale }}>{children}</div>
    </div>
  )
}
