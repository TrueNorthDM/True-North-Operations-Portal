'use client'

/**
 * The clock panel's bodies, one per mode (Clock Panel.dc.html): off the clock
 * (1A), choosing a job (1B, 1C, 1C-b), the details before clocking in (1D), on
 * the clock (1E, with 1F, 1I and the notes that save themselves), and the
 * automatic stop waiting for its real end time (1L). Presentational: the
 * panel (ClockPanel.tsx) holds the state and calls the server.
 */

import { BTN_ICON } from '@/lib/ui/buttons'
import type { ClockChoice, ClockPanelData, RunningEntry, ToConfirm } from '@/lib/timeclock/clocky-types'
import { activityNeedsNotes, type FieldName, type MissingName } from '@/lib/timeclock/entry-rules'
import { timeLabel } from '@/lib/timeclock/format'
import { limitAheadText } from '@/lib/timeclock/allowance'
import { formatClock, formatDuration, formatTimer } from '@/lib/timeclock/rounding'
import {
  FIELD_SHORT, SHOWN_COMBINATIONS, billableText, breakdown, browseJobs, choiceRow, lineOf, fieldByKey, jobsOn, keysFor, liveTotals, optionsOf,
  overWarn, resumeCard, roundNoteText, searchJobs, switchChoices, timerStart, valueOf, type Draft,
} from './clock-model'
import { BTN_DANGER, BTN_WHITE_DANGER, CK_BTN_NAVY, CK_BTN_NAVY_FLAT, CK_BTN_WHITE, byWidth, type Phone, ChoiceRowView, ClockField, FOCUS, ICON, INPUT_FOCUS, Icon, LINK_BTN, PlayIcon, SearchInput, SectionLabel, StopIcon } from './ClockParts'


// ── Alerts at the top of the body ───────────────────────────────────────────

export function OfflineBanner() {
  return (
    <div role="status" className="flex gap-2.5 items-center rounded-[11px] bg-[#fdf8e7] border border-[#f0e2a8] px-3 py-2.5 text-[12.5px] text-tn-ink font-semibold leading-[1.4]">
      <Icon d={ICON.offline} size={17} stroke="#8a6d1a" sw={2} className="shrink-0" />
      <span>Offline. Your clock is safe; it will sync when you are back.</span>
    </div>
  )
}

/** The red line of 1N (a locked period), and of any refusal the server sends back. */
export function ErrorBanner({ text }: { text: string }) {
  return (
    <div role="alert" className="flex gap-2.5 items-center rounded-[11px] bg-[#fdeeef] border border-[#f3c6ca] px-3 py-2.5 text-[12.5px] text-[#c8323d] font-bold leading-[1.4]">
      <Icon d={ICON.lock} size={17} sw={2} className="shrink-0" />
      <span>{text}</span>
    </div>
  )
}

// ── 1A Off the clock ────────────────────────────────────────────────────────

