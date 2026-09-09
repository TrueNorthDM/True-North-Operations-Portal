'use client'

/**
 * The period filter for Project Hours & Others, which is the i7 report's.
 *
 * The same control, the same four ways of asking, and the same behaviour under
 * the hand: it answers the click and lets the URL catch up behind it, because
 * reloading this report means re-reading a year of entries and a filter that
 * waits for that looks broken.
 *
 * Thin on purpose. Everything it knows lives in lib/tsheets/range.ts and in
 * RangeFilter, so the two reports cannot drift into meaning different things by
 * "a calendar year".
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RangeFilter } from './RangeFilter'
import { Select } from '@/components/ui/Select'
import { choiceFromRange, rangeOf, type Range, type RangeChoice } from '@/lib/tsheets/range'

export function ProjectPeriodFilter(
  { range, availableMonths, team = '', teams = [], basePath = '/tools/time-report/grant-pass' }: {
    range: Range
    availableMonths: string[]
    team?: string
    teams?: readonly { id: string; name: string }[]
    /**
     * Where choosing a period goes. A prop so the design check can point it at
     * itself: the toolbar is only on a page behind a login, which is how a
     * negative margin that overlapped the buttons once shipped unseen.
     */
    basePath?: string
  },
) {
  const router = useRouter()
  const [, startNav] = useTransition()

  const newest = availableMonths.length
    ? availableMonths.reduce((mx, m) => (m > mx ? m : mx), availableMonths[0])
    : range.to

  // Its own answer, adjusted during render when the URL moves underneath it,
  // which is what Back and Forward do.
  const urlKey = `${range.from}|${range.to}`
  const [chosen, setChosen] = useState(() => choiceFromRange(range.from, range.to, newest))
  const [lastUrl, setLastUrl] = useState(urlKey)
  if (lastUrl !== urlKey) {
    setLastUrl(urlKey)
    setChosen(choiceFromRange(range.from, range.to, newest))
  }

  function pick(next: RangeChoice) {
    setChosen(next)
    const r = rangeOf(next, newest)
    // A half-typed custom range is not worth a round trip. The popover says so.
    if (r.from <= r.to) {
      startNav(() => router.push(href({ from: r.from, to: r.to })))
    }
  }

  // Both filters live in the URL together, so changing one keeps the other and
  // the address stays shareable.
  const href = (r: { from: string; to: string }, t: string = team) =>
    `${basePath}?from=${r.from}&to=${r.to}${t ? `&team=${encodeURIComponent(t)}` : ''}`

  return (
    <>
      <RangeFilter
        value={chosen}
        onChange={pick}
        currentMonth={newest}
        modes={['month', 'year', 'last12', 'custom']}
        months={[...availableMonths].sort((a, b) => b.localeCompare(a))}
      />
      {teams.length > 0 && (
      <>
        <span className="text-[10px] font-(family-name:--font-display) font-extrabold uppercase tracking-wide text-muted ml-2">Team</span>
        <Select
          value={team}
          onChange={t => startNav(() => router.push(href(range, t)))}
          options={[{ value: '', label: 'All teams' }, ...teams.map(t => ({ value: t.id, label: t.name }))]}
          ariaLabel="Team"
          className="px-3 py-2 rounded-[9px] border border-slate-200 text-sm bg-white text-tn-ink font-(family-name:--font-display) font-bold focus:outline-none focus:border-tn-teal focus:ring-2 focus:ring-tn-teal/20"
        />
      </>
      )}
    </>
  )
}
