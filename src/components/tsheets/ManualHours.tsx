'use client'

/**
 * Hours added by hand, for people the timeclock does not have.
 *
 * Sits under the report rather than beside it, and lists what it has added,
 * because the risk here is not adding a wrong number once: it is adding the
 * same invoice twice a month apart with nothing on screen to notice it.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { addManualEntry, deleteManualEntry } from '@/lib/timeclock/manual-actions'
import { MAX_HOURS_PER_ENTRY } from '@/lib/timeclock/manual-entry'

export type ManualRow = {
  id: number
  personName: string
  entryDate: string
  hours: number
  jobcodeName: string
  i7Code: string
  activity: string
  notes: string | null
  addedBy: string | null
}

export type ManualOptions = {
  people: { id: string; name: string; hasRate: boolean }[]
  jobcodes: { id: number; name: string }[]
  i7Codes: string[]
  activities: string[]
}

const FIELD = 'w-full rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2 text-[13.5px] text-tn-ink'
const LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5'

export function ManualHours(
  { rows, options, month }: { rows: ManualRow[]; options: ManualOptions; month: string },
) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const [personId, setPersonId] = useState('')
  const [entryDate, setEntryDate] = useState(`${month}-01`)
  const [jobcodeId, setJobcodeId] = useState('')
  const [hours, setHours] = useState('')
  const [i7Code, setI7Code] = useState('')
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')

  const chosen = options.people.find(p => p.id === personId)

  const submit = () => {
    setError(null)
    start(async () => {
      const r = await addManualEntry({
        personId,
        entryDate,
        jobcodeId: Number(jobcodeId),
        hours: Number(hours),
        i7Code,
        activity,
        notes,
      })
      if (!r.ok) { setError(r.error ?? 'Something went wrong.'); return }
      setHours(''); setNotes('')
      router.refresh()
    })
  }

  const remove = (id: number) => {
    setError(null)
    start(async () => {
      const r = await deleteManualEntry(id)
      if (!r.ok) setError(r.error ?? 'Something went wrong.')
      else router.refresh()
    })
  }

  const total = rows.reduce((s, r) => s + r.hours, 0)

  return (
    <section className={`border border-[var(--panel-border)] bg-white rounded-[14px] px-5 pt-[18px] pb-5 transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0">
            Hours added by hand
          </h3>
          <p className="text-[12.5px] text-muted mt-1 m-0 leading-[1.55]">
            For people who bill i7 work without a timeclock account. These count in the report and
            the invoice exactly like any other hour, which is why they are listed here rather than
            only totalled.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="shrink-0 text-[13px] font-semibold px-3.5 py-2 rounded-[10px] border border-[var(--panel-border)] text-tn-ink hover:bg-[var(--row-hover)] transition-colors"
        >
          {open ? 'Cancel' : 'Add hours'}
        </button>
      </div>

      {error ? (
        <div className="rounded-[10px] border border-red-300 bg-red-50 px-4 py-3 text-[13px] text-red-800 mb-4">{error}</div>
      ) : null}

      {open ? (
        <div className="border border-[var(--panel-border)] rounded-[12px] p-4 mb-4 bg-subtle">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={LABEL}>Person</label>
              <Select
                value={personId}
                onChange={setPersonId}
                searchable
                fullWidth
                ariaLabel="Person"
                options={options.people.map(p => ({ value: p.id, label: p.name }))}
                placeholder="Choose…"
              />
              {/* Their hours would count and their cost would be zero, so the
                  budget would read as less consumed than it is. Said before
                  the entry is saved, not after the invoice is out. */}
              {chosen && !chosen.hasRate ? (
                <p className="text-[11.5px] text-[#b06d0a] mt-1.5 m-0 leading-[1.5]">
                  {chosen.name} has no i7 rate. The hours will count and the cost will be zero
                  until one is set in Rates &amp; Costs.
                </p>
              ) : null}
            </div>

            <div>
              <label className={LABEL}>Day</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={FIELD} />
            </div>

            <div>
              <label className={LABEL}>Hours</label>
              <input
                type="number" step="0.25" min="0" max={MAX_HOURS_PER_ENTRY}
                value={hours} onChange={e => setHours(e.target.value)}
                placeholder="0.00" className={FIELD}
              />
            </div>

            <div>
              <label className={LABEL}>Job code</label>
              <Select
                value={jobcodeId}
                onChange={setJobcodeId}
                searchable
                fullWidth
                ariaLabel="Job code"
                options={options.jobcodes.map(j => ({ value: String(j.id), label: j.name }))}
                placeholder="Choose…"
              />
            </div>

            <div>
              <label className={LABEL}>i7 code</label>
              <Select
                value={i7Code} onChange={setI7Code} searchable fullWidth ariaLabel="i7 code"
                options={options.i7Codes.map(c => ({ value: c, label: c }))}
                placeholder="Choose…"
              />
            </div>

            <div>
              <label className={LABEL}>Activity</label>
              <Select
                value={activity} onChange={setActivity} searchable fullWidth ariaLabel="Activity"
                options={options.activities.map(a => ({ value: a, label: a }))}
                placeholder="Choose…"
              />
            </div>

            <div className="sm:col-span-3">
              <label className={LABEL}>Note (optional)</label>
              <input
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Invoice number, or what the hours were for"
                className={FIELD}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="mt-4 text-[13px] font-bold px-4 py-2 rounded-[10px] bg-tn-ink text-white hover:opacity-90 transition-opacity"
          >
            Add to the report
          </button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="text-[13px] text-muted m-0">Nothing added by hand this month.</p>
      ) : (
        <>
          <div className="border border-[var(--panel-border)] rounded-[12px] overflow-hidden">
            {rows.map((r, i) => (
              <div key={r.id} className={`flex items-center gap-3 px-4 py-2.5 ${i ? 'border-t border-[var(--row-rule)]' : ''}`}>
                <span className="w-[100px] flex-none text-[12.5px] text-muted">{r.entryDate}</span>
                <span className="w-[130px] flex-none text-[13px] font-semibold text-tn-ink truncate">{r.personName}</span>
                <span className="min-w-0 flex-1 text-[12.5px] text-foreground truncate">
                  {[r.i7Code, r.activity].filter(Boolean).join(' · ') || r.jobcodeName}
                  {r.notes ? <span className="text-muted"> · {r.notes}</span> : null}
                </span>
                <span className="w-[60px] flex-none text-right text-[13px] font-semibold text-tn-ink">{r.hours}h</span>
                <span className="w-[110px] flex-none text-right text-[11.5px] text-muted truncate">
                  {r.addedBy ? `by ${r.addedBy}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => remove(r.id)}
                  className="shrink-0 text-[12px] font-semibold text-muted hover:text-[#c2410c] transition-colors"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <p className="text-[12.5px] text-muted mt-2.5 m-0">
            {`${rows.length} ${rows.length === 1 ? 'entry' : 'entries'} · ${total}h added by hand this month, already counted above.`}
          </p>
        </>
      )}
    </section>
  )
}
