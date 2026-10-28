// The clock panel's frames with the prototype's own data (Design/design_handoff_clocky/
// Clock Panel.dc.html, `frame(k)`): Thu, Oct 15, 2026, New York, the same
// jobs, fields, combinations and recents, the same instants. Only what the
// server would compute differently is written as the server writes it (every
// total on the quarter hour), chosen so the screen shows the prototype's figures.

import type { ClockChoice, ClockPanelData, PanelField, PanelFolder, PanelJob, RunningEntry, ToConfirm } from '@/lib/timeclock/clocky-types'
import type { ClockApi } from '@/components/clocky/clock/clock-api'
import { draftFor, saveDraftFrom } from '@/components/clocky/clock/clock-model'
import type { PanelUi, Toast } from '@/components/clocky/clock/ClockPanel'
import { ACTIVITIES, STRUCTURE } from '@/lib/timeclock/structure-2026'

const ZONE = 'America/New_York'
/** An instant on Thu, Oct 15, 2026 in New York (EDT, UTC-4). */
export const et = (h: number, m = 0, s = 0) => new Date(Date.UTC(2026, 9, 15, h + 4, m, s)).toISOString()
const H = (h: number, m = 0) => h * 3600 + m * 60

const ACT = ['Content: Writing', 'Content: Review/Edit', 'General admin', 'Graphic creation', 'Management', 'Meeting: Project', 'Meeting: Status', 'Other (indicate in Notes)', 'Project management', 'SEO: Routine', 'SEO Research', 'Social Media', 'Training', 'Translation', 'WebDev']
const CO = ['COE', 'DDI', 'GNA/COEI', 'True North']
const PRJ = ['AAAF', 'Africa', 'ASI', 'Called!', 'GP church', 'GP School', 'GYC', 'In-House', 'Internship', "Messiah's Mansion", 'NAD', 'not listed--ask Dave', 'Rwanda']
const CODES = ['i7-ADMIN', 'i7-MKTG', 'i7-WEBDVT', 'BE-MKTG', 'MME-WEBDVT', 'WM-ADMIN']

export const FIELDS: PanelField[] = [
  { key: 'company', id: '1', label: '1 Company', options: CO, required: 'always' },
  { key: 'project', id: '2', label: '2 Project', options: PRJ, required: 'always' },
  { key: 'activity', id: '3', label: '3 Activity', options: ACT, required: 'always' },
  { key: 'billable', id: '4', label: '4 Billable', options: ['yes', 'no'], required: 'always' },
  { key: 'code', id: '5', label: '1 - i7 Code', options: CODES, required: 'i7' },
]

const TREE: { f?: string; kids?: string[]; j?: string }[] = [
  { f: '1 - True North', kids: ['Administrative', 'Content', 'Management', 'Marketing', 'Meetings', 'Project Management', 'SEO', 'Web Dev'] },
  { f: '2 - i7 Marketing', kids: ['Administrative', 'Content', 'Management', 'Marketing', 'Meetings', 'Project Management', 'SEO', 'Strategy Sprint', 'Web Dev'] },
  { j: 'A.org Job' }, { j: 'Adventist Messengers/HFA' }, { j: 'DDI' }, { j: 'GNA' }, { j: 'Rwanda-Incidental' },
]

const shortOf = (path: string) => {
  const [a, b] = path.split(' › ')
  if (!b) return a === 'Adventist Messengers/HFA' ? 'HFA' : a
  return (a.startsWith('2') ? 'i7' : 'TN') + ' › ' + b
}

