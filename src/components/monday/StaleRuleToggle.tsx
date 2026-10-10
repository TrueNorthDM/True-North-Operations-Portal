'use client'

/**
 * The switch that lets quiet boards fall off on their own.
 *
 * Two things a switch like this has to say before it is trusted: what it will
 * do, and what it just did. The first is the count beside it, read from the
 * same rule the sync runs. The second is the result line after a click, which
 * is how somebody knows a click that changed nothing changed nothing on
 * purpose rather than failing.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Switch } from '@/components/ui/Switch'
import { setHideStaleBoards } from '@/app/(app)/admin/settings/monday/actions'
import { STALE_MONTHS } from '@/lib/monday/worklist/stale'

/** What the last click did, or why it did nothing. Kept apart so a failure never reads as a result. */
type Outcome = { ok: boolean; text: string }

export function StaleRuleToggle(
  { on, wouldHide, wouldShow }: { on: boolean; wouldHide: number; wouldShow: number },
) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [result, setResult] = useState<Outcome | null>(null)

  const flip = () => {
    setResult(null)
    start(async () => {
      const r = await setHideStaleBoards(!on)
      if (!r.ok) { setResult({ ok: false, text: r.error ?? 'The rule could not be changed. Try again in a moment.' }); return }
      if (!on) {
        const parts = []
        if (r.hidden) parts.push(`${r.hidden.toLocaleString('en-US')} hidden`)
        if (r.shown) parts.push(`${r.shown.toLocaleString('en-US')} brought back`)
        setResult({ ok: true, text: parts.length ? parts.join(', ') + '.' : 'Nothing to change: every board already matches its activity.' })
      }
      router.refresh()
    })
  }
  const label = `Follow activity: hide boards quiet for ${STALE_MONTHS} months, bring them back when used`

  return (
    <div className={`border rounded-[12px] px-4 py-3.5 mb-4 transition-opacity ${busy ? 'opacity-60' : ''} ${
      on ? 'border-tn-teal bg-[rgba(30,125,127,.06)]' : 'border-[var(--panel-border)] bg-white'
    }`}>
      <div className="flex items-start gap-3 flex-wrap">
        {/* The portal's switch, named for the rule (audit, 10 October 2026). */}
        <span className="mt-0.5">
          <Switch on={on} onChange={flip} label={label} disabled={busy} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-tn-ink" aria-hidden="true">
            {label}
          </span>
          <span className="block text-[12.5px] text-muted mt-1 leading-[1.55]">
            A finished project goes quiet without telling anybody, and a restarted one comes back
            the same way. Switching a board Shown or Not shown by hand pins it, and the rule leaves
            it alone from then on.
          </span>

          {/* What it would do, from the same rule the sync runs, so the number
              beside the switch cannot disagree with the switch. */}
          {!on && (wouldHide > 0 || wouldShow > 0) ? (
            <span className="block text-[12.5px] text-foreground mt-2">
              Right now this would hide <strong className="font-bold">{wouldHide.toLocaleString('en-US')}</strong> and bring
              back <strong className="font-bold">{wouldShow.toLocaleString('en-US')}</strong>.
            </span>
          ) : null}

          {/* A failure in the warning colours and said at once; a result in
              teal and read out politely. They looked the same before. */}
          {result && !result.ok ? (
            <span role="alert" className="block mt-2 rounded-[8px] border border-[var(--warn-border)] bg-[var(--warn-bg)] px-3 py-2 text-[12.5px] font-semibold text-[var(--warn-fg)]">{result.text}</span>
          ) : null}
          {result && result.ok ? <span role="status" className="block text-[12.5px] text-tn-teal font-semibold mt-2">{result.text}</span> : null}
        </span>
      </div>
    </div>
  )
}
