'use client'

/**
 * Picking the job of an entry or a request on the 2026 structure, with the
 * clock panel's own first screen (owner, 28 October 2026: the same source of
 * truth for the clock, Add time and Request a time correction): the Client,
 * Division, Project, Activity, Billable form, My combinations, Recent and
 * Browse. A row or Browse fills the form, which opens again with it.
 */

import type { ClockChoice } from '@/lib/timeclock/clocky-types'
import { fieldsForJob, type Draft } from '@/components/clocky/clock/clock-model'
import { ChooseView, OffView } from '@/components/clocky/clock/ClockViews'
import type { Catalog } from './api'
import { EMPTY_VALUES, valuesOf, withCombination, type FieldValues } from './form'
import { Icon, ICON } from './ui'

/** What the picker reads and writes on its form's state. */
export interface PickState {
  jobcodeId: number | null
  values: FieldValues
  notes: string
  /** The row picked ('c<id>', 'r<i>'), '' for none. */
  combo: string
  /** The form's remount key: a row or Browse refills it. */
  formKey?: number
  /** My combinations showing all. */
  more?: boolean
  /** Browse open: its folder and search. */
  browsing?: { folder: number | null; query: string } | null
}

export type PickPatch = Partial<PickState> & { jobPath?: string }

export function JobPick({ catalog, day, busy, s, set, hideNotes = false }: {
  catalog: Catalog
  /** The day the entry is on: what is offered is what that day can record. */
  day: string
  busy: boolean
  s: PickState
  set: (patch: PickPatch) => void
  /** A correction request: its "What happened" stands for the Notes. */
  hideNotes?: boolean
}) {
  // The clock panel's data as of that day.
  const dayData = { ...catalog, today: day, resume: null }
  const nextKey = (s.formKey ?? 0) + 1

  /** The form, complete: the entry takes its project, Activity and notes. */
  const fromDraft = (d: Draft) => {
    const j = catalog.jobs.find(x => x.id === d.jobId)
    set({ jobcodeId: d.jobId, jobPath: j?.path ?? '', values: valuesOf(d.values, fieldsForJob(catalog.fields, j)), notes: d.notes, combo: '' })
  }
  /** A combination or a recent row. */
  const fromChoice = (c: ClockChoice, key: string) => {
    const w = withCombination(c, fieldsForJob(catalog.fields, catalog.jobs.find(j => j.id === c.jobcodeId)))
    set({ combo: key, jobcodeId: w.jobcodeId, jobPath: c.path, values: w.values, notes: s.notes || c.notes, formKey: nextKey })
  }

  if (s.browsing) {
    const b = s.browsing
    return (
      <div className="flex flex-col gap-3">
        <button type="button" onClick={() => set({ browsing: null })}
          className="self-start inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[12.5px] font-bold text-tn-teal hover:text-tn-ink">
          <Icon d={ICON.left} size={13} />Back to the form
        </button>
        <ChooseView data={dayData} day={day} phone={false} first={false} query={b.query} browse={b.folder}
          onQuery={q => set({ browsing: { folder: b.folder, query: q } })}
          onBrowse={id => set({ browsing: { folder: id, query: b.query } })}
          onPick={id => {
            const j = catalog.jobs.find(x => x.id === id)
            set({ jobcodeId: id, jobPath: j?.path ?? '', values: { ...EMPTY_VALUES }, combo: '', browsing: null, formKey: nextKey })
          }} />
      </div>
    )
  }
  return (
    <OffView data={dayData} phone={false} more={!!s.more} busy={busy} draft={null} hideNotes={hideNotes}
      switching={{ picked: s.combo || null, jobcodeId: null, activity: '', action: 'pick' }}
      formKey={String(s.formKey ?? 0)} formInitial={{ jobId: s.jobcodeId, activity: s.values.activity, notes: s.notes }}
      onFormPick={d => (d ? fromDraft(d) : set({ jobcodeId: null, combo: '' }))}
      onStart={fromChoice}
      onToggleMore={() => set({ more: !s.more })}
      onBrowse={() => set({ browsing: { folder: null, query: '' } })}
      onResume={() => {}} onClockIn={() => {}} onPickProject={() => {}} onField={() => {}} onNotes={() => {}} onGo={() => {}} onSaveDraft={() => {}} />
  )
}
