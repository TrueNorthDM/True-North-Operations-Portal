/**
 * The Time entries prototype's own sample data (Time Entries.dc.html, its
 * gen() and frame()), ported so the design checks render every frame
 * without a database: the people, the jobs, two months of entries with the
 * same per-day shifts, the overrides each frame relies on, the corrections
 * and the time off. "Now" is Thu, Oct 15, 2026, 1:20 PM in New York.
 *
 * makeApi() answers like entries-actions.ts and approvals/actions.ts, over an
 * in-memory copy, so the screens can be clicked through. Development only.
 */

import { wallToInstant } from '@/lib/timeclock/clock'
import { overlapsAmong, sharedSpan, trimOther, trimThis, approveOverlapLine, overlapLine } from '@/lib/timeclock/entry-rules'
import { dayLabel, dateLabel, minutesLabel, zoneAbbr, initials as initialsOf } from '@/lib/timeclock/format'
import { addDays } from '@/lib/timeclock/periods'
import { formatDuration, parseDuration, roundSeconds, runningSeconds } from '@/lib/timeclock/rounding'
import type {
  ApprovalRow, ApprovalsData, AttentionItem, ClockChoice, EntriesData, EntryView, HistoryData, PanelField, PanelJob, Pill, SubmitSummary,
} from '@/lib/timeclock/clocky-types'
import type { ApprovalsApi, Catalog, EntriesApi } from '@/components/clocky/entries/api'
import { attentionOrder, goesToLabel, requestHistoryLines, waitingOrder } from '@/lib/timeclock/clocky-requests'

export type Level = 'super' | 'admin' | 'lead' | 'user'

export const NOW_ISO = '2026-10-15T17:20:00.000Z'
const NOW = Date.parse(NOW_ISO)
const TODAY = '2026-10-15'
const NOW_SEC = 13 * 3600 + 20 * 60
const ET = 'America/New_York'
const TZ: Record<string, { zone: string; off: number }> = { ET: { zone: ET, off: 0 }, EAT: { zone: 'Africa/Nairobi', off: 7 }, PT: { zone: 'America/Los_Angeles', off: -3 } }
const TEAMS: [string, string][] = [['Africa', '#F0A35E'], ['Web', '#A99BD4'], ['Leadership', '#1E40AF'], ['Operations', '#92400E'], ['Fund Raising', '#CA8A04'], ['Writers', '#86C06A'], ['Social Media', '#DC2626'], ['SEO', '#F4C24A'], ['Graphics', '#C026D3']]

interface K { job: string; act: string; co: string; prj: string; bill: string; code: string }
const KK: Record<string, K> = {
  tnMgmt: { job: '1 - True North › Management', act: 'Management', co: 'True North', prj: 'In-House', bill: 'no', code: '' },
  tnAdmin: { job: '1 - True North › Administrative', act: 'General admin', co: 'True North', prj: 'In-House', bill: 'no', code: '' },
  tnMeet: { job: '1 - True North › Meetings', act: 'Meeting: Status', co: 'True North', prj: 'In-House', bill: 'no', code: '' },
  tnPM: { job: '1 - True North › Project Management', act: 'Translation', co: 'True North', prj: 'In-House', bill: 'no', code: '' },
  tnWeb: { job: '1 - True North › Web Dev', act: 'WebDev', co: 'True North', prj: 'In-House', bill: 'no', code: '' },
  tnSEO: { job: '1 - True North › SEO', act: 'SEO: Routine', co: 'True North', prj: 'In-House', bill: 'no', code: '' },
  tnMkt: { job: '1 - True North › Marketing', act: 'Graphic creation', co: 'True North', prj: 'In-House', bill: 'no', code: '' },
  i7Content: { job: '2 - i7 Marketing › Content', act: 'Social Media', co: 'True North', prj: 'In-House', bill: 'yes', code: 'i7-MKTG' },
  i7Write: { job: '2 - i7 Marketing › Content', act: 'Content: Writing', co: 'True North', prj: 'In-House', bill: 'yes', code: 'i7-MKTG' },
  i7Web: { job: '2 - i7 Marketing › Web Dev', act: 'WebDev', co: 'True North', prj: 'In-House', bill: 'yes', code: 'i7-WEBDVT' },
  i7Mkt: { job: '2 - i7 Marketing › Marketing', act: 'Social Media', co: 'True North', prj: 'In-House', bill: 'yes', code: 'i7-MKTG' },
  hfa: { job: 'Adventist Messengers/HFA', act: 'Translation', co: 'COE', prj: 'NAD', bill: 'yes', code: '' },
  hfaEdit: { job: 'Adventist Messengers/HFA', act: 'Content: Review/Edit', co: 'COE', prj: 'NAD', bill: 'yes', code: '' },
}
const COMBOS: [string, string][] = [['i7 Social', 'i7Content'], ['TN Management', 'tnMgmt'], ['Status meeting', 'tnMeet'], ['i7 Web Dev', 'i7Web'], ['TN Admin', 'tnAdmin'], ['HFA Translation', 'hfa'], ['i7 Writing', 'i7Write']]
type Pat = [number, number, string]
const PEOPLE: { n: string; t: string | null; tz: string; pat: Pat[] }[] = [
  { n: 'Arnaldo Oliveira', t: 'Leadership', tz: 'ET', pat: [[8, 9.0833, 'tnAdmin'], [9.0833, 9.75, 'hfa'], [10, 13, 'i7Web'], [13.5, 17, 'i7Web']] },
  { n: 'Dave Sharpe', t: 'Leadership', tz: 'ET', pat: [[8, 9.5, 'tnMgmt'], [13, 16, 'tnMgmt']] },
  { n: 'Rock Kai', t: 'Operations', tz: 'ET', pat: [[8.5, 12.25, 'tnMgmt'], [12.75, 16.5, 'tnAdmin']] },
  { n: 'Tina Gennette', t: 'Fund Raising', tz: 'PT', pat: [[7.3333, 10.0833, 'hfaEdit'], [10.5, 14, 'hfa']] },
  { n: 'Justus Tsofa', t: 'Africa', tz: 'EAT', pat: [[9, 13.5, 'i7Write'], [14, 17.5, 'i7Write']] },
  { n: 'Hosea Moturi', t: 'Africa', tz: 'EAT', pat: [[10, 14, 'hfa'], [14.5, 18, 'tnPM']] },
  { n: 'Joy Inyele', t: 'Africa', tz: 'EAT', pat: [[8, 12, 'i7Content'], [12.5, 16.25, 'i7Content']] },
  { n: 'Wendy Cacka', t: 'Web', tz: 'ET', pat: [[8, 12, 'i7Web'], [12.5, 16.5, 'tnWeb']] },
  { n: 'Samuel Manzi', t: 'Web', tz: 'ET', pat: [[6.5, 12.5, 'tnWeb'], [13, 15, 'tnWeb']] },
  { n: 'Clarise Nixon', t: 'Social Media', tz: 'ET', pat: [[7, 11.5, 'i7Content'], [12, 15.5, 'tnMgmt']] },
  { n: 'Stephanie Aguirre', t: 'Social Media', tz: 'ET', pat: [[9.0833, 13.0833, 'i7Mkt'], [13.5, 17, 'i7Mkt']] },
  { n: 'Cheyenne Wilson', t: 'Writers', tz: 'ET', pat: [[7, 11.5, 'i7Write'], [12, 15.5, 'i7Write']] },
  { n: 'Saheed Fidimaye', t: 'SEO', tz: 'ET', pat: [[8.25, 12, 'tnSEO'], [12.5, 16, 'tnSEO']] },
  { n: 'Alyssa Sommerville', t: 'Graphics', tz: 'ET', pat: [[7.5, 10.3333, 'tnMkt'], [11, 15, 'tnMkt']] },
  { n: 'Olivia Hale', t: null, tz: 'ET', pat: [[8, 12, 'hfa'], [12.5, 16.5, 'hfa']] },
]
type X = { act?: string; manual?: boolean; dur?: number; auto?: boolean; autoHist?: boolean; confirmed?: boolean; wendyHist?: boolean; edited?: string; daveHist?: boolean; notes?: string }
type Ov = [number | null, number | null, string, X?]
const OV: Record<string, Record<string, Ov[]>> = {
  'Clarise Nixon': {
    '2026-10-12': [[7, 11.5, 'i7Content'], [12, 15.5, 'tnMgmt']],
    '2026-10-13': [[7, 12, 'i7Content'], [null, null, 'tnMeet', { act: '', manual: true, dur: 2.75 * 3600 }]],
    '2026-10-14': [[7.25, 10, 'tnMgmt'], [10, 15, 'i7Content', { auto: true, autoHist: true }]],
    '2026-10-15': [[7, 9.75, 'tnMgmt'], [9.75, 10.5, 'i7Content'], [10.7, null, 'i7Content']],
  },
  'Dave Sharpe': { '2026-10-14': [[8, 17.1667, 'tnMgmt', { edited: 'Arnaldo Oliveira', daveHist: true }]] },
  'Rock Kai': { '2026-10-13': [[7, 17.5, 'tnMgmt']] },
  'Wendy Cacka': { '2026-10-15': [[8, 12.6667, 'i7Web', { auto: true, confirmed: true, wendyHist: true }]] },
  'Justus Tsofa': { '2026-10-15': [[9, 13.5, 'i7Write'], [14, 18.6667, 'i7Write']] },
  'Hosea Moturi': { '2026-10-15': [[10, 14, 'hfa'], [16.5, null, 'tnPM', { notes: 'Translation' }]] },
  'Joy Inyele': { '2026-10-15': [[8, 12, 'i7Content'], [12.5, 16.25, 'i7Content']] },
  'Samuel Manzi': { '2026-10-15': [[6.5, 12.5, 'tnWeb']] },
  'Cheyenne Wilson': { '2026-10-15': [[7, null, 'i7Write', { notes: 'i7 LinkedIn Project' }]] },
  'Arnaldo Oliveira': { '2026-10-15': [[8, 9.0833, 'tnAdmin'], [9.0833, 9.75, 'hfa'], [10, null, 'i7Web']] },
  'Saheed Fidimaye': { '2026-10-15': [[8.25, 12, 'tnSEO'], [12.5, null, 'tnSEO', { act: '' }]] },
  'Stephanie Aguirre': { '2026-10-15': [[9.0833, 13.0833, 'i7Mkt']] },
}
const ACT = ['Content: Writing', 'Content: Review/Edit', 'General admin', 'Graphic creation', 'Management', 'Meeting: Project', 'Meeting: Status', 'Other (indicate in Notes)', 'Project management', 'SEO: Routine', 'SEO Research', 'Social Media', 'Training', 'Translation', 'WebDev']
const CO = ['COE', 'DDI', 'GNA/COEI', 'True North']
const PRJ = ['AAAF', 'Africa', 'ASI', 'Called!', 'GP church', 'GP School', 'GYC', 'In-House', 'Internship', "Messiah's Mansion", 'NAD', 'not listed--ask Dave', 'Rwanda']
const CODES = ['i7-ADMIN', 'i7-MKTG', 'i7-WEBDVT', 'BE-MKTG', 'MME-WEBDVT', 'WM-ADMIN']
const JOBS = ['1 - True North › Administrative', '1 - True North › Content', '1 - True North › Management', '1 - True North › Marketing', '1 - True North › Meetings', '1 - True North › Project Management', '1 - True North › SEO', '1 - True North › Web Dev', '2 - i7 Marketing › Administrative', '2 - i7 Marketing › Content', '2 - i7 Marketing › Management', '2 - i7 Marketing › Marketing', '2 - i7 Marketing › Meetings', '2 - i7 Marketing › Project Management', '2 - i7 Marketing › SEO', '2 - i7 Marketing › Strategy Sprint', '2 - i7 Marketing › Web Dev', 'A.org Job', 'Adventist Messengers/HFA', 'DDI', 'GNA', 'Rwanda-Incidental']
const ME: Record<Level, string> = { user: 'Clarise Nixon', lead: 'Wendy Cacka', admin: 'Dave Sharpe', super: 'Arnaldo Oliveira' }
const CAD = new Set(['Clarise Nixon', 'Wendy Cacka', 'Samuel Manzi', 'Cheyenne Wilson', 'Stephanie Aguirre', 'Saheed Fidimaye', 'Alyssa Sommerville'])
const LEAD: Record<string, string> = { 'Social Media': 'Rock Kai', Web: 'Wendy Cacka', Africa: 'Justus Tsofa', Writers: 'Dave Sharpe', SEO: 'Rock Kai', Graphics: 'Dave Sharpe', 'Fund Raising': 'Dave Sharpe', Leadership: 'Dave Sharpe', Operations: 'Arnaldo Oliveira' }

