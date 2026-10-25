'use client'

/**
 * Home's day banner (design_handoff_home, README "1. Banner / day timeline",
 * 25 October 2026). It replaced WelcomeBanner: the date and the greeting, a
 * line on what needs the person today, the clock card, and the day's track
 * with the sun moving along it with the time and today's clock-ins as gold
 * bars. Everything in the person's own time zone; the server draws the first
 * paint and a one-minute tick keeps it moving.
 *
 * The clock card is the top bar's clock (clock-bus.ts): the same data, and its
 * buttons open the top bar's panel to clock in, switch or clock out. Until the
 * top bar has read the clock, the card's empty frame; a read that failed, one
 * line and a button to the top bar's panel, which shows why; a login linked to
 * nobody, no card (audit, 25 October 2026).
 *
 * Navy in both themes, so its text uses fixed literal colours, never tokens
 * that remap in dark mode.
 */

import { useEffect, useState } from 'react'
import { Sunrise } from '@/components/Sunrise'
import { askClock, useSharedClock, type SharedClock } from '@/components/clocky/clock/clock-bus'
import type { ClockPanelData } from '@/lib/timeclock/clocky-types'
import { formatDuration } from '@/lib/timeclock/rounding'
import { clockTime, eyebrow, greeting, hourIn, trackAt, trackRange, trackSegments, trackTicks } from '@/lib/home/day-banner'

const DISPLAY = 'font-(family-name:--font-display)'