/** Clock Panel.dc.html's "When to use" lines and billable defaults (11C). */
export const WHEN: Record<string, [string, string]> = {
    '1 - True North': ['Work for True North itself: our own site, admin, meetings, our marketing.', 'no'],
    '1 - True North › Administrative': ['Email, scheduling, paperwork and internal tools for True North.', 'no'],
    '1 - True North › Content': ["Writing and editing for True North's own channels.", 'no'],
    '1 - True North › Management': ['Managing people and the team: 1:1s, reviews, hiring.', 'no'],
    '1 - True North › Marketing': ["Promoting True North: campaigns, social posts about us, proposals.", 'no'],
    '1 - True North › Meetings': ['Internal meetings with no client: status, all-hands, team syncs.', 'no'],
    '1 - True North › Project Management': ['Planning and tracking internal projects (Monday boards, the portal).', 'no'],
    '1 - True North › SEO': ["SEO for True North's own site.", 'no'],
    '1 - True North › Web Dev': ['Building and fixing our own sites and the Operations Portal.', 'no'],
    '2 - i7 Marketing': ['Work for i7 itself. Bessemeters or Wagner work goes under its i7 Code (BE-MKTG, WM-ADMIN).', 'yes'],
    '2 - i7 Marketing › Administrative': ['i7 admin: reports, invoices, client email. Pick the i7 Code of the brand.', 'yes'],
    '2 - i7 Marketing › Content': ['Writing and editing for i7 itself. Bessemeters or Wagner work goes under its i7 Code: BE-MKTG, WM-ADMIN.', 'yes'],
    '2 - i7 Marketing › Management': ['Leading the i7 account: client calls, priorities, approvals.', 'yes'],
    '2 - i7 Marketing › Marketing': ['i7 campaigns, ads and social. Use the i7 Code of the brand.', 'yes'],
    '2 - i7 Marketing › Meetings': ['Meetings with i7 or about i7 work.', 'yes'],
    '2 - i7 Marketing › Project Management': ['Planning and tracking i7 projects.', 'yes'],
    '2 - i7 Marketing › SEO': ['SEO for i7 sites: audits, schema, keyword work.', 'yes'],
    '2 - i7 Marketing › Strategy Sprint': ['Only during a booked i7 strategy sprint.', 'yes'],
    '2 - i7 Marketing › Web Dev': ['Building and fixing i7 sites. Pick the i7 Code of the site (i7-WEBDVT).', 'yes'],
    'A.org Job': ['Adventist.org work booked under the A.org contract.', 'yes'],
    'Adventist Messengers/HFA': ['Hope for Africa and Adventist Messengers: translation, content, video.', 'yes'],
    'DDI': ['DDI client work.', 'yes'],
    'GNA': ['Good News for All: writing, editing and social for GNA and GYC.', 'yes'],
    'Rwanda-Incidental': ['Small Rwanda tasks outside a project. Ask your Team Leader if it should be a project.', 'no']
}

export const FOLDERS: PanelFolder[] = []
export const JOBS: PanelJob[] = []
{
  let id = 100
  TREE.forEach((t, i) => {
    if (t.f) {
      const folder: PanelFolder = { id: i + 1, name: t.f, jobIds: [], use: WHEN[t.f]?.[0] ?? null, order: i }
      for (const k of t.kids!) {
        const path = `${t.f} › ${k}`
        JOBS.push({ id: ++id, name: k, path, short: shortOf(path), folderId: folder.id, isI7: t.f.startsWith('2 - i7'), use: WHEN[path]?.[0] ?? null, billable: WHEN[path]?.[1] === 'yes', order: id })
        folder.jobIds.push(id)
      }
      FOLDERS.push(folder)
    } else {
      JOBS.push({ id: ++id, name: t.j!, path: t.j!, short: shortOf(t.j!), folderId: null, isI7: false, use: WHEN[t.j!]?.[0] ?? null, billable: WHEN[t.j!]?.[1] === 'yes', order: i })
    }
  })
}
export const job = (path: string) => JOBS.find(j => j.path === path)!

/** The prototype's smart defaults, per job (`defaults(p)`). */
const DEFAULTS: Record<string, Record<string, string>> = {}
for (const j of JOBS) {
  let d: Record<string, string> = {}
  if (j.isI7) d = { 1: 'True North', 2: 'In-House', 4: 'yes', 5: j.name === 'Web Dev' ? 'i7-WEBDVT' : j.name === 'Administrative' ? 'i7-ADMIN' : 'i7-MKTG' }
  else if (j.path.startsWith('1 - True North')) d = { 1: 'True North', 2: 'In-House', 4: 'no' }
  else d = ({
    'A.org Job': { 1: 'COE', 2: 'ASI', 4: 'yes' }, 'Adventist Messengers/HFA': { 1: 'COE', 2: 'NAD', 4: 'yes' }, DDI: { 1: 'DDI', 2: 'In-House', 4: 'yes' },
    GNA: { 1: 'GNA/COEI', 2: 'GYC', 4: 'yes' }, 'Rwanda-Incidental': { 1: 'True North', 2: 'Rwanda', 4: 'no' },
  } as Record<string, Record<string, string>>)[j.path] ?? {}
  DEFAULTS[String(j.id)] = d
}

