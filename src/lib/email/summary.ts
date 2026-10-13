/**
 * The daily summary email (7 October 2026): one a day for Tools (System
 * stopped being emailed 13 October 2026), at the person's summary hour (8:00 unless they chose 6:00 to 10:00)
 * in their time zone, on US working days. After a
 * weekend or a holiday it is a catch-up: "What you missed since Friday", with
 * the days off named and the items under the day they landed.
 *
 * Same look as the portal's other emails (invite.ts): tables and inline styles
 * so every mail client draws it, readable with images blocked, light only. The
 * header is navy for Tools and indigo for System, so the two tell apart at a
 * glance in an inbox. Pure: the summary run, "Send me a test" and the tests
 * share it.
 */

import { CATEGORY_LABEL, NOTIFICATION_TYPES, TYPE_BY_KEY } from '@/lib/notifications/catalogue'
import { previousWorkingDay, type MissedDay } from '@/lib/notifications/calendar'

export type SummaryCategory = 'tools' | 'system'

export interface SummaryItem {
  type: string
  title: string
  body: string
  /** A path in the portal ("/my-work"); the origin is added here. */
  href: string | null
  /** The day it landed in the person's calendar, YYYY-MM-DD. */
  day: string
}

export interface SummaryInput {
  category: SummaryCategory
  firstName: string
  /** Today in the person's calendar. */
  today: string
  /** The days off this summary covers (empty on an ordinary day). */
  missed: readonly MissedDay[]
  items: readonly SummaryItem[]
  /** The portal's public address, for the links and the logo. */
  origin: string
  /** "New York", "Sao Paulo": the person's zone, said in the footer. */
  zoneLabel: string
  /** The hour it arrives, said in the footer. 8 unless they chose another. */
  hour?: number
  /** Sent from "Send me a test": says so at the top. */
  test?: boolean
}

export interface SummarySection { type: string; heading: string; items: SummaryItem[] }
export interface SummaryStat { type: string; count: number; label: string; alarm: boolean }

const WEEKDAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayParts = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { w: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), m: m - 1, d }
}
/** "Wednesday, October 7" */
export const longDay = (iso: string) => { const p = dayParts(iso); return `${WEEKDAY[p.w]}, ${MONTH[p.m]} ${p.d}` }
/** "Sat, Oct 10" */
export const shortDay = (iso: string) => { const p = dayParts(iso); return `${WEEKDAY[p.w].slice(0, 3)}, ${MON[p.m]} ${p.d}` }
const weekday = (iso: string) => WEEKDAY[dayParts(iso).w]

/**
 * How many things one notification stands for: "3 new steps were assigned to
 * you" is three, "A step of yours is due tomorrow" is one. The generators fold
 * several into one notification and put the number first.
 */
export const countOf = (title: string): number => {
  const m = /^(\d+)\s/.exec(title.trim())
  return m ? Number(m[1]) : 1
}

/** Sections in the catalogue's order, newest day first inside each. Only types of this category. */
export function sectionsOf(category: SummaryCategory, items: readonly SummaryItem[]): SummarySection[] {
  const out: SummarySection[] = []
  for (const t of NOTIFICATION_TYPES) {
    if (t.block !== category) continue
    const mine = items.filter(i => i.type === t.key).sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0))
    if (mine.length) out.push({ type: t.key, heading: t.section, items: mine })
  }
  return out
}

export function statsOf(sections: readonly SummarySection[]): SummaryStat[] {
  return sections.map(s => {
    const t = TYPE_BY_KEY.get(s.type)!
    const count = s.items.reduce((n, i) => n + countOf(i.title), 0)
    return { type: s.type, count, label: count === 1 && t.statOne ? t.statOne : t.stat, alarm: !!t.alarm }
  })
}

/** The subject line: what is in it, in a glance. */
export function subjectOf(input: Pick<SummaryInput, 'category' | 'today' | 'missed' | 'test'>, stats: readonly SummaryStat[]): string {
  const total = stats.reduce((n, s) => n + s.count, 0)
  const parts = stats.slice(0, 3).map(s => `${s.count} ${s.label}`).join(', ')
  const since = weekday(previousWorkingDay(input.today))
  const base = input.missed.length
    ? `${input.category === 'tools' ? 'What you missed' : 'The portal'} since ${since}: ${total} ${total === 1 ? 'update' : 'updates'}`
    : `${input.category === 'tools' ? 'Your day' : 'The portal today'}: ${parts}`
  return input.test ? `Test: ${base}` : base
}

// ── HTML ────────────────────────────────────────────────────────────────────

const e = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

