// The Home's Pay period card (design handoff, 25 October 2026, README section
// 2, Home Final.dc.html): the active period's hours, pace and days by kind. It
// is also the timesheet reminder that replaced TimesheetDueCard: an amber band
// on the day the period closes, red once it is late, until it is sent. Every
// figure comes worked out from lib/timeclock/home-pay-period.ts. Server
// component: the per-day tooltips are title attributes.
//
// Not read: one line, and Time entries as a link to try again (audit, 25
// October 2026). Not set up for the person: one line that says whom to ask.

import Link from 'next/link'
import { BTN_ICON } from '@/lib/ui/buttons'
import type { PayPeriodResult, PayPeriodView } from '@/lib/timeclock/home-pay-period'

const TONE = {
  today: { border: '#f0e2a8', bg: 'var(--warn-bg)', fg: '#8a6d1a', title: 'var(--color-tn-ink)' },
  late: { border: '#f3c6ca', bg: '#fdeeef', fg: '#c8323d', title: '#c8323d' },
} as const

const ICON = {
  arrow: 'M3 12h18M14 5l7 7-7 7',
  invoice: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 11v8M14 13h-3a1 1 0 0 0 0 2h2a1 1 0 0 1 0 2h-3',
}

const display = 'font-(family-name:--font-display)'
const eyebrow = `${display} font-extrabold text-[11px] tracking-[.12em] uppercase text-muted`
const shell = 'bg-white rounded-[20px] overflow-hidden shadow-[0_18px_40px_-26px_rgba(1,35,88,.45)] px-7 py-6 flex flex-col gap-[18px] border leading-[normal]'

export function PayPeriodCard({ data }: { data: PayPeriodResult }) {
  if (!data.ok) {
    return (
      <section aria-label="Pay period" className={shell} style={{ borderColor: 'var(--panel-border)' }}>
        <span className={eyebrow}>Pay period</span>
        <p role="status" className="m-0 text-[13.5px] text-muted">
          {data.unset
            ? 'Your pay period could not be set up: ask a Super Admin to check your profile.'
            : <>The pay period could not be read just now. <Link href="/clocky-hours" className="font-bold text-tn-teal hover:text-tn-ink">Open Time entries</Link> to try again.</>}
        </p>
      </section>
    )
  }
  const v = data.view
  const tone = v.state === 'today' || v.state === 'late' ? TONE[v.state] : null
  return (
    <section aria-label="Pay period" className={shell} style={{ borderColor: tone?.border ?? 'var(--panel-border)' }}>
      {v.band && tone && <Band band={v.band} tone={tone} />}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className={eyebrow}>{v.label}</span>
          <span className={`${display} font-extrabold text-[20px] text-tn-ink`}>{v.range}</span>
        </div>
        {v.chip && (
          <span className="flex items-center gap-2 text-[12.5px] text-[#5b6b82] rounded-full px-3 py-1.5 tabular-nums lining-nums" style={{ background: v.chip.bg }}>
            <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: v.chip.dot }} />{v.chip.text}
          </span>
        )}
      </div>

      {v.meter && <Meter m={v.meter} />}

      <div className="flex items-center gap-2 border-t border-(--row-rule) pt-[14px] text-[13px] text-[#5b6b82]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1E7D7F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true"><path d={ICON[v.footer.icon]} /></svg>
        {v.footer.text}
      </div>

      {v.nextLine && (
        <div className="-mx-7 -mb-6 -mt-1 px-7 py-3 bg-[#f8f7f3] border-t border-(--row-rule) flex items-center gap-2.5 text-[13px] text-[#5b6b82] tabular-nums lining-nums">
          <span className="w-[7px] h-[7px] rounded-full bg-[#1E9E6A] flex-none" />{v.nextLine}
        </div>
      )}
    </section>
  )
}