const choice = (o: { id?: number; name?: string; path: string; company: string; project: string; activity: string; billable: string; code?: string; notes?: string }): ClockChoice => {
  const j = job(o.path)
  const fields: Record<string, string> = { 1: o.company, 2: o.project, 3: o.activity, 4: o.billable }
  if (o.code) fields[5] = o.code
  return {
    combinationId: o.id ?? null, name: o.name ?? null, jobcodeId: j.id, path: j.path, short: j.short, isI7: j.isI7, fields,
    notes: o.notes ?? '', label: o.name ?? j.short, activity: o.activity, billable: o.billable,
  }
}

export const COMBOS: ClockChoice[] = [
  choice({ id: 1, name: 'i7 Web Dev', path: '2 - i7 Marketing › Web Dev', company: 'True North', project: 'In-House', activity: 'WebDev', billable: 'yes', code: 'i7-WEBDVT' }),
  choice({ id: 2, name: 'TN Admin', path: '1 - True North › Administrative', company: 'True North', project: 'In-House', activity: 'General admin', billable: 'no' }),
  choice({ id: 3, name: 'HFA Translation', path: 'Adventist Messengers/HFA', company: 'COE', project: 'NAD', activity: 'Translation', billable: 'yes' }),
  choice({ id: 4, name: 'i7 Social', path: '2 - i7 Marketing › Content', company: 'True North', project: 'In-House', activity: 'Social Media', billable: 'yes', code: 'i7-MKTG', notes: 'i7 LinkedIn Project' }),
  choice({ id: 5, name: 'Status meeting', path: '1 - True North › Meetings', company: 'True North', project: 'In-House', activity: 'Meeting: Status', billable: 'no' }),
  choice({ id: 6, name: 'GNA Writing', path: 'GNA', company: 'GNA/COEI', project: 'GYC', activity: 'Content: Writing', billable: 'yes' }),
  choice({ id: 7, name: 'TN SEO', path: '1 - True North › SEO', company: 'True North', project: 'In-House', activity: 'SEO: Routine', billable: 'no' }),
]
export const RECENTS: ClockChoice[] = [
  choice({ path: '2 - i7 Marketing › Strategy Sprint', company: 'True North', project: 'In-House', activity: 'Meeting: Project', billable: 'yes', code: 'i7-MKTG' }),
  choice({ path: '1 - True North › Project Management', company: 'True North', project: 'In-House', activity: 'Project management', billable: 'no' }),
  choice({ path: 'DDI', company: 'DDI', project: 'In-House', activity: 'Content: Review/Edit', billable: 'yes' }),
  choice({ path: 'Rwanda-Incidental', company: 'True North', project: 'Rwanda', activity: 'Training', billable: 'no' }),
]

/** Frame b: off the clock at 7:58 AM, the last entry was i7 Web Dev, week 31h 20m so far. */
const base = (o: Partial<ClockPanelData> = {}): ClockPanelData => ({
  me: { personId: 'p-ao', name: 'Arnaldo Oliveira', zone: ZONE, zoneAbbr: 'EDT', level: 'super_admin', leader: true },
  now: et(7, 58),
  today: '2026-10-15',
  todayLabel: 'Thu, Oct 15',
  todaySeconds: 0,
  todaySpans: [],
  weekSeconds: H(31, 15),
  allowance: null,
  running: null,
  safety: null,
  toConfirm: [],
  resume: COMBOS[0],
  combinations: COMBOS,
  recents: RECENTS,
  todayByCombination: [],
  jobs: JOBS,
  folders: FOLDERS,
  fields: FIELDS,
  defaults: DEFAULTS,
  locked: null,
  startsOn: null,
  notYet: null,
  period: { start: '2026-10-01', end: '2026-10-31', kind: 'month', label: 'October', full: 'October 2026' },
  firstTime: false,
  correctionGoesTo: 'Goes to Rock Kai, your Team Leader. Admins and Super Admins can also approve it.',
  ...o,
})

