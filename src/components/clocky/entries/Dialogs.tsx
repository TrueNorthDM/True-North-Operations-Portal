'use client'

/**
 * The smaller windows of Time entries and Approvals (Time Entries.dc.html):
 * 3H submit the period, 3I delete an entry, 3J a time off request, 3K-3 a
 * time correction under review, and the reason the week grid asks for on Save.
 */

import { useState } from 'react'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { formatDuration } from '@/lib/timeclock/rounding'
import type { PillTone, SubmitSummary } from '@/lib/timeclock/clocky-types'
import { CloseButton, FieldLabel, Icon, ICON, LABEL, MODAL_TITLE, Modal, Pill, TEXTAREA_PLAIN, TEXTAREA_WARN } from './ui'

const DISABLED = 'disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:translate-y-0'
const DANGER_WHITE = BTN.white.replace('text-tn-ink', 'text-[#c8323d]').replace('hover:border-tn-teal', 'hover:border-[#c8323d]')

// ── 3I ──────────────────────────────────────────────────────────────────────

export function DeleteDialog({ text, busy, onClose, onDelete }: {
  /** "2 - i7 Marketing › Web Dev, Thu, Oct 15, 9:45 AM to 11:00 AM (1h 15m)." */
  text: string
  busy: boolean
  onClose: () => void
  onDelete: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const ok = !!reason.trim() && !busy
  return (
    <Modal label="Delete entry" width={440} onClose={onClose} alert gap={12}>
      <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>Delete this entry?</h2>
      <p className="m-0 text-[13.5px] text-foreground leading-[1.55] tabular-nums">{text} This cannot be undone.</p>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel warn>Reason (required)</FieldLabel>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why are you deleting this entry?" className={TEXTAREA_WARN} />
      </label>
      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onClose} className={BTN.white}>Cancel</button>
        <button type="button" disabled={!ok} onClick={() => onDelete(reason.trim())}
          className="inline-flex items-center rounded-[10px] px-[18px] py-[11px] bg-[#c8323d] text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] tracking-[.02em] hover:bg-[#b02a34] disabled:opacity-45 disabled:cursor-not-allowed">
          Delete
        </button>
      </div>
    </Modal>
  )
}

// ── 3H ──────────────────────────────────────────────────────────────────────

const CARD = 'bg-subtle rounded-[12px] px-3.5 py-3'

