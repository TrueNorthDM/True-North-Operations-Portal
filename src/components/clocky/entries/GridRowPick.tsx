'use client'

/**
 * The week grid's Add row on the 2026 structure (owner, 28 October 2026): the
 * same picker as Add time (JobPick: the form, My combinations, Recent and
 * Browse), with the combinations and recents of the person whose week it is,
 * not the viewer's. A row is a job and its Activity; its hours are typed in
 * the grid afterwards.
 */

import { useState } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import { fieldsForJob } from '@/components/clocky/clock/clock-model'
import type { Catalog } from './api'
import { EMPTY_VALUES, fieldsOf } from './form'
import { JobPick, type PickState } from './JobPick'
import { gridRowKey, type GridSource } from './model'
import { BTN_MODAL_NAVY, BTN_MODAL_WHITE, CloseButton, Icon, ICON, MODAL_TITLE, Modal, SaveError } from './ui'

/** Whose choices the picker lists: null while they are read. */
export type GridChoices = Pick<Catalog, 'combinations' | 'recents'> & { error?: string }

export function GridRowPick({ catalog, choices, day, whose, combosLabel, taken, onClose, onAdd }: {
  catalog: Catalog
  choices: GridChoices | null
  /** The day the picker offers jobs for: a week across the switch date offers the 2026 projects. */
  day: string
  /** "Your week, Oct 25 to Oct 31." or "Wendy Cacka's week, ..." */
  whose: string
  /** "Wendy Cacka's combinations" on someone else's week. */
  combosLabel?: string
  /** Whether a row of that job and Activity is already in the grid. */
  taken: (key: string) => boolean
  onClose: () => void
  onAdd: (s: GridSource) => void
}) {
  const [s, setS] = useState<PickState & { jobPath: string }>({ jobcodeId: null, jobPath: '', values: { ...EMPTY_VALUES }, notes: '', combo: '' })
  const [error, setError] = useState<string | null>(null)
  const job = catalog.jobs.find(j => j.id === s.jobcodeId)
  const activity = s.values.activity
  // What is already a row is not offered again (as the short list of a TSheets week).
  const fresh = (c: { jobcodeId: number; activity: string }) => !taken(gridRowKey(c.jobcodeId, c.activity))

  const add = () => {
    if (!job || !activity) return
    const key = gridRowKey(job.id, activity)
    if (taken(key)) return setError('That job and Activity is already a row this week.')
    onAdd({ key, jobcodeId: job.id, path: job.path, activity, fields: fieldsOf(s.values, fieldsForJob(catalog.fields, job), job.isI7) })
  }

  return (
    <Modal label="Add a row" width={560} onClose={onClose}>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>Add a row</h2>
          <p className="m-0 text-[13px] text-foreground mt-[5px] leading-normal">{whose} Pick the job and Activity, then type its hours in the grid.</p>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      {choices === null ? (
        <div className="text-[13px] text-muted py-6 text-center">Reading their combinations…</div>
      ) : (
        <>
          {choices.error && <SaveError text={choices.error} />}
          <JobPick catalog={{ ...catalog, combinations: choices.combinations.filter(fresh), recents: choices.recents.filter(fresh) }} day={day} busy={false} hideNotes combosLabel={combosLabel} s={s}
            combosEmpty={choices.combinations.length ? 'Every saved combination is already a row this week.' : 'None saved yet.'}
            set={p => { setS(x => ({ ...x, ...p })); setError(null) }} />
        </>
      )}
      <SaveError text={error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN_MODAL_WHITE}>Cancel</button>
        <button type="button" disabled={!job || !activity} onClick={add}
          className={`${BTN_MODAL_NAVY} disabled:opacity-45 disabled:cursor-not-allowed`}>
          <Icon d={ICON.plus} size={14} color={BTN_ICON.navy} width={3} />Add row
        </button>
      </div>
    </Modal>
  )
}
