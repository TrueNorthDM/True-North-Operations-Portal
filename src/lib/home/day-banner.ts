/**
 * The day banner on Home (design_handoff_home, README "1. Banner / day
 * timeline", 25 October 2026): the date, the greeting, the one-line summary,
 * and the day's track, all in the signed-in person's own time zone. Pure, so
 * the server's first paint and the client's one-minute tick agree.
 */

/** Hours since midnight, with minutes as a fraction, of an instant in a zone: 10:46 AM is 10.77. */
export function hourIn(at: Date | string, zone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(at))
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0)
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0)
  return h + m / 60
}

/** "MONDAY, OCTOBER 26 · 10:46 AM" */
export function eyebrow(now: Date, zone: string): string {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'long', month: 'long', day: 'numeric' }).format(now)
  return `${day} · ${clockTime(now, zone)}`.toUpperCase()
}

/** "10:46 AM" */
export const clockTime = (at: Date | string, zone: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit' }).format(new Date(at))

/** Morning before 12, afternoon before 18, evening after. */
export const greeting = (hour: number) => (hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening')

/**
 * "5 things need you today, 2 of them late." From the open rows of Needs you
 * and My Work: late and due today make "today"; the rest of the week the
 * second sentence.
 */
export function summaryLine(n: { late: number; today: number; week: number }): string {
  const urgent = n.late + n.today
  if (urgent) return `${urgent} ${urgent === 1 ? 'thing needs' : 'things need'} you today${n.late ? `, ${n.late} of them late` : ''}.`
  if (n.week) return `Today is clear. ${n.week} more this week.`
  return 'Nothing is waiting on you.'
}

/**
 * The track's hours: 7 AM to 7 PM, widened to the person's day: from the
 * earlier of 7 AM and their first clock-in today (down to the hour), to the
 * later of 7 PM and now (up to the hour).
 */
export function trackRange(nowHour: number, firstStartHour: number | null): { from: number; to: number } {
  const from = Math.min(7, firstStartHour == null ? 7 : Math.floor(firstStartHour))
  const to = Math.min(24, Math.max(19, Math.ceil(nowHour)))
  return { from, to }
}

/** Where an hour sits on the track, 0 to 1. */
export const trackAt = (hour: number, r: { from: number; to: number }) => Math.min(1, Math.max(0, (hour - r.from) / (r.to - r.from)))

/** The hour labels, every 2 hours from the start: "7 AM" ... "7 PM". */
export function trackTicks(r: { from: number; to: number }): { hour: number; label: string; at: number }[] {
  const out: { hour: number; label: string; at: number }[] = []
  for (let h = r.from; h <= r.to; h += 2) {
    const h12 = h % 12 === 0 ? 12 : h % 12
    out.push({ hour: h, label: `${h12} ${h < 12 || h === 24 ? 'AM' : 'PM'}`, at: trackAt(h, r) })
  }
  return out
}

/** Today's worked stretches on the track; one still running ends at now. */
export function trackSegments(spans: readonly { start: string; end: string | null }[], now: Date, zone: string, r: { from: number; to: number }): { left: number; width: number }[] {
  const nowH = hourIn(now, zone)
  return spans.map(s => {
    const a = trackAt(hourIn(s.start, zone), r)
    const b = trackAt(s.end ? hourIn(s.end, zone) : nowH, r)
    return { left: a, width: Math.max(0, b - a) }
  }).filter(s => s.width > 0)
}