const SANS = "'Open Sans',Arial,sans-serif"
const DISPLAY = 'Raleway,Arial,sans-serif'
const C = {
  page: '#f1efe8', card: '#ffffff', rule: '#e4e7ec', row: '#eef0f3', subtle: '#f6f4ee',
  ink: '#012358', text: '#435066', muted: '#8593a4', gold: '#F2C40A', teal: '#1E7D7F', red: '#c8323d', violet: '#5b4bc4',
} as const
const HEAD = {
  tools: { bg: '#012358', tile: '#163868', tileRule: '#2b4c80', sub: '#c9d6ea' },
  system: { bg: '#1d1a5c', tile: '#2c2972', tileRule: '#433f8c', sub: '#cfcdf0' },
} as const

/** The coloured bar beside each line: red for an alarm, gold for due tomorrow, else the category. The settings preview draws the same. */
export const barColor = (type: string, category: SummaryCategory) => {
  const t = TYPE_BY_KEY.get(type)
  if (t?.alarm) return C.red
  if (type === 'step-due-tomorrow') return C.gold
  return category === 'system' ? C.violet : C.teal
}

function itemHtml(i: SummaryItem, category: SummaryCategory, origin: string, showDay: boolean): string {
  const t = TYPE_BY_KEY.get(i.type)
  const tag = [t?.src ?? '', showDay ? shortDay(i.day) : ''].filter(Boolean).join(' · ')
  const link = i.href ? `${origin}${i.href}` : `${origin}/settings#notifications`
  return `
          <tr><td style="padding:0 0 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${C.row};border-left:4px solid ${barColor(i.type, category)};border-radius:10px;">
              <tr>
                <td style="padding:12px 14px;font-family:${SANS};">
                  <div style="font-family:${DISPLAY};font-weight:800;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:${C.muted};">${e(tag)}</div>
                  <div style="font-family:${DISPLAY};font-weight:800;font-size:14px;line-height:1.35;color:${C.ink};margin-top:2px;">${e(i.title)}</div>
                  <div style="font-size:13px;line-height:1.5;color:${C.text};margin-top:2px;">${e(i.body)}</div>
                </td>
                <td width="70" align="right" style="padding:12px 14px 12px 0;vertical-align:middle;white-space:nowrap;">
                  <a href="${e(link)}" style="font-family:${SANS};font-weight:700;font-size:12.5px;color:${C.teal};text-decoration:none;">Open &rarr;</a>
                </td>
              </tr>
            </table>
          </td></tr>`
}