export function SubmitDialog({ summary, error, busy, clockHref, onClose, onSubmit, onFix }: {
  summary: SubmitSummary | null
  error: string | null
  busy: boolean
  /** "Open the clock": the top bar opens the panel on ?clock=open. */
  clockHref: string
  onClose: () => void
  onSubmit: () => void
  onFix: (key: string) => void
}) {
  const s = summary
  const done = s?.state === 'submitted' || s?.state === 'approved'
  const disabled = busy || !s || s.attention.length > 0 || done || !s.canSubmit
  return (
    <Modal label="Submit the period" width={520} onClose={onClose}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>{s?.title ?? 'Submit'}</h2>
        <CloseButton onClick={onClose} />
      </div>
      {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
      {s && <div className="text-[12.5px] text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-[9px] px-[11px] py-2 leading-[1.45]">{s.cadenceLine}</div>}
      {s?.running && (
        <>
          <div role="alert" className="flex gap-2.5 items-center rounded-[11px] bg-[#fdeeef] border border-[#f3c6ca] px-3.5 py-3 text-[13.5px] text-[#c8323d] font-bold">
            <Icon d={ICON.clock} size={17} />Clock out first. Your clock is running.
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={BTN.white}>Close</button>
            <a href={clockHref} className={BTN.navy}>Open the clock</a>
          </div>
        </>
      )}
      {s && !s.running && (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <div className={CARD}>
              <div className={`${LABEL} text-muted`}>Total</div>
              <div className="font-(family-name:--font-display) font-black text-[22px] text-tn-ink mt-1 tabular-nums">{formatDuration(s.totalSeconds)}</div>
            </div>
            <div className={CARD}>
              <div className={`${LABEL} text-muted`}>Days with no time</div>
              <div className="text-[13px] text-foreground mt-1.5 leading-[1.45]">{s.noTime}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <div className={`${LABEL} text-muted`}>By client</div>
            {s.byClient.map(c => (
              <div key={c.client} className="flex justify-between text-[13px] border-b border-[var(--row-rule)] pb-1.5">
                <span className="text-tn-ink font-semibold">{c.client}</span>
                <span className="tabular-nums">{formatDuration(c.seconds)}</span>
              </div>
            ))}
          </div>
          {s.attention.length > 0 && (
            <div className="flex flex-col gap-2 border border-[#f0e2a8] bg-[var(--warn-bg)] rounded-[12px] px-3.5 py-3">
              <div className="text-[13px] font-bold text-tn-ink">Fix these first ({s.attention.length}):</div>
              {s.attention.map(a => (
                <div key={a.key} className="flex justify-between items-center gap-2.5 text-[12.5px] text-foreground">
                  <span className="min-w-0 tabular-nums"><b className="text-tn-ink">{a.reason}</b> · {a.sub}</span>
                  <button type="button" onClick={() => onFix(a.key)} className="border-0 bg-transparent p-0 text-[12.5px] font-bold text-tn-teal hover:text-tn-ink">Fix</button>
                </div>
              ))}
            </div>
          )}
          <div className="text-[12px] text-muted leading-normal">{s.lockNote}</div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className={BTN.white}>Cancel</button>
            <button type="button" disabled={disabled} onClick={onSubmit} className={`${BTN.navy} ${DISABLED}`}>
              <Icon d={ICON.send} size={14} color={BTN_ICON.navy} width={2.4} />Submit {s.label}
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

// ── 3K-3 and 3J: a request under review ─────────────────────────────────────

const STATE_TONE: Record<string, PillTone> = { pending: 'warn', approved: 'ok', denied: 'bad' }
const stateText = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function DetailGrid({ rows }: { rows: [string, string, boolean?][] }) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px] tabular-nums">
      {rows.map(([k, v, soft]) => (
        <div key={k} className="contents">
          <span className="text-muted">{k}</span>
          <span className={soft ? 'text-foreground leading-normal' : 'text-tn-ink font-semibold'}>{v}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * 3K-3: "Time correction request", read only, with Approve (the time becomes
 * an entry marked Edited) and Deny (a reason, asked on the first press).
 */
export function CorrectionReview({ who, goesTo, state, date, time, job, reason, overlap, canDecide, denyFirst, busy, onClose, onApprove, onDeny }: {
  who: string
  /** "Rock Kai": who decides it ("Clarise Nixon · goes to Rock Kai"). */
  goesTo: string
  state: string
  date: string
  time: string
  job: string
  reason: string
  overlap: string | null
  canDecide: boolean
  /** Opened by Deny: the reason field shows at once. */
  denyFirst: boolean
  busy: boolean
  onClose: () => void
  onApprove: () => void
  onDeny: (note: string) => void
}) {
  const [deny, setDeny] = useState(denyFirst)
  const [note, setNote] = useState('')
  const first = who.split(' ')[0]
  return (
    <Modal label="Time correction request" width={480} onClose={onClose}>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>Time correction request</h2>
          <div className="text-[13px] text-foreground mt-1">{who} · goes to {goesTo}</div>
        </div>
        <Pill text={stateText(state)} tone={STATE_TONE[state] ?? 'neutral'} size="md" />
      </div>
      <DetailGrid rows={[['Date', date], ['Time', time], ['Job', job], ['What happened', reason, true]]} />
      {overlap && <div role="alert" className="text-[12.5px] font-bold text-[#c8323d]">{overlap}</div>}
      {deny && canDecide && (
        <label className="flex flex-col gap-[5px]">
          <FieldLabel>Reason for denying (required)</FieldLabel>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} className={TEXTAREA_PLAIN} />
        </label>
      )}
      {canDecide && <div className="text-[12px] text-muted leading-normal">Approving adds the time to {first}&apos;s entries, marked Edited, with this request in its history.</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN.white}>Close</button>
        {canDecide && (
          <>
            <button type="button" disabled={busy} onClick={() => { if (!deny) setDeny(true); else if (note.trim()) onDeny(note.trim()) }}
              style={{ opacity: deny && !note.trim() ? 0.5 : 1 }} className={DANGER_WHITE}>Deny</button>
            <button type="button" disabled={busy || !!overlap} onClick={onApprove} className={`${BTN.navy} ${DISABLED}`}>
              <Icon d={ICON.check} size={14} color={BTN_ICON.navy} width={3} />Approve
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

/** 3J: "Time off request", read only, Approve and Deny for Super Admins. */
export function TimeOffCard({ who, state, type, dates, hours, note, canDecide, denyFirst, busy, onClose, onApprove, onDeny }: {
  who: string
  state: string
  type: string
  dates: string
  hours: string
  note: string
  canDecide: boolean
  denyFirst: boolean
  busy: boolean
  onClose: () => void
  onApprove: () => void
  onDeny: (note: string) => void
}) {
  const [deny, setDeny] = useState(denyFirst)
  const [reason, setReason] = useState('')
  return (
    <Modal label="Time off request" width={440} onClose={onClose}>
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h2 className={MODAL_TITLE} style={{ letterSpacing: 'normal' }}>Time off request</h2>
          <div className="text-[13px] text-foreground mt-1">{who}</div>
        </div>
        <Pill text={stateText(state)} tone={STATE_TONE[state] ?? 'neutral'} size="md" />
      </div>
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2 text-[13px]">
        <span className="text-muted">Type</span><span className="text-tn-ink font-semibold">{type}</span>
        <span className="text-muted">Dates</span><span className="text-tn-ink font-semibold">{dates}</span>
        <span className="text-muted">Hours</span><span className="text-tn-ink font-semibold tabular-nums">{hours}</span>
        <span className="text-muted">Note</span><span className="text-foreground">{note}</span>
      </div>
      {deny && canDecide && (
        <label className="flex flex-col gap-[5px]">
          <FieldLabel>Reason (required)</FieldLabel>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className={TEXTAREA_PLAIN} />
        </label>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN.white}>Close</button>
        {canDecide && (
          <>
            <button type="button" disabled={busy} onClick={() => { if (!deny) setDeny(true); else if (reason.trim()) onDeny(reason.trim()) }}
              style={{ opacity: deny && !reason.trim() ? 0.5 : 1 }} className={DANGER_WHITE}>Deny</button>
            <button type="button" disabled={busy} onClick={onApprove} className={`${BTN.navy} ${DISABLED}`}>
              <Icon d={ICON.check} size={14} color={BTN_ICON.navy} width={3} />Approve
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

// ── The week grid's reason ──────────────────────────────────────────────────

/**
 * Save on the week grid asks for the reason every change needs ("Saving asks
 * for a reason", the grid's note). The design draws no window for it: this
 * one is 3I's shape with 3E's reason field.
 */
export function GridReasonDialog({ busy, onClose, onSave }: { busy: boolean; onClose: () => void; onSave: (reason: string) => void }) {
  const [reason, setReason] = useState('')
  const ok = !!reason.trim() && !busy
  return (
    <Modal label="Reason for the change" width={440} onClose={onClose} gap={12}>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel warn>Reason for the change (required)</FieldLabel>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Why are you changing these hours?" className={TEXTAREA_WARN} />
      </label>
      <div className="flex justify-end gap-2 mt-1">
        <button type="button" onClick={onClose} className={BTN.white}>Cancel</button>
        <button type="button" disabled={!ok} onClick={() => onSave(reason.trim())} className={`${BTN.navy} ${DISABLED}`}>
          <Icon d={ICON.check} size={14} color={BTN_ICON.navy} width={3} />Save
        </button>
      </div>
    </Modal>
  )
}
