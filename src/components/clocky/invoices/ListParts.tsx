'use client'

/**
 * What the Invoices list (6E) and the reimbursement documents list share, so
 * the two stay one design (owner, 25 October 2026): the strip, the state
 * switch, Export CSV, a person's cell, the state pill and Mark paid on a row.
 */

import { BTN_ICON } from '@/lib/ui/buttons'
import type { InvoiceStateKey } from '@/lib/timeclock/invoices-view'
import { STATE_PILL } from './InvoiceParts'

export const LIST_HEAD = 'px-3.5 py-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted whitespace-nowrap'
const DOWN = 'M12 3v12M7 10l5 5 5-5M5 21h14'

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

/** Saves the lines as <name>, a CSV file. */
export function downloadCsv(name: string, lines: readonly (readonly string[])[]) {
  const url = URL.createObjectURL(new Blob([lines.map(l => l.map(csvCell).join(',')).join('\n')], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export interface StripCard { k: string; label: string; val: string; sub: string; fg: string }

/** The totals strip: each card a filter, the chosen one outlined. */
export function ListStrip<C extends StripCard>({ cards, active, onPick, cols = 'grid-cols-3' }: { cards: C[]; active: string; onPick: (c: C) => void; cols?: string }) {
  return (
    <div className={`grid ${cols} gap-3`}>
      {cards.map(c => (
        <button key={c.k} type="button" onClick={() => onPick(c)} aria-pressed={active === c.k}
          className={`text-left bg-white border rounded-[14px] px-[18px] py-[15px] flex flex-col gap-[5px] cursor-pointer hover:border-tn-teal ${active === c.k ? 'border-tn-teal' : 'border-[var(--panel-border)]'}`}>
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{c.label}</span>
          <span className="flex flex-wrap items-baseline gap-x-2.5">
            <span className="font-(family-name:--font-display) font-black text-[26px] tabular-nums lining-nums" style={{ color: c.fg }}>{c.val}</span>
            <span className="text-[13px] text-foreground font-semibold tabular-nums lining-nums">{c.sub}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** All, Waiting, Approved...: one pressed at a time. */
export function StateSwitch<K extends string>({ options, value, onChange }: { options: readonly (readonly [K, string])[]; value: K; onChange: (k: K) => void }) {
  return (
    <div role="group" aria-label="State" className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 self-end">
      {options.map(([k, label]) => (
        <button key={k} type="button" aria-pressed={value === k} onClick={() => onChange(k)}
          className={`border-0 cursor-pointer rounded-[8px] px-3 py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] ${value === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
      ))}
    </div>
  )
}

export function ExportCsvButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="ml-auto inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-[15px] py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:border-tn-teal">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={DOWN} /></svg>Export CSV
    </button>
  )
}

/** A row's person: initials on navy, the name, and the team with its colour. */
export function PersonCell({ initials, who, team, teamColor }: { initials: string; who: string; team: string; teamColor: string }) {
  return (
    <div className="px-3.5 py-[9px] flex items-center gap-[9px] min-w-0">
      <span className="w-7 h-7 rounded-full bg-tn-primary text-[#ffffff] flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[10.5px] flex-none">{initials}</span>
      <span className="flex flex-col min-w-0">
        <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink whitespace-nowrap">{who}</span>
        <span className="flex items-center gap-[5px] text-[11.5px] text-muted"><span className="w-[7px] h-[7px] rounded-full" style={{ background: teamColor }} />{team}</span>
      </span>
    </div>
  )
}

export function StatePill({ st }: { st: InvoiceStateKey }) {
  return <span className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.05em] uppercase whitespace-nowrap rounded-full px-[9px] py-1" style={{ background: STATE_PILL[st].bg, color: STATE_PILL[st].fg }}>{STATE_PILL[st].label}</span>
}

/** Mark paid on a row; the row itself opens, so the click stops here. */
export function RowMarkPaid({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={e => { e.stopPropagation(); onClick() }}
      className="inline-flex shrink-0 items-center gap-[7px] border border-slate-200 rounded-[10px] px-3 py-[7px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] whitespace-nowrap cursor-pointer hover:border-tn-teal">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>Mark paid
    </button>
  )
}
