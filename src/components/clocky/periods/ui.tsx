'use client'

/**
 * Pieces the three Timesheet periods screens share (design handoff of 16
 * October 2026, Timesheet Periods.dc.html): the cadence pill, the confirm
 * dialog that lists each change with its dates (5A2, 5C3), and the toast.
 */

import { useEffect, useRef, useState } from 'react'
import { useModal } from '@/components/ui/useModal'
import type { Cadence } from '@/lib/timeclock/periods'
import { BTN } from '@/lib/ui/buttons'
import { FIELD_LABEL } from '@/lib/ui/type'
import { Toast } from '@/components/clocky/entries/ui'
import { Pill } from '@/components/ui/Pill'

export const CADENCE_LABEL: Record<Cadence, string> = { monthly: 'Monthly', biweekly: 'Every 2 weeks' }

/** The small uppercase label above a value ("A pay period starts on", "Length"). */
export { FIELD_LABEL }

/** Monthly in neutral, Every 2 weeks in teal (5B, 5C); "Not set" in amber, for someone with no cadence of their own yet. */
export function CadencePill({ cadence, size = 10 }: { cadence: Cadence | null; size?: 10 | 10.5 }) {
  void size
  if (cadence === null) return <Pill tone="amber" text="Not set" />
  // The two cadences are kinds, not states: Every 2 weeks keeps its teal.
  return cadence === 'biweekly'
    ? <Pill colorClass="bg-tn-teal-soft text-tn-teal" text={CADENCE_LABEL[cadence]} />
    : <Pill tone="gray" text={CADENCE_LABEL[cadence]} />
}

/** The "New" tag on what this handoff added (the menu item, the section, the column). */
export function NewTag({ size = 9 }: { size?: 9 | 8.5 }) {
  void size
  return <Pill tone="blue" text="New" />
}

export interface DialogItem { name: string; change: string; eff: string }

/**
 * "Move the pay periods?" (5A2) and "Change how these people submit?" (5C3):
 * each change with the dates it takes effect, Cancel and the confirm.
 */
export function PeriodsDialog({ title, intro, items, action, busy, error, onCancel, onConfirm }: {
  title: string
  intro: string
  items: DialogItem[]
  action: string
  busy?: boolean
  error?: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  const box = useRef<HTMLDivElement>(null)
  useModal(true, box, onCancel)
  // 520 wide inside its 22px padding (564 in all), as the design draws it.
  return (
    <div className="fixed inset-0 z-[70] bg-[rgba(1,35,88,.32)] flex items-center justify-center p-5 leading-[normal]" onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div ref={box} role="dialog" aria-modal="true" aria-label={title}
        className="w-full max-w-[564px] bg-white rounded-[16px] shadow-[0_30px_70px_-20px_rgba(1,35,88,.5)] p-[22px] flex flex-col gap-3.5">
        <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">{title}</h2>
        <p className="m-0 text-[13.5px] text-foreground leading-[1.55]">{intro}</p>
        <div className="flex flex-col gap-2">
          {items.map(d => (
            <div key={`${d.name}-${d.change}`} className="border border-[var(--row-rule)] rounded-[11px] px-[13px] py-2.5 flex flex-col gap-[3px]">
              <span className="text-[13.5px] text-tn-ink"><b>{d.name}</b> {d.change}</span>
              <span className="text-[12.5px] text-muted leading-[1.45] tabular-nums lining-nums">{d.eff}</span>
            </div>
          ))}
        </div>
        {error && <p role="alert" className="m-0 text-[13px] text-[#c8323d]">{error}</p>}
        <div className="flex justify-end gap-2 mt-1">
          <button type="button" onClick={onCancel} className={BTN.white}>Cancel</button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`${BTN.navy} disabled:opacity-60`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
            {action}
          </button>
        </div>
      </div>
    </div>
  )
}

/** The navy toast at the foot of the window, five seconds. */
export function useToast(): [React.ReactNode, (text: string) => void] {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    if (!text) return
    const t = setTimeout(() => setText(null), 5000)
    return () => clearTimeout(t)
  }, [text])
  const node = <Toast toast={text ? { text } : null} />
  return [node, setText]
}
