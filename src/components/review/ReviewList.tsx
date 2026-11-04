'use client'

/**
 * Human Resources > Reviews (design handoff, B1 and A5): one row a person for
 * the year, with the step, who it waits for, the due date and the Drive copy.
 * The numbers on top filter the list. Before the year starts, a Super Admin
 * sees what the cycle needs and starts it.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BTN, BTN_ICON } from '@/lib/ui/buttons'
import { withViewAs } from '@/components/ViewAsKeeper'
import { CARD, FIELD_LABEL, PAGE_TITLE, TH } from '@/lib/ui/type'
import { Pill, type PillToneName } from '@/components/ui/Pill'
import { Segmented } from '@/components/ui/Segmented'
import { StatusIcon } from '@/components/ui/StatusIcon'
import { Modal, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { fmtDay, initials } from '@/lib/review/format'

export interface ListRow {
  id: number; personId: string; name: string; sub: string; team: string; leader: string | null
  step: 'waiting' | 'self' | 'review' | 'meeting' | 'approval' | 'approved'; sentBack: boolean; booked: string | null
  waits: string; due: string | null; dueText: string; late: boolean; approvedOn: string | null; drive: 'waiting' | 'saved' | 'failed' | null
}
export interface ImportListRow { id: number; name: string; file: string; when: string | null }
export interface StartCheck { key: string; label: string; text: string; ok: boolean | 'warn'; href: string; action: string }

const STEP_PILL: Record<ListRow['step'], [string, PillToneName]> = {
  waiting: ['Not open yet', 'gray'], self: ['Self-review', 'blue'], review: ['Review', 'blue'], meeting: ['Meeting', 'blue'], approval: ['Approval', 'blue'], approved: ['Approved', 'green'],
}
type Filter = 'all' | 'self' | 'review' | 'meeting' | 'approved'

export function ReviewList({ year, years, intro, rows, imports, canPriorities, suggestions, start, onStart }: {
  year: number; years: number[]; intro: string; rows: ListRow[]; imports: ImportListRow[] | null
  canPriorities: boolean; suggestions: number
  start: { checks: StartCheck[]; leaders: number; noLeader: number; teamsOpenBy: string | null; canStart: boolean; /** May open Company settings: the Change links show (audit, 4 November 2026). */ canSettings: boolean; warn: string | null } | null
  onStart?: (i: { year: number }) => Promise<{ ok: true; toast?: string } | { ok: false; error: string }>
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const n = (f: (r: ListRow) => boolean) => rows.filter(f).length
  const selfRows = rows.filter(r => r.step === 'self' || r.step === 'waiting')
  const tiles: { key: Filter; label: string; value: number; sub: string; red?: boolean }[] = [
    { key: 'all', label: 'All', value: rows.length, sub: 'employees in the review' },
    { key: 'self', label: 'Waiting for self-review', value: selfRows.length, sub: [n(r => (r.step === 'self') && r.late) && `${n(r => r.step === 'self' && r.late)} late`, n(r => r.sentBack && r.step === 'self') && `${n(r => r.sentBack && r.step === 'self')} sent back`, n(r => r.step === 'waiting') && `${n(r => r.step === 'waiting')} not open yet`].filter(Boolean).join(', ') || 'on time', red: n(r => r.step === 'self' && r.late) > 0 },
    { key: 'review', label: 'In review', value: n(r => r.step === 'review'), sub: 'waiting on the reviewer' },
    { key: 'meeting', label: 'Meeting to book', value: n(r => r.step === 'meeting' && !r.booked), sub: rows.find(r => r.step === 'meeting')?.due ? `by ${fmtDay(rows.find(r => r.step === 'meeting')!.due)}` : 'none yet' },
    { key: 'approved', label: 'Approved', value: n(r => r.step === 'approved'), sub: driveSub(n(r => r.step === 'approved' && r.drive === 'failed'), n(r => r.step === 'approved' && r.drive === 'waiting')) },
  ]
  const shown = useMemo(() => rows.filter(r => filter === 'all' || (filter === 'self' ? r.step === 'self' || r.step === 'waiting' : filter === 'meeting' ? r.step === 'meeting' : filter === 'review' ? r.step === 'review' || r.step === 'approval' : r.step === filter)), [rows, filter])

  const [asking, setAsking] = useState(false)
  const begin = async () => {
    if (!onStart || !start) return
    setAsking(false)
    setBusy(true)
    try {
      const r = await onStart({ year })
      setToast(r.ok ? { text: r.toast ?? 'Started.' } : { text: r.error, error: true })
      if (r.ok) router.refresh()
    } finally { setBusy(false) }
  }
  const phase1 = start ? start.leaders + start.noLeader : 0
  const steps = start ? [
    `Phase 1 opens now for ${phase1} ${phase1 === 1 ? 'person' : 'people'}: ${[start.leaders && `the ${start.leaders} Team ${start.leaders === 1 ? 'Leader' : 'Leaders'}`, start.noLeader && `the ${start.noLeader} ${start.noLeader === 1 ? 'person' : 'people'} with no Team Leader`].filter(Boolean).join(' and ')}. Each gets an email and a row in Needs you.`,
    `Each team's self-reviews open when its priorities are approved${start.teamsOpenBy ? `, or on ${fmtDay(start.teamsOpenBy)} at the latest` : ''}. Its people get the same email then.`,
    'Reminders go out by email and in Needs you 1 week before, 3 days before and on the day of each due date.',
  ] : []
  const PLAY = 'M6 4l14 8-14 8z'

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[260px] flex flex-col gap-1.5">
          <h1 className={PAGE_TITLE}>Reviews</h1>
          <p className="m-0 text-[15px] text-muted leading-relaxed">{intro}</p>
        </div>
        {years.length > 1 && <Segmented label="Year" value={year} options={years.map(y => ({ key: y, label: String(y) }))} onChange={y => router.push(withViewAs(`/human-resources/reviews?year=${y}`))} />}
        {canPriorities && (
          <Link href="/human-resources/reviews/priorities" className={`${BTN.white} py-[9px]`}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 22V4M4 4h13l-2 4 2 4H4" /></svg>
            Edit priorities{suggestions > 0 && <Pill tone="amber" text={`${suggestions} ${suggestions === 1 ? 'suggestion' : 'suggestions'}`} />}
          </Link>
        )}
      </div>

      {start && (
        <div className="flex flex-wrap gap-5 items-start">
          <div className={`${CARD} px-[22px] py-5 flex flex-col gap-1 flex-[1_1_520px] min-w-0`}>
            <h2 className="m-0 mb-2 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">Ready to start the {year} cycle?</h2>
            {start.checks.map(c => (
              <div key={c.key} className="flex items-start gap-3 py-3 border-t border-[#f1f3f6]">
                <StatusIcon state={c.ok === true ? 'done' : c.ok === 'warn' ? 'progress' : 'todo'} size={18} className="mt-px" />
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[14px] font-bold text-tn-ink">{c.label}</span>
                  <span className={`text-[13px] leading-[1.5] ${c.ok === true ? 'text-[#5b6b82]' : 'text-[var(--bdg-orange-fg)]'}`}>{c.text}</span>
                </div>
                {(start.canSettings || !c.href.startsWith('/admin/')) && <Link href={c.href} className="font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-teal hover:text-tn-ink">{c.action}</Link>}
              </div>
            ))}
          </div>
          <div className={`${CARD} px-[22px] py-5 flex flex-col gap-3 flex-[1_1_360px] min-w-0`}>
            <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink">When you start it</h2>
            {steps.map((t, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-6 h-6 rounded-full bg-tn-ink text-[#F2C40A] font-(family-name:--font-display) font-black text-[12px] flex items-center justify-center flex-none">{i + 1}</span>
                <span className="text-[13.5px] leading-[1.55] text-[#435066]">{t}</span>
              </div>
            ))}
            <div className="pt-1.5">
              {start.canStart
                ? <><button type="button" disabled={busy || start.checks.some(c => c.ok === false)} className={`${BTN.navy} disabled:opacity-50`} onClick={() => setAsking(true)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PLAY} /></svg>Start the {year} cycle</button>
                  {start.checks.some(c => c.ok === false) && <span className="ml-3 text-[12.5px] text-muted">Set the dates first.</span>}</>
                : <p className="m-0 text-[13px] text-muted">A Super Admin starts the cycle.</p>}
            </div>
          </div>
        </div>
      )}

      {asking && start && (
        <Modal label={`Start the ${year} cycle?`} width={476} gap={12} alert onClose={() => setAsking(false)}>
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Start the {year} cycle?</h2>
          <p className="m-0 text-[13.5px] leading-[1.6] text-[#8593a4]">{phase1} {phase1 === 1 ? 'person gets their' : 'people get their'} self-review now, by email and in Needs you: the Team Leaders and the people with no Team Leader. Each team follows when its priorities are approved{start.teamsOpenBy ? `, or on ${fmtDay(start.teamsOpenBy)} at the latest` : ''}. The dates can still change in Company settings.</p>
          {start.warn && (
            <div className="flex gap-2.5 rounded-[10px] bg-[#fdf8e7] border border-[#f0e2a8] px-3 py-2.5 text-[13px] leading-[1.5] text-[#8a6d1a]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-px" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
              <p className="m-0">{start.warn}</p>
            </div>
          )}
          <div className="flex justify-end gap-2.5 pt-1">
            <button type="button" className={BTN.white} onClick={() => setAsking(false)}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>Cancel</button>
            <button type="button" disabled={busy} className={`${BTN.navy} disabled:opacity-50`} onClick={() => void begin()}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PLAY} /></svg>Start the cycle</button>
          </div>
        </Modal>
      )}

      {imports ? (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full min-w-[640px] border-collapse">
            <thead><tr><th className={TH}>Employee</th><th className={TH}>File</th><th className={TH}>Imported</th><th className={TH} /></tr></thead>
            <tbody>
              {imports.map(r => (
                <tr key={r.id} className="border-t border-[var(--row-rule)]">
                  <td className="px-4 py-3 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.name}</td>
                  <td className="px-4 py-3 text-[13px] text-[#435066]">{r.file}</td>
                  <td className="px-4 py-3 text-[13px] text-muted">{r.when ? fmtDay(r.when.slice(0, 10)) : ''}</td>
                  <td className="px-4 py-3 text-right"><a href={`/human-resources/imports/${r.id}/file`} target="_blank" rel="noopener noreferrer" className={BTN.smallWhite}>Open the PDF</a></td>
                </tr>
              ))}
              {!imports.length && <tr><td colSpan={4} className="px-4 py-6 text-[13px] text-muted">No {year} reviews imported yet. Import them in Company settings › Human Resources.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : rows.length > 0 && (
        <>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(170px,1fr))]">
            {tiles.map(t => (
              <button key={t.key} type="button" onClick={() => setFilter(t.key)} aria-pressed={filter === t.key}
                className={`${CARD} text-left px-4 py-3.5 flex flex-col gap-[7px] cursor-pointer ${filter === t.key ? 'border-tn-teal shadow-[0_0_0_3px_rgba(30,125,127,.12)]' : 'hover:border-tn-teal'}`}>
                <span className={FIELD_LABEL}>{t.label}</span>
                <span className="font-(family-name:--font-display) font-black text-[28px] text-tn-ink leading-none tabular-nums">{t.value}</span>
                <span className={`text-[12px] ${t.red ? 'text-[var(--bdg-red-fg)]' : 'text-[#8593a4]'}`}>{t.sub}</span>
              </button>
            ))}
          </div>
          <div className={`${CARD} overflow-x-auto`}>
            <table className="w-full min-w-[900px] border-collapse">
              <thead><tr className="bg-[#f4f2ec] border-b border-[#e4e7ec]"><th className={TH}>Employee</th><th className={TH}>Team</th><th className={TH}>Team Leader</th><th className={TH}>Step</th><th className={TH}>Waits for</th><th className={TH}>Due</th><th className={TH}>Drive</th></tr></thead>
              <tbody>
                {shown.map(r => {
                  const [label, tone] = r.sentBack && r.step === 'self' ? ['Sent back', 'amber' as PillToneName] : STEP_PILL[r.step]
                  return (
                    <tr key={r.id} onClick={() => router.push(withViewAs(`/human-resources/reviews/${r.id}`))} className="border-t border-[#f1f3f6] cursor-pointer hover:bg-[#fbfaf6]">
                      <td className="px-4 py-2.5">
                        <Link href={`/human-resources/reviews/${r.id}`} className="flex items-center gap-3 no-underline" onClick={e => e.stopPropagation()}>
                          <span className="w-8 h-8 rounded-full border border-[#dfe4ea] bg-[#eef1f5] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[11px] text-[#435066] flex-none">{initials(r.name)}</span>
                          <span className="flex flex-col min-w-0"><span className="text-[13.5px] font-bold text-tn-ink">{r.name}</span><span className="text-[12px] text-[#8593a4] truncate">{r.sub}</span></span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[13px] text-[#435066]">{r.team}</td>
                      <td className={`px-4 py-2.5 text-[13px] ${r.leader ? 'text-[#435066]' : 'text-[#8593a4]'}`}>{r.leader ?? 'No Team Leader'}</td>
                      <td className="px-4 py-2.5"><Pill tone={tone} text={label} /></td>
                      <td className="px-4 py-2.5 text-[13px] text-[#435066]">{r.waits}</td>
                      <td className={`px-4 py-2.5 text-[13px] font-bold ${r.late ? 'text-[var(--bdg-red-fg)]' : r.step === 'approved' ? 'text-[#8593a4]' : 'text-tn-ink'}`}>{r.step === 'approved' && r.approvedOn ? `Approved ${fmtDay(r.approvedOn.slice(0, 10)).replace(/^\w+, /, '')}` : r.dueText}</td>
                      <td className="px-4 py-2.5">{r.step === 'approved' && <DriveState s={r.drive ?? 'waiting'} />}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-[12.5px] text-[#8593a4]">{rows.length} {rows.length === 1 ? 'employee' : 'employees'} in the review. Every employee has one; anyone else is added in Company settings › Human Resources.</p>
        </>
      )}
      <Toast toast={toast} />
    </div>
  )
}

// The Drive column (design handoff, B1): a coloured word with its symbol, no pill.
/** The Approved tile's line: a failed copy is named first, it needs someone. */
function driveSub(failed: number, waiting: number): string {
  const parts = [failed && `${failed} failed to copy to Drive`, waiting && `${waiting} waiting to copy to Drive`].filter(Boolean)
  return parts.length ? parts.join(', ') : 'all in Drive'
}

function DriveState({ s }: { s: 'waiting' | 'saved' | 'failed' }) {
  const [fg, d, word] = s === 'saved' ? ['#0d7a4f', 'M5 12l5 5 9-10', 'Saved'] : s === 'failed' ? ['#c8323d', 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'Failed'] : ['#9a5a00', 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z', 'Waiting']
  return <span className="flex items-center gap-1.5 text-[12.5px] font-bold" style={{ color: fg }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>{word}</span>
}
