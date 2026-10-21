'use client'

/**
 * 2E, "Clock out for them..." (Who's Working.dc.html): a Super Admin ends
 * someone's running clock. The end time (now, or every 5 minutes back to the
 * start, in the viewer's time and theirs) and a required reason; the entry is
 * marked "Clocked out by" the viewer.
 */

import { useState } from 'react'
import type { WorkingPerson } from '@/lib/timeclock/clocky-types'
import { BTN_DANGER, ClockField, FOCUS, HeadButton, ICON, INPUT_FOCUS, Icon, SectionLabel, StopIcon } from '../clock/ClockParts'
import { ClockWindow } from '../clock/ComboModals'
import { BTN_MODAL_WHITE } from '../entries/ui'
import { currentEntryLine, endTimeOptions } from './working-model'

export function ClockOutForDialog({ person, meName, viewerZone, nowMs, busy, contained, initialReason = '', onClose, onConfirm }: {
  person: WorkingPerson
  meName: string
  viewerZone: string
  nowMs: number
  busy: boolean
  contained?: boolean
  initialReason?: string
  onClose: () => void
  onConfirm: (end: string, reason: string) => void
}) {
  // The options are fixed when the window opens, so "Now" stays the moment it was opened.
  const [opened] = useState(nowMs)
  const options = endTimeOptions(person, opened, viewerZone)
  const [end, setEnd] = useState(options[0]?.value ?? 'now')
  const [reason, setReason] = useState(initialReason)
  const ready = !!reason.trim() && !busy
  const first = person.name.split(' ')[0]
  return (
    <ClockWindow label="Clock out for them" width={504} contained={contained} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2.5">
          <div>
            <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink" style={{ letterSpacing: 'normal' }}>{`Clock out ${person.name}`}</h2>
            <div className="text-[13px] text-foreground leading-[1.5] mt-1.5">{currentEntryLine(person, opened, viewerZone)}</div>
          </div>
          <HeadButton label="Close" onClick={onClose}><Icon d={ICON.close} size={17} sw={2.2} join={null} /></HeadButton>
        </div>
        <ClockField label="End time (your time, their time)" value={end} options={options} onChange={setEnd} search />
        <label className="flex flex-col gap-[5px]">
          <SectionLabel>Reason (required)</SectionLabel>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Why are you stopping this clock?"
            className={`w-full box-border resize-y px-3 py-2.5 border border-[var(--panel-border)] rounded-[10px] text-[13px] text-tn-ink placeholder:text-muted ${INPUT_FOCUS}`} />
        </label>
        <div className="text-[12px] text-muted leading-[1.5]">{`The entry is marked "Clocked out by ${meName}". The reason is kept in its history, and ${first} gets a notification.`}</div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={`${BTN_MODAL_WHITE} ${FOCUS}`}>Cancel</button>
          <button type="button" onClick={() => ready && onConfirm(end, reason.trim())} disabled={!ready}
            className={`${BTN_DANGER} disabled:opacity-40 disabled:cursor-not-allowed ${FOCUS}`}>
            <StopIcon size={12} color="#ffffff" />Clock out
          </button>
        </div>
      </div>
    </ClockWindow>
  )
}
