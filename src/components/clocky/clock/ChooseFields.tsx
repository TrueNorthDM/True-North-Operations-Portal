'use client'

/**
 * What you are working on, picked field by field, always on the panel's first
 * screen as David's structure defines it: Client, Division, Project, Activity,
 * Billable (set by the project, shown only) and Notes. Every field but Notes
 * must be picked; Notes are asked only when the Activity says so ("Other",
 * "Meeting: Other"). Each field narrows the next: a Division lists the
 * Client's divisions, a Project the Division's projects. Clock in, or keep the
 * choice as a combination.
 */

import { useState } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import { activityNeedsNotes } from '@/lib/timeclock/entry-rules'
import type { ClockPanelData } from '@/lib/timeclock/clocky-types'
import { clientsOf, divisionsOf, draftFor, fieldByKey, jobsOn, optionsOf, placeOf, projectsOf, stillToPick, type Draft } from './clock-model'
import { BillableFromProject } from './ClockViews'
import { CK_BTN_NAVY, CK_BTN_WHITE, ClockField, FOCUS, ICON, INPUT_FOCUS, Icon, PlayIcon, SectionLabel } from './ClockParts'

/** A field that cannot be picked yet: drawn like Billable, with why. */
function LockedField({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex flex-col gap-[5px] min-w-0">
      <div className="flex items-center gap-1.5 min-h-4"><SectionLabel>{label}</SectionLabel></div>
      <div className="h-10 px-3 flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] font-sans text-[12.5px] text-muted overflow-hidden whitespace-nowrap text-ellipsis">{text}</div>
    </div>
  )
}

