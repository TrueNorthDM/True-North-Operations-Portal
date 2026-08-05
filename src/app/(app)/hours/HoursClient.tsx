'use client'

// My Hours: the clock, the week, and the form for filling in what the clock
// missed. The module around it is Clocky Hours.
//
// One client component rather than three, because the three share one piece of
// state: the draft. Clocking in and adding an entry by hand ask exactly the
// same questions, and splitting them would have meant keeping two copies of the
// same form in step.

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { formatHM, decimalHours, daysOfWeek, shiftWeek, durationSeconds } from '@/lib/timeclock/clock'
import { startClock, stopClock, saveEntry, deleteEntry, submitPeriod, decidePeriod, reopenPeriod } from './actions'
import { monthName, whatCanIDo, type SubmissionState } from '@/lib/timeclock/periods'
import type { Jobcode, Field, Entry, Waiting } from './page'

interface Props {
  timezone: string
  today: string
  weekStartDate: string
  weekEndDate: string
  jobcodes: Jobcode[]
  fields: Field[]
  entries: Entry[]
  month: string
  monthSeconds: number
  submissionState: SubmissionState | null
  submissionNote: string
  waiting: Waiting[]
  approvers: string[]
  isAdmin: boolean
  myPersonId: string
  running: { id: number; startedAt: string; jobcodeId: number | null } | null
}

const card = 'rounded-[14px] border border-slate-200 bg-white p-5'
const labelCls = 'text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted'
const inputCls = 'px-3 py-2 rounded-[9px] border border-slate-200 text-sm bg-white text-tn-ink focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20'

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/** Wall-clock HH:MM of an instant, in the company's zone. */
function hhmm(iso: string | null, timeZone: string): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date(iso))
}