const ACCESS = { super: 'super_admin', admin: 'admin', lead: 'team_leader', user: 'user' } as const
/** Who a person's corrections go to: their team's lead (never themselves), else the Admins and Super Admins. */
const goesToOf = (who: string) => { const lead = LEAD[PM.get(who)?.t ?? '']; return goesToLabel(lead && lead !== who ? [lead] : []) }
const pid = (n: string) => `p-${n.toLowerCase().replace(/\s+/g, '-')}`
const tid = (t: string) => `t-${t.toLowerCase().replace(/\s+/g, '-')}`
const PM = new Map(PEOPLE.map(p => [p.n, p]))
const zoneOf = (n: string) => TZ[PM.get(n)?.tz ?? 'ET'].zone
const jobId = (path: string) => JOBS.indexOf(path) + 1
const isI7 = (path: string) => path.startsWith('2 - i7')
const shortOf = (j: string) => { if (!j) return ''; const [a, b] = j.split(' › '); if (!b) return a === 'Adventist Messengers/HFA' ? 'HFA' : a; return `${a.startsWith('2') ? 'i7' : 'TN'} › ${b}` }
const clientOf = (j: string) => (j.startsWith('1 -') ? 'True North' : j.startsWith('2 -') ? 'i7 Marketing' : j.startsWith('Adventist') ? 'HFA' : j.startsWith('Rwanda') ? 'Rwanda' : j)
const R = (t: number) => Math.round(t / 900) * 900
const clk = (sec: number) => minutesLabel(Math.round(sec / 60))
const at = (date: string, sec: number, zone: string) => new Date(Date.parse(wallToInstant(date, '00:00', zone)!) + sec * 1000).toISOString()
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const fieldsOfK = (k: Pick<K, 'co' | 'prj' | 'act' | 'bill' | 'code'>) => {
  const f: Record<string, string> = {}
  if (k.co) f['1'] = k.co
  if (k.prj) f['2'] = k.prj
  if (k.act) f['3'] = k.act
  if (k.bill) f['4'] = k.bill
  if (k.code) f['5'] = k.code
  return f
}

// ── The catalogue: jobs, fields, smart defaults, combinations ──────────────