const runningOf = (c: ClockChoice, o: { real: string; session: string; now: string; recorded?: string }): RunningEntry => {
  const rec = o.recorded ?? new Date(Math.round(Date.parse(o.real) / 900_000) * 900_000).toISOString()
  const recNow = Math.round(Date.parse(o.now) / 900_000) * 900_000
  const t = (iso: string) => {
    const d = new Date(Date.parse(iso) - 4 * 3600_000)
    const h = d.getUTCHours(), m = d.getUTCMinutes()
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  }
  return {
    id: 900, jobcodeId: c.jobcodeId, path: c.path, short: c.short, label: c.label, isI7: c.isI7, fields: c.fields, notes: c.notes,
    startedAt: rec, startedAtReal: o.real, sessionStartedAt: o.session, windowStartedAt: o.session,
    recordedSeconds: Math.max(0, (recNow - Date.parse(rec)) / 1000),
    roundNote: t(rec) !== t(o.real) ? { recorded: t(rec), real: t(o.real) } : null,
    missing: [], imported: false,
  }
}

const safetyOf = (session: string, label: string): ClockPanelData['safety'] => {
  const t0 = Date.parse(session)
  const d = new Date(Math.round(t0 / 900_000) * 900_000 - 4 * 3600_000)
  const h = d.getUTCHours(), m = d.getUTCMinutes()
  const at = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
  return {
    windowStartedAt: session, sessionStartedAt: session,
    warnAt: new Date(t0 + 4.5 * 3600_000).toISOString(), stopAt: new Date(t0 + 5 * 3600_000).toISOString(),
    warn: false,
    panelText: `Your clock has been running for 4h 30m since you clocked in at ${at}, now on ${label}. It will stop by itself at 5h 00m unless you tell us you are still on it.`,
  }
}

/** `on(o)`: i7 Web Dev since 9:52 AM (counted from 9:45), clocked in at 8:07, now 11:50:34. */
const on = (o: Partial<ClockPanelData> = {}) => {
  const now = et(11, 50, 34)
  return base({
    now,
    running: runningOf(COMBOS[0], { real: et(9, 52), session: et(8, 7), now }),
    safety: safetyOf(et(8, 7), 'i7 Web Dev'),
    todaySeconds: H(3, 45),
    weekSeconds: H(35, 15),
    todayByCombination: [
      { label: 'i7 Web Dev', seconds: H(2, 0), running: true },
      { label: 'TN Admin', seconds: H(1, 0), running: false },
      { label: 'HFA Translation', seconds: H(0, 45), running: false },
    ],
    ...o,
  })
}

/** The 2026 structure with five combinations. */
function five2026() {
  const d = data2026(); const base1 = d.combinations[0]
  const mk = (id: number, name: string, activity: string, path?: string) => { const j = d.jobs.find(x => x.path === path) ?? d.jobs.find(x => x.id === base1.jobcodeId)!; return { ...base1, combinationId: id, name, jobcodeId: j.id, path: j.path, short: j.short, activity, label: name } }
  const more = [mk(32, 'AAAF Writing', 'Content: Writing', 'COE Group › Seeker Outreach › AAAF'), mk(33, 'Africa Social', 'Marketing: Social Media & Community', 'COE Group › Africa › Africa Social Media'), mk(34, 'WM Marketing', 'Marketing: Strategy & Campaigns', 'i7 Marketing › Wagner Meters › WM-MKTG'), mk(35, 'TN Admin', 'Admin', 'True North Internal › TN Operations')]
  return { ...d, combinations: [...d.combinations, ...more] }
}

/** `on2026()`: the 2026 structure, on the clock with the last of the five combinations. */
const on2026 = () => {
  const d = five2026()
  const c = d.combinations[d.combinations.length - 1]
  const now = et(11, 50, 34)
  return on({ ...d, running: runningOf(c, { real: et(9, 52), session: et(8, 7), now }), safety: safetyOf(et(8, 7), c.label),
    todayByCombination: [{ label: c.label, seconds: H(2, 0), running: true }] })
}

