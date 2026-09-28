'use client'

/**
 * A person's two-step sign-in in the Directory card (plan step p4-2fa): whether
 * it is on, and the Reset an admin uses when someone loses or replaces their
 * phone. After a reset they set it up again, with a new QR code, at their next
 * sign-in; until then the portal lets nobody past the second step on that account.
 */

import { useState, useTransition } from 'react'
import { PILL_CLASS, formatDate, type Pill } from '@/lib/directory/people-types'

export type TwoStepState = 'on' | 'not-set-up' | 'no-account'

const PILL: Record<TwoStepState, Pill> = {
  on: { kind: 'green', label: 'On' },
  'not-set-up': { kind: 'amber', label: 'Not set up yet' },
  'no-account': { kind: 'grey', label: 'No account yet' },
}

const btn = 'font-(family-name:--font-display) font-extrabold text-[12px] rounded-[8px] px-3 py-1.5 transition-all disabled:opacity-50'

export function TwoStepControl({ name, state, since, reset }: {
  name: string
  state: TwoStepState
  /** When the factor was added, for the tooltip. */
  since?: string | null
  reset: (() => Promise<void>) | null
}) {
  const [pending, start] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The card is a snapshot taken when it opened; after a Reset it follows what
  // was just done instead of waiting to be reopened.
  const [current, setCurrent] = useState<TwoStepState>(state)
  const pill = PILL[current]
  const first = name.split(' ')[0]

  function onReset() {
    if (!window.confirm(`Reset ${name}'s second step? Use this when they lose or replace their phone. They are signed out, and set it up again with a new QR code at their next sign-in.`)) return
    setError(null)
    start(async () => {
      try {
        await reset?.()
        setCurrent('not-set-up')
        setNote(`Reset. ${first} sets it up again at the next sign-in.`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1.5">
      <span className="inline-flex items-center gap-2">
        <span
          className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}
          title={current === 'on' && since ? `Set up ${formatDate(since)}` : undefined}
        >
          {pill.label}
        </span>
        {current === 'on' && (
          <button type="button" disabled={pending} onClick={onReset} className={`${btn} text-tn-ink border border-slate-200 hover:border-tn-ink`}>
            {pending ? 'Resetting…' : 'Reset'}
          </button>
        )}
      </span>
      {current === 'not-set-up' && !note && (
        <span className="text-[11.5px] text-muted max-w-[240px] text-right">The portal asks {first} to set it up at the next sign-in.</span>
      )}
      {note && <span className="text-[11.5px] text-tn-teal font-semibold max-w-[240px] text-right">{note}</span>}
      {error && <span className="text-[11.5px] text-red-600 max-w-[240px] text-right">{error}</span>}
    </span>
  )
}
