'use client'

/**
 * "This event, This and following events, All events": what a change or a
 * delete on one occurrence of a series reaches, as Google Calendar asks it
 * (owner, 30 October 2026).
 */

import { useState } from 'react'
import { Modal, MODAL_TITLE } from '@/components/clocky/entries/ui'
import type { Scope } from '@/lib/agenda/recurrence'
import { BTN } from '@/lib/ui/buttons'
import { CHECKBOX } from '@/lib/ui/fields'

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
            <input type="radio" name="scope" checked={scope === k} onChange={() => setScope(k)} className={CHECKBOX} />
            {l}
          </label>
        ))}
      </div>
      {del && <p className="m-0 text-[12.5px] text-muted leading-[1.5]">Everyone invited gets Google&apos;s cancellation for what is deleted.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={BTN.white}>Cancel</button>
        <button type="button" disabled={busy} onClick={() => onPick(scope)}
          className={`${del ? BTN.danger : BTN.navy} disabled:opacity-50`}>
          {busy ? (del ? 'Deleting…' : 'Saving…') : del ? 'Delete' : 'OK'}
        </button>
      </div>
    </Modal>
  )
}
