'use client'

/**
 * 3K-1, "Request to add time" (Time Entries.dc.html, frame 3K1): a day
 * of this week, a start and an end on the quarter hour, a combination or a
 * job and its Activity, and "What happened". From the switch date the job is
 * picked with the clock panel's own first screen (JobPick, as in Add time),
 * without its Notes: "What happened" says it. It may not overlap an entry; it
 * counts only once approved; the line at the foot says who it goes to.
 */

import { BTN_ICON } from '@/lib/ui/buttons'
import { wallToInstant } from '@/lib/timeclock/clock'
import { addDays } from '@/lib/timeclock/periods'
import { dayLabel, minutesLabel } from '@/lib/timeclock/format'
import { correctionOverlapLine, END_AFTER_START, structureOn } from '@/lib/timeclock/entry-rules'
import { fieldsForJob, jobsOn, optionsOf, sortedOptions } from '@/components/clocky/clock/clock-model'
import { formatDuration } from '@/lib/timeclock/rounding'
import type { EntryView } from '@/lib/timeclock/clocky-types'
import type { Catalog } from './api'
import { EMPTY_VALUES, overlapAmong, withCombination, withJob, type RequestState } from './form'
import { JobPick, type PickPatch } from './JobPick'
import { QUARTERS, hhmmOf, nameFor } from './model'
import { BTN_MODAL_NAVY, BTN_MODAL_WHITE, CloseButton, FieldLabel, Icon, ICON, LabeledSelect, MODAL_TITLE, Modal, SaveError, TEXTAREA_WARN } from './ui'

/** What a request keeps of the picker's change: the job, its Activity and the picker's own state (no path, no notes). */
function requestPart(p: PickPatch): Partial<RequestState> {
  const keys = ['jobcodeId', 'values', 'combo', 'formKey', 'more', 'browsing'] as const
  return Object.fromEntries(keys.filter(k => k in p).map(k => [k, p[k]])) as Partial<RequestState>
}

/** The check line of 3K-1, from the rows on screen. */
export function requestCheck(q: RequestState, personId: string, zone: string, rows: readonly EntryView[], catalog: Pick<Catalog, 'combinations'>, nowMs: number): { text: string; bad: boolean } {
  const d = (q.end - q.start) * 60
  if (!(d > 0)) return { text: END_AFTER_START, bad: true }
  const start = wallToInstant(q.date, hhmmOf(q.start), zone)
  const end = wallToInstant(q.date, hhmmOf(q.end), zone)
  const o = start && end ? overlapAmong({ start, end }, personId, rows, null, nowMs) : null
  if (o) return { text: correctionOverlapLine({ start: o.start, end: o.end }, nameFor(o.row, catalog.combinations), zone), bad: true }
  return { text: `${formatDuration(d)} requested.`, bad: false }
}

