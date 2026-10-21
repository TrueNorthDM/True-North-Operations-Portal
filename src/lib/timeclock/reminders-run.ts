/**
 * Clocky's reminders (Company Settings.dc.html 13C), every hour from the
 * server's crontab; each person's lines go at 9:00 AM in their own time zone,
 * the allowance lines when they happen. Each kind is on or off in Company
 * settings > Reminders.
 *
 *   contractor_due    monthly submitters: "Your October timesheet is due tomorrow"
 *   pay_period_ends   every 2 weeks: "Your pay period ends Saturday (Oct 18 to 31)",
 *                     the Thursday before
 *   late              "Submit October: it is 3 days late", the person every
 *                     morning; the Super Admins from the 3rd day
 *   allowance         90% and over to the person; over without approval also to
 *                     the Team Leader and the Super Admins
 *   birthday          "Today: Joy Inyele's birthday." to everyone else, 7:00 AM
 *                     in their time zone (Agenda); never for someone who hides
 *                     their birthday in their settings
 *
 * It also turns contractors into US employees on the day a Super Admin
 * scheduled (type-change.ts).
 *
 * Only people who use Clocky: a late reminder needs time logged in the portal
 * in that period, so nobody is chased for months kept in QuickBooks Time.
 * Fixed, no timesheet contractors submit nothing and are left out. Every line
 * is written once (the notifications' dedupe key), however often this runs.
 */

import { db, loadCadenceChanges, loadClockySettings, loadDirectory, rulesFor } from './clocky-context'
import { loadSubmissions } from './clocky-store'
import { loadAllowanceUse, loadApprovedExtra } from './allowance-data'
import { loadReminders } from './company-settings'
import { localDate, localMinutes, monthLong } from './format'
import { loadPayTerms } from './pay-terms'
import { addDays, daysBetween, isSent, periodContaining, periodLabel, rangeText } from './periods'
import { formatDuration } from './rounding'
import { notifyClockyReminders } from '@/lib/notifications/run'
import { applyTypeChanges } from './type-change'
import { loadBirthDates } from '@/lib/hr/contact'
import { loadCelebrationOptOuts } from '@/lib/settings/person'

export interface RemindersReport { reminders: number; late: number; allowance: number; over: number; birthdays: number }

const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const hrs = (s: number) => (s % 3600 === 0 ? `${s / 3600}h` : formatDuration(s))

