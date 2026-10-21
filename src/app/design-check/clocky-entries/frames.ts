/**
 * The Time entries prototype's frames (Time Entries.dc.html, frame()), as the
 * level, the sample data and the screen state each one opens on.
 */

import type { EntriesUi } from '@/components/clocky/entries/TimeEntries'
import { blankForm, blankRequest, formFromRow, valuesOf } from '@/components/clocky/entries/form'
import { gridEditKey, gridRowKey, periodRange } from '@/components/clocky/entries/model'
import type { EntriesData, EntryView } from '@/lib/timeclock/clocky-types'
import { FIELDS, JOBS, KK, NOW_ISO, R, TODAY, entriesData, find, generate, jobId, makeStore, pid, reqSeed, type Level, type Rec, type Store } from './sample'

export const FRAMES: [string, string][] = [
  ['3A1', '3A List, My week'], ['3A2', '3A All day'], ['3Am', '3A Team member menu'], ['3A3', '3A Flagged + Columns'],
  ['3B1', '3B Week grid'], ['3B2', '3B Week grid (Team Leader)'], ['3B3', '3B Over 24h'],
  ['3C1', '3C Timeline, My'], ['3C2', '3C Timeline, All'], ['3C3', '3C Drag to create'], ['3C4', '3C Overlap'],
  ['3E1', '3E Add time (Team Leader)'], ['3E3', '3E User shortens own entry'], ['3E2', '3E Edit someone else'],
  ['3K1', '3K Request a correction'], ['3K2', '3K Pending in the list'], ['3K3', '3K Leader reviews'], ['3K4', '3K Needs attention (Team Leader)'],
  ['3F', '3F Overlap fix'], ['3G', '3G History'], ['3H1', '3H Submit, every 2 weeks'], ['3H3', '3H Submit, monthly'], ['3H2', '3H Refused, running'],
  ['3I', '3I Delete'], ['3J', '3J Time off'], ['E', 'Empty'], ['P', '?person= (Their time entries)'],
]

const ANCHORS = [{ anchor: '2026-10-04', effectiveFrom: null }]
const ET = 'America/New_York'
const at = (h: number) => new Date(Date.parse(`${TODAY}T04:00:00.000Z`) + h * 3600 * 1000).toISOString()

/** The rows of one record, as the loader shows them to the level. */
function viewOf(store: Store, x: Rec): EntryView {
  return entriesData(store, { from: x.date, to: x.date, who: 'all' }).rows.find(r => r.id === x.id)!
}

export interface Frame { level: Level; store: Store; initial: Partial<EntriesUi>; data: EntriesData }

