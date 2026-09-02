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
import { addManualEntries, deleteManualEntry } from '@/lib/timeclock/manual-actions'
import type { ManualEntryInput } from '@/lib/timeclock/manual-entry'
import { MAX_HOURS_PER_ENTRY } from '@/lib/timeclock/manual-entry'
import { monthName } from '@/lib/timeclock/periods'

export type ManualRow = {
  id: number
  personName: string
  entryDate: string
  hours: number
  jobcodeName: string
  /**
   * What the entry is tagged with: the i7 code inside the i7 tree, the project
   * outside it. One column, because it is the same slot in the sentence and the
   * row reads the same either way.
   */
  tag: string
  activity: string
  notes: string | null
  addedBy: string | null
}

export type ManualOptions = {
  /**
   * Rate state is absent where it has no meaning. Only the i7 branch turns an
   * hour into money, so only there is "this will count as zero" a real warning;
   * carrying a made-up `hasRate: true` for the others would have been a lie
   * living in the data rather than an absence the form can read.
   */
  people: { id: string; name: string; hasRate?: boolean; rateOutsideMonth?: boolean }[]
  /**
   * The roots, chosen first, exactly as QuickBooks Time asks. `branch` says
   * which middle the form shows once one is picked: an i7 code inside the i7
   * tree, a Company and a Project outside it.
   */
  tops: { id: string; name: string; branch: 'i7' | 'project' }[]
  /** The disciplines inside each root, keyed by the root's id. */
  jobsByTop: Record<string, { id: number; name: string }[]>
  /**
   * The branch-specific middle. Both are carried and the chosen root decides
   * which one is drawn, the same swap QuickBooks Time makes at the same point.
   */
  i7Codes: { code: string; project: string }[]
  companies: string[]
  projects: string[]
  activities: string[]
  billable: string[]
}

const FIELD = 'w-full rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2 text-[13.5px] text-tn-ink'
const LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5'

