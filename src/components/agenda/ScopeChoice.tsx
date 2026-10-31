'use client'

/**
 * "This event, This and following events, All events": what a change or a
 * delete on one occurrence of a series reaches, as Google Calendar asks it
 * (owner, 30 October 2026).
 */

import { useState } from 'react'
import { Modal, MODAL_TITLE } from '@/components/clocky/entries/ui'
import type { Scope } from '@/lib/agenda/recurrence'

const CHOICES: [Scope, string][] = [['one', 'This event'], ['following', 'This and following events'], ['all', 'All events']]

export function ScopeChoice({ action, busy, onPick, onClose }: { action: 'save' | 'delete'; busy: boolean; onPick: (s: Scope) => void; onClose: () => void }) {
  const [scope, setScope] = useState<Scope>('one')
  const del = action === 'delete'
  return (
    <Modal label={del ? 'Delete a repeating event' : 'Change a repeating event'} width={400} alert onClose={onClose}>
      <h2 className={MODAL_TITLE}>{del ? 'Delete repeating event' : 'Edit repeating event'}</h2>
      <div className="flex flex-col gap-1" role="radiogroup" aria-label="Which events">
        {CHOICES.map(([k, l]) => (
          <label key={k} className="flex items-center gap-3 rounded-[10px] px-2.5 py-2 cursor-pointer hover:bg-subtle text-[14px] text-tn-ink font-semibold">
            <input type="radio" name="scope" checked={scope === k} onChange={() => setScope(k)} className="w-4 h-4 accent-[#012358]" />
            {l}
          </label>
        ))}
      </div>
      {del && <p className="m-0 text-[12.5px] text-muted leading-[1.5]">Everyone invited gets Google&apos;s cancellation for what is deleted.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer">Cancel</button>
        <button type="button" disabled={busy} onClick={() => onPick(scope)}
          className={`border-0 rounded-[10px] px-4 py-2.5 text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer disabled:opacity-50 ${del ? 'bg-[#c8323d]' : 'bg-tn-primary'}`}>
          {busy ? (del ? 'Deleting…' : 'Saving…') : del ? 'Delete' : 'OK'}
        </button>
      </div>
    </Modal>
  )
}
