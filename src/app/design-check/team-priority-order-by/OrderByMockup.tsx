'use client'

/**
 * "Order by" moved to the right, under Save and close. A mockup, asked for on
 * 18 September 2026: the three levels were a small grey segmented control on
 * the left, inside a card, and read as a filter rather than as the choice that
 * decides what the whole page below is ordering.
 *
 * Here they are one pill of the same shape as Save and close, the chosen one
 * filled navy with a gold count, so the two controls a leader uses most sit in
 * one column on the right. The line under them says what the chosen level does.
 */

import { useState } from 'react'
import { SearchField } from '@/components/ui/SearchField'

type Level = 'workspace' | 'board' | 'item'

const NOTE: Record<Level, string> = {
  workspace: 'Whole workspaces: everything in the first comes before anything in the second. Every board and item inside moves with its workspace.',
  board: 'Boards in your order, inside their workspace. Every item on a board moves with it.',
  item: 'Single steps. A step you move here keeps its place above everything, even other workspaces.',
}

const ICON: Record<Level, React.ReactNode> = {
  workspace: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  board: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16M15 4v16" /></>,
  item: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></>,
}

const segment = 'font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] transition-colors'

export function OrderByMockup() {
  const [level, setLevel] = useState<Level>('item')
  const counts: Record<Level, number> = { workspace: 6, board: 20, item: 774 }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0">1. The editor</h2>
        <div className="rounded-[16px] border border-[var(--panel-border)] bg-background p-6 space-y-3.5">
          {/* Row 1: as today. */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <SearchField value="" onChange={() => {}} placeholder="Search the team's steps…" className="flex-1 min-w-[220px]" />
            <div className="flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
              <span className={`${segment} text-muted`}>Mine</span>
              <span className={`${segment} text-muted`}>Everyone</span>
              <span className={`${segment} bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]`}>Team priority</span>
            </div>
            <span className="inline-flex items-center gap-2 px-3 py-[9px] rounded-[10px] border border-tn-teal bg-white font-(family-name:--font-display) font-semibold text-[13px] text-tn-teal">SEO ▾</span>
            <span className="inline-flex items-center gap-2 px-3 py-[9px] rounded-[10px] border border-[var(--panel-border)] bg-white font-(family-name:--font-display) font-semibold text-[13px] text-muted">Anyone on the team ▾</span>
            <span className="shrink-0 inline-flex items-center gap-2 rounded-full px-[17px] py-2 font-(family-name:--font-display) font-extrabold text-[12.5px] bg-tn-primary border border-tn-primary shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7" /></svg>
              <span className="text-[#ffffff]">Save and close</span>
            </span>
          </div>

          {/* Row 2: who set it on the left; Order by on the right, under Save and close. */}
          <div className="flex items-start gap-4 flex-wrap border-t border-[var(--panel-border)] pt-3">
            <div className="text-[12.5px] text-muted pt-2.5">
              Set by Jeannette Owens · updated today at 10:19 AM
              <div className="mt-1 text-[13px]">774 open steps on the SEO team</div>
            </div>
            <div className="ml-auto flex flex-col items-end gap-2">
              <div className="flex items-center gap-3">
                <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">Order by</span>
                <div role="group" aria-label="Order by" className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-border)] bg-white p-1 shadow-[0_6px_16px_-10px_rgba(1,35,88,.35)]">
                  {(['workspace', 'board', 'item'] as const).map(k => {
                    const on = level === k
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setLevel(k)}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 font-(family-name:--font-display) font-extrabold text-[13px] transition-colors ${on ? 'bg-tn-primary shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)]' : 'text-tn-ink hover:bg-subtle'}`}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={on ? '#F2C40A' : 'currentColor'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICON[k]}</svg>
                        <span className={on ? 'text-[#ffffff]' : ''}>{k === 'workspace' ? 'Workspace' : k === 'board' ? 'Board' : 'Item'}</span>
                        <span className={`text-[11px] font-bold rounded-full px-1.5 py-px ${on ? 'bg-[rgba(242,196,10,.18)] text-[#F2C40A]' : 'bg-subtle text-muted'}`}>{counts[k]}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <p className="text-[12.5px] text-muted leading-relaxed m-0 max-w-[560px] text-right">{NOTE[level]}</p>
            </div>
          </div>

          {/* What follows, faded: the agreement card and the table, unchanged. */}
          <div className="opacity-45 pointer-events-none space-y-3.5" aria-hidden="true">
            <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 h-[92px] flex gap-8">
              <div className="w-[180px] space-y-2"><div className="h-2.5 w-32 rounded bg-subtle" /><div className="h-6 w-16 rounded bg-subtle" /><div className="h-1.5 w-full rounded bg-subtle" /></div>
              <div className="flex-1 space-y-2"><div className="h-2.5 w-20 rounded bg-subtle" /><div className="h-3 w-2/3 rounded bg-subtle" /><div className="h-3 w-1/2 rounded bg-subtle" /></div>
            </div>
            <div className="rounded-[14px] border border-[var(--panel-border)] bg-white">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-6 px-4 py-3.5 border-b border-[var(--row-rule)] last:border-b-0">
                  <div className="h-3 w-6 rounded bg-subtle" /><div className="h-3 flex-1 max-w-[420px] rounded bg-subtle" /><div className="h-3 w-28 rounded bg-subtle" /><div className="h-3 w-16 rounded bg-subtle ml-auto" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink m-0">2. Edit order, on My Work (built)</h2>
        <div className="rounded-[14px] border border-[var(--panel-border)] bg-[rgba(30,125,127,.07)] px-4 py-3 flex items-center gap-3 flex-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h10M4 18h6" /></svg>
          <span className="text-[13.5px] text-tn-ink"><b>Ordered by the SEO team&apos;s priority</b><span className="text-muted">, set by Jeannette Owens · updated today at 10:19 AM</span></span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] border border-[var(--panel-border)] bg-white font-(family-name:--font-display) font-semibold text-[12.5px] text-tn-ink">SEO order ▾</span>
          <span className="ml-auto inline-flex items-center gap-2 rounded-full px-[17px] py-2 font-(family-name:--font-display) font-extrabold text-[12.5px] bg-tn-primary border border-tn-primary shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            <span className="text-[#ffffff]">Edit order</span>
          </span>
        </div>
      </section>
    </div>
  )
}