export function DayBanner({ firstName, zone, summary, serverNow, hasClock, sample, sampleError }: {
  firstName: string | null
  /** The person's own zone (agendaViewer's), the browser's when the profile has none. */
  zone: string
  /** summaryLine(): what needs them today; on Home it streams in after the banner (a Suspense boundary). */
  summary: React.ReactNode
  serverNow: string
  /** They have North Time: the clock card shows. */
  hasClock: boolean
  /** Design check: a fixed clock and a frozen instant, without the top bar. */
  sample?: ClockPanelData | null
  /** Design check: the top bar's read failed with this. */
  sampleError?: string
}) {
  const shared = useSharedClock()
  const frozen = sample !== undefined
  const read: SharedClock | null = frozen ? { data: sample, error: sampleError ?? null, unlinked: false } : shared
  const clock = read?.data ?? null

  const [nowMs, setNowMs] = useState(() => Date.parse(serverNow))
  useEffect(() => {
    if (frozen) return
    const tick = () => setNowMs(Date.now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 60_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [frozen])
  const now = new Date(nowMs)

  const nowH = hourIn(now, zone)
  const spans = clock?.todaySpans ?? []
  const range = trackRange(nowH, spans.length ? hourIn(spans[0].start, zone) : null)
  const sunAt = trackAt(nowH, range)
  const segs = trackSegments(spans, now, zone, range)
  const ticks = trackTicks(range)
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`

  return (
    <section
      aria-label="Your day"
      className="relative overflow-hidden min-h-[310px] lg:h-[310px] px-5 pt-[30px] pb-[84px] md:px-9 lg:pb-0"
      style={{ background: 'linear-gradient(180deg, #0a2f63, #012358)' }}
    >
      <Sunrise anchorLeft={`calc(36px + (100% - 72px) * ${sunAt.toFixed(4)})`} anchorTop="calc(100% - 130px)" glowAt={`${Math.round(sunAt * 100)}% 60%`} scale={0.75} moving />

      <div className="relative flex flex-wrap justify-between items-start gap-6">
        <div className="min-w-0">
          <div className={`${DISPLAY} font-extrabold text-[11px] tracking-[.2em] text-[#94C4C5] tabular-nums lining-nums`} suppressHydrationWarning>{eyebrow(now, zone)}</div>
          <h2 className={`${DISPLAY} font-extrabold text-[32px] tracking-[-.015em] text-[#ffffff] mt-2 leading-tight`} suppressHydrationWarning>
            {greeting(nowH)}{firstName ? `, ${firstName}` : ''}
          </h2>
          <p className="text-[15.5px] text-[#ffffff]/85 mt-2 mb-0 min-h-[1.5em]">{summary}</p>
        </div>
        {hasClock && !read?.unlinked && <ClockCard clock={clock} error={read ? read.error : null} zone={zone} nowMs={nowMs} live={!frozen} />}
      </div>

      <div className="absolute left-5 right-5 md:left-9 md:right-9 bottom-5">
        <div className="relative h-3 rounded-full bg-[#ffffff]/10">
          {segs.map((s, i) => (
            <div key={i} className="absolute inset-y-0 rounded-full bg-[#F2C40A]" style={{ left: pct(s.left), width: pct(s.width) }} />
          ))}
          <div className="absolute -top-2.5 -bottom-2.5 w-0.5 rounded-[2px] bg-[#ffffff]" style={{ left: pct(sunAt) }} aria-hidden="true" />
        </div>
        <div className="relative h-[22px] mt-2" aria-hidden="true">
          {ticks.map((t, i) => (
            <span
              key={t.hour}
              className="absolute text-[11.5px] text-[#ffffff]/55 tabular-nums whitespace-nowrap"
              style={{ left: pct(t.at), transform: i === 0 ? 'translateX(0)' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)' }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

const PLAY = 'M7 4.5v15l12-7.5z'
const STOP = 'M6 6h12v12H6z'
const BRIEFCASE = 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2'

function ClockCard({ clock, error, zone, nowMs, live }: { clock: ClockPanelData | null; error: string | null; zone: string; nowMs: number; live: boolean }) {
  // The hours today tick with the running clock, every second like the top bar's timer.
  const running = clock?.running ?? null
  const [secNow, setSecNow] = useState(nowMs)
  useEffect(() => {
    if (!live || !running) return
    const id = setInterval(() => setSecNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [live, running])
  const at = live && running ? Math.max(secNow, nowMs) : nowMs

  // The first read failed: one line, and the top bar's panel, which says why and reads again.
  if (!clock && error) {
    return (
      <div className="flex-none w-full sm:w-[300px] h-[187px] box-border rounded-2xl border border-[#ffffff]/16 bg-[#ffffff]/[.07] px-[18px] py-4 flex flex-col justify-between gap-3">
        <p role="status" className="m-0 text-[13.5px] leading-[1.5] text-[#ffffff]/85">The clock could not be read just now.</p>
        <button type="button" onClick={() => askClock('in')} className={`rounded-[10px] px-3.5 py-[11px] ${DISPLAY} font-extrabold text-[13.5px] flex items-center justify-center gap-2 text-[#012358] bg-[#ffffff]`}>
          Open the clock
        </button>
      </div>
    )
  }
  // Until the top bar has read the clock: the card's frame, empty, at its own size.
  if (!clock) return <div className="flex-none w-full sm:w-[300px] h-[187px] rounded-2xl border border-[#ffffff]/16 bg-[#ffffff]/[.07]" aria-busy="true" />

  const on = !!running
  const today = clock.todaySeconds + (on ? Math.max(0, (at - Date.parse(clock.now)) / 1000) : 0)
  const since = running ? clockTime(running.sessionStartedAt ?? running.startedAtReal ?? running.startedAt, zone) : null
  return (
    <div className="flex-none w-full sm:w-[300px] box-border rounded-2xl border border-[#ffffff]/16 bg-[#ffffff]/[.07] px-[18px] py-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2.5">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={on ? { background: '#1E9E6A', boxShadow: '0 0 0 4px rgba(30,158,106,.25)' } : { background: 'rgba(255,255,255,.4)', boxShadow: '0 0 0 4px rgba(255,255,255,.08)' }} />
          <span className={`${DISPLAY} font-extrabold text-[11px] tracking-[.12em] uppercase`} style={{ color: on ? '#7fd1ad' : 'rgba(255,255,255,.7)' }}>{on ? 'On the clock' : 'Off the clock'}</span>
        </span>
        <span className="text-[12px] text-[#ffffff]/65 tabular-nums">{on ? `since ${since}` : clock.todaySpans.length ? '' : 'not started today'}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <span className={`${DISPLAY} font-black text-[38px] leading-none text-[#ffffff] tabular-nums lining-nums tracking-[-.02em]`}>{formatDuration(today)}</span>
        <span className="text-[11.5px] text-[#ffffff]/60 pb-[3px]">today</span>
      </div>
      <div className="flex items-center gap-2 rounded-[9px] bg-[#ffffff]/[.08] px-2.5 py-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94C4C5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true"><path d={BRIEFCASE} /></svg>
        <span className="flex-1 min-w-0 text-[12.5px] font-semibold text-[#ffffff] truncate">{running ? running.label || running.short : 'Pick a job when you clock in'}</span>
        {on && <button type="button" onClick={() => askClock('switch')} className="text-[12px] font-bold text-[#94C4C5] hover:text-[#ffffff]">Switch</button>}
      </div>
      <button
        type="button"
        onClick={() => askClock(on ? 'out' : 'in')}
        className={`rounded-[10px] px-3.5 py-[11px] ${DISPLAY} font-extrabold text-[13.5px] flex items-center justify-center gap-2 text-[#012358] ${on ? 'bg-[#ffffff]' : 'bg-[#F2C40A]'}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#012358" strokeWidth="2.3" strokeLinecap="round" aria-hidden="true"><path d={on ? STOP : PLAY} /></svg>
        {on ? 'Clock out' : 'Clock in'}
      </button>
    </div>
  )
}
