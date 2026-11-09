/**
 * A time typed by hand, as minutes after midnight (owner, 9 November 2026:
 * times could only be picked from the list). Reads "1:15 pm", "1:15PM",
 * "13:15", "1315", "9", "9a", "9 am", "12:00 AM" and "noon"/"midnight".
 * A bare hour from 1 to 6 is read as PM (meetings run in the day), 7 to 11
 * as AM, 12 as noon. Null when it is not a time.
 */
export function parseTime(text: string, opts: { allowMidnightEnd?: boolean } = {}): number | null {
  const t = text.trim().toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ')
  if (!t) return null
  if (t === 'noon') return 720
  if (t === 'midnight') return opts.allowMidnightEnd ? 1440 : 0
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*(a|am|p|pm)?$/.exec(t)
  if (!m) return null
  let h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (min > 59) return null
  const ap = m[3]?.[0]
  if (ap) {
    if (h < 1 || h > 12) return null
    if (ap === 'a') h = h === 12 ? 0 : h
    else h = h === 12 ? 12 : h + 12
  } else if (!m[2] && h >= 1 && h <= 6) h += 12
  if (h > 24 || (h === 24 && min > 0)) return null
  const total = h * 60 + min
  if (total === 1440) return opts.allowMidnightEnd ? 1440 : 0
  if (total === 0 && opts.allowMidnightEnd && /^(12(:00)?\s*am?|0{1,2}(:?00)?)$/.test(t)) return 1440
  return total
}
