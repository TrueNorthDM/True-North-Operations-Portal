// The 6C page with the prototype's data (Approvals.dc.html: TS, PREV, days(),
// entries(), frame()), built through the real buildReview. "Now" is Tue,
// Nov 3, 2026, 9:32 AM in New York.

import { wallToInstant } from '@/lib/timeclock/clock'
import type { InvRow, LineRow } from '@/lib/timeclock/invoice-doc'
import { buildReview, type ReviewSource, type ReviewView, type SubRow, type TimesheetReview } from '@/lib/timeclock/timesheet-review'
import type { PaysAs } from '@/lib/timeclock/routing'

const NY = 'America/New_York'
const NOW = new Date('2026-11-03T14:32:00Z')
const ID: Record<string, string> = {
  'Arnaldo Oliveira': 'ao', 'Dave Sharpe': 'dave', 'Wendy Cacka': 'wendy', 'Rock Kai': 'rock', 'Tina Gennette': 'tina', 'Samuel Manzi': 'sm', 'Cheyenne Wilson': 'cw',
  'Justus Tsofa': 'jt', 'Olivia Hale': 'oh', 'Clarise Nixon': 'cn', Andressa: 'an', Yuliberth: 'yu', John: 'jo',
}
const NAMES = Object.fromEntries(Object.entries(ID).map(([n, id]) => [id, n]))
const TEAMC: Record<string, string> = { Africa: '#F0A35E', Leadership: '#1E40AF', 'Social Media': '#DC2626', SEO: '#F4C24A', 'Special Projects': '#6D5EF5', Web: '#A99BD4', Writers: '#86C06A' }
const TEAM: Record<string, string> = { cw: 'Writers', jt: 'Africa', oh: 'SEO', cn: 'Social Media', sm: 'Web', rk: 'Social Media', an: 'Special Projects', yu: 'Special Projects', jo: 'Special Projects', wc: 'Web' }
const REP: Record<string, string> = { cw: 'ao', jt: 'ao', oh: 'ao', cn: 'rock', sm: 'wendy', rk: 'dave', an: 'ao', yu: 'ao', jo: 'dave', wc: 'ao' }
const PID: Record<string, string> = { cw: 'cw', jt: 'jt', oh: 'oh', cn: 'cn', sm: 'sm', rk: 'rock', an: 'an', yu: 'yu', jo: 'jo', wc: 'wendy' }