export function ChooseFields({ data, busy, onClockIn, onSaveAs, onPick }: {
  data: ClockPanelData
  busy: boolean
  /** Switching: no Clock in here; each complete choice (or null once it is not) goes up to the Switch button at the top. */
  onPick?: (d: Draft | null) => void
  /** Clock in with this choice. */
  onClockIn: (d: Draft) => void
  /** Keep the choice as a combination: the panel's save window opens with it. */
  onSaveAs: (d: Draft) => void
}) {
  const todays = jobsOn(data.jobs, data.today, data.switchDate)
  const [client, setClient] = useState('')
  const [division, setDivision] = useState('')
  const [jobId, setJobId] = useState<number | null>(null)
  const [activity, setActivity] = useState('')
  const [notes, setNotes] = useState('')

  const clients = clientsOf(todays)
  const divisions = client ? divisionsOf(todays, client) : []
  const hasDivisions = divisions.length > 0
  const projects = client && (!hasDivisions || division) ? projectsOf(todays, client, division) : []
  const job = data.jobs.find(j => j.id === jobId)
  const activityField = fieldByKey(data.fields, 'activity', job ?? { structure: 2 })
  const missing = stillToPick({ client, division, hasDivisions, jobId, activity, notes })
  const ready = missing.length === 0
  const notesRequired = !!activity && activityNeedsNotes(activity)

  // Switching: tell the panel what the form now says, from the values just picked.
  const report = (n: Partial<{ client: string; division: string; jobId: number | null; activity: string; notes: string }>) => {
    if (!onPick) return
    const s = { client, division, jobId, activity, notes, ...n }
    const j = data.jobs.find(x => x.id === s.jobId)
    const hasDiv = !!s.client && divisionsOf(todays, s.client).length > 0
    onPick(j && stillToPick({ ...s, hasDivisions: hasDiv }).length === 0 ? draftFor(data, j, { activity: s.activity, notes: s.notes }) : null)
  }
  const pickClient = (v: string) => { setClient(v); setDivision(''); setJobId(null); setActivity(''); report({ client: v, division: '', jobId: null, activity: '' }) }
  const pickDivision = (v: string) => { setDivision(v); setJobId(null); setActivity(''); report({ division: v, jobId: null, activity: '' }) }
  const pickProject = (id: number) => { setJobId(id); setActivity(''); report({ jobId: id, activity: '' }) }
  const pickActivity = (v: string) => { setActivity(v); report({ activity: v }) }
  const typeNotes = (v: string) => { setNotes(v); report({ notes: v }) }
  const draft = (): Draft | null => (job ? draftFor(data, job, { activity, notes }) : null)
  const clockIn = () => { const d = draft(); if (d && ready) { onClockIn(d) } }
  const saveAs = () => { const d = draft(); if (d && ready) onSaveAs(d) }

  return (
    <>
    {/* Every client, division and project with when to use it, for whoever is unsure (owner: make it obvious). */}
    <a href="/clocky-hours/which-job" className={`group flex items-center gap-3 rounded-[12px] border border-[#cfe5e5] bg-[#eaf4f4] px-3.5 py-2.5 no-underline hover:border-tn-teal ${FOCUS}`}>
      <span className="grid place-items-center shrink-0 w-8 h-8 rounded-full bg-tn-teal text-[#ffffff]" aria-hidden="true">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
      </span>
      <span className="flex-1 min-w-0">
        <b className="block font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">Not sure what to pick?</b>
        <span className="block text-[12px] text-muted leading-[1.4]">See every client, division and project with when to use it.</span>
      </span>
      <span className="shrink-0 text-tn-teal text-[18px] font-bold transition-transform group-hover:translate-x-0.5" aria-hidden="true">→</span>
    </a>
    <div className="flex flex-col gap-3 border border-[var(--panel-border)] rounded-[14px] p-3.5 bg-[#fbfaf7]">
      <SectionLabel>What are you working on?</SectionLabel>
      <div className="grid grid-cols-2 gap-3">
        <ClockField label="Client" value={client} placeholder="Choose" options={clients} onChange={pickClient} />
        {!client
          ? <LockedField label="Division" text="Pick the client first" />
          : hasDivisions
            ? <ClockField label="Division" value={division} placeholder="Choose" options={divisions} onChange={pickDivision} />
            : <LockedField label="Division" text={`Not used for ${client}`} />}
      </div>

      {client && (!hasDivisions || division)
        ? <ClockField label="Project" value={job ? String(job.id) : ''} placeholder="Choose" search
            options={projects.map(j => ({ value: String(j.id), label: placeOf(j.path).project }))} onChange={v => pickProject(Number(v))} />
        : <LockedField label="Project" text={client ? 'Pick the division first' : 'Pick the client first'} />}

      <div className="grid grid-cols-2 gap-3">
        {job && activityField
          ? <ClockField label="Activity" value={activity} placeholder="Search activities" search options={optionsOf(activityField)} onChange={pickActivity} />
          : <LockedField label="Activity" text="Pick the project first" />}
        {job ? <BillableFromProject billable={job.billable} /> : <LockedField label="Billable" text="Set by the project" />}
      </div>

      <label className="flex flex-col gap-[5px]">
        <SectionLabel>{notesRequired ? 'Notes (required for this Activity)' : 'Notes (optional)'}</SectionLabel>
        <textarea value={notes} onChange={e => typeNotes(e.target.value)} rows={2} placeholder="What are you working on?" aria-label="Notes"
          className={`w-full box-border resize-y px-3 py-2.5 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink placeholder:text-muted ${INPUT_FOCUS}`} />
      </label>

      {!ready && <div className="text-[12px] text-muted leading-[1.5]">{`Still to pick: ${missing.join(', ')}.`}</div>}
      <div className="flex items-center gap-2 flex-wrap">
        {!onPick && (
          <button type="button" onClick={clockIn} disabled={!ready || busy} className={`${CK_BTN_NAVY} disabled:opacity-60 ${FOCUS}`}>
            <PlayIcon size={14} color={BTN_ICON.navy} />Clock in
          </button>
        )}
        <button type="button" onClick={saveAs} disabled={!ready || busy} className={`${CK_BTN_WHITE} disabled:opacity-60 ${FOCUS}`}>
          <Icon d={ICON.star} size={15} stroke={BTN_ICON.white} sw={2} cap="butt" />Save as combination
        </button>
      </div>
    </div>
    </>
  )
}
