// The Home card for a timesheet to send (owner, 25 October 2026), right under
// the greeting: from the day the person's period closes until they send it.
// Amber on the day ("closes today"), red once it is late. The button opens
// Time entries on that period, where Submit is. Server component.

import Link from 'next/link'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { HomeTimesheet } from '@/lib/timeclock/home-timesheet'

const TONE = {
  today: { bg: 'var(--warn-bg)', fg: '#8a6d1a', border: '#f0e2a8' },
  late: { bg: '#fdeeef', fg: '#c8323d', border: '#f3c6ca' },
} as const

export function TimesheetDueCard({ t, href }: { t: HomeTimesheet; href: string }) {
  const tone = TONE[t.state]
  const title = t.state === 'today' ? `Your ${t.label} timesheet closes today` : `Your ${t.label} timesheet is ${t.days} day${t.days === 1 ? '' : 's'} late`
  const sub = t.state === 'today'
    ? `${t.hours} logged for ${t.full}. Check your entries and send it when the day is done.`
    : `${t.hours} logged for ${t.full}. Send it so it can be approved.`
  return (
    <section aria-label="Timesheet to send" className="bg-white border rounded-[16px] px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-3 leading-[normal]" style={{ borderColor: tone.border }}>
      <span className="w-10 h-10 rounded-[11px] flex items-center justify-center flex-none" style={{ background: tone.bg, color: tone.fg }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2" /></svg>
      </span>
      <div className="flex-1 min-w-[220px] flex flex-col gap-1">
        <span className="font-(family-name:--font-display) font-extrabold text-[16px]" style={{ color: t.state === 'late' ? tone.fg : 'var(--color-tn-ink)' }}>{title}</span>
        <span className="text-[13px] text-muted tabular-nums lining-nums">{sub}</span>
      </div>
      <Link href={href} className="inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] hover:bg-[#0a2f6b] whitespace-nowrap">
        <svg width="12" height="12" viewBox="0 0 24 24" fill={BTN_ICON.navy} aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>Review and send
      </Link>
    </section>
  )
}