export const FIELDS: PanelField[] = [
  { key: 'company', id: '1', label: '1 Company', options: CO, required: 'always' },
  { key: 'project', id: '2', label: '2 Project', options: PRJ, required: 'always' },
  { key: 'activity', id: '3', label: '3 Activity', options: ACT, required: 'always' },
  { key: 'billable', id: '4', label: '4 Billable', options: ['yes', 'no'], required: 'always' },
  { key: 'code', id: '5', label: '1 - i7 Code', options: CODES, required: 'i7' },
]
const JOB_LIST: PanelJob[] = JOBS.map((path, i) => ({ id: i + 1, name: path.split(' › ').pop()!, path, short: shortOf(path), folderId: path.includes(' › ') ? (path.startsWith('1') ? 100 : 200) : null, isI7: isI7(path) }))
function defaultsOf(j: string): Partial<K> {
  if (isI7(j)) { const k = j.split(' › ')[1]; return { co: 'True North', prj: 'In-House', bill: 'yes', code: k === 'Web Dev' ? 'i7-WEBDVT' : k === 'Administrative' ? 'i7-ADMIN' : 'i7-MKTG' } }
  if (j.startsWith('1 -')) return { co: 'True North', prj: 'In-House', bill: 'no', code: '' }
  return ({ 'A.org Job': { co: 'COE', prj: 'ASI', bill: 'yes' }, 'Adventist Messengers/HFA': { co: 'COE', prj: 'NAD', bill: 'yes' }, DDI: { co: 'DDI', prj: 'In-House', bill: 'yes' }, GNA: { co: 'GNA/COEI', prj: 'GYC', bill: 'yes' }, 'Rwanda-Incidental': { co: 'True North', prj: 'Rwanda', bill: 'no' } } as Record<string, Partial<K>>)[j] ?? {}
}
const DEFAULTS = Object.fromEntries(JOBS.map(j => { const d = defaultsOf(j); return [String(jobId(j)), fieldsOfK({ co: d.co ?? '', prj: d.prj ?? '', act: '', bill: d.bill ?? '', code: d.code ?? '' })] }))
export const COMBINATIONS: ClockChoice[] = COMBOS.map(([name, k], i) => ({
  combinationId: i + 1, name, jobcodeId: jobId(KK[k].job), path: KK[k].job, short: shortOf(KK[k].job), isI7: isI7(KK[k].job),
  fields: fieldsOfK(KK[k]), notes: '', label: name, activity: KK[k].act, billable: KK[k].bill,
}))

export function catalogFor(level: Level): Catalog {
  const me = ME[level]
  return {
    me: { personId: pid(me), name: me, zone: ET, zoneAbbr: 'EDT', level: ACCESS[level], leader: level !== 'user' },
    now: NOW_ISO, today: TODAY, jobs: JOB_LIST, fields: FIELDS, defaults: DEFAULTS, combinations: COMBINATIONS,
    correctionGoesTo: `Goes to ${LEAD[PM.get(me)?.t ?? ''] ?? 'Dave Sharpe'}, your Team Leader. Admins and Super Admins can also approve it.`,
    running: null,
  }
}

// ── The store: entries, corrections, time off ──────────────────────────────

interface Hist { when: string; who: string; text: string; changes: { field: string; old: string; new: string }[]; reason?: string; dot?: string }
export interface Rec {
  id: number
  who: string
  date: string
  kind: 'work' | 'req' | 'off'
  /** Seconds of the person's day, recorded (quarter hour); null for duration only. */
  s: number | null
  e: number | null
  dur?: number
  manual?: boolean
  job: string; act: string; co: string; prj: string; bill: string; code: string
  notes: string
  status: string
  imported?: boolean
  auto?: boolean
  confirmed?: boolean
  edited?: string | null
  hist: Hist[]
  reason?: string
  asked?: string
  askedAt?: string
  decided?: { by: string; when: string; at: string; reason?: string }
  fromReq?: { by: string; when: string; at: string; asked: string; askedAt: string; reason: string }
  type?: string
  note?: string
}

const ev = (date: string, sec: number, who: string, text: string, x: Partial<Hist> = {}): Hist => ({ when: `${dateLabel(date)}, ${clk(sec)}`, who, text, changes: [], ...x })

export function generate(): Rec[] {
  const out: Rec[] = []
  let id = 1
  const push = (n: string, date: string, s: number | null, e: number | null, key: string, x: X = {}) => {
    const k = KK[key]
    const o: Rec = {
      id: id++, who: n, date, kind: 'work', s: s == null ? null : R(s * 3600), e: e == null ? null : R(e * 3600),
      ...k, notes: x.notes ?? '', status: date < '2026-10-01' ? 'Approved' : 'Open', imported: date < '2026-10-01', hist: [],
      ...(x.act !== undefined ? { act: x.act } : {}),
      ...(x.manual ? { manual: true, dur: x.dur } : {}), auto: x.auto, confirmed: x.confirmed, edited: x.edited ?? null,
    }
    const rs = s == null ? null : Math.round(s * 3600)
    const re = e == null ? null : Math.round(e * 3600)
    if (o.imported) o.hist = [{ when: 'Oct 2, 2026, 6:00 AM', who: 'Clocky', text: 'Imported from QuickBooks Time', changes: [] }]
    else if (o.manual) { o.edited = 'Arnaldo Oliveira'; o.hist = [ev(date, 17 * 3600, 'Arnaldo Oliveira', `Arnaldo Oliveira added ${formatDuration(o.dur!)} for ${n} in the week grid`, { reason: 'Status meeting held offline; Clarise could not clock in.' })] }
    else if (x.wendyHist) o.hist = [ev(date, 8 * 3600, n, `${n} clocked in · ${o.job}`), ev(date, 13 * 3600, 'Clocky', 'Clocky stopped the clock automatically after 5h 00m', { dot: '#c8323d' }), ev(date, 13 * 3600 + 1200, n, `${n} confirmed the real end time: 12:40 PM · recorded as 12:45 PM`, { changes: [{ field: 'End', old: '1:00 PM', new: '12:40 PM' }] })]
    else if (x.daveHist) o.hist = [ev(date, 8 * 3600, n, `${n} clocked in · ${o.job}`), ev(date, 18 * 3600, n, `${n} clocked out`), ev(TODAY, 8 * 3600 + 720, 'Arnaldo Oliveira', 'Arnaldo Oliveira edited', { changes: [{ field: 'End', old: '6:00 PM', new: '5:10 PM' }], reason: 'forgot to clock out' })]
    else if (x.autoHist) o.hist = [ev(date, o.s!, n, `${n} switched to ${o.job}`), ev(date, o.e!, 'Clocky', 'Clocky stopped the clock automatically after 5h 00m', { dot: '#c8323d' })]
    else {
      const rec = (r: number, v: number) => (r !== v ? ` · recorded as ${clk(v)}` : '')
      o.hist = [ev(date, rs!, n, `${n} clocked in · ${o.job}${rec(rs!, o.s!)}`)]
      if (o.e != null) o.hist.push(ev(date, re!, n, `${n} clocked out${rec(re!, o.e)}`))
    }
    out.push(o)
  }
  for (let d = '2026-09-01'; d <= TODAY; d = addDays(d, 1)) {
    const w = dow(d)
    if (w === 0 || w === 6) continue
    PEOPLE.forEach((p, pi) => {
      const ov = OV[p.n]?.[d]
      if (ov) { ov.forEach(r => push(p.n, d, r[0], r[1], r[2], r[3])); return }
      const sh = (((Number(d.slice(8)) * 7 + pi * 3) % 4) * 5) / 60
      p.pat.forEach(([s, e, k]) => {
        if (d === TODAY && e + sh > NOW_SEC / 3600 + TZ[p.tz].off) return
        push(p.n, d, s + sh, e + sh, k)
      })
    })
  }
  out.push({ id: 9001, who: 'Olivia Hale', date: '2026-10-16', kind: 'off', s: null, e: null, dur: 8 * 3600, job: '', act: '', co: '', prj: '', bill: '', code: '', notes: '', type: 'Vacation', note: 'Family trip.', status: 'Pending', askedAt: '2026-10-09T14:14:00.000Z', asked: 'Oct 9, 2026, 10:14 AM', hist: [] })
  const rq = (rid: number, who: string, date: string, s: number, e: number, key: string, reason: string, asked: string, askedAt: string, x: Partial<Rec> = {}) =>
    out.push({ id: rid, who, date, kind: 'req', s: s * 3600, e: e * 3600, ...KK[key], notes: reason, reason, status: 'Pending', asked, askedAt, hist: [], ...x })
  rq(8002, 'Samuel Manzi', '2026-10-13', 16, 17, 'tnWeb', 'I fixed the staging deploy after hours and forgot to clock back in.', 'Oct 13, 2026, 5:20 PM', '2026-10-13T21:20:00.000Z')
  rq(8003, 'Stephanie Aguirre', '2026-10-12', 17.5, 18.25, 'i7Mkt', 'I scheduled the i7 posts for the week after my clock stopped.', 'Oct 13, 2026, 9:05 AM', '2026-10-13T13:05:00.000Z')
  rq(8004, 'Joy Inyele', '2026-10-08', 17, 18, 'i7Content', 'I worked on the captions in the evening.', 'Oct 8, 2026, 8:10 PM', '2026-10-09T00:10:00.000Z', { status: 'Denied', decided: { by: 'Justus Tsofa', when: 'Oct 9, 2026, 9:30 AM', at: '2026-10-09T13:30:00.000Z', reason: 'This hour is already in your Oct 9 entries.' } })
  out.push({
    id: 7005, who: 'Cheyenne Wilson', date: '2026-10-09', kind: 'work', s: 16 * 3600, e: 16.5 * 3600, ...KK.i7Write, notes: 'Finished the i7 blog draft.', status: 'Open', edited: 'Dave Sharpe',
    fromReq: { by: 'Dave Sharpe', when: 'Oct 9, 2026, 5:02 PM', at: '2026-10-09T21:02:00.000Z', asked: 'Oct 9, 2026, 4:45 PM', askedAt: '2026-10-09T20:45:00.000Z', reason: 'I finished the i7 blog draft after my clock stopped.' },
    hist: [
      { when: 'Oct 9, 2026, 4:45 PM', who: 'Cheyenne Wilson', text: 'Cheyenne Wilson requested a time correction: 0h 30m · 2 - i7 Marketing › Content', changes: [], reason: 'I finished the i7 blog draft after my clock stopped.' },
      { when: 'Oct 9, 2026, 5:02 PM', who: 'Dave Sharpe', text: 'Dave Sharpe approved the correction', changes: [] },
    ],
  })
  return out
}

