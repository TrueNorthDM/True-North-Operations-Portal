'use client'

/**
 * Invoices sent through the invoice form by someone not in the Directory
 * (migration 147, decision B), on top of the Invoices list: who sent it, the
 * month, every line and the files, and "Link to this person". Linked, it
 * becomes that person's numbered invoice, waiting for its approver. Only the
 * default approver, Admins and Super Admins link; Finance sees them.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { withViewAs } from '@/components/ViewAsKeeper'
import { Select, type SelectOption } from '@/components/ui/Select'
import { Pill } from '@/components/ui/Pill'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { SELECT_FIELD } from '@/lib/ui/fields'
import { ERROR_BOX } from '@/lib/ui/feedback'
import { CARD, CARD_TITLE } from '@/lib/ui/type'
import { failText } from '@/lib/ui/action-error'
import type { WaitingSender } from '@/lib/invoice-form/data'
import type { Result } from '@/lib/timeclock/clocky-types'
import { Icon, ICON, Toast, type ToastState } from '../entries/ui'

export type LinkSender = (i: { id: number; personId: string }) => Promise<Result<{ toast: string }>>

function One({ s, people, link, say }: { s: WaitingSender; people: SelectOption[]; link: LinkSender | null; say: (t: ToastState) => void }) {
  const router = useRouter()
  const [personId, setPersonId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const go = async () => {
    if (!link || !personId) return
    setBusy(true); setError(null)
    try {
      const r = await link({ id: s.id, personId })
      if (r.ok) { say({ text: r.toast }); router.refresh() }
      else setError(r.error)
    } catch (e) { setError(failText(e)) } finally { setBusy(false) }
  }
  return (
    <div className="px-[18px] py-4 border-t border-[var(--row-rule)] first:border-t-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
      <div className="flex flex-col gap-1.5 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{s.name}</span>
          <span className="text-[12.5px] text-muted break-all">{s.email}</span>
        </div>
        <span className="text-[12.5px] text-muted">{s.line}</span>
        <span className="text-[13px] text-foreground">{s.month} · Came from {s.how.replace(/^The /, 'the ')} · sent {s.sentOn}</span>
        <div className="mt-1 rounded-[10px] border border-[var(--panel-border)] overflow-hidden">
          {s.lines.map((l, i) => (
            <div key={i} className="flex justify-between gap-3 px-3 py-2 border-t border-[var(--row-rule)] first:border-t-0 text-[12.5px]">
              <span className="text-tn-ink min-w-0 [overflow-wrap:anywhere]">{l.text}</span><span className="font-bold text-tn-ink tabular-nums whitespace-nowrap">{l.amount}</span>
            </div>
          ))}
          <div className="flex justify-between px-3 py-2 bg-subtle font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink tabular-nums"><span>Total due</span><span>{s.total}</span></div>
        </div>
        {s.files.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {s.files.map(f => <a key={f.key} href={withViewAs(`/clocky-hours/invoices/new-sender/${s.id}/${f.key}`)} target="_blank" rel="noreferrer" className={`${BTN.link} break-all`}>{f.label}</a>)}
          </div>
        )}
      </div>
      {link ? (
        <div className="flex flex-col gap-2">
          <Select fullWidth searchable value={personId} onChange={setPersonId} options={people} placeholder="Pick the person" ariaLabel={`The person who sent ${s.name}'s invoice`} className={SELECT_FIELD} />
          <button type="button" disabled={!personId || busy} onClick={() => void go()} className={`${BTN.navy} justify-center disabled:opacity-45 disabled:cursor-not-allowed`}>
            <Icon d={ICON.check} size={14} color={BTN_ICON.navy} width={3} />{busy ? 'Linking…' : 'Link to this person'}
          </button>
          {error && <div role="alert" className={ERROR_BOX}>{error}</div>}
          <span className="text-[12px] text-muted leading-[1.45]">Not in the Directory yet? Add them in Admin, People (Add person), then link here. Linked, it gets its number and waits for approval like any invoice.</span>
        </div>
      ) : (
        <span className="text-[12.5px] text-muted">The default approver links it to a person.</span>
      )}
    </div>
  )
}

export function NewSenders({ senders, people, link }: { senders: WaitingSender[]; people: SelectOption[]; link: LinkSender | null }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }
  if (!senders.length) return <Toast toast={toast} />
  return (
    <div className={`${CARD} overflow-hidden`}>
      <div className="px-[18px] py-3.5 flex items-center gap-2.5 flex-wrap border-b border-[var(--panel-border)]">
        <h2 className={CARD_TITLE}>New sender, not in the Directory</h2>
        <Pill tone="amber" text={`${senders.length} waiting`} />
      </div>
      {senders.map(s => <One key={s.id} s={s} people={people} link={link} say={say} />)}
      <Toast toast={toast} />
    </div>
  )
}
