'use client'

/**
 * Company settings > Timesheet periods (design handoff of 16 October 2026,
 * Timesheet Periods.dc.html frames 5A and 5A2): the day pay periods start and
 * the periods it makes and the people on each cadence. There is no company
 * default for new people (owner, 20 October 2026): the cadence is a required
 * field when someone is added to the Directory. Edit / Done like the other
 * sections; Done saves, and moving the
 * start date asks first ("Move the pay periods?") with the old and new current
 * period. Super Admins change it (cs-periods-edit); Admins read it.
 *
 * Drawn with its own Edit / Done (the section is not `editable` in
 * SettingsNav), because Done here saves and may ask first.
 */

import Link from 'next/link'
import { failText } from '@/lib/ui/action-error'
import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/Select'
import { withViewAs } from '@/components/ViewAsKeeper'
import { BTN_ICON } from '@/lib/ui/buttons'
import { previewAnchorMove, setPayPeriodAnchor } from '@/app/(app)/clocky-hours/periods/actions'
import { addDays } from '@/lib/timeclock/periods'
import { dayLabel, longDateLabel } from '@/lib/timeclock/format'
import type { Result, TimesheetPeriodsData } from '@/lib/timeclock/clocky-types'
import type { AnchorPreview } from '@/lib/timeclock/clocky-periods-data'
import { FIELD_LABEL, PeriodsDialog, useToast } from './ui'

// The Edit / Done button (Timesheet Periods.dc.html 5A): Edit navy 11px 20px with
// its shadow, Done white 10px 18px; 8px gap, no letter spacing.
const PERIODS_EDIT = 'inline-flex items-center gap-2 rounded-[10px] px-5 py-[11px] bg-tn-primary text-white font-(family-name:--font-display) font-extrabold text-[13px] shadow-[0_8px_20px_-8px_rgba(1,35,88,.55)] transition-colors hover:bg-[#0a2f6b] disabled:opacity-60'
const PERIODS_DONE = 'inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-[18px] py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:border-tn-teal disabled:opacity-60'

export interface PeriodsActions {
  previewAnchorMove: (input: { anchor: string }) => Promise<Result<{ data: AnchorPreview }>>
  setPayPeriodAnchor: (input: { anchor: string }) => Promise<Result<{ effectiveFrom: string | null }>>
}
const SERVER: PeriodsActions = { previewAnchorMove, setPayPeriodAnchor }

const CARD = 'bg-white border border-[var(--panel-border)] rounded-[16px] px-[22px] py-5 flex flex-col'
const TAG = 'font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-[3px]'
const READ_BOX = 'h-10 flex items-center px-3 rounded-[10px] bg-subtle font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink'
const ALERT = 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z'

/** "Sun, Oct 4 to Sat, Oct 17, 2026" */
const periodText = (start: string, end: string) => `${dayLabel(start)} to ${dayLabel(end)}, ${end.slice(0, 4)}`