/** Clarise's request of 3K: 1h 30m on Wed, Oct 14, after the clock stopped by itself. */
export const reqSeed = (): Rec => ({
  id: 8001, who: 'Clarise Nixon', date: '2026-10-14', kind: 'req', s: 15 * 3600, e: 16.5 * 3600, ...KK.i7Content,
  notes: 'I kept working on the i7 LinkedIn posts after the clock stopped by itself at 3:00 PM.',
  reason: 'I kept working on the i7 LinkedIn posts after the clock stopped by itself at 3:00 PM.', status: 'Pending',
  asked: 'Oct 15, 2026, 8:40 AM', askedAt: '2026-10-15T12:40:00.000Z', hist: [],
})

/** The prototype's find(): a person's entry on a day starting at an hour. */
export const find = (recs: Rec[], who: string, date: string, h: number) => recs.find(x => x.kind === 'work' && x.who === who && x.date === date && x.s === R(h * 3600))!

// ── Reading the store the way the loaders do ───────────────────────────────

const startIso = (x: Rec) => (x.s == null ? null : at(x.date, x.s, zoneOf(x.who)))
const endIso = (x: Rec) => (x.s == null || x.e == null ? null : at(x.date, x.e, zoneOf(x.who)))
const secondsOf = (x: Rec) => (x.s == null ? x.dur ?? 0 : x.e == null ? runningSeconds(startIso(x)!, new Date(NOW)) : x.e - x.s)
const timeTextOf = (x: Rec) => (x.kind === 'off' ? 'All day' : x.s == null ? 'Duration only' : `${clk(x.s)} to ${x.e == null ? 'now' : clk(x.e)}`)
const locked = (x: Rec) => x.status === 'Submitted' || x.status === 'Approved'

function scopeOf(level: Level) {
  const me = ME[level]
  const inScope = (who: string) => who === me || (level === 'lead' ? PM.get(who)?.t === 'Web' : level === 'admin' || level === 'super')
  return { me, inScope, leader: level !== 'user' }
}

function attnOf(x: Rec, level: Level, overlaps: Set<number>): string | null {
  const { me, inScope, leader } = scopeOf(level)
  if (x.kind === 'req') return x.status === 'Pending' && leader && x.who !== me && inScope(x.who) ? 'Correction request waiting for you' : null
  if (x.kind === 'off') return x.status === 'Pending' && level === 'super' ? 'Time off request waiting for you' : null
  if (x.auto && !x.confirmed) return 'Auto clocked out, end time not confirmed'
  const miss = ([['act', 'Activity'], ['co', 'Company'], ['prj', 'Project'], ['bill', 'Billable']] as const).filter(([k]) => !x[k]).map(([, l]) => l as string)
  if (isI7(x.job) && !x.code) miss.push('i7 Code')
  if (miss.length) return `Missing ${miss.join(', ')}`
  if (secondsOf(x) > 36000) return 'Over 10 hours'
  if (overlaps.has(x.id)) return 'Overlaps another entry'
  return null
}

function viewOf(x: Rec, level: Level, overlaps: Set<number>): EntryView {
  const { me, inScope } = scopeOf(level)
  const p = PM.get(x.who)
  const zone = zoneOf(x.who)
  const team = p?.t ? { id: tid(p.t), name: p.t, color: TEAMS.find(t => t[0] === p.t)![1] } : null
  const running = x.kind === 'work' && x.s != null && x.e == null
  const pills: Pill[] = []
  const tone = (s: string) => (s === 'Pending' ? 'warn' : s === 'Approved' ? 'ok' : 'bad') as Pill['tone']
  if (x.kind === 'req') pills.push({ text: `Correction: ${x.status}`, tone: tone(x.status), tip: 'Requested time. It counts only after it is approved.' })
  else if (x.kind === 'off') pills.push({ text: `Time off: ${x.status}`, tone: tone(x.status), tip: '' })
  else {
    if (running) pills.push({ text: 'Running', tone: 'ok', tip: 'The clock is running' })
    else pills.push({ text: x.status, tone: x.status === 'Approved' ? 'ok' : 'neutral', tip: x.imported ? 'Imported from QuickBooks Time' : '' })
    if (x.auto) pills.push({ text: 'Auto out', tone: 'bad', tip: x.confirmed ? 'Stopped by Clocky after 5h 00m. Real end time confirmed.' : 'Stopped by Clocky after 5h 00m. End time not confirmed.' })
    if (x.edited) pills.push({ text: 'Edited', tone: 'neutral', tip: `Edited by ${x.edited}` })
  }
  const work = x.kind === 'work'
  const canEdit = work && !locked(x) && inScope(x.who)
  const start = work || x.kind === 'req' ? startIso(x) : null
  return {
    key: x.kind === 'req' ? `c${x.id}` : x.kind === 'off' ? `o${x.id}:${x.date}` : `e${x.id}`,
    rowType: x.kind === 'req' ? 'correction' : x.kind === 'off' ? 'time_off' : 'entry',
    id: x.id, personId: pid(x.who), personName: x.who, initials: initialsOf(x.who), team,
    zone, zoneAbbr: zone !== ET ? zoneAbbr(zone, new Date(NOW)) : '',
    date: x.date, start, end: work || x.kind === 'req' ? endIso(x) : null, running, timeText: timeTextOf(x), seconds: secondsOf(x),
    jobcodeId: x.kind === 'off' ? 900 : jobId(x.job), path: x.kind === 'off' ? `Time off › ${x.type}` : x.job, short: x.kind === 'off' ? x.type! : shortOf(x.job),
    client: x.kind === 'off' ? 'Time off' : clientOf(x.job), isI7: isI7(x.job), fields: fieldsOfK(x),
    company: x.co, project: x.prj, activity: x.act, billable: x.bill, code: x.code, notes: x.kind === 'off' ? x.note ?? '' : x.notes,
    kind: x.kind === 'req' ? 'correction' : x.kind === 'off' ? 'time_off' : x.manual ? 'manual' : 'clock', imported: !!x.imported,
    pills, autoOut: x.auto ? { confirmed: !!x.confirmed, flagged: false } : null, edited: x.edited ? { by: x.edited, at: NOW_ISO } : null,
    clockedOutBy: null, locked: work && locked(x), lockWhy: work && locked(x) ? x.status.toLowerCase() : null,
    canEdit, shortenOnly: canEdit && level === 'user' && x.who === me, canDelete: canEdit,
    canContinue: work && x.who === me && x.s != null && x.e != null, continuesPrevious: false,
    attention: attnOf(x, level, overlaps),
    correction: x.kind === 'req' ? {
      state: x.status.toLowerCase() as 'pending', reason: x.reason ?? '', requestedAt: x.askedAt ?? NOW_ISO, decidedBy: x.decided?.by ?? null,
      decidedAt: x.decided?.at ?? null, decisionNote: x.decided?.reason ?? null,
      canDecide: x.status === 'Pending' && level !== 'user' && x.who !== me && inScope(x.who),
      goesTo: goesToOf(x.who),
    } : null,
    timeOff: x.kind === 'off' ? { type: x.type!, state: x.status.toLowerCase(), startDate: x.date, endDate: x.date, hoursPerDay: (x.dur ?? 0) / 3600, note: x.note ?? '', canDecide: level === 'super' && x.status === 'Pending' } : null,
  }
}