const autoItem = (): ToConfirm => {
  const opts: string[] = []
  for (let t = Date.parse(et(13)); t >= Date.parse(et(8, 15)); t -= 900_000) opts.push(new Date(t).toISOString())
  const later: string[] = []
  for (let t = Date.parse(et(15, 15)); t >= Date.parse(et(13, 15)); t -= 900_000) later.push(new Date(t).toISOString())
  return {
    entryId: 901, path: COMBOS[0].path, label: 'i7 Web Dev', startedAt: et(8), stoppedAt: et(13), stoppedAtReal: et(13), date: '2026-10-15',
    stopWhen: '1:00 PM',
    text: 'It ran 5h 00m without an answer since you clocked in at 8:00 AM, so it stopped at 1:00 PM. When did you really stop working?',
    options: opts, laterOptions: later,
  }
}

const F = COMBOS[0]
const content = choice({ path: '2 - i7 Marketing › Content', company: 'True North', project: 'In-House', activity: '', billable: 'yes', code: 'i7-MKTG', notes: 'i7 LinkedIn Project' })

export interface ClockFrame {
  code: string
  title: string
  data: ClockPanelData
  ui?: Partial<PanelUi>
  toast?: Toast
  offline?: boolean
}

/** The 2026 structure (Client › Division › Project, the 26 activities by family) as the server loads it, from the switch date. */
function data2026(): Pick<ClockPanelData, 'jobs' | 'folders' | 'fields' | 'defaults' | 'combinations' | 'recents' | 'resume' | 'switchDate' | 'today'> {
  const jobs: PanelJob[] = [], folders: PanelFolder[] = []
  let id = 2000
  for (const c of STRUCTURE) {
    // A client's own projects (True North Internal) sit right under it; a division, even one named like its client (i7 Marketing), is a level of its own.
    const groups = [...c.divisions.map(d => ({ name: d.name, projects: d.projects, direct: false })), ...(c.projects.length ? [{ name: c.name, projects: c.projects, direct: true }] : [])]
    for (const g of groups) {
      const fid = ++id
      const own = g.direct ? c.name : `${c.name} › ${g.name}`
      const f: PanelFolder = { id: fid, name: own, jobIds: [], use: null, order: fid }
      for (const p of g.projects) {
        const path = `${own} › ${p.name}`
        jobs.push({ id: ++id, name: p.name, path, short: `${g.name} › ${p.name}`, folderId: fid, isI7: false, use: null, billable: c.billable, order: id, structure: 2 })
        f.jobIds.push(id)
      }
      folders.push(f)
    }
  }
  const families = Object.fromEntries(ACTIVITIES.map(a => [a.name, a.family]))
  const fields: PanelField[] = [...FIELDS, { key: 'activity', id: '99', label: 'Activity', options: ACTIVITIES.map(a => a.name), required: 'always', structure: 2, families }]
  const africa = jobs.find(j => j.name === 'HopeFor.Africa')!
  const gc = (j: PanelJob, activity: string): ClockChoice => ({ combinationId: null, name: null, jobcodeId: j.id, path: j.path, short: j.short, isI7: false, fields: { 99: activity }, notes: '', label: j.short, activity, billable: j.billable ? 'yes' : 'no' })
  return { jobs, folders, fields, defaults: {}, combinations: [{ ...gc(africa, 'Content: Translation'), combinationId: 31, name: 'HFA Translation' }], recents: [gc(jobs.find(j => j.name === 'TN General')!, 'Meeting: Status')], resume: null, switchDate: '2026-10-01', today: '2026-10-15' }
}