export function OffView({ data, phone, more, busy, query, onQuery, onToggleMore, onResume, onStart, onSave, onManage, onBrowse }: {
  data: ClockPanelData
  phone: Phone
  more: boolean
  busy: boolean
  query: string
  onQuery: (q: string) => void
  onToggleMore: () => void
  onResume: () => void
  onStart: (c: ClockChoice) => void
  onSave: (c: ClockChoice) => void
  onManage: () => void
  onBrowse: () => void
}) {
  const resume = data.resume ? resumeCard(data.resume) : null
  const combos = more ? data.combinations : data.combinations.slice(0, SHOWN_COMBINATIONS)
  return (
    <>
      {resume && (
        <div className="border border-[#cfe5e5] bg-tn-teal-soft rounded-[14px] p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between"><SectionLabel className="text-tn-teal">Resume</SectionLabel></div>
          <div>
            <div className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">{resume.title}</div>
            <div className="text-[12.5px] text-foreground mt-1 leading-[1.45]">{resume.line}</div>
          </div>
          {phone !== true && (
            <button type="button" onClick={onResume} disabled={busy} className={`${CK_BTN_NAVY} self-start disabled:opacity-60 ${FOCUS}${phone === 'css' ? ' max-md:hidden' : ''}`}>
              <PlayIcon size={14} color={BTN_ICON.navy} />Clock in
            </button>
          )}
        </div>
      )}

      {data.combinations.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between px-0.5 pb-1.5">
            <SectionLabel>My combinations</SectionLabel>
            <button type="button" onClick={onManage} className={LINK_BTN}>Manage</button>
          </div>
          {combos.map(c => {
            const r = choiceRow(c, true)
            return <ChoiceRowView key={`c${c.combinationId}`} {...r} saved phone={phone} action="play" actionLabel="Clock in with" onGo={() => onStart(c)} disabled={busy} />
          })}
          {data.combinations.length > SHOWN_COMBINATIONS && (
            <button type="button" onClick={onToggleMore} className={`self-start border-0 bg-transparent cursor-pointer px-2 py-1 text-[12.5px] font-semibold text-tn-teal hover:text-tn-ink ${FOCUS}`}>
              {more ? 'Show fewer' : `More (${data.combinations.length - SHOWN_COMBINATIONS})`}
            </button>
          )}
        </div>
      )}

      {data.recents.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="px-0.5 pb-1.5"><SectionLabel inline>Recent</SectionLabel></div>
          {data.recents.map((c, i) => {
            const r = choiceRow(c, false)
            return <ChoiceRowView key={`r${i}`} {...r} saved={false} phone={phone} action="play" actionLabel="Clock in with" onGo={() => onStart(c)} onStar={() => onSave(c)} disabled={busy} />
          })}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between px-0.5">
          <SectionLabel>Something else</SectionLabel>
          <button type="button" onClick={onBrowse} className={LINK_BTN}>Browse</button>
        </div>
        <SearchInput value={query} onChange={onQuery} placeholder="Search jobs" height={42} iconTop={13} />
      </div>
    </>
  )
}

// ── 1B, 1C, 1C-b Choosing a job ─────────────────────────────────────────────

