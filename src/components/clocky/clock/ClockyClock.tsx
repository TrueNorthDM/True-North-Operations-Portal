'use client'

/**
 * The clock in the top bar with its panel (TB and 1A to 1N): the data, the
 * ticking timer, the tab title while it runs ("2:00 · i7 › Web Dev · True
 * North"), the toast (with Undo for 10 seconds after a clock out), and a fresh
 * read when the 5-hour mark passes, so Clocky's stop shows at once.
 *
 * Whether the panel is open belongs to whoever draws this (the top bar opens
 * one drawer at a time). A design check hands it its frame's data, a stand-in
 * `api`, and where to draw inside the frame.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import type { ClockPanelData, Result } from '@/lib/timeclock/clocky-types'
import type { ClockApi } from './clock-api'
import { tabTitle, topBarState } from './clock-model'
import { ClockButton } from './ClockButton'
import { ClockPanel, type PanelUi, type Toast } from './ClockPanel'
import { ClockToast, type Phone } from './ClockParts'
import { useLiveNow, usePhone } from './hooks'

/** The tab title Clocky writes, so it knows its own from the page's. */
const OURS = /^\d+:\d{2} · .+ · True North$/

export function ClockyClock({
  initial, latest, api, open, onOpenChange, device = 'auto', frameTop, initialUi, initialToast, frozen = false, forceOffline, setsTitle = true,
}: {
  initial: Result<{ data: ClockPanelData }>
  /** The layout's read after a refresh of the page (the bell's Keep going, an action elsewhere): taken when it lands. */
  latest?: Promise<Result<{ data: ClockPanelData }>> | null
  api: ClockApi
  open: boolean
  onOpenChange: (open: boolean) => void
  device?: 'auto' | 'phone' | 'desktop'
  /** Design check: draw the panel and the toast inside a frame, this far down. */
  frameTop?: number
  initialUi?: Partial<PanelUi>
  initialToast?: Toast
  /** Design check: the timers stand still on the frame's instant. */
  frozen?: boolean
  forceOffline?: boolean
  /** Write the timer into the browser tab's title while the clock runs. */
  setsTitle?: boolean
}) {
  const [state, setState] = useState<{ data: ClockPanelData | null; error: string | null }>(() =>
    initial.ok ? { data: initial.data, error: null } : { data: null, error: initial.error })
  const data = state.data
  const narrow = usePhone(device)
  // In the app ('auto', not inside a design-check frame) the phone and desktop
  // differences are CSS, right from the first paint; a fixed frame uses the
  // size it was given.
  const phone: Phone = device === 'auto' && frameTop == null ? 'css' : narrow
  const ticking = !frozen && !!(data?.running || data?.toConfirm.length)
  const nowMs = useLiveNow(data?.now ?? null, ticking)
  const tb = topBarState(data, nowMs)
  const btn = useRef<HTMLButtonElement>(null)

  const loaded = useRef(0)
  const refresh = useCallback(async () => {
    loaded.current = Date.now()
    try {
      const r = await api.load()
      setState(s => (r.ok ? { data: r.data, error: null } : { data: s.data, error: r.error }))
    } catch {
      // Offline: the clock keeps counting from what it has.
    }
  }, [api])

  useEffect(() => {
    if (!latest) return
    let live = true
    latest.then(r => { if (live && r.ok) setState({ data: r.data, error: null }) }, () => {})
    return () => { live = false }
  }, [latest])

  // The toast: 10 seconds with Undo, 5 without. A design check keeps its own.
  const [toast, setToastState] = useState<Toast | null>(initialToast ?? null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((t: Toast | null) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToastState(t)
    if (t) toastTimer.current = setTimeout(() => setToastState(null), t.undo ? 10_000 : 5_000)
  }, [])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const undo = async (entryId: number) => {
    showToast(null)
    try {
      const r = await api.undoClockOut({ entryId })
      if (!r.ok) showToast({ text: r.error, error: true })
    } catch {
      showToast({ text: 'Not saved yet. Will retry when you are back online.', error: true })
    }
    await refresh()
  }

  // Past the 5-hour mark: read again, and the server stops the clock (1L).
  const stopAt = data?.running && data.safety ? Date.parse(data.safety.stopAt) : null
  const due = !frozen && stopAt != null && nowMs >= stopAt + 2000
  const refreshRef = useRef(refresh)
  useEffect(() => { refreshRef.current = refresh })
  useEffect(() => { if (due) void refreshRef.current() }, [due])

  // Back to the tab after a while: the clock may have changed on another device.
  useEffect(() => {
    if (frozen) return
    const onShow = () => { if (document.visibilityState === 'visible' && Date.now() - loaded.current > 60_000) void refresh() }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [frozen, refresh])

  // The tab title while the clock runs; the page's own back when it stops.
  // Checked every second while it runs: the page's metadata can land after
  // this and put its own title back (streamed metadata, a navigation).
  const title = setsTitle ? tabTitle(data, nowMs) : null
  const pathname = usePathname()
  const pageTitle = useRef<string | null>(null)
  const second = title ? Math.floor(nowMs / 1000) : 0
  useEffect(() => {
    if (!setsTitle) return
    if (title) {
      if (!OURS.test(document.title)) pageTitle.current = document.title
      if (document.title !== title) document.title = title
    } else if (pageTitle.current !== null && OURS.test(document.title)) {
      document.title = pageTitle.current
      pageTitle.current = null
    }
  }, [title, pathname, setsTitle, second])

  return (
    <>
      <ClockButton ref={btn} state={tb} phone={phone} open={open} onClick={() => onOpenChange(!open)} />
      {open && (
        <ClockPanel data={data} loadError={state.error} api={api} nowMs={nowMs} phone={phone} frameTop={frameTop}
          initialUi={initialUi} forceOffline={forceOffline} onClose={() => onOpenChange(false)} refresh={refresh} toast={showToast} closeRef={btn} />
      )}
      {toast && (
        <ClockToast text={toast.text} error={toast.error} contained={frameTop != null} phone={phone}
          onUndo={toast.undo != null ? () => void undo(toast.undo!) : undefined} />
      )}
    </>
  )
}
