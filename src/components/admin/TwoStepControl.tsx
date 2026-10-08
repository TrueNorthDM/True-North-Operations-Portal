'use client'

/**
 * A person's two-step sign-in in the Directory card (plan step p4-2fa): whether
 * it is on, and the Reset an admin uses when someone loses or replaces their
 * phone. After a reset they set it up again, with a new QR code, at their next
 * sign-in; until then the portal lets nobody past the second step on that account.
 */

import { useState, useTransition } from 'react'
import { useConfirm } from '@/components/ui/useConfirm'
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
  /** The reset action: its result says why it failed, if it did. */
  reset: (() => Promise<{ ok: true } | { ok: false; error: string } | void>) | null
}) {
  const [pending, start] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The card is a snapshot taken when it opened; after a Reset it follows what
  // was just done instead of waiting to be reopened.
  const [current, setCurrent] = useState<TwoStepState>(state)
  const pill = PILL[current]
  const first = name.split(' ')[0]

  const [confirmDialog, confirm] = useConfirm()

  async function onReset() {
    if (!(await confirm({ title: `Reset ${name}'s second step?`, body: 'Use this when they lose or replace their phone. They are signed out, and set it up again with a new QR code at their next sign-in.', action: 'Reset', danger: true }))) return
    setError(null)
    start(async () => {
      try {
        const r = await reset?.()
        if (r && !r.ok) { setError(r.error); return }
        setCurrent('not-set-up')
        setNote(`Reset. ${first} sets it up again at the next sign-in.`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-end gap-1.5">
      {confirmDialog}
      <span className="inline-flex items-center gap-2">
        <span
          className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}
          title={current === 'on' && since ? `Set up ${formatDate(since)}` : undefined}
        >
          {pill.label}
        </span>
        {/* No reset handed in, no button: whoever cannot reset never sees one. */}
        {current === 'on' && reset && (
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
