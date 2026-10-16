'use client'

/**
 * The Work tab's Timesheet section (design handoff of 16 October 2026,
 * Timesheet Periods.dc.html frames 5B and 5B2): "Submits hours" (Monthly or
 * Every 2 weeks) and the current period. In Edit work, for whoever may change
 * it, the choice is a segmented control, and when it changes an amber line
 * says when the new way starts (previewCadenceChange): a period is never cut
 * in half. The same setting as Directory > Rates & Costs.
 */

import Link from 'next/link'
import type { ReactNode } from 'react'
import { Segmented } from '@/components/ui/Segmented'
import { withViewAs } from '@/components/ViewAsKeeper'
import { NewTag } from '@/components/clocky/periods/ui'
import type { Cadence } from '@/lib/timeclock/periods'
import { PillBadge, Section } from './PersonParts'

export interface PersonTimesheetView {
  cadence: Cadence
  currentPeriod: string
  periodIf: Record<Cadence, string>
  /** May change it here (cs-periods-edit, with Edit work). */
  canEdit: boolean
  /** The two places the line points to, as links only for whoever opens them. */
  links: { rates: boolean; settings: boolean }
}

const CADENCE: Record<Cadence, string> = { monthly: 'Monthly', biweekly: 'Every 2 weeks' }

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3.5 items-center py-2.5 border-b border-[var(--row-rule)]">
      <dt className="text-muted text-[13.5px]">{label}</dt>
      <dd className="m-0 text-right flex justify-end items-center text-[13.5px] font-semibold text-foreground">{children}</dd>
    </div>
  )
}

const place = (on: boolean, href: string, text: string) => on
  ? <Link href={withViewAs(href)} className="font-bold text-tn-teal hover:text-tn-ink">{text}</Link>
  : <span className="font-bold">{text}</span>

export function TimesheetSection({ t, editing = false, draft, onDraft, startsLine }: {
  t: PersonTimesheetView
  /** In Edit work, with the right to change it. */
  editing?: boolean
  draft?: Cadence
  onDraft?: (c: Cadence) => void
  /** "Starts with the pay period of Oct 18 to 31. October still closes monthly." while the choice differs. */
  startsLine?: string | null
}) {
  const choosing = editing && t.canEdit
  const shown = choosing && draft ? draft : t.cadence
  return (
    // While it can be changed, a soft teal ring around it says where the change is.
    <div className={`mb-6 ${choosing ? 'rounded-[14px] outline-2 outline-[#cfe5e5] outline-offset-8' : ''}`}>
      <Section title="Timesheet" tag={<NewTag />} flush>
        <dl className="m-0">
          <Row label="Submits hours">
            {choosing
              ? <Segmented label="Submits hours" options={[{ key: 'monthly', label: 'Monthly' }, { key: 'biweekly', label: 'Every 2 weeks' }]} value={shown} onChange={c => onDraft?.(c)} />
              : <PillBadge pill={t.cadence === 'biweekly' ? { kind: 'teal', label: CADENCE.biweekly } : { kind: 'grey', label: CADENCE.monthly }} />}
          </Row>
        </dl>
        {choosing && startsLine && (
          <p className="m-0 mt-2 text-[12.5px] text-[var(--warn-fg)] bg-[var(--warn-bg)] rounded-[9px] px-[11px] py-2 leading-[1.45]">{startsLine}</p>
        )}
        <dl className="m-0">
          <Row label="Current period"><span className="tabular-nums">{choosing ? t.periodIf[shown] : t.currentPeriod}</span></Row>
        </dl>
        <p className="m-0 pt-2 text-[12px] text-muted leading-normal">
          Also set in {place(t.links.rates, '/directory?tab=rates', 'Directory › Rates & Costs')}. Pay period dates come from {place(t.links.settings, '/admin/settings#periods', 'Company settings')}.
        </p>
      </Section>
    </div>
  )
}
