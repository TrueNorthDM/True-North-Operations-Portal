'use client'

import { useState } from 'react'
import { EntriesList } from '@/components/clocky/entries/EntriesList'
import { DEFAULT_COLUMNS, type ColumnKey } from '@/components/clocky/entries/model'
import type { EntryView } from '@/lib/timeclock/clocky-types'

const NOW = Date.parse('2026-10-28T14:40:00-04:00')
const OPEN = [{ text: 'Open', tone: 'neutral' as const, tip: 'Not submitted yet' }]
const EDITED = { text: 'Edited', tone: 'neutral' as const, tip: 'Edited after it was recorded' }

let n = 0
function row(o: { date: string; start: string; end: string; time: string; seconds: number; path: string; activity: string; billable: 'yes' | 'no'; notes?: string; structure: 1 | 2; switched?: boolean; edited?: boolean; play?: boolean }): EntryView {
  n += 1
  return {
    key: `e${n}`, rowType: 'entry', id: n, personId: 'me', personName: 'Arnaldo Oliveira', initials: 'AO', team: null,
    zone: 'America/New_York', zoneAbbr: '', date: o.date, start: o.start, end: o.end, running: false, timeText: o.time, seconds: o.seconds,
    jobcodeId: n, path: o.path, short: o.path.split(' › ').pop() ?? '', client: o.path.split(' › ')[0], isI7: false, structure: o.structure,
    fields: {}, company: '', project: '', activity: o.activity, billable: o.billable, code: '', notes: o.notes ?? '',
    kind: 'clock', imported: false, pills: o.edited ? [...OPEN, EDITED] : OPEN, autoOut: null, edited: null, clockedOutBy: null,
    locked: false, lockWhy: null, canEdit: true, shortenOnly: false, canDelete: true, canContinue: !!o.play, continuesPrevious: !!o.switched,
    attention: null, correction: null, timeOff: null,
  }
}

const at = (d: string, hm: string) => new Date(`${d}T${hm}:00-04:00`).toISOString()
const ROWS: EntryView[] = [
  row({ date: '2026-10-28', start: at('2026-10-28', '14:00'), end: at('2026-10-28', '14:30'), time: '2:00 PM to 2:30 PM', seconds: 1800, path: 'i7 Marketing › i7 Marketing › i7-ADMIN', activity: 'Admin', billable: 'yes', notes: 'Testing This note', structure: 2, play: true }),
  row({ date: '2026-10-28', start: at('2026-10-28', '14:30'), end: at('2026-10-28', '14:30'), time: '2:30 PM to 2:30 PM', seconds: 0, path: 'COE Group › Education › Education General', activity: 'Design/Graphics', billable: 'yes', structure: 2, switched: true, play: true }),
  row({ date: '2026-10-28', start: at('2026-10-28', '14:30'), end: at('2026-10-28', '14:30'), time: '2:30 PM to 2:30 PM', seconds: 0, path: 'i7 Marketing › i7 Marketing › i7-ADMIN', activity: 'Admin', billable: 'yes', structure: 2, switched: true, play: true }),
  row({ date: '2026-10-25', start: at('2026-10-25', '09:00'), end: at('2026-10-25', '09:15'), time: '9:00 AM to 9:15 AM', seconds: 900, path: '1 - True North › Project Management', activity: 'Project management', billable: 'yes', structure: 1, edited: true }),
  row({ date: '2026-10-25', start: at('2026-10-25', '09:15'), end: at('2026-10-25', '09:15'), time: '9:15 AM to 9:15 AM', seconds: 0, path: '1 - True North › Project Management', activity: 'Project management', billable: 'yes', structure: 1, switched: true }),
  row({ date: '2026-10-25', start: at('2026-10-25', '14:00'), end: at('2026-10-25', '15:00'), time: '2:00 PM to 3:00 PM', seconds: 3600, path: '1 - True North › Administrative', activity: 'SEO (unspecified)', billable: 'no', notes: 'This is a test', structure: 1 }),
]

const SPLIT: Record<ColumnKey, boolean> = { ...DEFAULT_COLUMNS }
const ONE: Record<ColumnKey, boolean> = { ...DEFAULT_COLUMNS, job: true, client: false, division: false, place: false }

export function ColumnsCheck() {
  const [split, setSplit] = useState(true)
  const [cols, setCols] = useState<Record<ColumnKey, boolean>>(SPLIT)
  const [colsOpen, setColsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const choose = (on: boolean) => { setSplit(on); setCols(on ? SPLIT : ONE) }
  const noop = () => {}
  return (
    // 1280 px: the list's width on the owner's screen, beside the Hours by client column.
    <div className="min-h-screen bg-[#f1efe8] px-8 py-7 flex flex-col gap-4 w-[1344px] max-w-full box-border">
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[26px] text-tn-ink">Time entries</h1>
        <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5" role="group" aria-label="Job columns">
          {([[false, 'Today: one Job column'], [true, 'Client, Division, Project']] as const).map(([on, label]) => (
            <button key={label} type="button" aria-pressed={split === on} onClick={() => choose(on)}
              className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] ${split === on ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{label}</button>
          ))}
        </div>
      </div>
      <EntriesList rows={ROWS} all={false} nowMs={NOW} cols={cols} setCols={setCols} colsOpen={colsOpen} setColsOpen={setColsOpen}
        collapsed={collapsed} toggleDay={d => setCollapsed(c => (c.includes(d) ? c.filter(x => x !== d) : [...c, d]))}
        note="Times in your time zone (New York), rounded to the nearest 15 minutes." emptyText="No entries." canAdd
        onEdit={noop} onHistory={noop} onContinue={noop} onDelete={noop} onOpen={noop} onAdd={noop} onRequest={noop} />
    </div>
  )
}