export function HoursClient(props: Props) {
  const {
    timezone, today, weekStartDate, weekEndDate, jobcodes, fields, entries, running,
    month, monthSeconds, submissionState, submissionNote, waiting,
    approvers, isAdmin, myPersonId,
  } = props
  const period = whatCanIDo(submissionState)
  const [returning, setReturning] = useState<string | null>(null)
  const [returnNote, setReturnNote] = useState('')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // The draft, shared by the clock and the by-hand form.
  const [jobcodeId, setJobcodeId] = useState<string>('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')

  // By-hand form
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [entryDate, setEntryDate] = useState(today)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [hours, setHours] = useState('')

  // The running clock, ticking. Recomputed from the start instant every second
  // rather than counted up, so a tab that was asleep for an hour shows the hour.
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!running) return
    const tick = () => setElapsed(durationSeconds(running.startedAt, new Date().toISOString()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [running])

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of entries) map.set(e.entryDate, [...(map.get(e.entryDate) ?? []), e])
    return map
  }, [entries])

  const weekSeconds = entries.reduce((s, e) => s + e.durationSeconds, 0)
  const jobcodeName = (id: number | null) => jobcodes.find(j => j.id === id)?.label ?? '—'

  function resetDraft() {
    setJobcodeId('')
    setFieldValues({})
    setNotes('')
    setStartTime('')
    setEndTime('')
    setHours('')
    setEditingId(null)
    setEntryDate(today)
  }

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setError(null)
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) { setError(res.error ?? 'Something went wrong.'); return }
      after?.()
      router.refresh()
    })
  }

  function edit(e: Entry) {
    setEditingId(e.id)
    setJobcodeId(String(e.jobcodeId ?? ''))
    setFieldValues(e.fields)
    setNotes(e.notes)
    setEntryDate(e.entryDate)
    setStartTime(hhmm(e.startedAt, timezone))
    setEndTime(hhmm(e.endedAt, timezone))
    setHours(e.startedAt ? '' : (e.durationSeconds / 3600).toFixed(2))
    setShowForm(true)
  }

  const fieldPickers = (
    <>
      {fields.map(f => (
        <div key={f.id} className="flex flex-col gap-1 min-w-[180px]">
          <label className={labelCls} htmlFor={`f-${f.id}`}>
            {f.name}{f.required && <span className="text-[#c2410c]"> *</span>}
          </label>
          <Select
            id={`f-${f.id}`}
            value={fieldValues[String(f.id)] ?? ''}
            onChange={v => setFieldValues(s => ({ ...s, [String(f.id)]: v }))}
            options={[{ value: '', label: '—' }, ...f.options.map(o => ({ value: o, label: o }))]}
            ariaLabel={f.name}
            className={inputCls}
          />
        </div>
      ))}
    </>
  )

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-[12px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* ── The month, and whether it is still yours ──────────────────────── */}
      <section className={`${card} flex items-center gap-4 flex-wrap`}>
        <div>
          <div className={labelCls}>{monthName(month)}</div>
          <div className="font-(family-name:--font-display) font-extrabold text-[22px] tabular-nums text-tn-ink leading-tight">
            {formatHM(monthSeconds)} <span className="text-sm font-normal text-muted">({decimalHours(monthSeconds)} h)</span>
          </div>
        </div>
        <div className="min-w-0">
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
            submissionState === 'approved' ? 'bg-[#e7f5ee] text-[#1f8a5b]'
              : submissionState === 'submitted' ? 'bg-[#eef2fb] text-tn-primary'
              : submissionState === 'returned' ? 'bg-amber-50 text-[#b45309]'
              : 'bg-subtle text-muted'
          }`}>{period.label}</span>
          <p className="text-sm text-muted m-0 mt-1 leading-relaxed">{period.hint}</p>
          {submissionNote && submissionState === 'returned' && (
            <p className="text-sm text-[#b45309] m-0 mt-1">Note: {submissionNote}</p>
          )}
        </div>
        {period.canSubmit && (
          <div className="ml-auto text-right">
            <button
              onClick={() => run(() => submitPeriod(month))}
              disabled={pending || monthSeconds === 0 || approvers.length === 0}
              className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-white font-(family-name:--font-display) font-bold disabled:opacity-50 transition-transform hover:-translate-y-0.5 disabled:translate-y-0"
            >
              {pending ? 'Sending…' : `Submit ${monthName(month)}`}
            </button>
            <p className="text-xs text-muted m-0 mt-1.5">
              {approvers.length
                ? `Goes to ${approvers.join(' or ')}`
                : 'Nobody is set up to approve your hours yet'}
            </p>
          </div>
        )}
        {/* Submitting is otherwise a one-way door: a person whose approver goes
            away afterwards has a month nobody can move. */}
        {isAdmin && !period.canEdit && (
          <button
            onClick={() => run(() => reopenPeriod(myPersonId, month))}
            disabled={pending}
            className="ml-auto px-4 py-2 rounded-[10px] border border-slate-200 text-tn-ink font-(family-name:--font-display) font-bold text-sm disabled:opacity-50 hover:border-[#c2410c]"
          >
            Reopen (admin)
          </button>
        )}
      </section>

      {/* ── Waiting on me ─────────────────────────────────────────────────── */}
      {waiting.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-(family-name:--font-display) font-extrabold text-lg text-tn-ink m-0">
            Waiting for you
          </h2>
          <div className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
            {waiting.map(w => (
              <div key={w.personId} className="border-b border-slate-100 last:border-b-0">
                <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                  <span className="font-semibold text-tn-ink">{w.name}</span>
                  <span className="text-sm text-muted tabular-nums">{formatHM(w.seconds)} ({decimalHours(w.seconds)} h) · {w.entries} entries</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    w.state === 'approved' ? 'bg-[#e7f5ee] text-[#1f8a5b]'
                      : w.state === 'submitted' ? 'bg-[#eef2fb] text-tn-primary'
                      : 'bg-amber-50 text-[#b45309]'
                  }`}>{w.state}</span>
                  {w.state === 'submitted' && (
                    <span className="ml-auto flex gap-2">
                      <button
                        onClick={() => run(() => decidePeriod({ personId: w.personId, month: w.month, decision: 'approve' }))}
                        disabled={pending}
                        className="px-3.5 py-1.5 rounded-[9px] bg-[#1f8a5b] text-white font-(family-name:--font-display) font-bold text-sm disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => { setReturning(returning === w.personId ? null : w.personId); setReturnNote('') }}
                        disabled={pending}
                        className="px-3.5 py-1.5 rounded-[9px] border border-slate-200 text-tn-ink font-(family-name:--font-display) font-bold text-sm disabled:opacity-50 hover:border-[#c2410c]"
                      >
                        Hand back
                      </button>
                    </span>
                  )}
                </div>
                {returning === w.personId && (
                  <div className="flex gap-2 px-4 pb-3 flex-wrap items-center">
                    {/* A month handed back without a reason is a month that comes
                        straight back, so the note is the point of the button. */}
                    <input
                      value={returnNote}
                      onChange={e => setReturnNote(e.target.value)}
                      placeholder="What needs fixing?"
                      className={`${inputCls} grow min-w-[240px]`}
                    />
                    <button
                      onClick={() => run(
                        () => decidePeriod({ personId: w.personId, month: w.month, decision: 'return', note: returnNote }),
                        () => setReturning(null),
                      )}
                      disabled={pending || !returnNote.trim()}
                      className="px-4 py-2 rounded-[9px] bg-[#c2410c] text-white font-(family-name:--font-display) font-bold text-sm disabled:opacity-50"
                    >
                      Send it back
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── The clock ─────────────────────────────────────────────────────── */}
      <section className={card}>
        {!period.canEdit && !running ? (
          <p className="text-sm text-muted m-0">
            {monthName(month)} is closed to changes, so there is nothing to clock into for it.
          </p>
        ) : running ? (
          <div className="flex items-center gap-6 flex-wrap">
            <div>
              <div className={labelCls}>On the clock</div>
              <div className="font-(family-name:--font-display) font-extrabold text-[34px] tabular-nums text-tn-ink leading-tight">
                {formatHM(elapsed)}
              </div>
              <div className="text-sm text-muted">
                {jobcodeName(running.jobcodeId)} · started {hhmm(running.startedAt, timezone)}
              </div>
            </div>
            <button
              onClick={() => run(() => stopClock(), resetDraft)}
              disabled={pending}
              className="ml-auto px-5 py-3 rounded-[10px] bg-[#c2410c] text-white font-(family-name:--font-display) font-bold disabled:opacity-50 transition-transform hover:-translate-y-0.5"
            >
              {pending ? 'Stopping…' : 'Clock out'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={labelCls}>Clock in</div>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex flex-col gap-1 min-w-[240px]">
                <label className={labelCls} htmlFor="jobcode">Job code <span className="text-[#c2410c]">*</span></label>
                <Select
                  id="jobcode"
                  value={jobcodeId}
                  onChange={setJobcodeId}
                  options={[{ value: '', label: '—' }, ...jobcodes.map(j => ({ value: String(j.id), label: j.label }))]}
                  ariaLabel="Job code"
                  className={inputCls}
                />
              </div>
              {fieldPickers}
              <div className="flex flex-col gap-1 grow min-w-[200px]">
                <label className={labelCls} htmlFor="notes">Notes</label>
                <input id="notes" value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Optional" />
              </div>
              <button
                onClick={() => run(() => startClock({ jobcodeId: Number(jobcodeId), fields: fieldValues, notes }))}
                disabled={pending || !jobcodeId}
                className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-white font-(family-name:--font-display) font-bold disabled:opacity-50 transition-transform hover:-translate-y-0.5 disabled:translate-y-0"
              >
                {pending ? 'Starting…' : 'Clock in'}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ── The week ──────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="font-(family-name:--font-display) font-extrabold text-lg text-tn-ink m-0">
            {dayLabel(weekStartDate)} to {dayLabel(weekEndDate)}
          </h2>
          <button onClick={() => router.push(`/hours?week=${shiftWeek(weekStartDate, -1)}`)} className="text-sm text-tn-teal hover:underline underline-offset-2">Previous</button>
          <button onClick={() => router.push(`/hours?week=${shiftWeek(weekStartDate, 1)}`)} className="text-sm text-tn-teal hover:underline underline-offset-2">Next</button>
          <span className="ml-auto text-sm">
            <span className="text-muted">Week total:</span>{' '}
            <strong className="tabular-nums text-tn-ink">{formatHM(weekSeconds)}</strong>
            <span className="text-muted"> ({decimalHours(weekSeconds)} h)</span>
          </span>
          <button
            onClick={() => { resetDraft(); setShowForm(v => !v) }}
            disabled={!period.canEdit}
            className="px-4 py-2 rounded-[10px] border border-slate-200 bg-white text-tn-ink font-(family-name:--font-display) font-bold text-sm hover:border-tn-teal transition-colors"
          >
            {showForm ? 'Close' : 'Add by hand'}
          </button>
        </div>

        {showForm && (
          <div className={`${card} space-y-4`}>
            <div className={labelCls}>{editingId ? 'Edit entry' : 'New entry'}</div>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="date">Date</label>
                <input id="date" type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1 min-w-[240px]">
                <label className={labelCls} htmlFor="jc2">Job code <span className="text-[#c2410c]">*</span></label>
                <Select
                  id="jc2"
                  value={jobcodeId}
                  onChange={setJobcodeId}
                  options={[{ value: '', label: '—' }, ...jobcodes.map(j => ({ value: String(j.id), label: j.label }))]}
                  ariaLabel="Job code"
                  className={inputCls}
                />
              </div>
              {fieldPickers}
            </div>
            <div className="flex gap-3 flex-wrap items-end">
              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="from">From</label>
                <input id="from" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="to">To</label>
                <input id="to" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
              </div>
              <span className="text-sm text-muted pb-2">or</span>
              <div className="flex flex-col gap-1">
                <label className={labelCls} htmlFor="hrs">Hours</label>
                <input
                  id="hrs" type="number" step="0.25" min="0" max="24"
                  value={hours} onChange={e => setHours(e.target.value)}
                  className={`${inputCls} w-28`} placeholder="1.50"
                  disabled={Boolean(startTime && endTime)}
                />
              </div>
              <div className="flex flex-col gap-1 grow min-w-[200px]">
                <label className={labelCls} htmlFor="n2">Notes</label>
                <input id="n2" value={notes} onChange={e => setNotes(e.target.value)} className={inputCls} placeholder="Optional" />
              </div>
              <button
                onClick={() => run(
                  () => saveEntry({
                    id: editingId ?? undefined,
                    jobcodeId: Number(jobcodeId),
                    entryDate, startTime, endTime,
                    hours: Number(hours) || 0,
                    fields: fieldValues, notes,
                  }),
                  () => { resetDraft(); setShowForm(false) },
                )}
                disabled={pending || !jobcodeId}
                className="px-5 py-2.5 rounded-[10px] bg-tn-primary text-white font-(family-name:--font-display) font-bold disabled:opacity-50"
              >
                {pending ? 'Saving…' : editingId ? 'Save changes' : 'Add entry'}
              </button>
            </div>
            <p className="text-xs text-muted m-0">
              Give times when you know them and hours when you do not. Times are read on the
              company clock ({timezone.replace('_', ' ')}).
            </p>
          </div>
        )}

        <div className="space-y-2">
          {daysOfWeek(weekStartDate).map(day => {
            const list = byDay.get(day) ?? []
            const total = list.reduce((s, e) => s + e.durationSeconds, 0)
            return (
              <div key={day} className="rounded-[14px] border border-slate-200 bg-white overflow-hidden">
                <div className={`flex items-center gap-3 px-4 py-2.5 ${day === today ? 'bg-tn-teal-soft' : 'bg-subtle'} border-b border-slate-200`}>
                  <span className="font-(family-name:--font-display) font-bold text-tn-ink text-sm">{dayLabel(day)}</span>
                  {day === today && <span className="text-[10px] font-bold uppercase tracking-wide text-tn-teal">Today</span>}
                  <span className="ml-auto text-sm tabular-nums text-muted">{total ? formatHM(total) : '—'}</span>
                </div>
                {list.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-400">Nothing logged.</div>
                ) : list.map(e => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-b-0 flex-wrap">
                    <span className="tabular-nums text-sm text-muted w-[104px] shrink-0">
                      {e.startedAt ? `${hhmm(e.startedAt, timezone)}–${e.endedAt ? hhmm(e.endedAt, timezone) : '…'}` : 'no times'}
                    </span>
                    <span className="font-semibold text-tn-ink text-sm">{jobcodeName(e.jobcodeId)}</span>
                    {Object.values(e.fields).filter(Boolean).slice(0, 3).map((v, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-subtle text-muted">{v}</span>
                    ))}
                    {e.notes && <span className="text-xs text-muted italic truncate max-w-[240px]">{e.notes}</span>}
                    {e.state !== 'open' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide text-muted">{e.state}</span>
                    )}
                    <span className="ml-auto tabular-nums font-semibold text-tn-ink">{formatHM(e.durationSeconds)}</span>
                    {e.editable && period.canEdit && (
                      <span className="flex gap-2 text-xs">
                        <button onClick={() => edit(e)} className="text-tn-teal hover:underline underline-offset-2">Edit</button>
                        <button onClick={() => run(() => deleteEntry(e.id))} className="text-[#c2410c] hover:underline underline-offset-2">Delete</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
