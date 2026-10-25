// Design check: Home's day banner (design_handoff_home, 25 October 2026), at
// the prototype's instant, Monday October 26 at 10:46 AM in New York: on the
// clock since 8:05 AM, then off the clock, then an afternoon in Nairobi, then
// a clock the top bar could not read.
// /design-check/home-banner

import { DayBanner } from '@/components/home/DayBanner'
import { FRAMES } from '@/app/design-check/clocky-clock/sample'
import type { ClockPanelData } from '@/lib/timeclock/clocky-types'

const NOW = '2026-10-26T14:46:00.000Z'
const off = FRAMES.find(f => f.code === '1A')!.data!
const onFrame = FRAMES.find(f => f.code === '1E')!.data!

const on: ClockPanelData = {
  ...onFrame,
  now: NOW,
  todaySeconds: 2 * 3600 + 41 * 60,
  todaySpans: [{ start: '2026-10-26T12:05:00.000Z', end: null }],
  running: { ...onFrame.running!, label: 'Leadership · Operations', sessionStartedAt: '2026-10-26T12:05:00.000Z', startedAtReal: '2026-10-26T12:05:00.000Z', startedAt: '2026-10-26T12:00:00.000Z' },
}
const offToday: ClockPanelData = { ...off, now: NOW, todaySeconds: 0, todaySpans: [] }
const nairobi: ClockPanelData = {
  ...off, now: NOW, todaySeconds: 6 * 3600 + 20 * 60,
  todaySpans: [{ start: '2026-10-26T03:30:00.000Z', end: '2026-10-26T07:00:00.000Z' }, { start: '2026-10-26T08:00:00.000Z', end: '2026-10-26T10:50:00.000Z' }],
}

export default function Page() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1216px] space-y-8 pb-10">
        <DayBanner firstName="Arnaldo" zone="America/New_York" summary="5 things need you today, 2 of them late." serverNow={NOW} hasClock sample={on} />
        <DayBanner firstName="Wendy" zone="America/New_York" summary="Today is clear. 2 more this week." serverNow={NOW} hasClock sample={offToday} />
        <DayBanner firstName="Hosea" zone="Africa/Nairobi" summary="Nothing is waiting on you." serverNow={NOW} hasClock sample={nairobi} />
        <DayBanner firstName="Rock" zone="America/New_York" summary="Nothing is waiting on you." serverNow={NOW} hasClock sample={null} sampleError="The clock could not be read. Try again in a moment." />
      </div>
    </div>
  )
}
