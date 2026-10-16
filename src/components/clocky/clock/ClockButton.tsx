'use client'

/**
 * The clock in the top bar (TB, Clock Panel.dc.html): left of the bell on
 * every page, 40px high. Four states: off the clock (navy, gold clock, "Clock
 * in"), running (teal soft, pulsing green dot, the timer and the short job),
 * over 4h 30m (warn, with "!"), and stopped by itself ("Confirm end time" in
 * red). On a phone the running states show the dot and the timer only.
 */

import { forwardRef } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { TopBarState } from './clock-model'
import { ClockDot, FOCUS, ICON, Icon } from './ClockParts'

const LOOK: Record<TopBarState['kind'], string> = {
  off: 'bg-tn-primary border-tn-primary text-[#ffffff]',
  on: 'bg-tn-teal-soft border-[#cfe5e5] text-tn-ink',
  over: 'bg-[#fdf8e7] border-[#f0e2a8] text-[#8a6d1a]',
  auto: 'bg-[#fdeeef] border-[#f3c6ca] text-[#c8323d]',
}

export const ClockButton = forwardRef<HTMLButtonElement, {
  state: TopBarState
  phone: boolean
  open: boolean
  onClick: () => void
}>(function ClockButton({ state, phone, open, onClick }, ref) {
  const live = state.kind !== 'off'
  return (
    <button ref={ref} type="button" onClick={onClick} aria-label={state.aria} aria-expanded={open} aria-haspopup="dialog"
      className={`h-10 flex items-center gap-2 px-[13px] leading-[normal] rounded-[10px] border cursor-pointer font-(family-name:--font-display) font-extrabold text-[13px] whitespace-nowrap hover:border-tn-teal ${FOCUS} ${LOOK[state.kind]}`}>
      {!live ? (
        <>
          <Icon d={ICON.clock} size={17} stroke={BTN_ICON.navy} sw={2.2} />
          <span>Clock in</span>
        </>
      ) : (
        <>
          <ClockDot color={state.kind === 'auto' ? '#c8323d' : '#1E9E6A'} pulse={state.kind !== 'auto'} />
          <span className="text-[14px] tabular-nums lining-nums">{state.text}</span>
          {!phone && state.job && (
            <span className={`font-sans font-semibold text-[12.5px] ${state.kind === 'over' ? 'text-[#8a6d1a]' : 'text-tn-teal'}`}>{state.job}</span>
          )}
          {!phone && state.kind === 'over' && (
            <span aria-hidden="true" className="w-[17px] h-[17px] rounded-full bg-[#8a6d1a] text-[#ffffff] text-[11px] font-black flex items-center justify-center">!</span>
          )}
        </>
      )}
    </button>
  )
})