function overlapSet(recs: Rec[]): Set<number> {
  const timed = recs.filter(x => x.kind === 'work' && x.s != null).map(x => ({ id: x.id, personId: x.who, start: startIso(x), end: endIso(x) }))
  return new Set(overlapsAmong(timed, new Date(NOW)).keys())
}

function attentionItem(r: EntryView, all: boolean): AttentionItem {
  const sub = r.rowType === 'time_off'
    ? `${r.personName} · ${dayLabel(r.date)} · Time off · ${r.short}`
    : `${all || r.rowType === 'correction' ? `${r.personName} · ` : ''}${dayLabel(r.date)} · ${r.timeText} · ${r.short}`
  return { key: r.key, reason: r.attention ?? '', sub, cta: r.rowType !== 'entry' ? 'Review' : r.canEdit ? 'Fix' : 'View history' }
}

function submitPeriodOf(level: Level, cad: Record<string, string>) {
  const me = ME[level]
  const biweekly = (cad[me] ?? (CAD.has(me) ? 'biweekly' : 'monthly')) === 'biweekly'
  return biweekly
    ? { start: '2026-10-04', end: '2026-10-17', kind: 'pay_period' as const, label: 'Oct 4 to 17', full: 'Oct 4 to 17, 2026', line: 'You submit every 2 weeks, by pay period. This one runs Sun, Oct 4 to Sat, Oct 17. A Super Admin sets this per person.' }
    : { start: '2026-10-01', end: '2026-10-31', kind: 'month' as const, label: 'October', full: 'October 2026', line: 'You submit monthly. October runs to Sat, Oct 31. A Super Admin sets this per person.' }
}

// ── The stand-in actions ───────────────────────────────────────────────────

const ok = <T extends object>(x: T) => Promise.resolve({ ok: true as const, ...x })
const no = (error: string, extra: object = {}) => Promise.resolve({ ok: false as const, error, ...extra })

/** A sent timesheet (Approvals, frame 3L3): its own numbers, since the sample's hours are October's. */
export interface Sheet {
  id: number; who: string; start: string; end: string; full: string; line: string
  state: 'submitted' | 'approved' | 'returned'; sentAt: string; sent: string
  byClient: [string, number][]; noTime: string
  decided?: { by: string; when: string; at: string; note: string | null }
}

export interface Store { recs: Rec[]; level: Level; cad: Record<string, string>; sheets?: Sheet[] }

export function makeStore(level: Level, recs: Rec[], cad: Record<string, string> = {}, sheets?: Sheet[]): Store { return { recs, level, cad, sheets } }

const H = (h: number) => h * 3600
/** Frame 3L3: two timesheets waiting (a month, a pay period) and one approved. */
export const SHEETS: Sheet[] = [
  { id: 901, who: 'Samuel Manzi', start: '2026-09-01', end: '2026-09-30', full: 'September 2026', line: 'You submit monthly. This covers the whole month.', state: 'submitted', sentAt: '2026-10-01T13:14:00.000Z', sent: 'Submitted Oct 1, 2026, 9:14 AM', byClient: [['i7 Marketing', H(120)], ['True North', H(48.5)]], noTime: 'Mon, Sep 14' },
  { id: 902, who: 'Wendy Cacka', start: '2026-09-27', end: '2026-10-10', full: 'Sep 27 to Oct 10, 2026', line: 'You submit every 2 weeks, by pay period. This covers Sep 27 to Oct 10.', state: 'submitted', sentAt: '2026-10-11T12:02:00.000Z', sent: 'Submitted Oct 11, 2026, 8:02 AM', byClient: [['i7 Marketing', H(80)]], noTime: 'None' },
  { id: 903, who: 'Cheyenne Wilson', start: '2026-09-01', end: '2026-09-30', full: 'September 2026', line: 'You submit monthly. This covers the whole month.', state: 'approved', sentAt: '2026-10-01T14:40:00.000Z', sent: 'Submitted Oct 1, 2026, 10:40 AM', byClient: [['i7 Marketing', H(152)]], noTime: 'None', decided: { by: 'Arnaldo Oliveira', when: 'Oct 3, 2026, 10:02 AM', at: '2026-10-03T14:02:00.000Z', note: null } },
]

export function entriesData(store: Store, q: { from: string; to: string; who: 'my' | 'all'; personId?: string }): EntriesData {
  const { level } = store
  const { me, inScope } = scopeOf(level)
  const overlaps = overlapSet(store.recs)
  const picked = store.recs.filter(x => {
    if (q.who === 'my' || level === 'user') return x.who === me
    if (q.personId) return pid(x.who) === q.personId
    if (level === 'lead') return PM.get(x.who)?.t === 'Web'
    return true
  }).filter(x => x.date >= q.from && x.date <= q.to)
  const rows = picked.map(x => viewOf(x, level, overlaps))
  const byPerson = new Map<string, EntryView[]>()
  for (const r of rows) if (r.start && r.rowType === 'entry') (byPerson.get(r.personId) ?? byPerson.set(r.personId, []).get(r.personId)!).push(r)
  for (const list of byPerson.values()) {
    list.sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))
    for (let i = 1; i < list.length; i++) if (list[i - 1].end && list[i - 1].end === list[i].start) list[i].continuesPrevious = true
  }
  rows.sort((a, b) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.personName.localeCompare(b.personName) || ((a.start ? Date.parse(a.start) : 9e15) - (b.start ? Date.parse(b.start) : 9e15))))
  const work = rows.filter(r => r.rowType === 'entry' && r.kind !== 'absence')
  const total = work.reduce((s, r) => s + r.seconds, 0)
  const billable = work.filter(r => r.billable === 'yes').reduce((s, r) => s + r.seconds, 0)
  const byClient = new Map<string, number>()
  for (const r of work) byClient.set(r.client, (byClient.get(r.client) ?? 0) + r.seconds)
  const all = q.who === 'all'
  const attention = attentionOrder(rows.filter(r => r.attention)).map(r => attentionItem(r, all))
  const people = PEOPLE.filter(p => level !== 'user' && inScope(p.n)).map(p => ({ id: pid(p.n), name: p.n, zone: zoneOf(p.n), teamIds: p.t ? [tid(p.t)] : [], cadence: ((store.cad[p.n] ?? (CAD.has(p.n) ? 'biweekly' : 'monthly')) === 'biweekly' ? 'biweekly' : 'monthly') as 'biweekly' | 'monthly' })).sort((a, b) => a.name.localeCompare(b.name))
  const teamIds = new Set(people.flatMap(p => p.teamIds))
  const sp = submitPeriodOf(level, store.cad)
  const mine = store.recs.filter(x => x.who === me && x.kind === 'work' && x.date >= sp.start && x.date <= sp.end)
  const submitted = mine.length > 0 && mine.every(x => x.status !== 'Open')
  return {
    viewer: { personId: pid(me), zone: ET, level: ACCESS[level], leader: level !== 'user', who: level === 'user' ? null : level === 'lead' ? 'team' : 'all', cadence: sp.kind === 'pay_period' ? 'biweekly' : 'monthly', canSubmit: true },
    range: { from: q.from, to: q.to },
    rows,
    days: [...new Set(rows.map(r => r.date))].sort().reverse().map(date => ({ date, label: dayLabel(date), seconds: rows.filter(r => r.date === date && r.rowType === 'entry').reduce((s, r) => s + r.seconds, 0), people: new Set(rows.filter(r => r.date === date).map(r => r.personId)).size })),
    totals: { seconds: total, billable, nonBillable: total - billable, entries: work.length, attention: attention.length, byClient: [...byClient.entries()].map(([client, seconds]) => ({ client, seconds })).sort((a, b) => b.seconds - a.seconds) },
    attention,
    people,
    teams: TEAMS.filter(([t]) => teamIds.has(tid(t))).map(([t, color]) => ({ id: tid(t), name: t, color })),
    submit: { start: sp.start, end: sp.end, kind: sp.kind, label: sp.label, full: sp.full, state: submitted ? 'submitted' : null, submitted },
    canAdd: level !== 'user',
    anchors: [{ anchor: '2026-10-04', effectiveFrom: null }],
  }
}

