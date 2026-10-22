'use client'

/**
 * Clock safety (design handoff of 16 October 2026, Clock Safety.dc.html frames
 * 4A with data and 4B empty): every time Clocky stopped a forgotten clock.
 * Totals, by person (with "Pressed Keep going" and a month by month bar), and
 * each occurrence with the real end the person confirmed. Super Admins have it
 * in full, Admins read it; nothing here changes hours.
 *
 * The period and the search ask the server again (getClockSafety): the cards
 * count what the two leave in. The design check hands in its own `load` with
 * the prototype's sample data.
 */

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Segmented } from '@/components/ui/Segmented'
import { SearchInput } from '@/components/clocky/clock/ClockParts'
import { withViewAs } from '@/components/ViewAsKeeper'
import { getClockSafety } from '@/app/(app)/clocky-hours/safety/actions'
import { dayLabel, initials } from '@/lib/timeclock/format'
import { MONTH_LONG, MONTH_SHORT } from '@/lib/format/months'
import type { ClockSafetyData, Result } from '@/lib/timeclock/clocky-types'

export type SafetyPeriod = 'month' | '3m' | 'all'
export type SafetyLoad = (input: { period: SafetyPeriod; q: string }) => Promise<Result<{ data: ClockSafetyData }>>

const PERIODS: { key: SafetyPeriod; label: string }[] = [
  { key: 'month', label: 'This month' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'all', label: 'All' },
]
const CARD_PERIOD: Record<SafetyPeriod, string> = { month: 'this month', '3m': 'in 3 months', all: 'in total' }

const LABEL = 'font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted'
const PERSON_GRID = 'grid grid-cols-[minmax(200px,1.4fr)_150px_150px_180px_130px]'
// The prototype's columns, with "Stopped by Clocky" and "Kept going earlier" at 150px:
// at its 120px and 110px those headings ran into the next one.
const OCC_GRID = 'grid grid-cols-[110px_160px_minmax(210px,1fr)_110px_150px_150px_90px_150px_90px]'

/** "New York" from "America/New_York". */
const zoneCity = (zone: string) => (zone.split('/').pop() ?? zone).replace(/_/g, ' ')

/** "-20m", "+10m", "0m"; "–" when the end is not confirmed. */
function diffText(min: number | null): { text: string; color: string } {
  if (min == null) return { text: '–', color: 'var(--faint)' }
  return { text: min === 0 ? '0m' : `${min < 0 ? '-' : '+'}${Math.abs(min)}m`, color: min < 0 ? '#012358' : 'var(--muted)' }
}

