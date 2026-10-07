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
import { setHideStaleBoards } from '@/app/(app)/admin/settings/monday/actions'
import { STALE_MONTHS } from '@/lib/monday/worklist/stale'

export function StaleRuleToggle(
  { on, wouldHide, wouldShow }: { on: boolean; wouldHide: number; wouldShow: number },
) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [result, setResult] = useState<string | null>(null)

  const flip = () => {
    setResult(null)
    start(async () => {
      const r = await setHideStaleBoards(!on)
      if (!r.ok) { setResult(r.error ?? 'Something went wrong.'); return }
      if (!on) {
        const parts = []
        if (r.hidden) parts.push(`${r.hidden} hidden`)
        if (r.shown) parts.push(`${r.shown} brought back`)
        setResult(parts.length ? parts.join(', ') + '.' : 'Nothing to change: every board already matches its activity.')
      }
      router.refresh()
    })
  }

  return (
    <div className={`border rounded-[12px] px-4 py-3.5 mb-4 transition-opacity ${busy ? 'opacity-60' : ''} ${
      on ? 'border-tn-teal bg-[rgba(30,125,127,.06)]' : 'border-[var(--panel-border)] bg-white'
    }`}>
      <div className="flex items-start gap-3 flex-wrap">
        <button
          type="button"
          onClick={flip}
          role="switch"
          aria-checked={on}
          disabled={busy}
          className={`mt-0.5 shrink-0 w-10 h-[22px] rounded-full transition-colors ${
            on ? 'bg-tn-teal' : 'bg-slate-300'
          }`}
        >
          <span
            className={`block w-[18px] h-[18px] rounded-full bg-white transition-transform ${
              on ? 'translate-x-[20px]' : 'translate-x-0.5'
            }`}
          />
        </button>

        <span className="min-w-0 flex-1">
          <span className="block text-[13.5px] font-semibold text-tn-ink">
            Follow activity: hide boards quiet for {STALE_MONTHS} months, bring them back when used
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
              Right now this would hide <strong className="font-bold">{wouldHide}</strong> and bring
              back <strong className="font-bold">{wouldShow}</strong>.
            </span>
          ) : null}

          {result ? <span className="block text-[12.5px] text-tn-teal font-semibold mt-2">{result}</span> : null}
        </span>
      </div>
    </div>
  )
}