export const FRAMES: ClockFrame[] = [
  { code: '1A', title: 'Off the clock', data: base() },
  { code: '1B', title: 'First time', data: base({ combinations: [], recents: [], resume: null, firstTime: true }) },
  { code: '1C', title: 'Search', data: base(), ui: { view: 'choose', query: 'i7 web' } },
  { code: '1Cb', title: 'Browse', data: base(), ui: { view: 'choose', browse: FOLDERS[1].id } },
  { code: '11C', title: 'Browse, When to use', data: base(), ui: { view: 'choose', browse: FOLDERS[1].id } },
  { code: '1D', title: 'Details', data: base(), ui: { view: 'details', draft: draftFor({ defaults: DEFAULTS, fields: FIELDS }, job('2 - i7 Marketing › Web Dev')) } },
  { code: '1E', title: 'On the clock', data: on() },
  // The 2026 structure, from the switch date (owner, 26 October 2026).
  { code: '26L', title: '2026 first screen, five combinations', data: base(five2026()) },
  // Switch to opens the first screen; the bar on top confirms (owner, 28 October 2026).
  { code: '26N', title: '2026 on the clock', data: on2026() },
  { code: '26W', title: '2026 switch to', data: on2026(), ui: { view: 'switch', ret: 'switch' } },
  { code: '26H', title: '2026 first screen, with combinations', data: base(data2026()) },
  { code: '26A', title: '2026 off, no combinations', data: base({ ...data2026(), combinations: [], recents: [], resume: null }) },
  { code: '26C', title: '2026 browse', data: base(data2026()), ui: { view: 'choose', browse: data2026().folders.find(f => f.name === 'COE Group › Africa')!.id } },
  { code: '26D', title: '2026 details', data: base(data2026()), ui: { view: 'details', draft: draftFor({ defaults: {}, fields: data2026().fields }, data2026().jobs.find(j => j.name === 'HopeFor.Africa')!) } },
  { code: '26E', title: '2026 Activity', data: base(data2026()), ui: { view: 'details', draft: draftFor({ defaults: {}, fields: data2026().fields }, data2026().jobs.find(j => j.name === 'HopeFor.Africa')!, { activity: 'Other' }) } },
  // Clocky part 2, 10B: the allowance lines (Clock Panel.dc.html 10B0, 10B1, 10B2).
  { code: '10B0', title: 'Allowance, quiet', data: on({ allowance: { used: H(128), limit: H(140), over: 0, left: H(12), state: 'ok', period: 'month', hours: 140, stopAt: et(23, 45) } }) },
  { code: '10B1', title: 'Allowance, 90%', data: on({ allowance: { used: H(128), limit: H(140), over: 0, left: H(12), state: 'near', period: 'month', hours: 140, stopAt: et(23, 45) } }) },
  { code: '10B2', title: 'Allowance, over', data: on({ allowance: { used: H(143), limit: H(140), over: H(3), left: 0, state: 'over', period: 'month', hours: 140, stopAt: null } }) },
  // The allowance as a real limit (owner, 25 October 2026): 1h 15m left, so the clock stops by itself at 1:00 PM.
  { code: '10B3', title: 'Allowance, stops at the limit', data: on({ allowance: { used: H(138, 45), limit: H(140), over: 0, left: H(1, 15), state: 'near', period: 'month', hours: 140, stopAt: et(13) } }) },
  {
    code: '1F', title: 'Missing field',
    data: (() => {
      const now = et(11, 2, 10)
      return on({
        now,
        running: { ...runningOf(content, { real: et(9, 45), session: et(7), now }), label: 'i7 › Content', missing: ['activity'] },
        safety: safetyOf(et(7), 'i7 › Content'),
        todaySeconds: H(4, 0),
        weekSeconds: H(35, 15),
        todayByCombination: [{ label: 'TN Management', seconds: H(2, 45), running: false }, { label: 'i7 › Content', seconds: H(1, 15), running: true }],
      })
    })(),
    ui: { gate: { kind: 'switch', to: COMBOS[1] } },
  },
  {
    code: '1H', title: 'Clocked out',
    data: base({ now: et(17, 10), todaySeconds: H(8, 15), weekSeconds: H(39, 30), todayByCombination: [{ label: 'i7 Web Dev', seconds: H(6, 30), running: false }, { label: 'TN Admin', seconds: H(1), running: false }, { label: 'HFA Translation', seconds: H(0, 45), running: false }] }),
    toast: { text: 'Clocked out at 5:10 PM, recorded as 5:15 PM. Today 8h 15m.', undo: 901 },
  },
  {
    code: '1I', title: 'Still working?',
    data: (() => {
      const now = et(12, 30, 12)
      return on({
        now,
        running: runningOf(F, { real: et(11, 15), session: et(8), now }),
        safety: { ...safetyOf(et(8), 'i7 Web Dev')!, warn: true },
        todaySeconds: H(4, 30),
        weekSeconds: H(35, 45),
        todayByCombination: [{ label: 'HFA Translation', seconds: H(2, 15), running: false }, { label: 'i7 Web Dev', seconds: H(1, 15), running: true }, { label: 'TN Admin', seconds: H(1), running: false }],
      })
    })(),
  },
  {
    code: '1J', title: 'Save',
    data: base({ combinations: [], recents: [], resume: null, firstTime: true }),
    ui: (() => {
      const draft = draftFor({ defaults: DEFAULTS, fields: FIELDS }, job('2 - i7 Marketing › Web Dev'), { activity: 'WebDev' })
      return { view: 'details', draft, modal: 'save', save: saveDraftFrom({ jobs: JOBS, fields: FIELDS }, { jobId: draft.jobId, values: draft.values, notes: '', name: 'i7 Web Dev' }) }
    })(),
  },
  { code: '1K', title: 'Manage', data: base(), ui: { modal: 'manage' } },
  { code: '1L', title: 'Auto out', data: base({ now: et(15, 20), toConfirm: [autoItem()] }) },
  { code: '1N2', title: 'Locked month', data: base({ locked: 'October is submitted. Ask a Super Admin to reopen it.' }) },
  { code: 'NT1', title: 'Before the North Time start date', data: base({ startsOn: '2026-11-22', notYet: 'You start on North Time on Sunday, Nov 22. Until then, keep clocking in TSheets.', locked: 'You start on North Time on Sunday, Nov 22. Until then, keep clocking in TSheets.' }) },
  { code: '1N3', title: 'Offline', data: on(), offline: true },
]