export function TimesheetPeriodsSection({ data, anchorOptions, startEditing = false, startAnchor = null, startDialog = false, actions = SERVER }: {
  data: TimesheetPeriodsData
  /** The days the start date can be set to (YYYY-MM-DD), oldest first. */
  anchorOptions: string[]
  /** Design check only: open in Edit, with this date picked, the dialog open. */
  startEditing?: boolean
  startAnchor?: string | null
  startDialog?: boolean
  actions?: PeriodsActions
}) {
  const router = useRouter()
  const canEdit = data.access === 'edit'
  const [editing, setEditing] = useState(startEditing && canEdit)
  const [anchorDraft, setAnchorDraft] = useState<string | null>(startAnchor)
  const [preview, setPreview] = useState<AnchorPreview | null>(null)
  const [dialog, setDialog] = useState(startDialog)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const asked = useRef<string | null>(null)
  const [toast, showToast] = useToast()

  // The design check opens on a picked date: ask for its preview once.
  useEffect(() => {
    if (!startAnchor) return
    let live = true
    actions.previewAnchorMove({ anchor: startAnchor }).then(r => { if (live && r.ok) setPreview(r.data) })
    return () => { live = false }
  }, [startAnchor, actions])

  const anchor = anchorDraft ?? data.anchor
  const moved = !!anchorDraft && !!preview && preview.movedText !== ''
  // The periods the picked date makes: the current one, one before, four after.
  const periods = anchorDraft && preview
    ? [-1, 0, 1, 2, 3, 4].map(i => {
      const a = addDays(preview.newCurrent.start, i * 14)
      return { start: a, end: addDays(a, 13), label: periodText(a, addDays(a, 13)), state: i < 0 ? 'closed' as const : i === 0 ? 'current' as const : 'next' as const }
    })
    : data.periods

  function pick(iso: string) {
    setError(null)
    if (iso === data.anchor) { setAnchorDraft(null); setPreview(null); return }
    setAnchorDraft(iso)
    setPreview(null)
    asked.current = iso
    actions.previewAnchorMove({ anchor: iso }).then(r => {
      // Two picks in a row: only the latest one's answer counts.
      if (asked.current !== iso) return
      if (r.ok) setPreview(r.data)
      else setError(r.error)
    }, () => { if (asked.current === iso) setError('The new periods could not be worked out. Try again in a moment.') })
  }

  function finish(text: string | null) {
    setEditing(false)
    setAnchorDraft(null)
    setPreview(null)
    setDialog(false)
    if (text) { showToast(text); router.refresh() }
  }

  function done() {
    if (anchorDraft && anchorDraft !== data.anchor) {
      // The dialog needs the new date's preview: still coming, or it failed (the error says so).
      if (!preview) { if (!error) setError('Still working out the new periods. Try Done again in a moment.'); return }
      setError(null)
      setDialog(true)
      return
    }
    // Nothing picked: close the editor without claiming a save.
    setError(null)
    finish(null)
  }

  // Leave the editor without saving: the draft, its preview (even one still coming) and any error go.
  function cancel() {
    asked.current = null
    setError(null)
    finish(null)
  }

  function move() {
    if (!anchorDraft) return
    start(async () => {
      // A dropped connection stays in the dialog with its error, not on the error page.
      try {
        const r = await actions.setPayPeriodAnchor({ anchor: anchorDraft })
        if (!r.ok) { setError(r.error); return }
        finish(`Saved. Pay periods start ${longDateLabel(anchorDraft)}, every 2 weeks.`)
      } catch (e) {
        setError(failText(e))
      }
    })
  }

  const options = anchorOptions.map(d => ({ value: d, label: longDateLabel(d) }))
  const dialogInfo = preview?.dialog

  return (
    <div className="flex flex-col gap-[18px] leading-[normal]">
      <div>
        <h2 className="font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink m-0">Timesheet periods</h2>
        <p className="text-[13.5px] text-muted mt-1.5 mb-0 leading-[1.55] max-w-[820px]">
          How often people submit their hours for approval. Each person submits either monthly or every 2 weeks, by pay period. Who does which is set on each person&apos;s page (Work tab) or in{' '}
          <Link href={withViewAs('/directory?tab=rates')} className="font-bold text-tn-teal hover:text-tn-ink">Directory › Rates &amp; Costs</Link>.
        </p>
      </div>

      <section className={`${CARD} gap-4`} aria-label="Pay periods">
        <div className="flex items-center justify-between gap-2.5 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Pay periods</span>
            <span className={`${TAG} text-tn-teal bg-tn-teal-soft`}>Every 2 weeks</span>
          </div>
          <span className="text-[12.5px] text-muted">{data.counts.biweekly} people submit every 2 weeks</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            {editing ? (
              <div className="flex flex-col gap-[5px]">
                <span className={`${FIELD_LABEL} min-h-4 flex items-center`}>A pay period starts on</span>
                <Select
                  fullWidth searchable
                  value={anchor ?? ''}
                  onChange={pick}
                  options={options}
                  placeholder="Choose"
                  ariaLabel="A pay period starts on"
                  className="h-10 px-3 bg-white border border-[var(--panel-border)] rounded-[10px] font-(family-name:--font-display) font-semibold text-[13px] tabular-nums lining-nums transition-colors hover:border-tn-teal aria-expanded:border-tn-teal aria-expanded:shadow-[0_0_0_3px_rgba(30,125,127,.15)]"
                />
              </div>
            ) : (
              <>
                <span className={FIELD_LABEL}>A pay period starts on</span>
                <div className={`${READ_BOX} tabular-nums lining-nums`}>{data.anchorLabel ?? 'Not set'}</div>
              </>
            )}
            <span className="text-[12px] text-muted">Any date. The next periods follow every 14 days from it.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className={FIELD_LABEL}>Length</span>
            <div className={READ_BOX}>2 weeks (14 days)</div>
          </div>
        </div>
        {moved && preview && (
          <div role="alert" className="flex gap-2.5 items-start rounded-[11px] bg-[var(--warn-bg)] border border-[#f0e2a8] px-[13px] py-[11px] text-[13px] text-tn-ink leading-[1.5]">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#8a6d1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 mt-px"><path d={ALERT} /></svg>
            <p className="m-0">{preview.movedText}</p>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <span className={FIELD_LABEL}>The periods it makes</span>
          <div className="flex flex-col border border-[var(--row-rule)] rounded-[12px] overflow-hidden">
            {periods.map(p => {
              const now = p.state === 'current'
              const past = p.state === 'closed'
              return (
                <div key={p.start} className={`grid grid-cols-[minmax(0,1fr)_150px] items-center gap-2.5 px-3.5 py-[9px] border-b border-[var(--row-rule)] tabular-nums lining-nums ${now ? 'bg-tn-teal-soft' : 'bg-white'}`}>
                  <span className={`text-[13px] ${now ? 'font-bold' : 'font-normal'} ${past ? 'text-muted' : 'text-tn-ink'}`}>{p.label}</span>
                  <span className="justify-self-end">
                    {past && <span className={`${TAG} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>Closed</span>}
                    {now && <span className={`${TAG} bg-tn-teal text-[#ffffff]`}>Current</span>}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section className={`${CARD} gap-2.5`} aria-label="Monthly">
        <div className="flex items-center gap-2.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">Monthly</span>
          <span className={`${TAG} text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)]`}>Every month</span>
        </div>
        <p className="m-0 text-[13.5px] text-foreground leading-[1.55]">From the 1st to the last day of each month, in each person&apos;s own time zone. Nothing to set.</p>
        <p className="m-0 text-[12.5px] text-muted">{data.counts.monthly} people submit monthly</p>
      </section>

      {error && <p role="alert" className="m-0 text-[13px] text-[#c8323d]">{error}</p>}

      {canEdit && (
        <div className="flex justify-end items-center gap-2.5 mt-1.5 pt-5 border-t border-slate-200">
          {editing && <span className="text-[13px] text-muted mr-auto">Editing. Changes apply when you press Done.</span>}
          {editing && <button type="button" disabled={pending} onClick={cancel} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] transition-colors hover:border-tn-teal disabled:opacity-60">Cancel</button>}
          <button type="button" aria-pressed={editing} disabled={pending} onClick={() => (editing ? done() : setEditing(true))} className={editing ? PERIODS_DONE : PERIODS_EDIT}>
            {editing ? (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            )}
            {editing ? 'Done' : <span className="text-[#ffffff]">Edit</span>}
          </button>
        </div>
      )}

      {dialog && dialogInfo && (
        <PeriodsDialog
          title={dialogInfo.title}
          intro={dialogInfo.intro}
          items={dialogInfo.items}
          action={dialogInfo.button}
          busy={pending}
          error={error}
          onCancel={() => setDialog(false)}
          onConfirm={move}
        />
      )}
      {toast}
    </div>
  )
}