export function ClockSafety({ initial, load = getClockSafety as SafetyLoad }: {
  initial: ClockSafetyData
  /** Design check only: answers from sample data instead of the server. */
  load?: SafetyLoad
}) {
  const [data, setData] = useState(initial)
  const [period, setPeriod] = useState<SafetyPeriod>('month')
  const [q, setQ] = useState('')
  const [error, setError] = useState<string | null>(null)
  const asked = useRef(0)
  const shown = useRef('month|')

  // Each change asks again; only the latest answer is drawn. The search waits
  // for a pause in the typing.
  useEffect(() => {
    const key = `${period}|${q.trim()}`
    if (key === shown.current) return
    shown.current = key
    const n = ++asked.current
    const t = setTimeout(() => {
      load({ period, q: q.trim() })
        .then(res => {
          if (n !== asked.current) return
          if (res.ok) { setData(res.data); setError(null) } else setError(res.error)
        })
        .catch(() => { if (n === asked.current) setError('Clock safety could not be read. Try again in a moment.') })
    }, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [period, q, load])

  const occ = data.occurrences
  const cards = [
    { label: `Auto clock-outs ${CARD_PERIOD[period]}`, value: String(data.cards.autoStops), color: data.cards.autoStops ? '#c8323d' : '#012358' },
    { label: 'People affected', value: String(data.cards.people), color: '#012358' },
    { label: 'Confirmed end times', value: `${data.cards.confirmed} of ${data.cards.autoStops}`, color: '#012358' },
    { label: 'Kept going (answered in time)', value: String(data.cards.keptGoing), color: '#0d7a4f' },
  ]
  const months = data.byPerson[0]?.byMonth.map(m => m.month) ?? []
  const tallest = Math.max(3, ...data.byPerson.flatMap(p => p.byMonth.map(m => m.count)))

  return (
    // Lines at the font's own height, as the design draws them.
    <div className="flex flex-col gap-[18px] leading-[normal]">
      <div>
        <Breadcrumb parents={['/clocky-hours']} now="Clock safety" />
        <h1 className="m-0 mt-0.5 font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink">Clock safety</h1>
        <p className="m-0 mt-1 text-[13.5px] text-muted">Every time North Time stopped a forgotten clock. Times in your time zone ({zoneCity(data.zone)}).</p>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-white border border-[var(--panel-border)] rounded-[14px] px-[18px] py-4 flex flex-col gap-1.5">
            <span className={LABEL}>{c.label}</span>
            <span className="font-(family-name:--font-display) font-black text-[28px] tabular-nums lining-nums" style={{ color: c.color }}>{c.value}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2.5 items-center">
        <Segmented label="Period" display="px-3 py-1.5 text-[12.5px]" options={PERIODS} value={period} onChange={setPeriod} />
        <div className="w-[240px]"><SearchInput value={q} onChange={setQ} placeholder="Search people" height={38} iconTop={11} iconLeft={11} iconSize={15} padLeft={33} fontSize={13} /></div>
        {data.access === 'read' && (
          <span className="text-[12px] text-[var(--chip-neutral-fg)] bg-[var(--chip-neutral-bg)] rounded-full px-[11px] py-[5px]">Read only at the Admin level</span>
        )}
      </div>

      {error && <p role="alert" className="m-0 text-[13px] text-[#c8323d]">{error}</p>}

      {occ.length === 0 ? (
        <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-14 flex flex-col items-center gap-2.5 text-center">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-3 8-9V6l-8-3-8 3v7c0 6 8 9 8 9zM9 12l2 2 4-4" /></svg>
          <p className="m-0 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{q.trim() ? `Nobody matches "${q.trim()}" in this period.` : 'No automatic clock-outs in this period.'}</p>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-2.5">
            <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">By person</h2>
            <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-auto">
              <div className="min-w-[720px]">
                <div className={`${PERSON_GRID} bg-subtle border-b border-[var(--panel-border)]`}>
                  {(['Person', 'Auto clock-outs', 'Pressed Keep going', 'Last occurrence', 'By month'] as const).map((h, i) => (
                    <div key={h} className={`px-3.5 py-2.5 ${LABEL} ${i === 1 || i === 2 ? 'text-right' : ''}`}>{h}</div>
                  ))}
                </div>
                {data.byPerson.map(p => (
                  <div key={p.personId} className={`${PERSON_GRID} items-center border-b border-[var(--row-rule)] hover:bg-[var(--row-hover)]`}>
                    <div className="px-3.5 py-2.5 flex items-center gap-2.5 min-w-0">
                      <span className="w-[30px] h-[30px] rounded-full bg-tn-primary text-[#ffffff] inline-flex items-center justify-center font-(family-name:--font-display) font-extrabold text-[11px] shrink-0">{initials(p.name)}</span>
                      <span className="flex flex-col min-w-0">
                        <span className="font-(family-name:--font-display) font-bold text-[13.5px] text-tn-ink">{p.name}</span>
                        {p.team && (
                          <span className="flex items-center gap-[5px] text-[11.5px] text-muted">
                            <span className="w-[7px] h-[7px] rounded-full" style={{ background: p.team.color ?? 'var(--faint)' }} />{p.team.name}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="px-3.5 py-2.5 text-right font-(family-name:--font-display) font-extrabold text-[15px] tabular-nums lining-nums" style={{ color: p.autoStops ? '#c8323d' : 'var(--faint)' }}>{p.autoStops}</div>
                    <div className="px-3.5 py-2.5 text-right font-semibold text-[13.5px] text-foreground tabular-nums lining-nums">{p.keptGoing}</div>
                    <div className="px-3.5 py-2.5 text-[13px] text-foreground tabular-nums lining-nums">{p.last ?? 'Never'}</div>
                    <div
                      title={p.byMonth.map(m => `${MONTH_SHORT[Number(m.month.slice(5, 7)) - 1]} ${m.count}`).join(' · ')}
                      className="px-3.5 py-2.5 h-7 box-content flex items-end gap-1"
                    >
                      {p.byMonth.map((m, i) => (
                        <span
                          key={m.month}
                          className="w-3.5 rounded-[2px]"
                          style={{ height: `${Math.max(2, (m.count / tallest) * 22)}px`, background: m.count ? (i === p.byMonth.length - 1 ? '#c8323d' : '#e9a3a9') : 'var(--row-rule)' }}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {months.length > 0 && (
              <p className="m-0 text-[12px] text-muted">
                Bars: automatic clock-outs per month, {MONTH_LONG[Number(months[0].slice(5, 7)) - 1]} to {MONTH_LONG[Number(months[months.length - 1].slice(5, 7)) - 1]}.
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2.5">
            <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Every occurrence</h2>
            <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-auto">
              <div className="min-w-[1110px]">
                <div className={`${OCC_GRID} bg-subtle border-b border-[var(--panel-border)]`}>
                  {['Date', 'Person', 'Job', 'Clock started', 'Stopped by North Time', 'Real end confirmed', 'Difference', 'Kept going earlier', 'Entry'].map(h => (
                    <div key={h} className={`px-3 py-2.5 whitespace-nowrap ${LABEL}`}>{h}</div>
                  ))}
                </div>
                {occ.map(o => {
                  const diff = diffText(o.diffMinutes)
                  return (
                    <div key={o.eventId} className={`${OCC_GRID} items-center border-b border-[var(--row-rule)] text-[13px] tabular-nums lining-nums hover:bg-[var(--row-hover)]`}>
                      <div className="px-3 py-2.5 text-tn-ink font-semibold whitespace-nowrap">{dayLabel(o.date)}</div>
                      <div className="px-3 py-2.5 text-tn-ink font-(family-name:--font-display) font-bold whitespace-nowrap">{o.name}</div>
                      <div className="px-3 py-2.5 text-foreground truncate" title={o.job}>{o.job}</div>
                      <div className="px-3 py-2.5 text-foreground whitespace-nowrap">{o.clockStarted}</div>
                      <div className="px-3 py-2.5 text-foreground whitespace-nowrap">{o.stoppedAt}</div>
                      <div className={`px-3 py-2.5 whitespace-nowrap ${o.confirmedEnd ? 'text-foreground' : 'text-[#c8323d] font-bold'}`}>{o.confirmedEnd ?? 'Not confirmed'}</div>
                      <div className="px-3 py-2.5 font-bold whitespace-nowrap" style={{ color: diff.color }}>{diff.text}</div>
                      <div className="px-3 py-2.5 text-foreground whitespace-nowrap">{o.keptGoingEarlier ? 'Yes' : 'No'}</div>
                      <div className="px-3 py-2.5 whitespace-nowrap">
                        {o.entryId != null && (
                          <Link href={withViewAs(`/clocky-hours?entry=${o.entryId}`)} className="text-[12.5px] font-bold text-tn-teal hover:text-tn-ink">Open entry</Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="m-0 text-[12px] text-muted">&quot;Kept going earlier&quot; means the person answered &quot;Still working?&quot; at least once that day before the clock stopped.</p>
          </section>
        </>
      )}
    </div>
  )
}