export function buildFrame(code: string): Frame {
  let recs = generate()
  let level: Level = 'user'
  let cad: Record<string, string> = {}
  let initial: Partial<EntriesUi> = {}
  const sa = () => { level = 'super'; initial = { ...initial, who: 'all', period: 'day' } }
  const clarise = (d: string, h: number) => find(recs, 'Clarise Nixon', d, h)
  const fieldsK = (k: keyof typeof KK) => ({ jobcodeId: jobId(KK[k].job), jobPath: KK[k].job, values: { company: KK[k].co, project: KK[k].prj, activity: KK[k].act, billable: KK[k].bill, code: KK[k].code } })

  switch (code) {
    case '3A2': sa(); break
    case '3Am': sa(); initial.memberOpen = true; break
    case '3A3': initial.colsOpen = true; break
    case '3B1': initial.tab = 'grid'; break
    case '3B2': level = 'lead'; initial.tab = 'grid'; break
    case '3B3': {
      level = 'lead'
      initial.tab = 'grid'
      const key = gridRowKey(jobId(KK.tnMeet.job), KK.tnMeet.act)
      initial.gExtra = [{ key, jobcodeId: jobId(KK.tnMeet.job), path: KK.tnMeet.job, activity: KK.tnMeet.act, fields: { 1: 'True North', 2: 'In-House', 3: 'Meeting: Status', 4: 'no' } }]
      initial.gEdits = { [gridEditKey(key, '2026-10-14')]: '20:00' }
      break
    }
    case '3C1': initial = { ...initial, tab: 'timeline', period: 'day' }; break
    case '3C2': sa(); initial = { ...initial, tab: 'timeline', tlFull: true }; break
    case '3C3': level = 'lead'; initial = { ...initial, tab: 'timeline', period: 'day', ghost: { personId: pid('Wendy Cacka'), s: 14 * 3600, e: 15.25 * 3600 } }; break
    case '3C4': {
      level = 'super'
      const x = find(recs, 'Arnaldo Oliveira', TODAY, 9.0833)
      initial = { ...initial, tab: 'timeline', period: 'day', drag: { key: `e${x.id}`, s: 8.5 * 3600, e: 9.25 * 3600, orig: { s: x.s!, e: x.e! }, warn: true } }
      break
    }
    case '3E1': {
      level = 'lead'
      initial = { ...initial, who: 'all', period: 'day' }
      const f = blankForm({ personId: pid('Samuel Manzi'), personName: 'Samuel Manzi', zone: ET, date: TODAY, start: 13 * 60, end: 15 * 60 })
      initial.modal = { kind: 'edit', form: { ...f, ...fieldsK('tnWeb'), reason: 'Samuel worked on the GYC site from 1 to 3 PM and could not clock in (no connection).' } }
      break
    }
    case '3E3': {
      const x = clarise('2026-10-14', 10)
      const f = formFromRow(viewOf(makeStore('user', recs), x))
      initial.modal = { kind: 'edit', form: { ...f, end: 13 * 60, reason: 'I stopped at 1:00 PM and forgot to clock out.' } }
      break
    }
    case '3E2': {
      sa()
      const x = find(recs, 'Wendy Cacka', TODAY, 8)
      initial.modal = { kind: 'edit', form: formFromRow(viewOf(makeStore('super', recs), x)) }
      break
    }
    case '3F': {
      level = 'super'
      initial = { ...initial, who: 'all', period: 'day' }
      const f = { ...blankForm({ personId: pid('Clarise Nixon'), personName: 'Clarise Nixon', zone: ET, date: TODAY, start: 9 * 60, end: 10 * 60 }), combo: '1', ...fieldsK('i7Content') }
      const b = clarise(TODAY, 7)
      initial.modal = { kind: 'overlap', from: 'form', form: f, a: { start: at(9), end: at(10) }, other: { id: b.id, key: `e${b.id}`, name: 'TN Management', start: at(b.s! / 3600), end: at(b.e! / 3600) } }
      break
    }
    case '3G': sa(); initial.drawer = `e${find(recs, 'Wendy Cacka', TODAY, 8).id}`; break
    case '3H1': case '3H3': {
      const x = clarise(TODAY, 10.7)
      x.e = R(13 * 3600 + 20 * 60)
      if (code === '3H3') cad = { 'Clarise Nixon': 'monthly' }
      initial.modal = { kind: 'submit' }
      break
    }
    case '3H2': initial.modal = { kind: 'submit' }; break
    case '3I': initial.modal = { kind: 'delete', key: `e${clarise(TODAY, 9.75).id}` }; break
    case '3J': sa(); initial = { ...initial, anchor: '2026-10-16', modal: { kind: 'off', key: 'o9001:2026-10-16', deny: false } }; break
    case '3K1': {
      initial.modal = {
        kind: 'request',
        rq: blankRequest({
          date: '2026-10-14', start: 15 * 60, end: 16 * 60 + 30, combo: '1', jobcodeId: jobId(KK.i7Content.job),
          values: valuesOf({ 1: 'True North', 2: 'In-House', 3: 'Social Media', 4: 'yes', 5: 'i7-MKTG' }, FIELDS),
          reason: 'I kept working on the i7 LinkedIn posts after the clock stopped by itself at 3:00 PM.',
        }),
      }
      break
    }
    case '3K2': recs = [...recs, reqSeed()]; break
    case '3K3': sa(); recs = [...recs, reqSeed()]; initial = { ...initial, anchor: '2026-10-14', modal: { kind: 'review', key: 'c8001', deny: false } }; break
    case '3K4': level = 'lead'; initial = { ...initial, who: 'all', attnOnly: true }; break
    case 'E': initial.anchor = '2026-10-22'; break
    // The shell's N3: a Team Leader's own list, where Clock safety's address sends them.
    case 'L': level = 'lead'; break
    // Who's working, "Their time entries": /clocky-hours?person=<id> opens All with them picked.
    case 'P': level = 'super'; initial = { ...initial, who: 'all', member: pid('Justus Tsofa') }; break
  }

  const store = makeStore(level, recs, cad)
  const ui = { period: initial.period ?? 'week', anchor: initial.anchor ?? TODAY, who: initial.who ?? 'my', member: initial.member ?? null }
  const r = periodRange(ui.period, ui.anchor, ANCHORS)
  const data = entriesData(store, { from: r.from, to: r.to, who: ui.who, ...(ui.who === 'all' && ui.member ? { personId: ui.member } : {}) })
  return { level, store, initial, data }
}

export { NOW_ISO, JOBS }