export function ChooseView({ data, day, phone, first, query, browse, onQuery, onBrowse, onPick }: {
  data: ClockPanelData
  /** The day the clock would record the entry on (its start on the quarter hour); today by default. */
  day?: string
  phone: Phone
  first: boolean
  query: string
  browse: number | null
  onQuery: (q: string) => void
  onBrowse: (folderId: number | null) => void
  onPick: (jobId: number) => void
}) {
  const q = query.trim()
  // Today's structure only: the TSheets jobs before the switch date, the 2026 projects from it.
  const todays = jobsOn(data.jobs, day ?? data.today, data.switchDate)
  const ids = new Set(todays.map(j => j.id))
  const folders = data.folders.filter(f => f.jobIds.some(id => ids.has(id)))
  const rows = q ? searchJobs(todays, folders, q) : browseJobs(todays, folders, browse)
  const folder = browse != null ? data.folders.find(f => f.id === browse) : null
  const rowPad = byWidth(phone, 'py-[13px] px-2.5', 'py-[9px] px-2', 'py-[13px] px-2.5 md:py-[9px] md:px-2')
  return (
    <>
      {first && (
        <div className="text-[14px] text-foreground leading-[1.55] [text-wrap:pretty]">Pick what you are working on and press Clock in. You can save it as a combination for next time.</div>
      )}
      <div className="flex flex-col gap-3">
        <SearchInput value={query} onChange={onQuery} placeholder="Search jobs" height={42} iconTop={13} autoFocus />
        {!q && (
          <div className="flex items-center flex-wrap gap-1.5 text-[12.5px] px-0.5">
            {folder ? (
              <>
                <button type="button" onClick={() => onBrowse(null)} className={`border-0 bg-transparent p-0 cursor-pointer text-[12.5px] font-semibold text-tn-teal ${FOCUS}`}>All jobs</button>
                <span className="text-[#cbd2da]">›</span>
                <span className="text-[12.5px] font-bold text-tn-ink">{folder.name}</span>
              </>
            ) : (
              <span className="text-[12.5px] font-bold text-tn-ink">All jobs</span>
            )}
          </div>
        )}
        <div className="flex flex-col gap-px">
          {rows.map(r => r.type === 'header'
            ? <div key={r.key} className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-[#a3aebb] pt-2.5 px-2.5 pb-1">{r.label}</div>
            : (
              <button key={r.key} type="button" onClick={() => (r.type === 'folder' ? onBrowse(r.folder.id) : onPick(r.job.id))}
                className={`flex items-center gap-2.5 w-full border-0 bg-transparent cursor-pointer text-left rounded-[10px] hover:bg-[var(--row-hover)] ${rowPad} ${FOCUS}`}>
                {r.type === 'folder' && <Icon d={ICON.folder} size={17} stroke="#8593a4" sw={1.9} cap="butt" className="shrink-0" />}
                <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className={`font-(family-name:--font-display) text-[13.5px] text-tn-ink ${r.type === 'folder' ? 'font-bold' : 'font-semibold'}`}>{r.label}</span>
                  {r.sub && <span className="text-[12px] text-muted">{r.sub}</span>}
                  {lineOf(r) && <span className="text-[12px] text-foreground leading-[1.45] [text-wrap:pretty]">{lineOf(r)!.use}</span>}
                </span>
                {lineOf(r)?.billable != null && (
                  <span className={`shrink-0 self-start mt-px text-[10.5px] font-bold rounded-full px-2 py-[3px] ${lineOf(r)!.billable ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#f1f3f6] text-[#5b6b82]'}`}>{lineOf(r)!.billable ? 'Billable' : 'Not billable'}</span>
                )}
                {r.type === 'folder' && <Icon d={ICON.chevronRight} size={16} stroke="#8593a4" sw={2} className="shrink-0" />}
              </button>
            ))}
          {q && rows.length === 0 && (
            <div className="p-2.5 text-[13px] text-muted leading-[1.5]">{`No job matches "${query}". Try fewer letters, or browse the list.`}</div>
          )}
        </div>
        <div className="flex flex-col items-stretch gap-2.5 pt-0.5 px-0.5">
          <span className="text-[12px] text-muted leading-[1.5] whitespace-nowrap">Vacation, Sick, Holiday and Jury duty are not clocked.</span>
          <a href="/clocky-hours/which-job" className={`text-[12.5px] font-bold self-start text-tn-teal hover:text-tn-ink ${FOCUS}`}>Which job? See every job and when to use it</a>
        </div>
      </div>
    </>
  )
}

// ── 1D Details before clocking in ───────────────────────────────────────────

/** A 2026 project's Billable: the project's own, shown and not chosen (owner, 26 October 2026). */
export function BillableFromProject({ billable }: { billable: boolean }) {
  return (
    <div className="flex flex-col gap-[5px] min-w-0">
      <div className="flex items-center gap-1.5 min-h-4"><SectionLabel>Billable</SectionLabel></div>
      <div title="Set by the project. Ask an Admin if this project is billed wrongly." className="h-10 px-3 flex items-center gap-2 bg-subtle border border-[var(--panel-border)] rounded-[10px] font-(family-name:--font-display) font-semibold text-[13px] text-tn-ink">
        {billable ? 'Yes' : 'No'}<span className="text-[11.5px] font-sans font-normal text-muted">from the project</span>
      </div>
    </div>
  )
}

export function DetailsView({ data, draft, switching, busy, onChangeJob, onField, onNotes, onGo, onSave, onCancel }: {
  data: ClockPanelData
  draft: Draft
  switching: boolean
  busy: boolean
  onChangeJob: () => void
  onField: (key: FieldName, value: string) => void
  onNotes: (v: string) => void
  onGo: () => void
  onSave: () => void
  onCancel: () => void
}) {
  const job = data.jobs.find(j => j.id === draft.jobId)
  const notesReq = activityNeedsNotes(valueOf(draft.values, data.fields, 'activity'))
  const v2 = job?.structure === 2
  return (
    <div className="flex flex-col gap-4">
      <div className="border border-[var(--panel-border)] rounded-[12px] px-3.5 py-3 flex items-center gap-3 bg-subtle">
        <div className="flex-1 min-w-0">
          <SectionLabel>{v2 ? 'Project' : 'Job'}</SectionLabel>
          <div className="font-(family-name:--font-display) font-bold text-[14px] text-tn-ink mt-[3px]">{job?.path ?? ''}</div>
        </div>
        <button type="button" onClick={onChangeJob} className={LINK_BTN}>Change</button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {keysFor(!!job?.isI7).map(key => {
          const f = fieldByKey(data.fields, key, job)
          if (!f) return null
          return (
            <ClockField key={key} label={f.label} value={draft.values[f.id] ?? ''} options={optionsOf(f)} onChange={v => onField(key, v)}
              search={key === 'activity' || key === 'code'} auto={!!draft.auto[key]} placeholder={key === 'activity' ? 'Search activities' : 'Choose'} />
          )
        })}
        {v2 && job && <BillableFromProject billable={job.billable} />}
      </div>
      <div className="flex flex-col gap-[5px]">
        <SectionLabel>{notesReq ? 'Notes (required for this Activity)' : 'Notes'}</SectionLabel>
        <textarea value={draft.notes} onChange={e => onNotes(e.target.value)} rows={2} placeholder="What are you working on?" aria-label="Notes"
          className={`w-full box-border resize-y px-3 py-2.5 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink placeholder:text-muted ${INPUT_FOCUS}`} />
      </div>
      <div className="text-[12px] text-muted leading-[1.5]">Activity and notes can wait: you can fill them while the clock runs. You will need them to clock out.</div>
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={onGo} disabled={busy} className={`${CK_BTN_NAVY} disabled:opacity-60 ${FOCUS}`}>
          <PlayIcon size={14} color={BTN_ICON.navy} />{switching ? 'Switch' : 'Clock in'}
        </button>
        <button type="button" onClick={onSave} className={`${CK_BTN_WHITE} ${FOCUS}`}>
          <Icon d={ICON.star} size={15} stroke={BTN_ICON.white} sw={2} cap="butt" />Save as combination
        </button>
        <button type="button" onClick={onCancel} className={`border-0 bg-transparent cursor-pointer p-2 text-[13px] font-semibold text-muted hover:text-tn-ink ${FOCUS}`}>Cancel</button>
      </div>
    </div>
  )
}

// ── 1E On the clock (with 1F, 1I, notes autosave) ───────────────────────────

export type NoteStatus = 'typing' | 'saving' | 'saved' | 'failed' | null

export function OnView({
  data, running, values, nowMs, phone, busy, editKey, gate, gateLabel, missing, notes, noteStatus, noteError,
  onKeepGoing, onClockOut, onEditKey, onField, onNotes, onNotesCommit, onGateGo, onGateCancel, onSwitch, onSave, onSwitchQuery,
}: {
  data: ClockPanelData
  running: RunningEntry
  /** The running entry's fields with what was just picked laid over them. */
  values: Record<string, string>
  nowMs: number
  phone: Phone
  busy: boolean
  editKey: FieldName | null
  gate: { kind: 'switch' | 'out' } | null
  gateLabel: string
  missing: MissingName[]
  notes: string
  noteStatus: NoteStatus
  noteError: string | null
  onKeepGoing: () => void
  onClockOut: () => void
  onEditKey: (k: FieldName) => void
  onField: (k: FieldName, v: string, from: 'edit' | 'gate') => void
  onNotes: (v: string) => void
  onNotesCommit: () => void
  onGateGo: () => void
  onGateCancel: () => void
  onSwitch: (c: ClockChoice) => void
  onSave: (c: ClockChoice) => void
  onSwitchQuery: (q: string) => void
}) {
  const zone = data.me.zone
  const warn = overWarn(data, nowMs)
  const totals = liveTotals(data, nowMs)
  const bars = breakdown(data, nowMs)
  const activity = valueOf(values, data.fields, 'activity')
  const head = data.combinations.find(c => c.jobcodeId === running.jobcodeId && (c.activity || '') === activity)?.name ?? 'Now'
  const runningJob = data.jobs.find(j => j.id === running.jobcodeId)
  const keys = keysFor(running.isI7)
  const switchRows = switchChoices(data, { jobcodeId: running.jobcodeId, fields: values })
  const gateFields = gate ? missing.filter((m): m is FieldName => m !== 'notes') : []
  const gateOut = gate?.kind === 'out'
  const field = (k: FieldName) => fieldByKey(data.fields, k, runningJob)
  const sel = (k: FieldName, from: 'edit' | 'gate') => {
    const f = field(k)
    if (!f) return null
    return (
      <ClockField key={`${from}-${k}`} label={f.label} value={values[f.id] ?? ''} options={optionsOf(f)} onChange={v => onField(k, v, from)}
        search={k === 'activity' || k === 'code'} placeholder={k === 'activity' ? 'Search activities' : 'Choose'} />
    )
  }

  return (
    <>
      {warn && data.safety && (
        <div role="alert" className="border border-[#f0e2a8] bg-[#fdf8e7] rounded-[14px] p-4 flex flex-col gap-3.5">
          <div className="flex gap-[11px] items-start">
            <Icon d={ICON.warn} size={20} stroke="#8a6d1a" sw={2} className="shrink-0 mt-px" />
            <div>
              <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Still working?</div>
              <div className="text-[13px] text-foreground leading-[1.5] mt-1">{data.safety.panelText}</div>
            </div>
          </div>
          <div className="flex gap-2 justify-end flex-wrap">
            <button type="button" onClick={onClockOut} disabled={busy} className={`${BTN_WHITE_DANGER} disabled:opacity-60 ${FOCUS}`}>
              <StopIcon size={13} color="#c8323d" />Clock out now
            </button>
            <button type="button" onClick={onKeepGoing} disabled={busy} className={`${CK_BTN_NAVY} disabled:opacity-60 ${FOCUS}`}>
              <PlayIcon size={14} color={BTN_ICON.navy} />Keep going
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-2.5 pt-1 pb-0.5">
        <div className={`font-(family-name:--font-display) font-black text-[48px] leading-none tracking-[-.01em] tabular-nums lining-nums ${warn ? 'text-[#8a6d1a]' : 'text-tn-ink'}`}>
          {formatTimer((nowMs - Date.parse(timerStart(running))) / 1000)}
        </div>
        <div className="flex gap-2">
          <span className="text-[12px] text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-full px-[11px] py-[5px] tabular-nums lining-nums">Today <b className="text-tn-ink">{formatClock(totals.today)}</b></span>
          <span className="text-[12px] text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-full px-[11px] py-[5px] tabular-nums lining-nums">Week <b className="text-tn-ink">{formatClock(totals.week)}</b></span>
        </div>
        {data.allowance && <AllowanceLine a={data.allowance} zone={zone} />}
      </div>

      <div className="border border-[var(--panel-border)] rounded-[14px] p-3.5 flex flex-col gap-[11px]">
        <div className="flex justify-between items-start gap-2.5">
          <div className="min-w-0">
            <SectionLabel>{head}</SectionLabel>
            <div className="font-(family-name:--font-display) font-bold text-[14px] text-tn-ink mt-[3px]">{running.path}</div>
          </div>
          <span className="text-[12px] text-muted whitespace-nowrap tabular-nums lining-nums">since {timeLabel(running.startedAt, zone)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {keys.map(k => {
            const f = field(k)
            const v = f ? values[f.id] ?? '' : ''
            return v
              ? <span key={k} className="text-[11.5px] font-semibold text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-full px-[9px] py-1">{k === 'billable' ? billableText(v) : v}</span>
              : <button key={k} type="button" onClick={() => onEditKey(k)} aria-expanded={editKey === k} className={`text-[11.5px] font-bold text-[#8a6d1a] bg-[#fdf8e7] border border-dashed border-[#e9d48a] rounded-full px-[9px] py-[3px] cursor-pointer hover:border-solid ${FOCUS}`}>+ Add {FIELD_SHORT[k]}</button>
          })}
        </div>
        {running.roundNote && <div className="text-[12px] text-muted leading-[1.45] -mt-[3px]">{roundNoteText(running.roundNote)}</div>}
        {editKey && !gate && sel(editKey, 'edit')}
        <input value={notes} onChange={e => onNotes(e.target.value)} onBlur={onNotesCommit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          placeholder="Add a note" aria-label="Notes"
          className={`w-full box-border h-9 px-[11px] border border-[var(--row-rule)] rounded-[9px] text-[13px] text-tn-ink bg-white placeholder:text-muted ${INPUT_FOCUS}`} />
        {noteStatus && noteStatus !== 'typing' && (
          <div aria-live="polite" className={`flex items-center gap-1.5 text-[11.5px] font-semibold -mt-[5px] ${noteStatus === 'failed' ? 'text-[#8a6d1a]' : 'text-muted'}`}>
            {noteStatus === 'saved' && <Icon d={ICON.check} size={12} stroke="#1E9E6A" sw={3} />}
            <span>{noteStatus === 'saving' ? 'Saving…' : noteStatus === 'saved' ? 'Saved' : noteError ?? 'Not saved yet. Will retry when you are back online.'}</span>
          </div>
        )}
      </div>

      {gate && (
        <div role="alert" className="border border-[#f0e2a8] bg-[#fdf8e7] rounded-[14px] p-3.5 flex flex-col gap-3">
          <div className="text-[13px] text-tn-ink font-bold leading-[1.45]">{gateOut ? 'Before you clock out, finish the current entry:' : `Before you switch${gateLabel ? ` to ${gateLabel}` : ''}, finish the current entry:`}</div>
          {gateFields.map(k => sel(k, 'gate'))}
          {missing.includes('notes') && (
            <input value={notes} onChange={e => onNotes(e.target.value)} onBlur={onNotesCommit} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
              placeholder="Notes (required for this Activity)" aria-label="Notes (required for this Activity)"
              className={`w-full box-border h-10 px-[11px] border border-[#e9d48a] rounded-[10px] text-[13px] text-tn-ink bg-white placeholder:text-muted ${INPUT_FOCUS}`} />
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onGateCancel} className={`${CK_BTN_WHITE} ${FOCUS}`}>Cancel</button>
            <button type="button" onClick={onGateGo} disabled={missing.length > 0 || busy}
              className={`${gateOut ? BTN_DANGER : CK_BTN_NAVY_FLAT} disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}>{gateOut ? 'Clock out' : 'Switch'}</button>
          </div>
        </div>
      )}

      {bars.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <SectionLabel className="text-muted px-0.5">Today, by combination</SectionLabel>
          {bars.map(b => (
            <div key={b.label} className="flex flex-col gap-[5px] px-0.5">
              <div className="flex justify-between items-center gap-2.5 text-[12.5px]">
                <span className="flex items-center gap-[7px] font-semibold text-tn-ink min-w-0">
                  <span className="truncate">{b.label}</span>
                  {b.running && <span className="text-[10px] font-(family-name:--font-display) font-extrabold tracking-[.06em] uppercase text-[#0d7a4f] bg-[#e6f6ee] rounded-full px-[7px] py-[2px]">now</span>}
                </span>
                <span className="text-foreground tabular-nums lining-nums whitespace-nowrap">{b.dur}</span>
              </div>
              <div className="h-[5px] rounded-[3px] bg-[var(--row-rule)] overflow-hidden"><div className="h-full rounded-[3px]" style={{ width: b.pct, background: b.color }} /></div>
            </div>
          ))}
        </div>
      )}

      {!gate && (
        <div className="flex flex-col gap-0.5 rounded-[14px]">
          <div className="flex items-center justify-between px-0.5 pb-1.5">
            <SectionLabel>Switch to</SectionLabel>
            <span className="text-[11.5px] text-muted">Ends this entry now, starts the next</span>
          </div>
          {switchRows.map((r, i) => {
            const v = choiceRow(r.choice, r.saved)
            return <ChoiceRowView key={`${r.saved ? 'c' : 'r'}${r.choice.combinationId ?? i}`} {...v} saved={r.saved} phone={phone} action="swap" actionLabel="Switch to"
              onGo={() => onSwitch(r.choice)} onStar={() => { if (!r.saved) onSave(r.choice) }} disabled={busy} />
          })}
          <div className="relative mt-1.5">
            <SearchInput value="" onChange={onSwitchQuery} placeholder="Something else: search jobs" height={40} iconTop={12} fontSize={13} />
          </div>
        </div>
      )}
    </>
  )
}

// ── 1L The real end time after an automatic stop ────────────────────────────

export function AutoView({ item, zone, later, end, busy, onLater, onEnd, onKeep, onConfirm }: {
  item: ToConfirm
  zone: string
  later: boolean
  end: string
  busy: boolean
  onLater: () => void
  onEnd: (iso: string) => void
  onKeep: () => void
  onConfirm: () => void
}) {
  const stop = timeLabel(item.stoppedAt, zone)
  const options = (later ? item.laterOptions : item.options).map(iso => ({ value: iso, label: timeLabel(iso, zone) }))
  return (
    <>
      <div role="alert" className="border border-[#f3c6ca] bg-[#fdeeef] rounded-[14px] p-4 flex flex-col gap-3.5">
        <div>
          <div className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink leading-[1.35] tabular-nums lining-nums">Your clock stopped by itself.</div>
          <div className="text-[13px] text-foreground leading-[1.5] mt-1.5">{item.text}</div>
        </div>
        <ClockField label="Real end time" value={end} options={options} onChange={onEnd} search />
        <button type="button" role="checkbox" aria-checked={later} onClick={onLater}
          className={`flex items-center gap-[9px] border-0 bg-transparent cursor-pointer p-0 text-[13px] text-tn-ink font-semibold text-left ${FOCUS}`}>
          <span className={`w-[21px] h-[21px] rounded-[5px] border-[1.5px] flex items-center justify-center shrink-0 ${later ? 'border-tn-teal bg-tn-teal' : 'border-[#cbd2da] bg-white'}`}>
            {later && <Icon d={ICON.check} size={12} stroke="#fff" sw={3} />}
          </span>
          I was still working until...
        </button>
        {later && <div className="text-[12px] text-[#8a6d1a] font-semibold -mt-1.5">{`A time after ${stop} is flagged for the approver.`}</div>}
        <div className="flex justify-end gap-2 flex-wrap">
          <button type="button" onClick={onKeep} disabled={busy} className={`${CK_BTN_WHITE} tabular-nums lining-nums disabled:opacity-60 ${FOCUS}`}>{`Keep ${stop}`}</button>
          <button type="button" onClick={onConfirm} disabled={busy || !end} className={`${CK_BTN_NAVY} disabled:opacity-60 ${FOCUS}`}>
            <Icon d={ICON.check} size={14} stroke={BTN_ICON.navy} sw={3} />Confirm
          </button>
        </div>
      </div>
      <div className="text-[12px] text-muted leading-[1.5] px-0.5">The entry is marked Auto clocked out in Time entries, and the occurrence is logged in Clock safety.</div>
    </>
  )
}

// ── The hours allowance (Clocky part 2, Clock Panel.dc.html 10B) ────────────

/** "128h", "12h 30m": whole hours when they are whole. */
const hrs = (seconds: number) => (seconds % 3600 === 0 ? `${seconds / 3600}h` : formatDuration(seconds))

/**
 * Quiet under 90%, a warning pill from 90%, an alert with the way to ask once over. From 90%
 * the pill also says when the clock stops by itself at the allowance (owner, 25 October 2026).
 */
function AllowanceLine({ a, zone }: { a: NonNullable<ClockPanelData['allowance']>; zone: string }) {
  const period = a.period === 'month' ? 'this month' : 'this week'
  if (a.state === 'over') {
    return (
      <div role="alert" className="w-full box-border flex items-center gap-2.5 justify-between flex-wrap text-[12.5px] text-[#c8323d] bg-[#fdeeef] border border-[#f3c6ca] rounded-[11px] px-3 py-[9px] tabular-nums lining-nums">
        <span className="font-bold">{hrs(a.over)} over your allowance, not approved. Ask for extra hours.</span>
        <a href="/requests/extra-hours?ask=1" className="font-extrabold font-(family-name:--font-display) text-tn-ink whitespace-nowrap">Ask for extra hours</a>
      </div>
    )
  }
  if (a.state === 'near') {
    return (
      <span className="flex flex-col items-center gap-1">
        <span className="flex items-center gap-[7px] text-[12.5px] font-bold text-[#8a6d1a] bg-[var(--warn-bg)] border border-[#f0e2a8] rounded-full px-3 py-[5px] tabular-nums lining-nums">
          <span className="w-[7px] h-[7px] rounded-full bg-[#d4a017]" />{hrs(a.left)} left {period} ({hrs(a.used)} of {hrs(a.limit)})
        </span>
        {a.stopAt && <span className="text-[12px] text-[#8a6d1a] text-center tabular-nums lining-nums">{limitAheadText(timeLabel(a.stopAt, zone))}</span>}
      </span>
    )
  }
  return <span className="text-[12.5px] text-muted tabular-nums lining-nums">{period === 'this month' ? 'This month' : 'This week'} <b className="text-foreground">{hrs(a.used)}</b> of {hrs(a.limit)}</span>
}
