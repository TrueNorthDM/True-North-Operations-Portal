'use client'

/**
 * Hours added by hand, for people the timeclock does not have. Drawn inside
 * ManualHoursDialog, opened from the report.
 *
 * It lists what it has added, because the risk here is not adding a wrong
 * number once: it is adding the same invoice twice a month apart with nothing
 * on screen to notice it. A batch carries one id made here, so sending it
 * twice (a double click, a retry after a timeout) lands it once.
 */

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ui/useConfirm'
import { formatDate } from '@/lib/directory/people-types'
import { BTN } from '@/lib/ui/buttons'
import { addManualEntries, deleteManualEntry } from '@/lib/timeclock/manual-actions'
import { ManualHoursForm } from './ManualHoursForm'
import { AddedRows, StagedLines } from './ManualHoursLists'
import {
  describeLine, emptyForm, h2, linesToSend, pendingSummary, stageProblem, toEntry,
  type ManualForm, type ManualOptions, type ManualRow, type StagedLine,
} from './manual-hours'

// The types live in ./manual-hours; re-exported so importers keep reaching
// them here.
export type { ManualOptions, ManualRow } from './manual-hours'

export function ManualHours(
  { rows, options, month, blurb }: {
    rows: ManualRow[]; options: ManualOptions; month: string
    /** What these hours are for, in the words of the report they land in. */
    blurb: string
  },
) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, confirm] = useConfirm()
  // One id per batch, kept across a retry and dropped once it lands or the
  // lines change: the server refuses the same batch twice.
  const batch = useRef<string | null>(null)

  const [form, setForm] = useState<ManualForm>(() => emptyForm(month))
  const patch = (p: Partial<ManualForm>) => setForm(f => ({ ...f, ...p }))
  /** Lines already staged, each carrying the sentence the list shows. */
  const [lines, setLines] = useState<StagedLine[]>([])

  const stage = () => {
    setError(null)
    const problem = stageProblem(form)
    if (problem) {
      setError(problem)
      return
    }
    const d = toEntry(form)
    batch.current = null
    setLines(ls => [...ls, { ...d, label: describeLine(options, form.topId, d), billable: d.billable }])
    // Cleared: what belongs to this line. Kept: what an invoice repeats down
    // its own lines, which is everything above the day.
    patch({ hours: '', notes: '' })
  }

  const submit = () => {
    setError(null)
    const toSend = linesToSend(lines, form)
    batch.current ??= crypto.randomUUID()
    const id = batch.current
    start(async () => {
      const r = await addManualEntries(toSend, id)
        .catch(() => ({ ok: false, error: 'The hours were not added. Try again in a moment.' }))
      if (!r.ok) { setError(r.error ?? 'Something went wrong.'); return }
      batch.current = null
      setLines([]); patch({ hours: '', notes: '' })
      router.refresh()
    })
  }

  const remove = async (r: ManualRow) => {
    const yes = await confirm({
      title: 'Remove these hours?',
      body: `${h2(r.hours)}h for ${r.personName} on ${formatDate(r.entryDate)} leave the report, and the invoice with them.`,
      action: 'Remove',
      danger: true,
    })
    if (!yes) return
    setError(null)
    start(async () => {
      const res = await deleteManualEntry(r.id).catch(() => ({ ok: false, error: 'The line was not removed. Try again in a moment.' }))
      if (!res.ok) setError(res.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  const pending = pendingSummary(lines, form)

  return (
    <section className={`transition-opacity ${busy ? 'opacity-60' : ''}`}>
      {confirmDialog}
      <div className="mb-4">
        <p className="text-[12.5px] text-muted mt-1 m-0 leading-[1.55]">{blurb}</p>
      </div>

      {error ? (
        <div role="alert" className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-800 mb-4">{error}</div>
      ) : null}

      <ManualHoursForm options={options} month={month} form={form} patch={patch} onStage={stage} busy={busy} />

      {lines.length > 0 && (
        <StagedLines
          lines={lines}
          onRemove={i => { batch.current = null; setLines(ls => ls.filter((_, j) => j !== i)) }}
        />
      )}

      {(lines.length > 0 || Number(form.hours) > 0) && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className={`${BTN.navy} disabled:opacity-50`}
          >
            <span className="text-[#ffffff]">{pending.count === 1 ? 'Add to the report' : `Add ${pending.count} lines to the report`}</span>
          </button>
          <span className="text-[12.5px] text-muted">{pending.hours}h in total</span>
        </div>
      )}

      <AddedRows rows={rows} busy={busy} onRemove={remove} />
    </section>
  )
}
