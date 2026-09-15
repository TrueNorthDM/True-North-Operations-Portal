'use client'

/**
 * Reviewing the steps the ingest guessed.
 *
 * The list is long and the work is small per row, so the screen is built
 * around getting through it: the ones that are wrong right now come first,
 * the count of what is still unverified is at the top, and a decision takes
 * one click and does not move the row out from under the cursor.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { SearchField } from '@/components/ui/SearchField'
import { setStepSource } from '@/app/(app)/settings/monday/actions'
import { chip } from '@/components/monday/tokens'
import { isNotAStep, type StepUnderReview } from '@/lib/monday/worklist/steps-review'

const BUTTON = 'text-[12px] font-semibold px-2.5 py-1 rounded-md border transition-colors'

export function StepReview(
  { steps, progress }: {
    steps: StepUnderReview[]
    progress: { total: number; settled: number; suspicious: number; notSteps: number; unverifiedAssignments: number }
  },
) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [query, setQuery] = useState('')
  const [onlyPending, setOnlyPending] = useState(true)

  const q = query.trim().toLowerCase()
  const shown = steps.filter(s => {
    if (onlyPending && (s.source !== 'guess' || isNotAStep(s))) return false
    if (!q) return true
    return `${s.boardName} ${s.stepName} ${s.peopleTitle} ${s.workspaceName ?? ''}`.toLowerCase().includes(q)
  })

  const decide = (s: StepUnderReview, source: 'guess' | 'confirmed' | 'off') => {
    start(async () => {
      await setStepSource(s.boardId, s.peopleCol, source)
      router.refresh()
    })
  }

  return (
    <div className={`space-y-3.5 transition-opacity ${pending ? 'opacity-60' : ''}`}>
      <div className="flex items-baseline gap-3 flex-wrap">
        <span className="text-[13px] text-foreground">
          {`${progress.settled} of ${progress.total} steps reviewed`}
        </span>
        {/* The number that matters is not how many steps are unverified, it
            is how much work is riding on them. */}
        <span className="text-[13px] text-muted">
          {`${progress.unverifiedAssignments.toLocaleString('en-US')} assignments still rest on a guess`}
        </span>
        {progress.suspicious > 0 ? (
          <span className={`${chip} bg-[rgba(194,65,12,.12)] text-[#c2410c]`}>
            {`${progress.suspicious} look wrong`}
          </span>
        ) : null}
        {/* Said, not hidden: these are off My Work because of the rule, and
            the person reading this is the one who can tell it missed a stage. */}
        {progress.notSteps > 0 ? (
          <span className="text-[13px] text-muted">
            {`${progress.notSteps} people columns own no status with a deadline and stay off My Work`}
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5 flex-wrap">
        <SearchField value={query} onChange={setQuery} placeholder="Board or step" />
        <button
          type="button"
          onClick={() => setOnlyPending(v => !v)}
          className={`${BUTTON} ${onlyPending
            ? 'border-tn-teal text-tn-teal bg-[rgba(30,125,127,.07)]'
            : 'border-[var(--panel-border)] text-muted'}`}
        >
          Only unreviewed
        </button>
      </div>

      <div className="border border-[var(--panel-border)] rounded-[12px] overflow-hidden bg-white">
        {shown.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted m-0">
            {onlyPending ? 'Every step has been reviewed.' : 'No step matches that.'}
          </p>
        ) : shown.map((s, i) => (
          <div
            key={`${s.boardId}|${s.peopleCol}`}
            className={`flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-[var(--row-rule)]' : ''}`}
          >
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="text-[13px] font-semibold text-tn-ink truncate">{s.stepName}</span>
                {s.suspicious ? (
                  <span
                    className={`${chip} bg-[rgba(194,65,12,.12)] text-[#c2410c]`}
                    title="This reads like a dropdown rather than a stage of work"
                  >
                    check
                  </span>
                ) : null}
              </span>
              {/* What the rule read, so a wrong pairing is visible without opening
                  Monday: each status, and the deadline beside it. */}
              <span className="block text-[11.5px] text-muted truncate">
                {`${s.peopleTitle} · `}
                {s.stages == null
                  ? 'paired before steps had deadlines'
                  : s.stages.length === 0
                    ? 'no status with a deadline'
                    : s.stages.map(st => `${st.statusTitle} by ${st.dateTitle}`).join(', then ')}
              </span>
              <span className="block text-[11.5px] text-muted truncate">
                {s.workspaceName ? `${s.workspaceName} · ${s.boardName}` : s.boardName}
              </span>
            </span>

            <span className="flex-none text-[12px] text-muted w-24 text-right">
              {`${s.assignments.toLocaleString('en-US')} rows`}
            </span>

            {isNotAStep(s) ? (
              <span className={`flex-none ${chip} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>not a step</span>
            ) : s.source === 'guess' ? (
              <span className="flex-none flex items-center gap-2">
                <button type="button" onClick={() => decide(s, 'confirmed')}
                  className={`${BUTTON} border-[var(--panel-border)] text-tn-ink hover:bg-[var(--row-hover)]`}>
                  It is a step
                </button>
                <button type="button" onClick={() => decide(s, 'off')}
                  className={`${BUTTON} border-[var(--panel-border)] text-muted hover:bg-[var(--row-hover)]`}>
                  Not a step
                </button>
              </span>
            ) : (
              // A decision has to be reversible in place, or a wrong click
              // becomes a support question.
              <span className="flex-none flex items-center gap-2">
                <span className={`${chip} ${s.source === 'confirmed'
                  ? 'bg-[var(--ok-bg)] text-[var(--ok-fg)]'
                  : 'bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]'}`}
                >
                  {s.source === 'confirmed' ? 'step' : 'off'}
                </span>
                <button type="button" onClick={() => decide(s, 'guess')}
                  className={`${BUTTON} border-transparent text-muted hover:text-tn-ink`}>
                  Undo
                </button>
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
