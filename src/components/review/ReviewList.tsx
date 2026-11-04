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
import { useConfirm } from '@/components/ui/useConfirm'
import { Toast, type ToastState } from '@/components/clocky/entries/ui'
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
  start: { checks: StartCheck[]; phase1: number; teamsOpenBy: string | null; canStart: boolean } | null
  onStart?: (i: { year: number }) => Promise<{ ok: true; toast?: string } | { ok: false; error: string }>
}) {
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('all')
  const [toast, setToast] = useState<ToastState | null>(null)
  const [busy, setBusy] = useState(false)
  const [dialog, confirm] = useConfirm()
  const n = (f: (r: ListRow) => boolean) => rows.filter(f).length
  const selfRows = rows.filter(r => r.step === 'self' || r.step === 'waiting')
  const tiles: { key: Filter; label: string; value: number; sub: string; red?: boolean }[] = [
    { key: 'all', label: 'All', value: rows.length, sub: 'in the review' },
    { key: 'self', label: 'Waiting for self-review', value: selfRows.length, sub: [n(r => (r.step === 'self') && r.late) && `${n(r => r.step === 'self' && r.late)} late`, n(r => r.sentBack && r.step === 'self') && `${n(r => r.sentBack && r.step === 'self')} sent back`].filter(Boolean).join(', ') || 'on time', red: n(r => r.step === 'self' && r.late) > 0 },
    { key: 'review', label: 'In review', value: n(r => r.step === 'review'), sub: 'waiting on the reviewer' },
    { key: 'meeting', label: 'Meeting to book', value: n(r => r.step === 'meeting' && !r.booked), sub: rows.find(r => r.step === 'meeting')?.due ? `by ${fmtDay(rows.find(r => r.step === 'meeting')!.due)}` : 'none yet' },
    { key: 'approved', label: 'Approved', value: n(r => r.step === 'approved'), sub: n(r => r.step === 'approved' && r.drive !== 'saved') ? `${n(r => r.step === 'approved' && r.drive !== 'saved')} waiting to copy to Drive` : 'all in Drive' },
  ]
  const shown = useMemo(() => rows.filter(r => filter === 'all' || (filter === 'self' ? r.step === 'self' || r.step === 'waiting' : filter === 'meeting' ? r.step === 'meeting' : filter === 'review' ? r.step === 'review' || r.step === 'approval' : r.step === filter)), [rows, filter])

  const begin = async () => {
    if (!onStart || !start) return
    const ok = await confirm({ title: `Start the ${year} cycle?`, action: 'Start the cycle',
      body: <><p className="m-0">{start.phase1} {start.phase1 === 1 ? 'person gets their' : 'people get their'} self-review now, by email and in Needs you: the Team Leaders and the people with no Team Leader. Each team follows when its priorities are approved{start.teamsOpenBy ? `, or on ${fmtDay(start.teamsOpenBy)} at the latest` : ''}. The dates can still change in Company settings.</p>
        {start.checks.some(c => c.ok === 'warn') && <p className="m-0 mt-2 text-[var(--bdg-orange-fg)]">{start.checks.filter(c => c.ok === 'warn').map(c => c.text).join(' ')}</p>}</> })
    if (!ok) return
    setBusy(true)
    try {
      const r = await onStart({ year })
      setToast(r.ok ? { text: r.toast ?? 'Started.' } : { text: r.error, error: true })
      if (r.ok) router.refresh()
    } finally { setBusy(false) }
  }

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
        <div className={`${CARD} px-[22px] py-5 flex flex-col gap-4`}>
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[19px] text-tn-ink">Ready to start the {year} cycle?</h2>
          <div className="flex flex-col">
            {start.checks.map(c => (
              <div key={c.key} className="flex items-center gap-3 py-2.5 border-t border-[var(--row-rule)] first:border-t-0 flex-wrap">
                <StatusIcon state={c.ok === true ? 'done' : c.ok === 'warn' ? 'progress' : 'todo'} size={18} />
                <span className="w-[200px] flex-none font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{c.label}</span>
                <span className="flex-1 min-w-[200px] text-[13px] text-[#435066]">{c.text}</span>
                <Link href={c.href} className={BTN.smallWhite}>{c.action}</Link>
              </div>
            ))}
          </div>
          <div className="rounded-[12px] bg-subtle px-4 py-3 flex flex-col gap-2 text-[13px] text-[#435066]">
            <span className={FIELD_LABEL}>When you start it</span>
            <span><strong className="text-tn-ink">1</strong> Phase 1 opens now for {start.phase1} {start.phase1 === 1 ? 'person' : 'people'}: the Team Leaders and the people with no Team Leader. Each gets an email and a row in Needs you.</span>
            <span><strong className="text-tn-ink">2</strong> Each team&apos;s self-reviews open when its priorities are approved{start.teamsOpenBy ? `, or on ${fmtDay(start.teamsOpenBy)} at the latest` : ''}. Its people get the same email then.</span>
            <span><strong className="text-tn-ink">3</strong> Reminders go out by email and in Needs you 1 week before, 3 days before and on the day of each due date.</span>
          </div>
          {start.canStart
            ? <div><button type="button" disabled={busy || start.checks.some(c => c.ok === false)} className={`${BTN.navy} disabled:opacity-50`} onClick={() => void begin()}>Start the {year} cycle</button>
              {start.checks.some(c => c.ok === false) && <span className="ml-3 text-[12.5px] text-muted">Set the dates first.</span>}</div>
            : <p className="m-0 text-[13px] text-muted">A Super Admin starts the cycle.</p>}
        </div>
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
                className={`${CARD} text-left px-4 py-3.5 flex flex-col gap-1 cursor-pointer ${filter === t.key ? 'border-tn-teal shadow-[0_0_0_2px_rgba(30,125,127,.15)]' : 'hover:border-tn-teal'}`}>
                <span className={FIELD_LABEL}>{t.label}</span>
                <span className="font-(family-name:--font-display) font-black text-[26px] text-tn-ink leading-none tabular-nums">{t.value}</span>
                <span className={`text-[12.5px] ${t.red ? 'text-[var(--bdg-red-fg)]' : 'text-muted'}`}>{t.sub}</span>
              </button>
            ))}
          </div>
          <div className={`${CARD} overflow-x-auto`}>
            <table className="w-full min-w-[900px] border-collapse">
              <thead><tr><th className={TH}>Employee</th><th className={TH}>Team</th><th className={TH}>Team Leader</th><th className={TH}>Step</th><th className={TH}>Waits for</th><th className={TH}>Due</th><th className={TH}>Drive</th></tr></thead>
              <tbody>
                {shown.map(r => {
                  const [label, tone] = r.sentBack && r.step === 'self' ? ['Sent back', 'amber' as PillToneName] : STEP_PILL[r.step]
                  return (
                    <tr key={r.id} onClick={() => router.push(withViewAs(`/human-resources/reviews/${r.id}`))} className="border-t border-[var(--row-rule)] cursor-pointer hover:bg-subtle">
                      <td className="px-4 py-2.5">
                        <Link href={`/human-resources/reviews/${r.id}`} className="flex items-center gap-3 no-underline" onClick={e => e.stopPropagation()}>
                          <span className="w-8 h-8 rounded-full border border-[var(--panel-border)] bg-white flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10.5px] text-muted flex-none">{initials(r.name)}</span>
                          <span className="flex flex-col"><span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{r.name}</span><span className="text-[12px] text-muted">{r.sub}</span></span>
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-[13.5px] text-[#435066]">{r.team}</td>
                      <td className={`px-4 py-2.5 text-[13.5px] ${r.leader ? 'text-[#435066]' : 'text-muted'}`}>{r.leader ?? 'No Team Leader'}</td>
                      <td className="px-4 py-2.5"><Pill tone={tone} text={label} /></td>
                      <td className="px-4 py-2.5 text-[13.5px] text-[#435066]">{r.waits}</td>
                      <td className={`px-4 py-2.5 text-[13.5px] font-(family-name:--font-display) font-extrabold ${r.late ? 'text-[var(--bdg-red-fg)]' : 'text-tn-ink'}`}>{r.dueText}</td>
                      <td className="px-4 py-2.5">{r.step === 'approved' && (r.drive === 'saved' ? <Pill tone="green" text="Saved" /> : r.drive === 'failed' ? <Pill tone="red" text="Failed" /> : <Pill tone="gray" text="Waiting" />)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="m-0 text-[12.5px] text-muted">{rows.length} {rows.length === 1 ? 'person' : 'people'} in the review. Every employee has one; anyone else is added in Company settings › Human Resources.</p>
        </>
      )}
      {dialog}
      <Toast toast={toast} />
    </div>
  )
}
