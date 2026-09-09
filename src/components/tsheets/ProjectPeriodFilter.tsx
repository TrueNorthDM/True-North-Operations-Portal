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
import { choiceFromRange, rangeOf, type Range, type RangeChoice } from '@/lib/tsheets/range'

export function ProjectPeriodFilter(
  { range, availableMonths }: { range: Range; availableMonths: string[] },
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
      startNav(() => router.push(`/tools/time-report/grant-pass?from=${r.from}&to=${r.to}`))
    }
  }

  return (
    <RangeFilter
      value={chosen}
      onChange={pick}
      currentMonth={newest}
      modes={['month', 'year', 'last12', 'custom']}
      months={[...availableMonths].sort((a, b) => b.localeCompare(a))}
    />
  )
}
