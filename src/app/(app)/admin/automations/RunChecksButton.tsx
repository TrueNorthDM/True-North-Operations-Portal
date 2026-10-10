'use client'

// "Run checks now", with its pending state and its answer (audit, 10 October
// 2026). The checks call Monday and TSheets and take several seconds; a plain
// form button gave no sign it was working, so people clicked it again.

import { useActionState } from 'react'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { runChecksNow, type RunChecksState } from './actions'

export function RunChecksButton() {
  const [state, action, pending] = useActionState<RunChecksState | null>(runChecksNow, null)
  return (
    <form action={action} className="flex flex-col items-end gap-1.5">
      <button type="submit" disabled={pending} aria-busy={pending} className={`${BTN.navy} disabled:opacity-60 disabled:cursor-wait disabled:hover:translate-y-0`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={pending ? 'animate-spin' : ''}><path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" /></svg>
        <span className="text-[#ffffff]">{pending ? 'Running checks…' : 'Run checks now'}</span>
      </button>
      <p aria-live="polite" className={`text-[12.5px] m-0 ${state && !state.ok ? 'text-[#b3271f]' : 'text-muted'}`}>
        {pending ? '' : state?.message ?? ''}
      </p>
    </form>
  )
}
