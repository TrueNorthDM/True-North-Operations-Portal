/**
 * Pieces shared by a person's page (PersonPage) and its edit forms
 * (PersonForms): the section heading, the teams list and the field style.
 */

import type { ReactNode } from 'react'
import { PILL_CLASS, type Pill } from '@/lib/directory/people-types'
import type { PersonPageData } from '@/lib/directory/person-page-data'

export const fieldCls = 'text-sm text-tn-ink bg-subtle border border-slate-200 rounded-[10px] px-3.5 py-[10px] w-full transition-all focus:outline-none focus:border-tn-teal'

export function Section({ title, right, tag, flush, children }: {
  title: string
  right?: ReactNode
  /** Beside the title: the "New" tag of a section just added (Timesheet, 16 October 2026). */
  tag?: ReactNode
  /** No space under it: whatever wraps it keeps the space instead. */
  flush?: boolean
  children: ReactNode
}) {
  return (
    <div className={`${flush ? '' : 'mb-6 '}min-w-0`}>
      <h3 className="m-0 mb-1.5 pb-2.5 border-b border-[var(--panel-border)] flex justify-between font-(family-name:--font-display) font-extrabold text-[11.5px] tracking-[.1em] uppercase text-tn-teal">
        {tag ? <span className="flex items-center gap-2">{title}{tag}</span> : <span>{title}</span>}{right && <span className="text-muted tracking-[.04em]">{right}</span>}
      </h3>
      {children}
    </div>
  )
}

export const PillBadge = ({ pill }: { pill: Pill }) => (
  <span className={`inline-flex items-center font-(family-name:--font-display) font-extrabold text-[11px] rounded-[7px] px-3 py-[5px] whitespace-nowrap ${PILL_CLASS[pill.kind]}`}>{pill.label}</span>
)

export function TeamsList({ teams }: { teams: NonNullable<PersonPageData['work']>['teams'] }) {
  if (!teams.length) return <p className="text-[13px] text-muted italic m-0 py-2.5">No team yet.</p>
  return (
    <>
      {teams.map(t => (
        <div key={t.teamId} className="flex items-center justify-between gap-3 py-2.5 border-b border-[var(--row-rule)] last:border-b-0">
          <span className="inline-flex items-center gap-2 min-w-0 text-[13.5px] font-semibold text-foreground">
            <span className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ background: t.color }} />
            <span className="truncate">{t.teamName}</span>
            {t.primary && teams.length > 1 && <span className="text-[10.5px] text-muted font-semibold">primary</span>}
          </span>
          <PillBadge pill={t.position === 'lead' ? { kind: 'teal', label: 'Lead' } : { kind: 'grey', label: 'Member' }} />
        </div>
      ))}
    </>
  )
}
