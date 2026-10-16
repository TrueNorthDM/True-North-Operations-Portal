'use client'

/**
 * The two clocks every Clocky screen keeps: the time, ticking from the
 * server's now, and whether the screen is a phone's.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { clockSkew } from './clock-model'

/**
 * Now, in milliseconds, from the server's `now` and kept ticking every second
 * while `ticking`. Rendered first as the server's own instant, so the server
 * and the browser draw the same thing; a design check that never ticks stays
 * on its frame's instant.
 */
export function useLiveNow(serverNow: string | null, ticking: boolean): number {
  const base = serverNow ? Date.parse(serverNow) : 0
  const [now, setNow] = useState(base)
  useEffect(() => {
    if (!ticking || !serverNow) return
    const skew = clockSkew(serverNow, Date.now())
    const tick = () => setNow(Date.now() + skew)
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [serverNow, ticking])
  return ticking ? Math.max(now, base) : base
}

const PHONE = '(max-width: 767px)'
const subscribePhone = (cb: () => void) => {
  const m = window.matchMedia(PHONE)
  m.addEventListener('change', cb)
  return () => m.removeEventListener('change', cb)
}

/** A phone-sized window (the panel goes full screen), or the size a design check asks for. */
export function usePhone(device: 'auto' | 'phone' | 'desktop' = 'auto'): boolean {
  const narrow = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false)
  return device === 'auto' ? narrow : device === 'phone'
}