function Band({ band, tone }: { band: NonNullable<PayPeriodView['band']>; tone: (typeof TONE)[keyof typeof TONE] }) {
  return (
    <div className="-mx-7 -mt-6 px-7 py-[18px] flex items-center gap-4 flex-wrap border-b" style={{ background: tone.bg, borderColor: tone.border }}>
      <span className="w-[42px] h-[42px] rounded-[12px] flex-none flex items-center justify-center bg-white" style={{ color: tone.fg }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2" /></svg>
      </span>
      <div className="flex-1 min-w-[240px] flex flex-col gap-[3px]">
        <span className={`${display} font-extrabold text-[17px]`} style={{ color: tone.title }}>{band.title}</span>
        <span className="text-[13px] text-[#5b6b82] tabular-nums lining-nums">{band.sub}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/clocky-hours?submit=1" className={`rounded-[10px] px-4 py-[11px] ${display} font-extrabold text-[13.5px] flex items-center gap-2 bg-tn-primary text-[#ffffff] whitespace-nowrap hover:bg-[#0a2f6b]`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={BTN_ICON.navy} aria-hidden="true"><path d="M7 4.5v15l12-7.5z" /></svg>Review and send
        </Link>
        <Link href="/clocky-hours" className={`border border-[#d9dee6] bg-white rounded-[10px] px-[14px] py-[11px] ${display} font-extrabold text-[13.5px] text-tn-ink whitespace-nowrap hover:border-tn-teal`}>
          Open Time entries
        </Link>
      </div>
    </div>
  )
}

function Meter({ m }: { m: NonNullable<PayPeriodView['meter']> }) {
  // A month has up to 31 columns: the 6px gap would leave them no width on a phone.
  const gap = m.days.length > 16 ? 3 : 6
  return (
    <>
      {/* Wraps by the card's own width, not the window's: beside an open rail panel the card is narrow on a wide screen. */}
      <div className="flex flex-wrap justify-between gap-x-6 gap-y-4 items-end">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className={`${display} font-black text-[46px] leading-none text-tn-ink tracking-[-.02em] tabular-nums lining-nums whitespace-nowrap`}>{m.total}</span>
          <span className="text-[14px] text-muted tabular-nums lining-nums">of {m.expected} in the period</span>
        </div>
        <div className="flex flex-wrap gap-x-[26px] gap-y-3">
          {m.stats.map(s => (
            <div key={s.k} className="flex flex-col gap-[3px] sm:items-end">
              <span className={`text-[10.5px] ${display} font-extrabold tracking-[.06em] uppercase text-muted`}>{s.k}</span>
              <span className={`${display} font-extrabold text-[16px] tabular-nums lining-nums whitespace-nowrap`} style={{ color: s.fg }}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative pb-[18px]">
        <div className="relative h-3 rounded-full bg-[#eef0f3] overflow-hidden">
          <div className="absolute left-0 top-0 bottom-0 rounded-full bg-tn-primary" style={{ width: `${m.fillPct.toFixed(1)}%` }} />
        </div>
        {m.pace && (
          <>
            <div className="absolute top-[-4px] h-5 w-[2px] bg-tn-accent rounded-[1px]" style={{ left: `${m.pace.pct.toFixed(1)}%` }} />
            <span className="absolute top-[22px] text-[11px] font-bold text-[#8a6d1a] whitespace-nowrap" style={{ left: `${m.pace.pct.toFixed(1)}%`, transform: m.pace.shift }}>expected by today</span>
          </>
        )}
      </div>

      <div className="grid items-end h-[74px]" style={{ gridTemplateColumns: `repeat(${m.days.length}, minmax(0, 1fr))`, gap }}>
        {m.days.map((d, i) => (
          <div key={i} title={d.title} className="flex flex-col items-center justify-end gap-[5px] h-full">
            <div className="w-full flex flex-col-reverse rounded-[4px] overflow-hidden" style={d.today ? { outline: '2px solid #F2C40A', outlineOffset: 2 } : undefined}>
              {d.segs.length
                ? d.segs.map((g, k) => <div key={k} style={{ height: g.h, background: g.bg }} />)
                : <div style={{ height: 3, background: d.stub === 'work' ? '#e4e7ec' : 'transparent' }} />}
            </div>
            <span className="text-[10.5px]" style={{ fontWeight: d.today ? 800 : 600, color: d.today ? '#012358' : d.weekend ? '#cbd2da' : '#8593a4' }}>{d.letter}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-x-[18px] gap-y-2 -mt-1.5">
        {m.legend.map(l => (
          <span key={l.label} className="flex items-center gap-[7px] text-[12.5px] text-[#5b6b82]">
            <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: l.bg }} />{l.label} <b className="text-tn-ink tabular-nums lining-nums">{l.v}</b>
          </span>
        ))}
      </div>
    </>
  )
}