type T = {
  who: string; con: boolean; sub: string; rate?: number; fixed?: number; noTs?: boolean; inv?: string; email: string; country: string
  cl: [string, number, boolean][]; rb?: [string, string, number][]; al?: [number, number]; attn: string[]; skip?: string[]
  from?: string; to?: string; pto?: Record<string, [string, number]>; zone?: string
}
const TS: Record<string, T> = {
  cw: { who: 'Cheyenne Wilson', con: true, sub: '2026-11-01T14:14:00Z', rate: 22, inv: 'INV-2026-0143', email: 'cheyenne.wilson@email.com', country: 'United States', cl: [['2 - i7 Marketing', 5760, true], ['1 - True North', 2475, false], ['Adventist Messengers/HFA', 840, true]], rb: [['Software', 'Grammarly Premium, October', 30]], al: [8400, 480], attn: ['Wed, Oct 14:confirmed'] },
  jt: { who: 'Justus Tsofa', con: true, sub: '2026-11-01T07:05:00Z', rate: 14, inv: 'INV-2026-0142', email: 'justus.tsofa@email.com', country: 'Nairobi, Kenya', cl: [['2 - i7 Marketing', 7200, true], ['1 - True North', 1830, false], ['A.org Job', 720, true]], rb: [['Internet', 'Internet, October', 35]], attn: ['Tue, Oct 13:confirmed', 'Fri, Oct 9:confirmed'], zone: 'Africa/Nairobi' },
  oh: { who: 'Olivia Hale', con: true, sub: '2026-10-31T22:40:00Z', fixed: 1800, inv: 'INV-2026-0144', email: 'olivia.hale@email.com', country: 'United States', cl: [['2 - i7 Marketing', 4500, true], ['1 - True North', 1905, false], ['GNA', 720, true]], skip: ['2026-10-12'], attn: [] },
  cn: { who: 'Clarise Nixon', con: true, sub: '2026-11-01T16:30:00Z', rate: 18, inv: 'INV-2026-0145', email: 'clarise.nixon@email.com', country: 'United States', cl: [['2 - i7 Marketing', 4800, true], ['1 - True North', 2340, false], ['DDI', 780, true]], attn: ['Wed, Oct 14:never', 'Fri, Oct 2:never'] },
  sm: { who: 'Samuel Manzi', con: true, sub: '2026-10-31T22:40:00Z', rate: 20, inv: 'INV-2026-0147', email: 'samuel.manzi@email.com', country: 'United States', cl: [['1 - True North', 5760, false], ['2 - i7 Marketing', 3840, true]], attn: ['Wed, Oct 7:confirmed'] },
  rk: { who: 'Rock Kai', con: true, sub: '2026-11-01T15:20:00Z', rate: 20, inv: 'INV-2026-0148', email: 'rock.kai@email.com', country: 'United States', cl: [['2 - i7 Marketing', 4200, true], ['1 - True North', 3000, false], ['GNA', 1200, true]], attn: [] },
  an: { who: 'Andressa', con: true, noTs: true, fixed: 2000, inv: 'INV-2026-0149', sub: '2026-11-01T10:00:00Z', email: 'andressa@email.com', country: 'Brazil', cl: [], attn: [] },
  wc: { who: 'Wendy Cacka', con: false, sub: '2026-10-17T21:40:00Z', email: 'wendy.cacka@email.com', country: 'United States', from: '2026-10-04', to: '2026-10-17', cl: [['1 - True North', 3000, false], ['2 - i7 Marketing', 1800, true]], pto: { '2026-10-16': ['Vacation', 480] }, attn: ['Wed, Oct 7:confirmed'] },
}
const PREV: Record<string, [string, number, number, string][]> = {
  cw: [['2026-09', 8400, 3080, '2026-10-12'], ['2026-08', 8160, 2992, '2026-09-11']], jt: [['2026-09', 9420, 2233, '2026-10-12'], ['2026-08', 9600, 2275, '2026-09-11']],
  oh: [['2026-09', 7260, 1800, '2026-10-13'], ['2026-08', 7020, 1800, '2026-09-11']], cn: [['2026-09', 7680, 2304, '2026-10-12'], ['2026-08', 7920, 2376, '2026-09-11']],
  sm: [['2026-09', 9120, 3040, '2026-10-12'], ['2026-08', 9510, 3170, '2026-09-11']], an: [['2026-09', 0, 2000, '2026-10-12'], ['2026-08', 0, 2000, '2026-09-11']],
  rk: [['2026-09', 8160, 2720, '2026-10-12'], ['2026-08', 8400, 2800, '2026-09-11']],
}
const JOBS: Record<string, [string, string, string, string, string]> = {
  '1 - True North': ['1 - True North › Web Dev', 'WebDev', 'True North', 'In-House', ''], '2 - i7 Marketing': ['2 - i7 Marketing › Content', 'Content: Writing', 'True North', 'In-House', 'i7-MKTG'],
  'Adventist Messengers/HFA': ['Adventist Messengers/HFA', 'Translation', 'COE', 'NAD', ''], 'A.org Job': ['A.org Job', 'Content: Editing', 'A.org', 'NAD', ''],
  GNA: ['GNA', 'Content: Writing', 'GNA/COEI', 'GYC', ''], DDI: ['DDI', 'Design', 'DDI', 'In-House', ''],
}
const OWN: Record<string, Record<string, [string, string, string, string, string]>> = {
  sm: { '2 - i7 Marketing': ['2 - i7 Marketing › Web Dev', 'WebDev', 'True North', 'In-House', 'i7-WEBDVT'] }, wc: { '2 - i7 Marketing': ['2 - i7 Marketing › Web Dev', 'WebDev', 'True North', 'In-House', 'i7-WEBDVT'] },
  rk: { '2 - i7 Marketing': ['2 - i7 Marketing › Marketing', 'Social Media', 'True North', 'In-House', 'i7-SOC'] }, cn: { '2 - i7 Marketing': ['2 - i7 Marketing › Marketing', 'Social Media', 'True North', 'In-House', 'i7-SOC'] },
  oh: { '2 - i7 Marketing': ['2 - i7 Marketing › SEO', 'SEO: Routine', 'True North', 'In-House', 'i7-SEO'] },
}
const TNJOB: Record<string, [string, string]> = { sm: ['1 - True North › Web Dev', 'WebDev'], wc: ['1 - True North › Web Dev', 'WebDev'], rk: ['1 - True North › Management', 'Management'], cn: ['1 - True North › Marketing', 'Social Media'], oh: ['1 - True North › SEO', 'SEO: Routine'], cw: ['1 - True North › Content', 'Content: Writing'], jt: ['1 - True North › Administrative', 'General admin'] }
const NOTES = ['', 'Client review fixes', '', 'Follow-ups from the client call', 'Drafts for next week', '', 'QA on staging', '', 'Notes from the kickoff']
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const add = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const fday = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return `${WD[d.getUTCDay()]}, ${MON[d.getUTCMonth()]} ${d.getUTCDate()}` }
const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`

/** The prototype's days(): minutes worked per weekday, spread by a small pattern. */
function days(t: T): Record<string, number> {
  const from = t.from ?? '2026-10-01', to = t.to ?? '2026-10-31', total = t.cl.reduce((a, c) => a + c[1], 0), pto = t.pto ?? {}, skip = t.skip ?? []
  const work: string[] = []
  for (let d = from; d <= to; d = add(d, 1)) { const w = dow(d); if (w > 0 && w < 6 && !pto[d] && !skip.includes(d)) work.push(d) }
  const n = work.length, base = Math.floor(total / n / 15) * 15, r = Math.round((total - base * n) / 15), pat = [30, -15, 0, 15, -30], map: Record<string, number> = {}
  work.forEach((d, i) => { map[d] = base + pat[i % 5] + (i < r ? 15 : 0) })
  const sum = work.reduce((a, d) => a + map[d], 0)
  map[work[n - 1]] += total - sum
  return map
}

/** The prototype's entries(): each day's minutes over the clients, as clock entries with a lunch gap. */
function entries(k: string): ReviewView[] {
  const t = TS[k], map = days(t), tot = t.cl.reduce((a, c) => a + c[1], 0), dates = Object.keys(map).sort(), alloc: Record<string, Record<string, number>> = {}
  dates.forEach(d => { alloc[d] = {} })
  const last = t.cl[t.cl.length - 1][0]
  t.cl.slice(0, -1).forEach(([c, m]) => {
    let used = 0
    dates.forEach(d => { const v = Math.round(map[d] * m / tot / 15) * 15; alloc[d][c] = v; used += v })
    let diff = m - used, i = 0
    while (diff !== 0 && i < 2000) { const d = dates[i % dates.length], st = diff > 0 ? 15 : -15, sum = Object.values(alloc[d]).reduce((a, b) => a + b, 0); if (alloc[d][c] + st >= 0 && sum + st <= map[d]) { alloc[d][c] += st; diff -= st } i++ }
  })
  dates.forEach(d => { alloc[d][last] = map[d] - Object.entries(alloc[d]).filter(([c]) => c !== last).reduce((a, [, v]) => a + v, 0) })
  const zone = t.zone ?? NY
  const out: ReviewView[] = []
  const start = k === 'jt' ? 7 * 60 + 30 : 8 * 60
  dates.forEach((d, di) => {
    const segs: { c: string; job: [string, string, string, string, string]; m: number; note: string }[] = []
    t.cl.forEach(([c]) => {
      let m = alloc[d][c]; if (!m) return
      const J = (OWN[k] ?? {})[c] ?? JOBS[c], TN = c === '1 - True North' && TNJOB[k]
      const job: [string, string, string, string, string] = TN ? [TN[0], TN[1], 'True North', 'In-House', ''] : J
      if (c === '1 - True North' && m >= 90 && (dow(d) === 1 || dow(d) === 4)) { segs.push({ c, job: ['1 - True North › Meetings', 'Meeting: Status', 'True North', 'In-House', ''], m: 30, note: 'Weekly status' }); m -= 30 }
      segs.push({ c, job, m, note: NOTES[(di + segs.length) % NOTES.length] })
    })
    let cur = start, worked = 0, lunch = false
    const rows: ReviewView[] = []
    segs.forEach(sg => {
      let rem = sg.m
      while (rem > 0) {
        if (!lunch && worked >= 240) { cur += 45; lunch = true }
        const room = !lunch ? 240 - worked : rem, part = Math.min(rem, room)
        rows.push({
          kind: 'clock', seconds: part * 60, date: d, billable: sg.c !== '1 - True North' ? 'yes' : 'no', path: sg.job[0], short: '',
          start: wallToInstant(d, hhmm(cur), zone), end: wallToInstant(d, hhmm(cur + part), zone),
          activity: sg.job[1], company: sg.job[2], project: sg.job[3], code: sg.job[4], notes: sg.note, autoOut: null,
        })
        cur += part; worked += part; rem -= part
      }
    })
    const lastRow = rows[rows.length - 1]
    for (const a of t.attn) if (a.startsWith(`${fday(d)}:`) && lastRow) lastRow.autoOut = { confirmed: !a.endsWith('never'), flagged: false }
    out.push(...rows)
  })
  for (const [d, [type, m]] of Object.entries(t.pto ?? {})) out.push({ kind: 'absence', seconds: m * 60, date: d, billable: 'no', path: `Time off › ${type}`, short: type, start: null, end: null, activity: '', company: '', project: '', code: '', notes: '', autoOut: null })
  return out
}

function invoiceOf(k: string, state: string, approvedBy: string | null, approvedAt: string | null): { inv: InvRow; lines: LineRow[]; rmb: number } {
  const t = TS[k], tot = t.cl.reduce((a, c) => a + c[1], 0)
  const lines: LineRow[] = t.fixed
    ? [{ kind: 'fixed', client: null, description: 'Fixed monthly amount, October 2026', hours_seconds: t.noTs ? null : tot * 60, rate: null, amount: t.fixed }]
    : t.cl.map(([c, m]) => ({ kind: 'hours', client: c, description: `${c}, October 2026`, hours_seconds: m * 60, rate: t.rate!, amount: Math.round((m / 60) * t.rate! * 100) / 100 }))
  for (const [cat, desc, amt] of t.rb ?? []) lines.push({ kind: 'reimbursement', client: cat, description: desc, hours_seconds: null, rate: null, amount: amt })
  const total = lines.reduce((a, l) => a + l.amount, 0)
  return {
    inv: {
      id: 900 + Object.keys(TS).indexOf(k), number: t.inv!, submission_id: t.noTs ? null : 1, person_id: PID[k], total, kind: t.noTs ? 'fixed_no_timesheet' : t.fixed ? 'fixed_monthly' : 'hourly', state,
      period_start: '2026-10-01', period_end: '2026-10-31', issued_on: '2026-11-01', due_on: '2026-11-15', created_at: '2026-11-01T10:00:00Z',
      approved_by: approvedBy, approved_at: approvedAt, paid_on: null, paid_ref: null,
      from_snapshot: { name: t.who, location: t.country, email: t.email },
      to_snapshot: { name: 'True North Digital Marketing LLC', address: 'PO Box 2096, New York, NY 10163\nUnited States', email: 'billing@truenorthdm.org' },
    },
    lines, rmb: (t.rb ?? []).reduce((a, r) => a + r[2], 0),
  }
}

type Who = 'ao' | 'wendy' | 'dave'
const VIEWER: Record<Who, ReviewSource['viewer']> = {
  ao: { personId: 'ao', level: 'super_admin', isSuperAdmin: true, ledTeamIds: new Set(), zone: NY },
  wendy: { personId: 'wendy', level: 'team_leader', isSuperAdmin: false, ledTeamIds: new Set(['Web']), zone: NY },
  dave: { personId: 'dave', level: 'admin', isSuperAdmin: false, ledTeamIds: new Set(), zone: NY },
}

function source(k: string, me: Who, state: SubRow['state'], x: { hoursAt?: string; approvedAt?: string; job?: ReviewSource['job'] } = {}): ReviewSource {
  const t = TS[k]
  const pid = PID[k]
  const rate = t.rate ?? null
  const paysAs: PaysAs | null = !t.con ? null : t.noTs ? 'fixed_no_timesheet' : t.fixed ? 'fixed_monthly' : 'hourly'
  const sub: SubRow | null = t.noTs ? null : {
    id: 1, person_id: pid, state, submitted_at: t.sub, approved_at: x.approvedAt ?? null, approved_by: x.approvedAt ? 'ao' : null,
    hours_approved_at: x.hoursAt ?? null, hours_approved_by: x.hoursAt ? 'wendy' : null, note: null,
    tc_periods: { start_date: t.from ?? '2026-10-01', end_date: t.to ?? '2026-10-31', kind: t.from ? 'pay_period' : 'month' },
  }
  const iv = t.con ? invoiceOf(k, state === 'approved' ? 'approved' : 'waiting', x.approvedAt ? 'ao' : null, x.approvedAt ?? null) : null
  return {
    viewer: VIEWER[me], sub, inv: iv?.inv ?? null, invLines: iv?.lines ?? [],
    prev: (PREV[k] ?? []).map(([ym, m, amt, paid], i) => ({ id: 800 + i, total: amt, state: 'paid', period_start: `${ym}-01`, period_end: `${ym}-${ym.endsWith('09') ? '30' : '31'}`, paid_on: paid, seconds: m * 60, rmb: 0 })),
    rmb: iv?.rmb ?? 0,
    settings: { invoiceApprovers: ['ao', 'dave'], defaultApprover: 'ao', deputyDirector: 'dave', finance: ['tina'] },
    terms: { paysAs, hourlyRate: rate, fixedAmount: t.fixed ?? null, allowance: t.al ? { hours: t.al[0] / 60, period: 'month' } : null, route: { personId: pid, reportsTo: REP[k], isContractor: t.con, paysAs } },
    person: { name: t.who, teamId: TEAM[k], team: { name: TEAM[k], color: TEAMC[TEAM[k]] ?? null }, zone: t.zone ?? NY },
    names: NAMES, views: t.noTs ? [] : entries(k), extraHours: t.al ? t.al[1] / 60 : 0, job: x.job ?? null, now: NOW,
  }
}

/** The 6C frames: the page's data and the state it opens in. */
export function reviewFrame(frame: string): { review: TimesheetReview; tab?: 'sum' | 'entries' | 'both'; day?: string; modal?: 'return' | 'pdf' } {
  const b = (s: ReviewSource) => buildReview(s)!
  switch (frame) {
    case '6Cr': return { review: b(source('cw', 'ao', 'submitted')), modal: 'return' }
    case '6Ct': return { review: b(source('sm', 'wendy', 'submitted')) }
    case '6Ci': return { review: b(source('sm', 'ao', 'hours_approved', { hoursAt: '2026-11-02T21:10:00Z' })) }
    case '6Ce': return { review: b(source('sm', 'wendy', 'submitted')), tab: 'entries' }
    case '6Cb': return { review: b(source('sm', 'ao', 'hours_approved', { hoursAt: '2026-11-02T21:10:00Z' })), tab: 'both', day: '2026-10-07' }
    case '6Cn': {
      const s = source('an', 'ao', 'submitted')
      return { review: b({ ...s, inv: { ...s.inv!, submission_id: null } }) }
    }
    case '6Cd': return { review: b(source('rk', 'dave', 'submitted')) }
    case '6Cj': return { review: b(source('jt', 'ao', 'submitted')) }
    case '6Cp': return { review: b(source('jt', 'ao', 'submitted')), modal: 'pdf' }
    case '6Co': return { review: b(source('oh', 'ao', 'submitted')) }
    case '6D': return { review: b(source('wc', 'ao', 'submitted')) }
    case '6Ds': return { review: b(source('wc', 'ao', 'approved', { approvedAt: '2026-11-03T15:02:00Z', job: { state: 'done', last_error: null, done_at: '2026-11-03T15:02:00Z' } })) }
    case '6Dx': return { review: b(source('wc', 'ao', 'approved', { approvedAt: '2026-11-03T15:02:00Z', job: { state: 'failed', last_error: 'Wendy Cacka has no pay schedule for Oct 4 to 17.', done_at: null } })) }
    default: return { review: b(source('cw', 'ao', 'submitted')) }
  }
}
