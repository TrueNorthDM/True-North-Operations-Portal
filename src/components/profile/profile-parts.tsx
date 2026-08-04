/**
 * profile-parts.tsx: the row / section / badge primitives the profile card is
 * built from.
 *
 * Shared so the My profile page and the popup on My team render the same
 * layout from the same code instead of two lookalikes that drift apart. Plain
 * functions (no hooks, no 'use client') so both a server page and a client
 * component can import them.
 */

import { PILL_CLASS, type Pill } from '@/lib/directory/people-types'

export function Badge({ pill }: { pill: Pill | null }) {
  if (!pill) return <span className="text-[13.5px] text-foreground font-semibold">-</span>
  return (
    <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>
      {pill.label}
    </span>
  )
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3.5">
      <span className="text-[12.5px] text-muted font-semibold shrink-0">{label}</span>
      <span className="text-right min-w-0">{children}</span>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-tn-teal mb-3 pb-2 border-b border-slate-200">{title}</div>
      <div className="flex flex-col gap-[13px]">{children}</div>
    </div>
  )
}

export const txt = (v: string | null | undefined) => (
  <span className="text-[13.5px] text-foreground font-semibold">{v || '-'}</span>
)

export const mail = (v: string | null) =>
  v ? (
    <a href={`mailto:${v}`} className="text-[13.5px] font-semibold text-tn-teal truncate inline-block max-w-[220px] align-bottom">{v}</a>
  ) : (
    txt(null)
  )

/** The "managed by your admin" strip that heads the read-only half. */
export function ManagedNote({ own }: { own: boolean }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8593a4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        <span className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.06em] uppercase text-muted">
          Managed by your admin · read-only
        </span>
      </div>
      <p className="text-[12.5px] text-muted mb-5">
        {own
          ? 'Your employment, team and company details are kept by your admin and will connect to the HR module. Need a change? Ask an admin.'
          : 'Employment, team and company details are kept by an admin and will connect to the HR module.'}
      </p>
    </>
  )
}
