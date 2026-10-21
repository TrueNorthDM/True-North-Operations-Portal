'use client'

/**
 * Clocky's part of the top bar (README "Top bar"): the Who's working icon
 * (Team Leader and up) between Messages and the clock, and the clock button,
 * left of the bell. One drawer at a time: opening one closes the other. The
 * clock panel also opens from a link that carries ?clock=open (the bell's
 * "Confirm end time"); the parameter is taken off the address once used.
 * Going to another page (a link inside a drawer, the rail) closes the drawer.
 *
 * The layout starts both reads without waiting for them (the page is not held
 * up by the clock); this sits in a Suspense boundary and draws when they land.
 */

import { use, useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ClockPanelData, Result } from '@/lib/timeclock/clocky-types'
import { CLOCK_API } from './clock-api'
import { ClockyClock } from './ClockyClock'
import { WhosWorking } from '../working/WhosWorking'
import { WORKING_API } from '../working/working-api'

type Which = 'clock' | 'working' | null

export function ClockyTopBar({ clock, working, meName }: {
  /** getClockPanel(), when the person has Clocky (clocky-hours). */
  clock: Promise<Result<{ data: ClockPanelData }>> | null
  /** getWhosWorkingCount(), when they have Who's working (ck-whos-working). */
  working: Promise<Result<{ count: number }>> | null
  meName: string
}) {
  // The first reads draw the bar; later ones (a refresh of the page) update it without a fallback.
  const [firstClock] = useState(clock)
  const [firstWorking] = useState(working)
  const clockInit = firstClock ? use(firstClock) : null
  const workingInit = firstWorking ? use(firstWorking) : null
  const [count, setCount] = useState(workingInit?.ok ? workingInit.count : 0)
  useEffect(() => {
    if (!working) return
    let live = true
    working.then(r => { if (live && r.ok) setCount(r.count) }, () => {})
    return () => { live = false }
  }, [working])

  const [which, setWhich] = useState<Which>(null)
  const toggle = (w: Exclude<Which, null>) => (open: boolean) => setWhich(open ? w : cur => (cur === w ? null : cur))

  // ?clock=open opens the panel once, then leaves the address.
  const params = useSearchParams()
  const pathname = usePathname()
  const wantClock = !!clock && params.get('clock') === 'open'
  const [handled, setHandled] = useState(false)
  if (wantClock && !handled) { setHandled(true); setWhich('clock') }
  if (!wantClock && handled) setHandled(false)
  // Another address (leaving ?clock aside) closes whichever drawer is open.
  const rest = new URLSearchParams(params)
  rest.delete('clock')
  const where = `${pathname}?${rest}`
  const [shownAt, setShownAt] = useState(where)
  if (where !== shownAt) { setShownAt(where); if (!wantClock) setWhich(null) }

  useEffect(() => {
    if (!wantClock) return
    const url = new URL(window.location.href)
    url.searchParams.delete('clock')
    window.history.replaceState(null, '', url.pathname + url.search + url.hash)
  }, [wantClock])

  return (
    <>
      {/* Who's working has no phone design (the handoff draws only the clock panel at 390px); on a
          phone its icon would push the bar off the screen, so it shows from the tablet width up. */}
      {workingInit && (
        <div className="hidden md:contents">
          <WhosWorking count={count} api={WORKING_API} open={which === 'working'} onOpenChange={toggle('working')} meName={meName} />
        </div>
      )}
      {clockInit && (
        <ClockyClock initial={clockInit} latest={clock} api={CLOCK_API} open={which === 'clock'} onOpenChange={toggle('clock')} />
      )}
    </>
  )
}
