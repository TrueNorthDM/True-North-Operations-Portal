'use client'

/**
 * The card a time off, reimbursement or extra hours row opens on Approvals
 * (Clocky part 2, Approvals.dc.html 7C, 9C, 10D): who asked and when, the
 * facts, the receipt (reimbursements), the team calendar (time off), the
 * allowance (extra hours), what approving does by itself, and Approve or Deny
 * with a reason. Read only for whoever does not decide it.
 */

import { useState } from 'react'
import { withViewAs } from '@/components/ViewAsKeeper'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { RequestCard as Card } from '@/lib/timeclock/request-cards'
import { CloseButton, FieldLabel, Icon, Modal, TEXTAREA_WARN } from '../entries/ui'

const TYPE: Record<Card['kind'], { bg: string; fg: string }> = {
  off: { bg: '#eef1fb', fg: '#3b4fa8' }, 'off-cancel': { bg: '#eef1fb', fg: '#3b4fa8' }, rmb: { bg: '#fbf3e4', fg: '#8a5a12' }, xh: { bg: '#f0edfb', fg: '#5847c9' },
}

export function RequestCard({ card, who, initials, team, asked, busy, denyFirst, onClose, onApprove, onDeny }: {
  card: Card
  who: string
  initials: string
  team: { name: string; color: string | null } | null
  asked: string
  busy: boolean
  denyFirst: boolean
  onClose: () => void
  onApprove: () => void
  onDeny: (reason: string) => void
}) {
  const [deny, setDeny] = useState(denyFirst)
  const [reason, setReason] = useState('')
  const t = TYPE[card.kind]
  return (
    <Modal label={card.type} width={card.width - 44} onClose={onClose} gap={16}>
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase rounded-full px-[9px] py-1" style={{ background: t.bg, color: t.fg }}>{card.type}</span>
          <span className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink tabular-nums lining-nums">{card.title}</span>
        </div>
        <CloseButton onClick={onClose} />
      </div>
      <div className="flex items-center gap-[11px]">
        <span className="flex-none w-9 h-9 rounded-full bg-tn-primary text-[#ffffff] text-[12px] font-bold flex items-center justify-center">{initials}</span>
        <div className="flex flex-col gap-0.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{who}</span>
          <span className="flex items-center gap-1.5 text-[12px] text-muted"><span className="w-2 h-2 rounded-full" style={{ background: team?.color ?? 'var(--faint)' }} />{team?.name ?? 'No team'} · {asked}</span>
        </div>
      </div>
      <div className={`grid gap-[18px] items-start ${card.twoCols ? 'grid-cols-1 md:grid-cols-[minmax(0,.9fr)_minmax(0,1fr)]' : 'grid-cols-1'}`}>
        {card.receipt && (
          <div className="flex flex-col gap-2">
            <div className="h-[300px] rounded-[12px] bg-subtle border border-dashed border-[#cbd2da] flex flex-col items-center justify-center gap-2 text-center p-4 box-border">
              <Icon d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2zM9 8h6M9 12h6M9 16h3" size={34} color="#8593a4" width={1.6} />
              <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink break-all">{card.receipt.file}</span>
              <span className="text-[12px] text-muted">{card.receipt.sub}</span>
            </div>
            <a href={withViewAs(`/requests/reimbursements/receipt/${card.receipt.id}`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-tn-teal">
              <Icon d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" size={13} width={2.2} />Open the receipt full size
            </a>
          </div>
        )}
        <div className="flex flex-col gap-2.5 min-w-0">
          {card.facts.map(f => (
            <div key={f.k} className="flex flex-col gap-[3px] pb-[9px] border-b border-[var(--row-rule)]">
              <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted">{f.k}</span>
              <span className="text-[13.5px] text-tn-ink font-semibold leading-[1.45] tabular-nums lining-nums [text-wrap:pretty]">{f.v}</span>
            </div>
          ))}
          {card.allow && <div className="border border-[#f0e2a8] bg-[var(--warn-bg)] rounded-[11px] px-[13px] py-[11px] text-[12.5px] text-[#8a6d1a] leading-[1.5] font-semibold tabular-nums lining-nums">{card.allow}</div>}
        </div>
      </div>
      {card.cal && (
        <div className="flex flex-col gap-2">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{card.cal.label}</span>
          <div className="border border-[var(--panel-border)] rounded-[12px] overflow-hidden">
            <div className="grid bg-subtle border-b border-[var(--panel-border)]" style={{ gridTemplateColumns: `180px repeat(${card.cal.days.length},minmax(0,1fr))` }}>
              <div />
              {card.cal.days.map(d => <div key={d} className="px-1 py-2 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.06em] uppercase text-muted text-center">{d}</div>)}
            </div>
            {card.cal.rows.map(r => (
              <div key={r.name} className="grid items-center border-b border-[var(--row-rule)]" style={{ gridTemplateColumns: `180px repeat(${card.cal!.days.length},minmax(0,1fr))` }}>
                <div className="px-3 py-[7px] flex flex-col gap-px"><span className="font-(family-name:--font-display) font-bold text-[13px] text-tn-ink">{r.name}</span><span className="text-[11.5px] text-muted">{r.sub}</span></div>
                {r.cells.map((c, i) => (
                  <div key={i} className="px-[3px] py-2">
                    <div className="h-[22px] rounded-[6px] box-border" style={{ background: !c ? 'transparent' : c === 'hol' ? '#e4e7ec' : c === 'req' ? r.color : 'rgba(169,155,212,.45)', border: c === 'req' ? '2px solid #012358' : '0' }} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="text-[12.5px] text-[#5b6b82] leading-[1.55] bg-subtle rounded-[11px] px-[13px] py-[11px] [text-wrap:pretty]">{card.after}</div>
      {card.canDecide && (
        <>
          {deny && (
            <label className="flex flex-col gap-[5px]">
              <FieldLabel warn>Reason (required)</FieldLabel>
              <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} placeholder="Tell them why" className={TEXTAREA_WARN} autoFocus />
            </label>
          )}
          <div className="flex justify-end gap-2">
            {!deny ? (
              <>
                <button type="button" disabled={busy} onClick={() => setDeny(true)} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-[#c8323d] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-[#c8323d]">{card.denyLabel}</button>
                <button type="button" disabled={busy} onClick={onApprove} className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-60">
                  <Icon d="M5 12l5 5 9-10" size={14} color={BTN_ICON.navy} width={3} />{card.approveLabel}
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => { setDeny(false); setReason('') }} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">Cancel</button>
                <button type="button" disabled={!reason.trim() || busy} onClick={() => onDeny(reason.trim())} className="border-0 rounded-[10px] px-[18px] py-[11px] bg-[#c8323d] text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#b02a34] disabled:opacity-45 disabled:cursor-not-allowed">{card.denyLabel}</button>
              </>
            )}
          </div>
        </>
      )}
      {card.roText && <div className="text-[12.5px] text-[#5b6b82] bg-[var(--chip-neutral-bg)] rounded-[10px] px-3 py-2.5">{card.roText}</div>}
    </Modal>
  )
}
