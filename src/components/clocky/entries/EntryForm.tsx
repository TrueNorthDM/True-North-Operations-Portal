'use client'

/**
 * 3E, "Add time" / "Edit entry" (Time Entries.dc.html, frames 3E1 to 3E3):
 * the person, a combination, Start and end or a Duration, the job and its
 * fields, notes, and a required reason. The line under the times checks as
 * you type (end after start, 24 hours, overlaps, shorten only); Save sends it,
 * and an overlap the server finds opens 3F.
 */

import { BTN_ICON } from '@/lib/ui/buttons'
import { Segmented } from '@/components/ui/Segmented'
import { dayLabel, minutesLabel } from '@/lib/timeclock/format'
import { overlapLine } from '@/lib/timeclock/entry-rules'
import { localMinutes } from '@/lib/timeclock/format'
import type { EntryView } from '@/lib/timeclock/clocky-types'
import type { Catalog } from './api'
import { fieldsForJob, jobsOn, optionsOf } from '@/components/clocky/clock/clock-model'
import { BillableFromProject } from '@/components/clocky/clock/ClockViews'
import { FIELD_ORDER, formJob, formSpan, overlapAmong, withCombination, withJob, type FormState } from './form'
import { QUARTERS, checkLine, nameFor, weekStartOf, type Check } from './model'
import { addDays } from '@/lib/timeclock/periods'
import {
  BTN_FORM_SAVE, BTN_MODAL_WHITE, CloseButton, FieldLabel, Icon, ICON, LabeledSelect, MODAL_TITLE, Modal, ReadOnlyField, TEXTAREA_PLAIN, TEXTAREA_WARN,
} from './ui'

const timeOption = (m: number) => ({ value: String(m), label: minutesLabel(m) })

/** The check line, with what the rows on screen say about overlaps. */
export function formCheck(f: FormState, rows: readonly EntryView[], catalog: Pick<Catalog, 'combinations'>, nowMs: number): Check {
  const span = formSpan(f, nowMs)
  const o = span && Date.parse(span.end) > Date.parse(span.start)
    ? overlapAmong(span, f.personId, rows, f.id !== null ? `e${f.id}` : null, nowMs)
    : null
  const nowMinutes = localMinutes(new Date(nowMs), f.zone)
  const base = { type: f.type, start: f.start, end: f.end, nowMinutes, durText: f.dur, bounds: f.bounds }
  const seconds = span ? (Date.parse(span.end) - Date.parse(span.start)) / 1000 : 0
  const overlapText = o && !f.fix ? overlapLine(seconds, { start: o.start, end: o.end }, nameFor(o.row, catalog.combinations), f.zone) : null
  const c = checkLine({ ...base, overlapText })
  if (f.error) return { ...c, text: f.error, bad: true }
  if (f.fixNote && !c.bad) return { ...c, text: f.fixNote }
  return c
}