function historyOf(store: Store, id: number): HistoryData | null {
  const x = store.recs.find(r => r.id === id && r.kind === 'work')
  if (!x) return null
  const abbr = zoneOf(x.who) !== ET ? ` ${zoneAbbr(zoneOf(x.who), new Date(NOW))}` : ''
  return {
    summary: `${x.who} · ${x.job} · ${dayLabel(x.date)}, ${timeTextOf(x)}${abbr} (${formatDuration(secondsOf(x))})`,
    lines: [...x.hist].reverse().map(h => ({ at: h.when, when: h.when, who: h.who, text: h.text, changes: h.changes, reason: h.reason ?? null, dot: h.dot ?? (h.changes.length ? '#012358' : '#1E7D7F') })),
    real: { start: startIso(x), end: endIso(x) }, recorded: { start: startIso(x), end: endIso(x) },
  }
}

const stamp = () => `Oct 15, 2026, ${clk(NOW_SEC)}`
const secOfHHMM = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 3600 + m * 60 }

export function makeApi(store: Store): EntriesApi & ApprovalsApi {
  const { me } = scopeOf(store.level)
  const timedOf = (who: string, except: number | null) => store.recs.filter(x => x.kind === 'work' && x.who === who && x.s != null && x.id !== except)
  const overlapWith = (who: string, date: string, s: number, e: number, except: number | null) => {
    const span = { start: at(date, s, zoneOf(who)), end: at(date, e, zoneOf(who)) }
    for (const o of timedOf(who, except)) {
      const sh = sharedSpan(span, { start: startIso(o), end: endIso(o) }, new Date(NOW))
      if (sh) return { o, sh }
    }
    return null
  }
  const nameOf = (x: Rec) => COMBOS.find(([, k]) => KK[k].job === x.job && KK[k].act === x.act)?.[0] ?? shortOf(x.job)

  type Body = Parameters<EntriesApi['editEntry']>[0] | Parameters<EntriesApi['addTime']>[0]
  const write = (b: Body, who: string, id: number | null) => {
    const job = JOBS[b.jobcodeId - 1] ?? ''
    const f = b.fields ?? {}
    const fields = { job, co: f['1'] ?? '', prj: f['2'] ?? '', act: f['3'] ?? '', bill: f['4'] ?? '', code: f['5'] ?? '', notes: b.notes ?? '' }
    let s: number | null = null
    let e: number | null = null
    let dur: number | undefined
    if (b.mode === 'range') {
      s = R(secOfHHMM(b.start!))
      e = b.end === 'now' ? null : R(secOfHHMM(b.end!))
      if (e !== null) {
        const hit = overlapWith(who, b.date, s, e, id)
        if (hit) {
          const info = { entryId: hit.o.id, name: nameOf(hit.o), start: startIso(hit.o)!, end: endIso(hit.o), sharedStart: hit.sh.start, sharedEnd: hit.sh.end }
          if (!b.fix || b.fix.otherId !== hit.o.id) return { fail: overlapLine(e - s, hit.sh, nameOf(hit.o), zoneOf(who)), overlap: info }
          const span = { start: at(b.date, s, zoneOf(who)), end: at(b.date, e, zoneOf(who)) }
          const other = { start: startIso(hit.o)!, end: endIso(hit.o) ?? NOW_ISO }
          const off = Date.parse(at(b.date, 0, zoneOf(who)))
          if (b.fix.trim === 'other') {
            const r = trimOther(span, other)
            if (!r) return { fail: 'Nothing left to keep. Cancel instead.' }
            hit.o.s = (Date.parse(r.start) - off) / 1000; hit.o.e = (Date.parse(r.end) - off) / 1000
            hit.o.hist.push({ when: stamp(), who: me, text: `${me} trimmed this entry to fix an overlap`, changes: [], reason: b.reason })
          } else {
            const r = trimThis(span, other)
            if (!r) return { fail: 'Nothing left to keep. Cancel instead.' }
            s = (Date.parse(r.start) - off) / 1000; e = (Date.parse(r.end) - off) / 1000
          }
        }
      }
    } else {
      const raw = parseDuration(b.duration ?? '')
      if (Number.isNaN(raw) || raw <= 0) return { fail: 'Type a duration like 2h 30m, 2:30 or 2.5.' }
      dur = roundSeconds(raw)
    }
    return { s, e, dur, fields }
  }

  return {
    getEntries: q => ok({ data: entriesData(store, q) }),
    getEntryHistory: ({ id }) => { const h = historyOf(store, id); return h ? ok({ data: h }) : no('That entry is not there any more.') },
    getCorrectionHistory: ({ id }) => {
      const x = store.recs.find(r => r.id === id && r.kind === 'req')
      if (!x) return no('That request is not there any more.')
      const lines = requestHistoryLines({
        owner: x.who, requestedAt: x.askedAt ?? NOW_ISO, seconds: x.e! - x.s!, job: x.job, reason: x.reason ?? '', viewerZone: ET,
        decided: x.decided && x.status !== 'Pending' ? { by: x.decided.by, at: x.decided.at, state: x.status === 'Denied' ? 'denied' : 'approved', note: x.decided.reason ?? null } : null,
      })
      const abbr = zoneOf(x.who) !== ET ? ` ${zoneAbbr(zoneOf(x.who), new Date(NOW))}` : ''
      return ok({ data: { summary: `${x.who} · ${x.job} · ${dayLabel(x.date)}, ${timeTextOf(x)}${abbr} (${formatDuration(x.e! - x.s!)})`, lines, real: { start: startIso(x), end: endIso(x) }, recorded: { start: startIso(x), end: endIso(x) } } })
    },
    getSubmitSummary: () => {
      const sp = submitPeriodOf(store.level, store.cad)
      const overlaps = overlapSet(store.recs)
      const mine = store.recs.filter(x => x.who === me && x.date >= sp.start && x.date <= sp.end)
      const work = mine.filter(x => x.kind === 'work')
      const noTime: string[] = []
      for (let d = sp.start; d <= TODAY && d <= sp.end; d = addDays(d, 1)) { const w = dow(d); if (w > 0 && w < 6 && !mine.some(x => x.date === d)) noTime.push(dayLabel(d)) }
      const views = work.map(x => viewOf(x, store.level, overlaps))
      const byClient = new Map<string, number>()
      for (const r of views) byClient.set(r.client, (byClient.get(r.client) ?? 0) + r.seconds)
      const attention = attentionOrder(views.filter(r => r.attention)).map(r => attentionItem(r, false))
      const running = views.some(r => r.running)
      const done = work.length > 0 && work.every(x => x.status !== 'Open')
      const data: SubmitSummary = {
        start: sp.start, end: sp.end, kind: sp.kind, title: `Submit ${sp.full}?`, label: sp.label, cadenceLine: sp.line,
        lockNote: `After you submit, ${sp.label} locks. Only a Super Admin can reopen it.`, state: done ? 'submitted' : null, running,
        totalSeconds: views.reduce((s, r) => s + r.seconds, 0), byClient: [...byClient.entries()].map(([client, seconds]) => ({ client, seconds })).sort((a, b) => b.seconds - a.seconds),
        noTime: noTime.length ? noTime.join(', ') : 'None', attention, canSubmit: !running && !attention.length && !done && work.length > 0,
      }
      return ok({ data })
    },
    addTime: b => {
      const who = PEOPLE.find(p => pid(p.n) === b.personId)?.n ?? me
      const w = write(b, who, null)
      if ('fail' in w) return no(w.fail!, w.overlap ? { overlap: w.overlap } : {})
      const id = Math.max(...store.recs.map(x => x.id)) + 1
      store.recs.push({ id, who, date: b.date, kind: 'work', s: w.s, e: w.e, dur: w.dur, manual: w.s == null, ...w.fields, status: 'Open', edited: who !== me ? me : null, hist: [{ when: stamp(), who: me, text: `${me} added time${who !== me ? ` for ${who}` : ''}`, changes: [], reason: b.reason }] })
      const seconds = w.s == null ? w.dur! : (w.e ?? 0) - w.s
      return ok({ entryId: id, toast: `Added ${formatDuration(seconds)} on ${dayLabel(b.date)}.` })
    },
    editEntry: b => {
      const x = store.recs.find(r => r.id === b.id)
      if (!x) return no('That entry is not there any more.')
      const w = write(b, x.who, x.id)
      if ('fail' in w) return no(w.fail!, w.overlap ? { overlap: w.overlap } : {})
      const changes: { field: string; old: string; new: string }[] = []
      const cmp = (field: string, o: string, n: string) => { if ((o || '') !== (n || '')) changes.push({ field, old: o || 'empty', new: n || 'empty' }) }
      if (b.mode === 'range') { cmp('Start', x.s == null ? '' : clk(x.s), clk(w.s!)); cmp('End', x.e == null ? 'now' : clk(x.e), w.e == null ? 'now' : clk(w.e)) }
      cmp('Job', x.job, w.fields.job); cmp('Activity', x.act, w.fields.act); cmp('Company', x.co, w.fields.co); cmp('Project', x.prj, w.fields.prj)
      cmp('Billable', x.bill, w.fields.bill); cmp('i7 Code', x.code, w.fields.code); cmp('Notes', x.notes, w.fields.notes)
      Object.assign(x, w.fields, { s: w.s, e: w.e, dur: w.dur, manual: w.s == null, date: b.date, edited: me, confirmed: x.auto ? true : x.confirmed })
      x.hist.push({ when: stamp(), who: me, text: `${me} edited`, changes, reason: b.reason })
      return ok({ entryId: x.id, changes: changes.length, toast: changes.length ? `Saved. ${changes.length} change${changes.length > 1 ? 's' : ''} kept in the history.` : 'Saved. Nothing changed.' })
    },
    deleteEntry: ({ id }) => { store.recs = store.recs.filter(x => x.id !== id); return ok({ toast: 'Entry deleted. The reason is kept in the change log.' }) },
    saveWeekGrid: b => {
      const who = PEOPLE.find(p => pid(p.n) === b.personId)?.n ?? me
      for (const row of b.rows) {
        const job = JOBS[row.jobcodeId - 1]
        const f = row.fields ?? {}
        for (const [day, text] of Object.entries(row.cells)) {
          const v = parseDuration(text)
          if (Number.isNaN(v)) return no(`Use "2:30" or "2.5" in ${dayLabel(day).slice(0, 3)}.`)
          store.recs = store.recs.filter(x => !(x.who === who && x.date === day && x.manual && x.job === job && x.act === (f['3'] ?? '')))
          if (v > 0) store.recs.push({ id: Math.max(...store.recs.map(x => x.id)) + 1, who, date: day, kind: 'work', s: null, e: null, dur: roundSeconds(v), manual: true, job, co: f['1'] ?? '', prj: f['2'] ?? '', act: f['3'] ?? '', bill: f['4'] ?? '', code: f['5'] ?? '', notes: '', status: 'Open', edited: who !== me ? me : null, hist: [{ when: stamp(), who: me, text: `${me} logged ${formatDuration(v)} in the week grid`, changes: [], reason: b.reason }] })
        }
      }
      const week = store.recs.filter(x => x.who === who && x.kind === 'work' && x.date >= b.weekStart && x.date <= addDays(b.weekStart, 6)).reduce((s, x) => s + secondsOf(x), 0)
      return ok({ weekSeconds: week, toast: `Saved. Week total ${formatDuration(week)}.` })
    },
    requestCorrection: b => {
      const s = secOfHHMM(b.start), e = secOfHHMM(b.end)
      const hit = overlapWith(me, b.date, s, e, null)
      if (hit) return no(`Overlaps ${clk(Math.max(s, hit.o.s!))} to ${clk(Math.min(e, hit.o.e ?? NOW_SEC))} with ${nameOf(hit.o)}. Ask only for time you have no entry for.`)
      const f = b.fields ?? {}
      store.recs.push({ id: Math.max(...store.recs.map(x => x.id)) + 1, who: me, date: b.date, kind: 'req', s, e, job: JOBS[b.jobcodeId - 1], co: f['1'] ?? '', prj: f['2'] ?? '', act: f['3'] ?? '', bill: f['4'] ?? '', code: f['5'] ?? '', notes: b.reason, reason: b.reason, status: 'Pending', asked: stamp(), askedAt: NOW_ISO, hist: [] })
      const lead = LEAD[PM.get(me)?.t ?? ''] ?? 'Dave Sharpe'
      return ok({ requestId: 1, goesTo: '', toast: `Request sent to ${lead}. It counts once it is approved.` })
    },
    submitPeriod: () => {
      const sp = submitPeriodOf(store.level, store.cad)
      const mine = store.recs.filter(x => x.who === me && x.date >= sp.start && x.date <= sp.end)
      mine.forEach(x => { x.status = 'Submitted' })
      return ok({ locked: mine.length, toast: `${sp.label} submitted. ${mine.length} entries are now locked.` })
    },
    decideCorrection: ({ id, decision, note }) => {
      const r = store.recs.find(x => x.id === id && x.kind === 'req')
      if (!r) return no('That request is not waiting for you. It may have been decided already.')
      if (decision === 'deny') { r.status = 'Denied'; r.decided = { by: me, when: stamp(), at: NOW_ISO, reason: note }; return ok({ toast: `Denied. ${r.who.split(' ')[0]} gets the reason.` }) }
      const hit = overlapWith(r.who, r.date, r.s!, r.e!, null)
      if (hit) return no(approveOverlapLine({ start: startIso(hit.o), end: endIso(hit.o) }, nameOf(hit.o), zoneOf(r.who)))
      Object.assign(r, { kind: 'work', status: 'Open', edited: me, fromReq: { by: me, when: stamp(), at: NOW_ISO, asked: r.asked!, askedAt: r.askedAt!, reason: r.reason! } })
      r.hist = [{ when: r.asked!, who: r.who, text: `${r.who} requested a time correction: ${formatDuration(r.e! - r.s!)} · ${r.job}`, changes: [], reason: r.reason }, { when: stamp(), who: me, text: `${me} approved the correction`, changes: [] }]
      return ok({ entryId: r.id, toast: `Approved. ${formatDuration(r.e! - r.s!)} added to ${r.who}'s entries. ${r.who.split(' ')[0]} gets a notification.` })
    },
    decideTimeOff: ({ id, decision, note }) => {
      const r = store.recs.find(x => x.id === id && x.kind === 'off')
      if (!r) return no('That request is not waiting for you. It may have been decided already.')
      r.status = decision === 'approve' ? 'Approved' : 'Denied'
      r.decided = { by: me, when: stamp(), at: NOW_ISO, reason: note }
      return ok({})
    },
    clockIn: b => {
      const job = JOBS[b.jobcodeId - 1]
      const f = b.fields ?? {}
      store.recs.push({ id: Math.max(...store.recs.map(x => x.id)) + 1, who: me, date: TODAY, kind: 'work', s: R(NOW_SEC), e: null, job, co: f['1'] ?? '', prj: f['2'] ?? '', act: f['3'] ?? '', bill: f['4'] ?? '', code: f['5'] ?? '', notes: b.notes ?? '', status: 'Open', hist: [] })
      return ok({ entryId: 1, startedAt: NOW_ISO, startedAtReal: NOW_ISO })
    },
    switchTo: b => {
      const run = store.recs.find(x => x.who === me && x.kind === 'work' && x.s != null && x.e == null)
      if (run) run.e = R(NOW_SEC)
      const job = JOBS[b.jobcodeId - 1]
      const f = b.fields ?? {}
      store.recs.push({ id: Math.max(...store.recs.map(x => x.id)) + 1, who: me, date: TODAY, kind: 'work', s: R(NOW_SEC), e: null, job, co: f['1'] ?? '', prj: f['2'] ?? '', act: f['3'] ?? '', bill: f['4'] ?? '', code: f['5'] ?? '', notes: b.notes ?? '', status: 'Open', hist: [] })
      return ok({ entryId: 1, previous: { label: '', todaySeconds: 0 }, toast: '' })
    },
    getApprovals: () => ok({ data: approvalsData(store) }),
    getTimesheet: ({ id }) => {
      const t = store.sheets?.find(x => x.id === id)
      if (!t) return no('That timesheet could not be found.')
      const total = t.byClient.reduce((n, [, sec]) => n + sec, 0)
      return ok({ data: {
        start: t.start, end: t.end, kind: t.start.slice(8) === '01' ? 'month' : 'pay_period', title: `Submit ${t.full}?`, label: t.full, cadenceLine: t.line,
        lockNote: '', state: t.state, running: false, totalSeconds: total, byClient: t.byClient.map(([client, seconds]) => ({ client, seconds })),
        noTime: t.noTime, attention: [], canSubmit: false,
      } satisfies SubmitSummary })
    },
    decideTimesheet: ({ id, decision, note }) => {
      const t = store.sheets?.find(x => x.id === id && x.state === 'submitted')
      if (!t) return no('That request is not waiting for you. It may have been decided already.')
      t.state = decision === 'approve' ? 'approved' : 'returned'
      t.decided = { by: me, when: stamp(), at: NOW_ISO, note: decision === 'approve' ? null : note ?? null }
      return ok({ toast: decision === 'approve' ? `${t.who}'s timesheet for ${t.full} is approved.` : `${t.full} went back to ${t.who.split(' ')[0]} with your reason.` })
    },
    reopenTimesheet: ({ id, note }) => {
      const t = store.sheets?.find(x => x.id === id && x.state === 'approved')
      if (!t) return no('That timesheet is not approved, so there is nothing to reopen.')
      t.state = 'returned'
      t.decided = { by: me, when: stamp(), at: NOW_ISO, note: note ?? null }
      return ok({ toast: `${t.full} is open again for ${t.who.split(' ')[0]}.` })
    },
  }
}