export function ManualHours(
  { rows, options, month, blurb, embedded = false }: {
    rows: ManualRow[]; options: ManualOptions; month: string
    /** What these hours are for, in the words of the report they land in. */
    blurb: string
    /**
     * Inside a dialog that already frames it: no card border, no heading, and
     * the form open from the start, because opening the dialog was the click
     * that used to open the form.
     */
    embedded?: boolean
  },
) {
  const router = useRouter()
  const [busy, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(embedded)

  const [personId, setPersonId] = useState('')
  const [entryDate, setEntryDate] = useState(`${month}-01`)
  const [topId, setTopId] = useState('')
  const [jobcodeId, setJobcodeId] = useState('')
  const [hours, setHours] = useState('')
  const [i7Code, setI7Code] = useState('')
  const [activity, setActivity] = useState('')
  const [company, setCompany] = useState('')
  const [project, setProject] = useState('')
  const [billable, setBillable] = useState('')
  const [notes, setNotes] = useState('')
  /** Lines already staged, each carrying the sentence the list shows. */
  const [lines, setLines] = useState<(ManualEntryInput & { label: string })[]>([])

  const chosen = options.people.find(p => p.id === personId)
  const top = options.tops.find(t => t.id === topId)
  const jobs = topId ? options.jobsByTop[topId] ?? [] : []
  // Warned the moment the person is chosen, not after the branch is.
  //
  // Waiting for the top meant the warning arrived once the form was half filled
  // in, which is the wrong end of the work: knowing that somebody has no rate is
  // most useful before you type their hours, because the fix is on another
  // screen. So it shows as soon as there is a person, and retracts if the top
  // turns out to be a branch where an hour never becomes money.
  const warnRate = chosen?.hasRate === false && top?.branch !== 'project'

  /** The line currently being typed, as the server wants it. */
  const draft = (): ManualEntryInput => ({
    personId,
    entryDate,
    jobcodeId: Number(jobcodeId),
    hours: Number(hours),
    i7Code,
    company,
    project,
    activity,
    billable,
    notes,
  })

  /** What the staged list shows for a line, so it reads like the report will. */
  const describe = (d: ManualEntryInput) => [
    options.tops.find(t => t.id === topId)?.name,
    (options.jobsByTop[topId] ?? []).find(j => j.id === d.jobcodeId)?.name,
    d.i7Code || d.project,
    d.activity,
  ].filter(Boolean).join(' › ')

  const stage = () => {
    setError(null)
    // The line has to stand on its own before it joins the others, or an empty
    // one sits in the list looking like work that is done.
    if (!personId || !jobcodeId || !entryDate || !(Number(hours) > 0)) {
      setError('Fill the day, the hours and the job before adding the line.')
      return
    }
    const d = draft()
    setLines(ls => [...ls, { ...d, label: describe(d), billable: d.billable }])
    // Cleared: what belongs to this line. Kept: what an invoice repeats down
    // its own lines, which is everything above the day.
    setHours(''); setNotes('')
  }

  const submit = () => {
    setError(null)
    // The line still in the fields counts. Making somebody stage it first, then
    // press a second button, is a rule that only exists because of how this is
    // built.
    const pending = Number(hours) > 0 && jobcodeId ? [...lines, draft()] : lines
    start(async () => {
      // Rebuilt field by field: the staged lines carry the sentence the list
      // shows, and that belongs to the screen, not to the write.
      const r = await addManualEntries(pending.map(d => ({
        personId: d.personId, entryDate: d.entryDate, jobcodeId: d.jobcodeId,
        hours: d.hours, i7Code: d.i7Code, company: d.company, project: d.project,
        activity: d.activity, billable: d.billable, notes: d.notes,
      })))
      if (!r.ok) { setError(r.error ?? 'Something went wrong.'); return }
      setLines([]); setHours(''); setNotes('')
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
  // The line still in the fields counts towards what the button says it
  // will send, because it is going to be sent.
  const typing = Number(hours) > 0 && Boolean(jobcodeId)
  const pendingCount = lines.length + (typing ? 1 : 0)
  const pendingHours = Math.round((lines.reduce((a, l) => a + l.hours, 0) + (typing ? Number(hours) : 0)) * 100) / 100

  return (
    <section className={`${embedded ? '' : 'border border-[var(--panel-border)] bg-white rounded-[14px] px-5 pt-[18px] pb-5'} transition-opacity ${busy ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          {!embedded && (
            <h3 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0">
              Hours added by hand
            </h3>
          )}
          <p className="text-[12.5px] text-muted mt-1 m-0 leading-[1.55]">{blurb}</p>
        </div>
        {!embedded && <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="shrink-0 text-[13px] font-semibold px-3.5 py-2 rounded-[10px] border border-[var(--panel-border)] text-tn-ink hover:bg-[var(--row-hover)] transition-colors"
        >
          {open ? 'Cancel' : 'Add hours'}
        </button>}
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
                  the entry is saved, not after the invoice is out.

                  The whole sentence is one expression on one line. JSX trims
                  every line of a text chunk that runs onto a second line, the
                  first one included, so any word sitting beside {expr} loses
                  its space. Wrapping the sentence to fit the margin ate it
                  twice here: once after the name, once after the full stop. */}
              {chosen && warnRate ? (
                <p className="text-[11.5px] text-[#b06d0a] mt-1.5 m-0 leading-[1.5]">
                  {chosen.rateOutsideMonth
                    ? `${chosen.name} has an i7 rate, but it does not cover ${monthName(month)}. The hours will count and the cost will be zero. In Rates & Costs, start the rate on or before this month.`
                    : `${chosen.name} has no i7 rate. The hours will count and the cost will be zero until one is set in Rates & Costs.`}
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
              <label className={LABEL}>Job, top</label>
              <Select
                value={topId}
                // Picking a different root empties the fields below it: the
                // disciplines are the root's own, and the middle of the form
                // may swap entirely. Leaving a stale choice sitting there is
                // how an hour gets filed under a code from the other branch.
                onChange={v => { setTopId(v); setJobcodeId(''); setI7Code(''); setCompany(''); setProject('') }}
                searchable fullWidth ariaLabel="Job, top"
                options={options.tops.map(t => ({ value: t.id, label: t.name }))}
                placeholder="Choose…"
              />
            </div>

            <div>
              <label className={LABEL}>Job</label>
              <Select
                value={jobcodeId}
                onChange={setJobcodeId}
                searchable
                fullWidth
                disabled={!topId}
                ariaLabel="Job"
                options={jobs.map(j => ({ value: String(j.id), label: j.name }))}
                placeholder={topId ? 'Choose…' : 'Choose the top first'}
              />
            </div>

            {/* Numbered the way QuickBooks Time numbers them, so they read as
                the same fields somebody fills in over there. */}
            {top?.branch === 'i7' && (
              <div>
                <label className={LABEL}>1 - i7 code</label>
                <Select
                  value={i7Code} onChange={setI7Code} searchable fullWidth ariaLabel="i7 code"
                  options={options.i7Codes.map(c => ({ value: c.code, label: c.code, group: c.project }))}
                  placeholder="Choose…"
                />
              </div>
            )}

            {top?.branch === 'project' && (
              <div>
                <label className={LABEL}>1 Company</label>
                <Select
                  value={company} onChange={setCompany} fullWidth ariaLabel="Company"
                  options={options.companies.map(c => ({ value: c, label: c }))}
                  placeholder="Choose…"
                />
              </div>
            )}

            {top?.branch === 'project' && (
              <div>
                <label className={LABEL}>2 Project</label>
                <Select
                  value={project} onChange={setProject} fullWidth ariaLabel="Project"
                  options={options.projects.map(c => ({ value: c, label: c }))}
                  placeholder="Choose…"
                />
              </div>
            )}

            <div>
              <label className={LABEL}>3 Activity</label>
              <Select
                value={activity} onChange={setActivity} searchable fullWidth ariaLabel="Activity"
                options={options.activities.map(a => ({ value: a, label: a }))}
                placeholder="Choose…"
              />
            </div>

            {options.billable.length > 0 && (
              <div>
                <label className={LABEL}>4 Billable</label>
                <Select
                  value={billable} onChange={setBillable} fullWidth ariaLabel="Billable"
                  options={options.billable.map(b => ({ value: b, label: b }))}
                  placeholder="Choose…"
                />
              </div>
            )}

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
            onClick={stage}
            disabled={busy}
            className="mt-4 text-[13px] font-semibold px-4 py-2 rounded-[10px] border border-dashed border-[var(--panel-border)] text-tn-ink hover:bg-[var(--row-hover)] transition-colors"
          >
            + Add another line
          </button>
        </div>
      ) : null}

      {/* Staged lines. Dashed above, solid below: the two buttons do different
          things and used to look the same, which is the one confusion this
          shape can cause. */}
      {open && lines.length > 0 && (
        <div className="mt-3 rounded-[12px] border border-[var(--panel-border)] overflow-hidden">
          {lines.map((l, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 text-[13px] border-b border-[var(--panel-border)] last:border-b-0 bg-subtle"
            >
              <span className="w-[62px] shrink-0 text-muted tabular-nums">{l.entryDate.slice(8)}/{l.entryDate.slice(5, 7)}</span>
              <span className="flex-1 min-w-0 truncate text-foreground">
                {l.label}
                {/* Only when it is not billable. A tag on every line is a column
                    that says the same thing every time, and stops being read. */}
                {l.billable && l.billable.toLowerCase() === 'no' && (
                  <span className="ml-2 text-[10.5px] font-bold uppercase tracking-wider text-[#b06d0a]">not billable</span>
                )}
              </span>
              <span className="w-[56px] shrink-0 text-right font-semibold text-tn-ink tabular-nums">{l.hours}h</span>
              <button
                type="button"
                onClick={() => setLines(ls => ls.filter((_, j) => j !== i))}
                aria-label={`Remove line ${i + 1}`}
                className="shrink-0 text-muted hover:text-tn-ink transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {open && (lines.length > 0 || Number(hours) > 0) && (
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="text-[13px] font-bold px-4 py-2 rounded-[10px] bg-tn-ink text-white hover:opacity-90 transition-opacity"
          >
            {pendingCount === 1 ? 'Add to the report' : `Add ${pendingCount} lines to the reports`}
          </button>
          <span className="text-[12.5px] text-muted">{pendingHours}h in total</span>
        </div>
      )}

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
                  {[r.tag, r.activity].filter(Boolean).join(' · ') || r.jobcodeName}
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