export async function runClockyReminders(now = new Date()): Promise<RemindersReport> {
  // Contractors whose day to become an employee has come (10A-4).
  await applyTypeChanges(localDate(now, 'America/New_York'))
  const on = await loadReminders()
  const c = db()
  const [dir, settings] = await Promise.all([loadDirectory(), loadClockySettings()])
  const people = [...dir.people.values()].filter(p => p.active)
  const ids = people.map(p => p.id)
  const [changes, subs, terms] = await Promise.all([loadCadenceChanges(c, ids), loadSubmissions(c, ids), loadPayTerms(ids)])
  const reminders: { personId: string; key: string; text: string }[] = []
  const late: { personId: string; key: string; text: string }[] = []
  const allowance: { personId: string; key: string; text: string }[] = []
  const over: { personId: string; key: string; to: string[]; text: string }[] = []

  // ── 9:00 AM in each person's zone: due, ends, late ───────────────────────
  const atNine = people.filter(p => Math.floor(localMinutes(now, p.zone) / 60) === 9)
  if (atNine.length && (on.contractor_due || on.pay_period_ends || on.late)) {
    const prevOf = new Map(atNine.map(p => {
      const today = localDate(now, p.zone)
      const rules = rulesFor(p.id, changes, settings)
      const cur = periodContaining(today, rules)
      return [p.id, { today, cur, prev: periodContaining(addDays(cur.start, -1), rules) }]
    }))
    const lo = [...prevOf.values()].reduce((m, x) => (x.prev.start < m ? x.prev.start : m), '9999-12-31')
    const { data: used } = await c.from('tc_entries').select('person_id, entry_date').in('person_id', atNine.map(p => p.id)).eq('source', 'portal').gte('entry_date', lo).limit(20000)
    for (const p of atNine) {
      if (terms.get(p.id)?.paysAs === 'fixed_no_timesheet') continue
      const { today, cur, prev } = prevOf.get(p.id)!
      const mine = subs.get(p.id) ?? []
      const sent = (s: string, e: string) => mine.some(x => x.start === s && x.end === e && isSent(x.state))
      const label = periodLabel(cur)
      if (on.contractor_due && cur.kind === 'month' && cur.end === addDays(today, 1) && !sent(cur.start, cur.end)) {
        reminders.push({ personId: p.id, key: `due:${cur.start}`, text: `Your ${label.label} timesheet is due tomorrow.` })
      }
      if (on.pay_period_ends && cur.kind === 'pay_period' && dow(today) === 4 && cur.end === addDays(today, 2) && !sent(cur.start, cur.end)) {
        reminders.push({ personId: p.id, key: `ends:${cur.start}`, text: `Your pay period ends Saturday (${rangeText(cur.start, cur.end)}).` })
      }
      const clocky = (used ?? []).some(u => u.person_id === p.id && u.entry_date >= prev.start && u.entry_date <= prev.end)
      if (on.late && clocky && !sent(prev.start, prev.end)) {
        const n = daysBetween(prev.end, today)
        const pl = periodLabel(prev)
        if (n >= 1) reminders.push({ personId: p.id, key: `late:${prev.start}:${today}`, text: `Submit ${pl.label}: it is ${n} day${n === 1 ? '' : 's'} late.` })
        if (n >= 3) late.push({ personId: p.id, key: `late:${p.id}:${prev.start}:${today}`, text: `Submit ${pl.label}: it is ${n} days late. ${p.name} has not submitted.` })
      }
    }
  }

  // ── The allowance, whenever it happens ───────────────────────────────────
  if (on.allowance) {
    const today = localDate(now, 'America/New_York')
    const use = await loadAllowanceUse(terms, now, await loadApprovedExtra(ids, addDays(today, -40), addDays(today, 40)))
    const supers = (await c.from('people').select('id').eq('access_level', 'super_admin').eq('status', 'active')).data?.map(r => r.id) ?? []
    for (const [pid, u] of use) {
      const p = dir.people.get(pid)
      if (!p) continue
      const period = u.period === 'month' ? `${monthLong(u.from)} allowance` : 'allowance this week'
      const extra = u.limit - u.hours * 3600
      if (u.state === 'near') {
        allowance.push({ personId: pid, key: `90:${u.from}`, text: `You have used 90% of your allowance: ${hrs(u.used)} of ${u.hours}h ${u.period === 'month' ? 'this month' : 'this week'}.` })
      }
      if (u.state === 'over') {
        allowance.push({ personId: pid, key: `over:${u.from}`, text: `You are over your ${period} (${u.hours}h${extra > 0 ? `, plus ${hrs(extra)} approved in advance` : ''}). Ask before adding more hours.` })
        const leaders = [...dir.led.entries()].filter(([, teams]) => p.teamIds.some(t => teams.has(t))).map(([id]) => id)
        over.push({ personId: pid, key: `over:${pid}:${u.from}`, to: [...leaders, ...supers], text: `${p.name} is over the ${u.period === 'month' ? `${monthLong(u.from)} ` : ''}allowance without approval: ${formatDuration(u.used)} of ${u.hours}h.` })
      }
    }
  }

  // ── 7:00 AM in each person's zone: today's birthdays (Agenda) ────────────
  const birthdays: { to: string; key: string; text: string }[] = []
  const atSeven = people.filter(p => Math.floor(localMinutes(now, p.zone) / 60) === 7)
  if (on.birthday && atSeven.length) {
    const [dobs, optOut] = await Promise.all([loadBirthDates(), loadCelebrationOptOuts(c)])
    for (const r of atSeven) {
      const today = localDate(now, r.zone), y = Number(today.slice(0, 4))
      const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
      for (const p of people) {
        const md = dobs.get(p.id)?.slice(5, 10)
        if (!md || p.id === r.id || optOut.birthday.has(p.id)) continue
        // Feb 29 birthdays are kept on Feb 28 in other years, as in the Agenda.
        if (md === today.slice(5) || (md === '02-29' && !leap && today.slice(5) === '02-28')) {
          birthdays.push({ to: r.id, key: `bday:${p.id}:${y}`, text: `Today: ${p.name}'s birthday.` })
        }
      }
    }
  }

  if (reminders.length || late.length || allowance.length || over.length || birthdays.length) await notifyClockyReminders({ reminders, late, allowance, over, birthdays })
  return { reminders: reminders.length, late: late.length, allowance: allowance.length, over: over.length, birthdays: birthdays.length }
}