export function EntryForm({ form, setForm, catalog, people, pickPerson, leader, viewerId, rows, nowMs, busy, onClose, onSave, onDelete, onRequestInstead }: {
  form: FormState
  setForm: (patch: Partial<FormState>) => void
  catalog: Catalog
  /** The Person picker (Add time in All): everyone the viewer may add for. */
  people: { id: string; name: string; zone: string }[]
  pickPerson: boolean
  leader: boolean
  viewerId: string
  rows: readonly EntryView[]
  nowMs: number
  busy: boolean
  onClose: () => void
  onSave: () => void
  onDelete: () => void
  onRequestInstead: () => void
}) {
  const f = form
  const check = formCheck(f, rows, catalog, nowMs)
  const job = catalog.jobs.find(j => j.id === f.jobcodeId)
  const isI7 = job?.isI7 ?? /^2 - i7/.test(f.jobPath)
  // The fields of the job's structure: a 2026 project asks only its Activity; its Billable is shown.
  const defs = fieldsForJob(catalog.fields, formJob(f, catalog.jobs))
  const shownFields = defs
    .filter(d => d.required === 'always' || isI7)
    .sort((a, b) => FIELD_ORDER.indexOf(a.key) - FIELD_ORDER.indexOf(b.key))
  const overlapOnly = check.bad && !f.error && !check.shortenOnly && /Overlaps /.test(check.text)
  const disabled = busy || !f.jobcodeId || !(check.seconds > 0) || check.seconds > 86400 || (check.bad && !overlapOnly && !f.error) || !f.reason.trim()

  const week = weekStartOf(f.date)
  const dateOptions = (leader ? Array.from({ length: 7 }, (_, i) => addDays(week, i)) : [f.date]).map(d => ({ value: d, label: dayLabel(d) }))

  const b = f.bounds
  const inside = (m: number) => !b || b.seconds !== null || ((b.start === null || m >= b.start) && (b.end === null || m <= b.end))
  const times = QUARTERS.filter(inside).map(timeOption)
  const endTimes = f.running && (!b || b.end === null) ? [{ value: 'now', label: 'now' }, ...times] : times

  // The jobs of the entry's day: the TSheets ones before the switch date, the 2026 projects from it.
  const jobOptions = jobsOn(catalog.jobs, f.date, catalog.switchDate).map(j => ({ value: String(j.id), label: j.path }))
  if (f.jobcodeId && !job) jobOptions.unshift({ value: String(f.jobcodeId), label: f.jobPath })
  const comboOptions = catalog.combinations.map((c, i) => ({ value: String(c.combinationId ?? `r${i}`), label: c.name ?? c.label }))

  const first = f.personName.split(' ')[0]
  const reasonPh = f.id === null ? 'Why are you adding this time?' : f.personId !== viewerId ? `You are editing ${first}'s hours. Say why.` : 'Why are you changing this entry?'
  const types = leader ? [{ key: 'range' as const, label: 'Start and end' }, { key: 'dur' as const, label: 'Duration' }]
    : [{ key: f.type, label: f.type === 'range' ? 'Start and end' : 'Duration' }]

  return (
    <Modal label={f.id === null ? 'Add time' : 'Edit entry'} width={580} onClose={onClose}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>{f.id === null ? 'Add time' : 'Edit entry'}</h2>
        <CloseButton onClick={onClose} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {pickPerson && f.id === null
          ? <LabeledSelect label="Person" value={f.personId} search options={people.map(p => ({ value: p.id, label: p.name }))}
              onChange={v => { const p = people.find(x => x.id === v); setForm({ personId: v, personName: p?.name ?? '', zone: p?.zone ?? f.zone, error: null }) }} />
          : <ReadOnlyField label="Person" value={f.personName} />}
        <LabeledSelect label="Use a combination" value={f.combo} options={comboOptions} placeholder="Fills the fields below"
          onChange={v => {
            const c = catalog.combinations.find((x, i) => String(x.combinationId ?? `r${i}`) === v)
            if (!c) return
            const w = withCombination(c, fieldsForJob(catalog.fields, catalog.jobs.find(j => j.id === c.jobcodeId)))
            setForm({ combo: v, jobcodeId: w.jobcodeId, jobPath: c.path, values: w.values, auto: {}, error: null })
          }} />
      </div>

      <div className="flex items-center gap-2.5">
        <FieldLabel>Type</FieldLabel>
        <Segmented label="Type" display="px-3 py-1.5 text-[12.5px]" options={types} value={f.type} onChange={k => setForm({ type: k, error: null, fix: null, fixNote: null })} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <LabeledSelect label="Date" value={f.date} options={dateOptions} onChange={v => setForm({ date: v, error: null, fix: null, fixNote: null })} />
        {f.type === 'range' ? (
          <>
            <LabeledSelect label="Start" value={String(f.start)} options={times} search onChange={v => setForm({ start: Number(v), error: null, fix: null, fixNote: null })} />
            <LabeledSelect label="End" value={String(f.end)} options={endTimes} search onChange={v => setForm({ end: v === 'now' ? 'now' : Number(v), error: null, fix: null, fixNote: null })} />
          </>
        ) : (
          <label className="flex flex-col gap-[5px] min-w-0">
            <span className="flex items-center min-h-4"><FieldLabel>Duration</FieldLabel></span>
            <input value={f.dur} onChange={e => setForm({ dur: e.target.value, error: null })} placeholder="2h 30m"
              className="h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-(family-name:--font-display) font-bold text-[13px] text-tn-ink outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]" />
          </label>
        )}
      </div>
      <div role={check.bad ? 'alert' : undefined} className={`-mt-1 text-[12.5px] font-semibold tabular-nums lining-nums ${check.bad ? 'text-[#c8323d]' : 'text-muted'}`}>{check.text}</div>
      {!leader && check.shortenOnly && (
        <button type="button" onClick={onRequestInstead} className="self-start -mt-2 border-0 bg-transparent p-0 text-[12.5px] font-bold text-tn-teal hover:text-tn-ink">
          Request a time correction instead
        </button>
      )}

      <LabeledSelect label={job?.structure === 2 ? 'Project' : 'Job'} value={f.jobcodeId ? String(f.jobcodeId) : ''} options={jobOptions} search placeholder="Search jobs"
        onChange={v => {
          const id = Number(v)
          const j = catalog.jobs.find(x => x.id === id)
          const w = withJob(f.values, id, !!j?.isI7, catalog.defaults, fieldsForJob(catalog.fields, j))
          setForm({ jobcodeId: id, jobPath: j?.path ?? '', values: w.values, auto: w.auto, combo: '', error: null })
        }} />

      <div className="grid grid-cols-2 gap-3">
        {shownFields.map(d => {
          const value = f.values[d.key] ?? ''
          const options: { value: string; label: string; group?: string }[] = optionsOf(d)
          if (value && !d.options.includes(value)) options.unshift({ value, label: value })
          const search = d.key === 'activity' || d.key === 'code'
          return (
            <LabeledSelect key={d.id} label={d.label} value={value} options={options} search={search} auto={!!f.auto[d.key]}
              placeholder={d.key === 'activity' ? 'Search activities' : 'Choose'}
              onChange={v => setForm({ values: { ...f.values, [d.key]: v }, auto: { ...f.auto, [d.key]: false }, error: null })} />
          )
        })}
        {job?.structure === 2 && <BillableFromProject billable={job.billable} />}
      </div>

      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Notes</FieldLabel>
        <textarea value={f.notes} onChange={e => setForm({ notes: e.target.value })} rows={2} className={TEXTAREA_PLAIN} />
      </label>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel warn>Reason for the change (required)</FieldLabel>
        <textarea value={f.reason} onChange={e => setForm({ reason: e.target.value })} rows={2} placeholder={reasonPh} className={TEXTAREA_WARN} />
      </label>

      <div className="flex items-center gap-2 mt-0.5">
        {f.id !== null && (
          <button type="button" onClick={onDelete}
            className="inline-flex items-center gap-[7px] border-0 bg-transparent px-1 py-2 font-(family-name:--font-display) font-extrabold text-[13px] text-[#c8323d]">
            <Icon d={ICON.trash} size={15} />Delete
          </button>
        )}
        <span className="flex-1" />
        <button type="button" onClick={onClose} className={BTN_MODAL_WHITE}>Cancel</button>
        <button type="button" onClick={onSave} disabled={disabled}
          className={`${BTN_FORM_SAVE} disabled:opacity-45 disabled:cursor-not-allowed`}>
          <Icon d={ICON.check} size={14} color={BTN_ICON.navy} width={3} />Save
        </button>
      </div>
    </Modal>
  )
}
