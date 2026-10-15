'use client'

/**
 * The fields of ManualHours: who, which day, how many hours, and the job the
 * way QuickBooks Time asks for it. It holds no state of its own: the form
 * comes in as one value and every change goes back out through `patch`.
 */

import { Select } from '@/components/ui/Select'
import { MAX_HOURS_PER_ENTRY } from '@/lib/timeclock/manual-entry'
import { monthName } from '@/lib/timeclock/periods'
import { shouldWarnRate, type ManualForm, type ManualOptions } from './manual-hours'

// The answers read heavier than the labels, because the answers are what
// somebody scans back over to check the line before sending it. Placeholders
// stay light: an absent answer should not weigh the same as a given one.
const FIELD = 'w-full rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2 text-[13.5px] text-tn-ink font-semibold placeholder:font-normal'
// The same box for the dropdowns. Six of the ten fields were bare text with a
// chevron while four had a white box, so more than half of them did not look
// like fields at all, and the panel read as flat. No text colour here: the
// Select paints its own value and placeholder.
const FIELD_SELECT = 'w-full rounded-[10px] border border-[var(--panel-border)] bg-white px-3 py-2 text-[13.5px]'
const LABEL = 'block text-[11px] font-bold uppercase tracking-wider text-muted mb-1.5'

export function ManualHoursForm({ options, month, form, patch, onStage, busy }: {
  options: ManualOptions
  month: string
  form: ManualForm
  patch: (p: Partial<ManualForm>) => void
  /** Moves the typed line into the staged list. */
  onStage: () => void
  busy: boolean
}) {
  const { personId, entryDate, topId, jobcodeId, hours, i7Code, activity, company, project, billable, notes } = form
  const chosen = options.people.find(p => p.id === personId)
  const top = options.tops.find(t => t.id === topId)
  const jobs = topId ? options.jobsByTop[topId] ?? [] : []
  const warnRate = shouldWarnRate(chosen, top)

  return (
    <div className="border border-[var(--panel-border)] rounded-[12px] p-4 mb-4 bg-subtle">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className={LABEL}>Person</label>
          <Select
            strongValue
            className={FIELD_SELECT}
            value={personId}
            onChange={v => patch({ personId: v })}
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
          <label htmlFor="manual-day" className={LABEL}>Day</label>
          <input id="manual-day" type="date" value={entryDate} onChange={e => patch({ entryDate: e.target.value })} className={FIELD} />
        </div>

        <div>
          <label htmlFor="manual-hours" className={LABEL}>Hours</label>
          <input
            id="manual-hours"
            type="number" step="0.25" min="0" max={MAX_HOURS_PER_ENTRY}
            value={hours} onChange={e => patch({ hours: e.target.value })}
            placeholder="0.00" className={FIELD}
          />
        </div>

        <div>
          <label className={LABEL}>Job, top</label>
          <Select
            strongValue
            className={FIELD_SELECT}
            value={topId}
            // Picking a different root empties the fields below it: the
            // disciplines are the root's own, and the middle of the form
            // may swap entirely. Leaving a stale choice sitting there is
            // how an hour gets filed under a code from the other branch.
            onChange={v => patch({ topId: v, jobcodeId: '', i7Code: '', company: '', project: '' })}
            searchable fullWidth ariaLabel="Job, top"
            options={options.tops.map(t => ({ value: t.id, label: t.name }))}
            placeholder="Choose…"
          />
        </div>

        <div>
          <label className={LABEL}>Job</label>
          <Select
            strongValue
            className={FIELD_SELECT}
            value={jobcodeId}
            onChange={v => patch({ jobcodeId: v })}
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
            <label className={LABEL}>1 - i7 Code</label>
            <Select
              strongValue
              className={FIELD_SELECT}
              value={i7Code} onChange={v => patch({ i7Code: v })} searchable fullWidth ariaLabel="i7 code"
              options={options.i7Codes.map(c => ({ value: c.code, label: c.code, group: c.project }))}
              placeholder="Choose…"
            />
          </div>
        )}

        {top?.branch === 'project' && (
          <div>
            <label className={LABEL}>1 Company</label>
            <Select
              strongValue
              className={FIELD_SELECT}
              value={company} onChange={v => patch({ company: v })} fullWidth ariaLabel="Company"
              options={options.companies.map(c => ({ value: c, label: c }))}
              placeholder="Choose…"
            />
          </div>
        )}

        {top?.branch === 'project' && (
          <div>
            <label className={LABEL}>2 Project</label>
            <Select
              strongValue
              className={FIELD_SELECT}
              value={project} onChange={v => patch({ project: v })} fullWidth ariaLabel="Project"
              options={options.projects.map(c => ({ value: c, label: c }))}
              placeholder="Choose…"
            />
          </div>
        )}

        <div>
          <label className={LABEL}>3 Activity</label>
          <Select
            strongValue
            className={FIELD_SELECT}
            value={activity} onChange={v => patch({ activity: v })} searchable fullWidth ariaLabel="Activity"
            options={options.activities.map(a => ({ value: a, label: a }))}
            placeholder="Choose…"
          />
        </div>

        {options.billable.length > 0 && (
          <div>
            <label className={LABEL}>4 Billable</label>
            <Select
              strongValue
              className={FIELD_SELECT}
              value={billable} onChange={v => patch({ billable: v })} fullWidth ariaLabel="Billable"
              options={options.billable.map(b => ({ value: b, label: b }))}
              placeholder="Choose…"
            />
          </div>
        )}

        <div className="sm:col-span-3">
          <label htmlFor="manual-note" className={LABEL}>Note (optional)</label>
          <input
            id="manual-note"
            value={notes} onChange={e => patch({ notes: e.target.value })}
            placeholder="Invoice number, or what the hours were for"
            className={FIELD}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onStage}
        disabled={busy}
        className="mt-4 text-[13px] font-semibold px-4 py-2 rounded-[10px] border border-dashed border-[var(--panel-border)] text-tn-ink hover:bg-[var(--row-hover)] transition-colors"
      >
        + Add another line
      </button>
    </div>
  )
}
