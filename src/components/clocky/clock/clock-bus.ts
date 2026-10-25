'use client'

/**
 * One clock, two places (design_handoff_home, 25 October 2026): Home's day
 * banner shows the same clock as the top bar, and both move together. The top
 * bar's ClockyClock owns the data and publishes every change here; the banner
 * reads it. The banner's buttons do not run the clock themselves: they ask the
 * top bar's panel, so the job picker, the required fields before a clock out
 * and the Undo toast stay in one place.
 *
 * What is published is the read as well as the data (audit, 25 October 2026:
 * a first read that failed left the banner's card an empty frame for good).
 * Nothing published yet is null: the top bar has not read the clock.
 */

import { useSyncExternalStore } from 'react'
import type { ClockPanelData } from '@/lib/timeclock/clocky-types'

export interface SharedClock {
  data: ClockPanelData | null
  /** The last read's refusal, when it had one. */
  error: string | null
  /** The read said the login is linked to nobody in the Directory: there is no clock. */
  unlinked: boolean
}

let current: SharedClock | null = null
const listeners = new Set<() => void>()

export function publishClock(next: SharedClock) {
  if (current && current.data === next.data && current.error === next.error && current.unlinked === next.unlinked) return
  current = next
  for (const l of listeners) l()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => { listeners.delete(l) }
}

/** The top bar's clock and its read, or null until it has read it (or for someone without Clocky). */
export function useSharedClock(): SharedClock | null {
  return useSyncExternalStore(subscribe, () => current, () => null)
}

/** What the banner asks the top bar's panel to do: open it to clock in, to switch jobs, or to clock out. */
export type ClockIntent = 'in' | 'switch' | 'out'
export const CLOCK_INTENT = 'tn:clock-intent'

export function askClock(intent: ClockIntent) {
  window.dispatchEvent(new CustomEvent<ClockIntent>(CLOCK_INTENT, { detail: intent }))
}