export function CorrectionRequest({ rq, setRq, catalog, today, personId, zone, rows, nowMs, busy, onClose, onSend }: {
  rq: RequestState
  setRq: (patch: Partial<RequestState>) => void
  catalog: Catalog
  today: string
  personId: string
  zone: string
  rows: readonly EntryView[]
  nowMs: number
  busy: boolean
  onClose: () => void
  onSend: () => void
}) {
  // The check line stays on the times; why a send was refused shows at the foot (SaveError).
  const check = requestCheck(rq, personId, zone, rows, catalog, nowMs)
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map(d => ({ value: d, label: dayLabel(d) }))
  const times = QUARTERS.map(m => ({ value: String(m), label: minutesLabel(m) }))
  const job = catalog.jobs.find(j => j.id === rq.jobcodeId)
  // The Activity of the job's structure (of the day's, before a job is picked).
  const activity = fieldsForJob(catalog.fields, job ?? { structure: structureOn(rq.date, catalog.switchDate) }).find(f => f.key === 'activity')
  const comboOptions = sortedOptions(catalog.combinations.map((c, i) => ({ value: String(c.combinationId ?? `r${i}`), label: c.name ?? c.label })))
  const s2 = structureOn(rq.date, catalog.switchDate) === 2
  const disabled = busy || check.bad || !rq.jobcodeId || (s2 && !rq.values.activity) || !rq.reason.trim()

  return (
    <Modal label="Request to add time" width={560} onClose={onClose}>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>Request to add time</h2>
          <p className="m-0 text-[13px] text-foreground mt-[5px] leading-normal">For time you worked but could not clock. It counts only after it is approved.</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {/* A day on the other side of the switch date asks the other structure: the job picked goes. */}
        <LabeledSelect label="Date" value={rq.date} options={days} onChange={v => setRq({
          date: v, error: null,
          ...(structureOn(v, catalog.switchDate) !== structureOn(rq.date, catalog.switchDate) ? { jobcodeId: null, values: { ...EMPTY_VALUES }, combo: '', browsing: null, formKey: (rq.formKey ?? 0) + 1 } : {}),
        })} />
        <LabeledSelect label="Start" value={String(rq.start)} options={times} search onChange={v => setRq({ start: Number(v), error: null })} />
        <LabeledSelect label="End" value={String(rq.end)} options={times} search onChange={v => setRq({ end: Number(v), error: null })} />
      </div>
      <div role={check.bad ? 'alert' : undefined} className={`-mt-1 text-[12.5px] font-semibold tabular-nums lining-nums ${check.bad ? 'text-[#c8323d]' : 'text-muted'}`}>{check.text}</div>
      {s2 ? (
        // The clock panel's first screen, picking (JobPick), as in Add time.
        <JobPick catalog={catalog} day={rq.date} busy={busy} hideNotes s={{ ...rq, notes: '' }}
          // A request keeps the job and its Activity; it has no path or notes of its own.
          set={p => setRq({ ...requestPart(p), error: null })} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <LabeledSelect label="Use a combination" value={rq.combo} options={comboOptions} placeholder="Fills job and Activity"
              onChange={v => {
                const c = catalog.combinations.find((x, i) => String(x.combinationId ?? `r${i}`) === v)
                if (!c) return
                const w = withCombination(c, fieldsForJob(catalog.fields, catalog.jobs.find(j => j.id === c.jobcodeId)))
                setRq({ combo: v, jobcodeId: w.jobcodeId, values: w.values, error: null })
              }} />
            <LabeledSelect label={activity?.label ?? '3 Activity'} value={rq.values.activity} search placeholder="Search activities"
              options={activity ? optionsOf(activity) : []}
              onChange={v => setRq({ values: { ...rq.values, activity: v }, error: null })} />
          </div>
          <LabeledSelect label="Job" value={rq.jobcodeId ? String(rq.jobcodeId) : ''} search placeholder="Search jobs"
            options={sortedOptions(jobsOn(catalog.jobs, rq.date, catalog.switchDate).map(j => ({ value: String(j.id), label: j.path })))}
            onChange={v => {
              const id = Number(v)
              const j = catalog.jobs.find(x => x.id === id)
              setRq({ jobcodeId: id, values: withJob(rq.values, id, !!j?.isI7, catalog.defaults, fieldsForJob(catalog.fields, j)).values, combo: '', error: null })
            }} />
        </>
      )}
      <label className="flex flex-col gap-[5px]">
        <FieldLabel warn>What happened (required)</FieldLabel>
        <textarea value={rq.reason} onChange={e => setRq({ reason: e.target.value })} rows={3} placeholder="Why this time is missing, and what you worked on" className={TEXTAREA_WARN} />
      </label>
      <div className="flex items-center gap-2 text-[12.5px] text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-[10px] px-3 py-[9px]">
        <Icon d={ICON.send} size={14} /><span>{catalog.correctionGoesTo}</span>
      </div>
      <SaveError text={rq.error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN_MODAL_WHITE}>Cancel</button>
        <button type="button" disabled={disabled} onClick={onSend}
          className={`${BTN_MODAL_NAVY} disabled:opacity-45 disabled:cursor-not-allowed`}>
          <Icon d={ICON.send} size={14} color={BTN_ICON.navy} width={2.4} />Send request
        </button>
      </div>
    </Modal>
  )
}
