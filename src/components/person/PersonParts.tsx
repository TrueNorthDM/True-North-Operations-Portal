/**
 * Pieces shared by a person's page (PersonPage) and its edit forms
 * (PersonForms): the section heading, the teams list and the field style.
 * Drawn as the Clocky design handoff draws the page (Timesheet Periods.dc.html
 * 5B, owner 20 October 2026): grey 11px section titles on a light rule, 22px
 * between sections, and Raleway 10.5px uppercase pills.
 */

import { DATE_FIELD_CLASS, INPUT, SELECT_FIELD, TEXTAREA } from '@/lib/ui/fields'
import type { ReactNode } from 'react'
import { PILL_CLASS, type Pill } from '@/lib/directory/people-types'
import type { PersonPageData } from '@/lib/directory/person-page-data'
import { PILL } from '@/components/ui/Pill'

/** The person forms' fields: the portal's field (lib/ui/fields.ts), full width, with the date, menu and textarea beside it. */
export const fieldCls = `${INPUT} w-full`
export const dateFieldCls = `${DATE_FIELD_CLASS} w-full`
export const selectFieldCls = `${SELECT_FIELD} w-full text-tn-ink`
export const areaFieldCls = `${TEXTAREA} w-full`

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
    <div className={`${flush ? '' : 'mb-[22px] '}min-w-0`}>
      <h3 className="m-0 pb-1.5 border-b border-[var(--row-rule)] flex justify-between items-center font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.08em] uppercase text-muted leading-[normal]" style={{ letterSpacing: '.08em' }}>
        {tag ? <span className="flex items-center gap-2">{title}{tag}</span> : <span>{title}</span>}{right && <span className="text-muted tracking-[.04em]">{right}</span>}
      </h3>
      {children}
    </div>
  )
}

// The handoff's blue (US Employee, Full-Time) and green (Active); the rest keep the Directory's.
const PAGE_PILL: Partial<Record<Pill['kind'], string>> = {
  blue: 'bg-[var(--bdg-blue-bg)] text-[var(--bdg-blue-fg)]',
  green: 'bg-[var(--bdg-green-bg)] text-[var(--bdg-green-fg)]',
}

export const PillBadge = ({ pill }: { pill: Pill }) => (
  <span className={`${PILL} ${PAGE_PILL[pill.kind] ?? PILL_CLASS[pill.kind]}`}>{pill.label}</span>
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
