'use client'

/**
 * The people icon in the top bar (Team Leader and up) with the count of people
 * on the clock, and the Who's working drawer it opens (README "Top bar",
 * Who's Working.dc.html 2A to 2E). The count is a green badge, gone at zero.
 * The drawer reads the list when it opens; its count then follows the list.
 */

import { forwardRef, useCallback, useRef, useState } from 'react'
import { NavIcon } from '@/components/NavIcon'
import type { WhosWorkingData } from '@/lib/timeclock/clocky-types'
import { useLiveNow } from '../clock/hooks'
import type { WorkingApi } from './working-api'
import { WhosWorkingPanel, type WorkingUi } from './WhosWorkingPanel'

export const WhosWorkingButton = forwardRef<HTMLButtonElement, { count: number; open: boolean; onClick: () => void }>(
  function WhosWorkingButton({ count, open, onClick }, ref) {
    return (
      <button ref={ref} type="button" onClick={onClick} title="Who's working" aria-haspopup="dialog" aria-expanded={open}
        aria-label={count ? `Who's working, ${count} on the clock` : "Who's working, nobody on the clock"}
        className={`relative inline-flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 ${open ? 'bg-tn-teal/10 text-tn-teal' : 'text-slate-500 hover:bg-slate-100 hover:text-tn-primary'}`}>
        <NavIcon name="people" />
        {count > 0 && (
          <span aria-hidden="true" className="absolute top-[3px] right-[2px] min-w-[18px] h-[18px] rounded-full px-[5px] inline-flex items-center justify-center text-[10.5px] font-bold leading-none ring-2 ring-white whitespace-nowrap bg-[#177a52] text-[#ffffff] tabular-nums lining-nums">
            {count}
          </span>
        )}
      </button>
    )
  },
)

export function WhosWorking({ count: initialCount, api, open, onOpenChange, meName, initialData, frameTop, initialUi, teamOrder, frozen = false }: {
  count: number
  api: WorkingApi
  open: boolean
  onOpenChange: (open: boolean) => void
  meName: string
  /** Design check: the list without asking the server. */
  initialData?: WhosWorkingData
  frameTop?: number | string
  initialUi?: Partial<WorkingUi>
  teamOrder?: readonly string[]
  frozen?: boolean
}) {
  const [data, setData] = useState<WhosWorkingData | null>(initialData ?? null)
  const [error, setError] = useState<string | null>(null)
  const [count, setCount] = useState(initialCount)
  const btn = useRef<HTMLButtonElement>(null)
  const nowMs = useLiveNow(data?.now ?? null, open && !frozen)

  // A new count from the layout (after a refresh) replaces the one shown.
  const [seenCount, setSeenCount] = useState(initialCount)
  if (initialCount !== seenCount) { setSeenCount(initialCount); setCount(initialCount) }

  const take = useCallback((d: WhosWorkingData) => { setData(d); setCount(d.onTheClock) }, [])
  const load = useCallback(async () => {
    try {
      const r = await api.load()
      if (r.ok) { take(r.data); setError(null) } else setError(r.error)
    } catch {
      setError("Who's working could not be read. Try again in a moment.")
    }
  }, [api, take])

  return (
    <>
      <WhosWorkingButton ref={btn} count={count} open={open} onClick={() => {
        onOpenChange(!open)
        if (!open && !initialData) void load()
      }} />
      {open && (
        <WhosWorkingPanel data={data} loadError={error} api={api} variant="drawer" meName={meName} nowMs={nowMs} frameTop={frameTop}
          initialUi={initialUi} teamOrder={teamOrder} onClose={() => onOpenChange(false)} onData={take} closeRef={btn} />
      )}
    </>
  )
}