export function renderSummary(input: SummaryInput): { subject: string; html: string; text: string } {
  const { category, origin, missed } = input
  const sections = sectionsOf(category, input.items)
  const stats = statsOf(sections)
  const subject = subjectOf(input, stats)
  const head = HEAD[category]
  const catchUp = missed.length > 0
  const since = weekday(previousWorkingDay(input.today))
  const title = catchUp
    ? (category === 'tools' ? `What you missed since ${since}` : `The portal since ${since}`)
    : (category === 'tools' ? 'Your daily summary' : 'The portal today')
  const dateLine = `${longDay(input.today)}${catchUp ? ' · catching up' : ''}`
  const hello = category === 'tools'
    ? (catchUp
      ? `Welcome back, ${input.firstName}. No summaries went out on the days off, so here is everything in one place, newest first.`
      : `Good morning, ${input.firstName}. Here is what changed since the last summary.`)
    : (catchUp
      ? `Good morning, ${input.firstName}. Everything the portal noticed about itself on the days off, newest first.`
      : `Good morning, ${input.firstName}. Everything the portal noticed about itself since the last summary.`)
  const cta = category === 'tools' ? { text: 'Open My Work', href: '/my-work' } : { text: 'Open Admin', href: '/admin' }
  const preheader = stats.map(s => `${s.count} ${s.label}`).join(', ')
  const days = new Set(input.items.map(i => i.day))
  const showDay = catchUp || days.size > 1

  const tiles = stats.slice(0, 4).map(s => `
                <td width="25%" style="padding:0 4px;vertical-align:top;">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${head.tile};border:1px solid ${head.tileRule};border-radius:12px;">
                    <tr><td style="padding:10px 12px;">
                      <div style="font-family:${DISPLAY};font-weight:900;font-size:24px;line-height:1.1;color:${s.alarm ? '#ffb4a8' : '#ffffff'};">${s.count}</div>
                      <div style="font-family:${SANS};font-size:12px;line-height:1.3;color:${head.sub};">${e(s.label)}</div>
                    </td></tr>
                  </table>
                </td>`).join('')

  const chips = catchUp ? `
          <tr><td style="padding:0 0 14px;font-family:${SANS};font-size:12px;">
            ${missed.map(m => m.holiday
              ? `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 11px;border-radius:999px;background:${C.gold};color:${C.ink};font-weight:800;">${e(shortDay(m.day))} · ${e(m.holiday)}</span>`
              : `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 11px;border-radius:999px;border:1px solid ${head.tileRule};color:#ffffff;font-weight:600;">${e(shortDay(m.day))}</span>`).join('')}
          </td></tr>` : ''

  const countIn = (s: SummarySection) => s.items.reduce((n, i) => n + countOf(i.title), 0)
  const body = sections.map(s => `
          <tr><td style="padding:18px 0 10px;">
            <span style="font-family:${DISPLAY};font-weight:800;font-size:13px;letter-spacing:.1em;text-transform:uppercase;color:${C.teal};">${e(s.heading)}</span>
            <span style="font-family:${SANS};font-weight:700;font-size:11.5px;color:${C.muted};background:${C.subtle};border-radius:999px;padding:1px 8px;margin-left:6px;">${countIn(s)}</span>
          </td></tr>${s.items.map(i => itemHtml(i, category, origin, showDay)).join('')}`).join('')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Raleway:wght@800;900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.page};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:640px;background:${C.card};border:1px solid ${C.rule};border-radius:16px;overflow:hidden;">${input.test ? `
      <tr><td style="padding:9px 28px;background:#fbf1cf;font-family:${SANS};font-size:12.5px;font-weight:700;color:#6b5000;">A test, sent from your notification settings. The real summary looks just like this.</td></tr>` : ''}
      <tr><td style="background:${head.bg};border-top:4px solid ${C.gold};padding:22px 28px 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="padding:0 0 14px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="background:#ffffff;border-radius:6px;padding:3px 6px;"><img src="${e(origin)}/logos/true-north.png" width="64" alt="True North" style="display:block;width:64px;height:auto;border:0;font-family:${DISPLAY};font-weight:900;font-size:12px;color:${C.ink};"></td>
              <td style="padding-left:10px;font-family:${SANS};font-size:13px;font-weight:600;color:${head.sub};">Operations Portal${category === 'system' ? ' · System' : ''}</td>
            </tr></table>
          </td></tr>
          <tr><td style="font-family:${DISPLAY};font-weight:800;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:${C.gold};">${e(dateLine)}</td></tr>
          <tr><td style="padding:2px 0 14px;font-family:${DISPLAY};font-weight:900;font-size:26px;line-height:1.15;color:#ffffff;">${e(title)}</td></tr>${chips}
          <tr><td>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 -4px;"><tr>${tiles}</tr></table>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:22px 28px 6px;font-family:${SANS};color:${C.text};">
        <p style="margin:0;font-size:15px;line-height:1.6;">${e(hello)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}
        </table>
      </td></tr>
      <tr><td align="center" style="padding:14px 28px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="border-radius:10px;background:${C.gold};">
            <a href="${e(origin + cta.href)}" style="display:inline-block;padding:12px 26px;font-family:${DISPLAY};font-weight:900;font-size:14.5px;color:${C.ink};text-decoration:none;border-radius:10px;">${cta.text}</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="background:${C.subtle};padding:18px 28px;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">
        <p style="margin:0 0 6px;">${category === 'tools'
          ? `You get this summary Monday to Friday at ${input.hour ?? 8}:00 AM, your time (${e(input.zoneLabel)}). After a weekend or a US holiday, it catches you up on the days you missed. Everything here is also in the bell.`
          : `Urgent problems, like an integration that stops answering, never wait for this email: they reach the bell the moment they happen. This summary comes Monday to Friday at ${input.hour ?? 8}:00 AM, your time (${e(input.zoneLabel)}).`}</p>
        <p style="margin:0 0 6px;"><a href="${e(origin)}/settings#notifications" style="color:${C.teal};font-weight:700;text-decoration:none;">Choose what reaches you</a> in your notification settings.</p>
        <p style="margin:0;">True North Digital Marketing · Operations Portal</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`

  const text = [
    input.test ? 'A test, sent from your notification settings.\n' : '',
    `${title.toUpperCase()}`,
    dateLine,
    catchUp ? `Days off covered: ${missed.map(m => shortDay(m.day) + (m.holiday ? ` (${m.holiday})` : '')).join(', ')}` : '',
    '',
    hello,
    ...sections.flatMap(s => [
      '',
      `${s.heading.toUpperCase()} (${countIn(s)})`,
      ...s.items.map(i => `- ${showDay ? `[${shortDay(i.day)}] ` : ''}${i.title}: ${i.body}\n  ${i.href ? origin + i.href : origin + '/settings#notifications'}`),
    ]),
    '',
    `${cta.text}: ${origin}${cta.href}`,
    '',
    `Choose what reaches you: ${origin}/settings#notifications`,
    `True North Digital Marketing · Operations Portal · ${CATEGORY_LABEL[category]} summary`,
  ].filter((l, n, a) => l !== '' || a[n - 1] !== '').join('\n')

  return { subject, html, text }
}