/** The top-bar button's four states (the prototype's "states" strip). */
export const TB_STATES: { label: string; data: ClockPanelData }[] = [
  { label: 'Off the clock', data: base() },
  { label: 'On the clock', data: on() },
  {
    label: 'Over 4h 30m',
    data: (() => {
      const now = et(12, 31, 8)
      return on({ now, running: runningOf(F, { real: et(8), session: et(8), now }), safety: { ...safetyOf(et(8), 'i7 Web Dev')!, warn: true } })
    })(),
  },
  { label: 'Auto clocked out, not confirmed', data: base({ now: et(15, 20), toConfirm: [autoItem()] }) },
]

/** A stand-in for the server: every call says yes with the prototype's words, and the panel reads its frame again. */
export function sampleApi(data: ClockPanelData): ClockApi {
  const ok = <T extends object>(x: T) => Promise.resolve({ ok: true as const, ...x })
  return {
    load: () => ok({ data }),
    clockIn: () => ok({ entryId: 902, startedAt: data.now, startedAtReal: data.now }),
    switchTo: () => ok({ entryId: 903, previous: { label: 'i7 Web Dev', todaySeconds: H(2, 10) }, toast: 'Switched to TN Admin. i7 Web Dev: 2h 10m.' }),
    clockOut: () => ok({ entryId: 901, endedAt: data.now, recordedEnd: data.now, todaySeconds: H(8, 15), undoUntil: data.now, toast: 'Clocked out at 5:10 PM, recorded as 5:15 PM. Today 8h 15m.' }),
    undoClockOut: () => ok({}),
    saveRunningDetails: () => new Promise(r => setTimeout(() => r({ ok: true as const, missing: [] }), 450)),
    keepGoing: () => ok({ windowStartedAt: data.now, toast: 'Got it. Your clock runs another 5h from now.', toastFromBell: 'Keep going. Your clock runs another 5h from now.', done: 'You kept going at 12:31 PM. North Time asks again in 4h 30m.' }),
    confirmEnd: () => ok({ recordedEnd: et(13), flagged: false, toast: 'End time confirmed: 1:00 PM. Today 5h 00m.' }),
    createCombination: i => ok({ combination: COMBOS[0], toast: `Saved ${i.name}.` }),
    updateCombination: i => ok({ combination: COMBOS[0], toast: `Saved ${i.name}.` }),
    deleteCombination: () => ok({ toast: 'Deleted TN SEO.' }),
    reorderCombinations: () => ok({}),
  }
}

/**
 * The clock as the Time entries frames have it (Thu, Oct 15, 1:20 PM): on the
 * clock since 10:45 AM on 2 - i7 Marketing > Content, as the list's running row.
 */
export const ENTRIES_CLOCK: ClockPanelData = on({
  now: et(13, 20),
  running: runningOf(COMBOS.find(c => c.name === 'i7 Social') ?? COMBOS[0], { real: et(10, 45), session: et(10, 45), now: et(13, 20) }),
  safety: safetyOf(et(10, 45), 'i7 Social'),
})