// ── Approvals (3L, 3L2) ─────────────────────────────────────────────────────

export function approvalsData(store: Store): ApprovalsData {
  const { level } = store
  const { me, inScope } = scopeOf(level)
  const sup = level === 'super'
  const mine = (x: Rec) => x.who !== me && inScope(x.who)
  const rowOf = (x: Rec): ApprovalRow => {
    const isOff = x.kind === 'off'
    const p = PM.get(x.who)
    const fr = x.fromReq
    const zone = zoneOf(x.who)
    const abbr = zone !== ET ? ` ${zoneAbbr(zone, new Date(NOW))}` : ''
    const state = (fr ? 'approved' : x.status.toLowerCase()) as ApprovalRow['state']
    let overlap: string | null = null
    if (!isOff && state === 'pending') {
      const span = { start: startIso(x)!, end: endIso(x)! }
      const o = store.recs.find(y => y.kind === 'work' && y.who === x.who && y.s != null && sharedSpan(span, { start: startIso(y), end: endIso(y) }, new Date(NOW)))
      if (o) overlap = approveOverlapLine({ start: startIso(o), end: endIso(o) }, COMBOS.find(([, k]) => KK[k].job === o.job && KK[k].act === o.act)?.[0] ?? shortOf(o.job), zone)
    }
    const decided = fr ? { by: fr.by, at: fr.at, when: fr.when, note: null } : x.decided ? { by: x.decided.by, at: x.decided.at, when: x.decided.when, note: x.decided.reason ?? null } : null
    return {
      key: `${isOff ? 'o' : 'c'}${x.id}`, type: isOff ? 'time_off' : 'correction', id: x.id, personId: pid(x.who), name: x.who, initials: initialsOf(x.who),
      team: p?.t ? { name: p.t, color: TEAMS.find(t => t[0] === p.t)![1] } : null,
      date: x.date, goesTo: isOff ? '' : goesToOf(x.who),
      seconds: isOff ? x.dur! : x.e! - x.s!,
      when: isOff ? `${dayLabel(x.date)}, 2026 · ${x.type}` : `${dayLabel(x.date)}, 2026 · ${clk(x.s!)} to ${clk(x.e!)}${abbr}`,
      job: isOff ? '' : `${x.job} · ${x.act || 'No activity'}`,
      reason: (fr ? fr.reason : isOff ? x.note : x.reason) ?? '',
      askedAt: fr ? fr.askedAt : x.askedAt ?? NOW_ISO, asked: `Asked ${fr ? fr.asked : x.asked}`,
      state, decided: state === 'pending' ? null : decided,
      entryId: fr ? x.id : null, overlap, canDecide: state === 'pending',
    }
  }
  // As the loader reads them: corrections as asked, then time off as asked.
  const asked = (a: ApprovalRow, b: ApprovalRow) => (a.askedAt < b.askedAt ? -1 : a.askedAt > b.askedAt ? 1 : 0)
  const loaded = (rows: ApprovalRow[]) => [...rows.filter(r => r.type === 'correction').sort(asked), ...rows.filter(r => r.type === 'time_off').sort(asked)]
  const sheetRow = (t: Sheet): ApprovalRow => {
    const p = PM.get(t.who)
    const state = t.state === 'submitted' ? 'pending' : t.state
    return {
      key: `t${t.id}`, type: 'timesheet', id: t.id, personId: pid(t.who), name: t.who, initials: initialsOf(t.who),
      team: p?.t ? { name: p.t, color: TEAMS.find(x => x[0] === p.t)![1] } : null,
      date: t.start, goesTo: '', seconds: t.byClient.reduce((n, [, sec]) => n + sec, 0), when: t.full,
      job: t.byClient.map(([cl, sec]) => `${cl} ${formatDuration(sec)}`).join(' · '), reason: '', askedAt: t.sentAt, asked: t.sent,
      state, decided: t.decided && state !== 'pending' ? t.decided : null, entryId: null, overlap: null, canDecide: state === 'pending',
      period: { start: t.start, end: t.end },
    }
  }
  const sheets = sup ? store.sheets ?? [] : []
  const waiting = waitingOrder([...loaded(store.recs.filter(x => mine(x) && x.status === 'Pending' && !x.fromReq && (x.kind === 'req' || (sup && x.kind === 'off'))).map(rowOf)), ...sheets.filter(t => t.state === 'submitted').map(sheetRow)])
  const decided = [...loaded(store.recs.filter(x => mine(x) && ((x.kind === 'work' && x.fromReq) || (x.kind === 'req' && x.status !== 'Pending') || (sup && x.kind === 'off' && x.status !== 'Pending'))).map(rowOf)), ...sheets.filter(t => t.state !== 'submitted').map(sheetRow)]
  return {
    level: ACCESS[level],
    subtitle: level === 'lead' ? 'Time corrections from the Web team, waiting for your decision.' : sup ? 'Time corrections, time off and timesheets waiting for a decision. Only Super Admins decide time off and timesheets.' : 'Time corrections from everyone, waiting for a decision. Super Admins decide time off.',
    note: "Times in each person's own time zone. Approved time becomes an entry marked Edited.",
    waiting, decided,
  }
}

export { ME, TODAY, KK, JOBS, jobId, pid, R }
