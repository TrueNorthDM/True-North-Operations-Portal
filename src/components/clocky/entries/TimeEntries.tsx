'use client'

/**
 * Time entries (design handoff of 16 October 2026, SPEC sections 8 and 9,
 * Time Entries.dc.html): one page in place of QuickBooks Time's Timesheets,
 * Manual Time Card and Time Slider.
 *
 *   header      Home / Clocky / Time entries
 *   toolbar     Add time (everyone for themselves since 4 November 2026;
 *               leaders for the people they add for; Request to add time is
 *               retired, owner, 5 November 2026),
 *               Submit <period> by cadence, Day | Week | Pay period | Month,
 *               Today, the arrows, the range, the calendar; My | All (My |
 *               My team for a Team Leader) and the Team member picker
 *   tabs        List, Week grid, Day timeline, with the totals strip
 *   side        hours by client, billable against not, Needs attention
 *
 * Everything it shows comes from the actions in entries-actions.ts (the
 * `api` handed in); the rules are the server's, and this only draws them.
 */

import { INPUT } from '@/lib/ui/fields'
import { useEffect, useRef, useState } from 'react'
import { failText } from '@/lib/ui/action-error'
import { BTN_ICON } from '@/lib/ui/buttons'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Segmented } from '@/components/ui/Segmented'
import { dayLabel, localDate, localMinutes, timeLabel } from '@/lib/timeclock/format'
import { formatDuration } from '@/lib/timeclock/rounding'
import type { AttentionItem, EntriesData, EntryView, HistoryData, OverlapInfo, SubmitSummary } from '@/lib/timeclock/clocky-types'
import type { Catalog, EntriesApi, EntryInputBody } from './api'
import { DayTimeline, droppedOverlap, type Drag, type Ghost } from './DayTimeline'
import { CorrectionReview, DeleteDialog, GridReasonDialog, SubmitDialog, TimeOffCard } from './Dialogs'
import { EntriesList, useOutside } from './EntriesList'
import { EntryForm } from './EntryForm'
import { GridRowPick, type GridChoices } from './GridRowPick'
import { blankForm, fieldsOf, formFromRow, formJob, formSpan, overlapAmong, type FormState } from './form'
import { fieldsForJob } from '@/components/clocky/clock/clock-model'
import { HistoryDrawer } from './HistoryDrawer'
import {
  DEFAULT_COLUMNS, buildGrid, calendarWeeks, gridChanges, gridRowKey, hhmmOf, isWork, nameFor, periodRange, rangeText, shiftAnchor,
  totalsLabel, totalsOf, weekStartOf, zoneCity, type ColumnKey, type GridSource, type PeriodKind,
} from './model'
import { OverlapFix, overlapModel } from './OverlapFix'
import { SummaryAside } from './SummaryAside'
import { BTN_PAGE_NAVY, BTN_PAGE_WHITE, BTN_SMALL, ICON_BTN, Icon, ICON, MENU, Toast, type ToastState } from './ui'
import { WeekGrid } from './WeekGrid'
import { addDays } from '@/lib/timeclock/periods'
import { structureOn } from '@/lib/timeclock/entry-rules'
import { Tabs } from '@/components/ui/Tabs'
import { PAGE_TITLE } from '@/lib/ui/type'

export type ModalState =
  | { kind: 'edit'; form: FormState }
  /** 3F: from the form (a refused Save) or from the timeline (a block let go on another). */
  | { kind: 'overlap'; from: 'form' | 'tl'; form: FormState; a: { start: string; end: string }; other: { id: number; key: string | null; name: string; start: string; end: string | null } }
  | { kind: 'delete'; key: string }
  | { kind: 'submit' }
  | { kind: 'review'; key: string; deny: boolean }
  | { kind: 'off'; key: string; deny: boolean }
  | { kind: 'grid-reason' }
  | { kind: 'grid-row' }

export interface EntriesUi {
  period: PeriodKind
  anchor: string
  who: 'my' | 'all'
  /** The Team member picked (a person id), or null for everyone. */
  member: string | null
  /** The team chip picked in the Team member menu (filters the menu's list). */
  teamF: string | null
  memberQ: string
  tab: 'list' | 'grid' | 'timeline'
  cols: Record<ColumnKey, boolean>
  colsOpen: boolean
  memberOpen: boolean
  calOpen: boolean
  addRowOpen: boolean
  attnOnly: boolean
  collapsed: string[]
  tlFull: boolean
  gEdits: Record<string, string>
  gExtra: GridSource[]
  ghost: Ghost | null
  drag: Drag | null
  modal: ModalState | null
  /** Whose history is open (3G): 'e<entry id>', or 'c<request id>' for a time correction request. */
  drawer: string | null
}

const queryOf = (ui: Pick<EntriesUi, 'period' | 'anchor' | 'who' | 'member'>, anchors: EntriesData['anchors']) => {
  const r = periodRange(ui.period, ui.anchor, anchors)
  return { from: r.from, to: r.to, who: ui.who, ...(ui.who === 'all' && ui.member ? { personId: ui.member } : {}) }
}
const keyOf = (q: ReturnType<typeof queryOf>) => `${q.from}|${q.to}|${q.who}|${q.personId ?? ''}`
const daySeconds = (iso: string, zone: string) => localMinutes(iso, zone) * 60

export function TimeEntries({ initialData, catalog, api, initial, clock, clockHref = '/clocky-hours?clock=open', onChanged, onInvoiceMade, onSendInvoice }: {
  initialData: EntriesData
  catalog: Catalog
  api: EntriesApi
  /** The design checks open a frame's state (a menu, a modal, a drag). */
  initial?: Partial<EntriesUi>
  /** The server's now; frozen in the design checks. */
  clock: { now: string; frozen?: boolean }
  clockHref?: string
  /** After a change: the live page refreshes the top bar. */
  onChanged?: () => void
  /** A contractor's submit made an invoice: the live page opens it. */
  onInvoiceMade?: (invoiceId: number) => void
  /** A contractor's timesheet is sent: on to Send your invoice for that period (4 November 2026). */
  onSendInvoice?: (start: string) => void
}) {
  const [data, setData] = useState<EntriesData>(initialData)
  const [nowMs, setNowMs] = useState(() => Date.parse(clock.now))
  const viewer = data.viewer
  const leader = data.canAdd
  // Whose hours the viewer adds to: a Team Leader their team's, never their own (owner, 25 October 2026).
  const addsFor = (p: string) => (p === viewer.personId ? data.canAddOwn : leader && data.people.some(x => x.id === p))
  const [ui, setUi] = useState<EntriesUi>(() => ({
    period: 'week', anchor: localDate(new Date(Date.parse(clock.now)), initialData.viewer.zone), who: 'my', member: null, teamF: null, memberQ: '',
    tab: 'list', cols: { ...DEFAULT_COLUMNS }, colsOpen: false, memberOpen: false, calOpen: false, addRowOpen: false,
    attnOnly: false, collapsed: [], tlFull: false, gEdits: {}, gExtra: [], ghost: null, drag: null, modal: null, drawer: null,
    ...initial,
  }))
  const [busy, setBusy] = useState(false)
  // An entry opened from the submit window that sits outside the view: its form, delete and history still find it.
  const [outside, setOutside] = useState<EntryView | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [history, setHistory] = useState<{ key: string; data: HistoryData | null; error: string | null } | null>(null)
  const [submit, setSubmit] = useState<{ summary: SubmitSummary | null; error: string | null } | null>(null)
  const uiRef = useRef(ui)
  const seq = useRef(0)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => { uiRef.current = ui })

  // The clock: the server's now, moving (durations are rounded, so every 15 seconds is plenty).
  useEffect(() => {
    if (clock.frozen) return
    const offset = Date.parse(clock.now) - Date.now()
    const t = setInterval(() => setNowMs(Date.now() + offset), 15_000)
    return () => clearInterval(t)
  }, [clock.now, clock.frozen])
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const say = (text: string, error = false) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ text, error })
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  const load = async (next: EntriesUi) => {
    const n = ++seq.current
    const r = await api.getEntries(queryOf(next, data.anchors))
    if (n !== seq.current) return
    if (r.ok) setData(r.data)
    else say(r.error, true)
  }
  const reload = () => { void load(uiRef.current); onChanged?.() }
  const go = (patch: Partial<EntriesUi>) => {
    // Another person's hours: the grid's unsaved cells and added rows were the last person's, so they go (audit, 29 October 2026).
    const otherPerson = (patch.member !== undefined && patch.member !== ui.member) || (patch.who !== undefined && patch.who !== ui.who)
    const next = { ...ui, ...patch, ...(otherPerson ? { gEdits: {}, gExtra: [] } : {}) }
    setUi(next)
    if (keyOf(queryOf(next, data.anchors)) !== keyOf(queryOf(ui, data.anchors))) void load(next)
  }
  const setModal = (modal: ModalState | null) => setUi(u => ({ ...u, modal }))

  // 3G and 3H read when they open.
  useEffect(() => {
    if (ui.drawer === null) return
    let off = false
    const key = ui.drawer
    const id = Number(key.slice(1))
    const read = key.startsWith('c') ? api.getCorrectionHistory({ id }) : api.getEntryHistory({ id })
    read.then(r => { if (!off) setHistory(r.ok ? { key, data: r.data, error: null } : { key, data: null, error: r.error }) },
      () => { if (!off) setHistory({ key, data: null, error: 'The history could not be read. Try again in a moment.' }) })
    return () => { off = true }
  }, [ui.drawer, api])
  const submitOpen = ui.modal?.kind === 'submit'
  // The period on the button (maybe one left behind, not today's).
  const submitStart = data.submit.start
  useEffect(() => {
    if (!submitOpen) return
    let off = false
    api.getSubmitSummary({ start: submitStart }).then(r => { if (!off) setSubmit(r.ok ? { summary: r.data, error: null } : { summary: null, error: r.error }) },
      () => { if (!off) setSubmit({ summary: null, error: 'The period could not be read. Try again in a moment.' }) })
    return () => { off = true }
  }, [submitOpen, submitStart, api])

  // The timeline draws one day and the grid one week: another period goes back to the list.
  const tabFor = (p: PeriodKind, t: EntriesUi['tab']): EntriesUi['tab'] => ((t === 'timeline' && p !== 'day') || (t === 'grid' && p !== 'week') ? 'list' : t)
  // The tabs this person has (ck-grid, ck-timeline); the server refuses the grid's save without it too.
  const views = data.views ?? { grid: true, timeline: true }
  const tabShown: EntriesUi['tab'] = (ui.tab === 'grid' && !views.grid) || (ui.tab === 'timeline' && !views.timeline) ? 'list' : ui.tab
  const today = localDate(new Date(nowMs), viewer.zone)
  const range = periodRange(ui.period, ui.anchor, data.anchors)
  const all = ui.who === 'all' && viewer.who !== null
  /** "Add time" here: in My, for whoever adds to their own hours (everyone since 4 November 2026). */
  const addHere = all ? leader : data.canAddOwn
  const rows = data.rows
  const shown = ui.attnOnly ? rows.filter(r => r.attention) : rows
  const totals = totalsOf(rows, nowMs)
  const rowByKey = (k: string) => rows.find(r => r.key === k) ?? (outside?.key === k ? outside : undefined)
  const me = { personId: viewer.personId, name: catalog.me.name, zone: viewer.zone }

  // ── Opening things ────────────────────────────────────────────────────────

  const openRow = (r: EntryView) => {
    if (r.rowType === 'correction') return setModal({ kind: 'review', key: r.key, deny: false })
    if (r.rowType === 'time_off') return setModal({ kind: 'off', key: r.key, deny: false })
    if (!r.canEdit) return setUi(u => ({ ...u, drawer: `e${r.id}` }))
    setUi(u => ({ ...u, modal: { kind: 'edit', form: formFromRow(r) }, drawer: null }))
  }
  const openAdd = (pre?: { personId: string; date: string; start?: number; end?: number }) => {
    const personId = pre?.personId ?? (all && ui.member ? ui.member : data.canAddOwn ? viewer.personId : data.people.find(p => addsFor(p.id))?.id ?? viewer.personId)
    if (!addsFor(personId)) return
    const person = data.people.find(p => p.id === personId)
    const zone = rows.find(r => r.personId === personId)?.zone ?? viewer.zone
    const date = pre?.date ?? (today >= range.from && today <= range.to ? today : ui.anchor)
    setUi(u => ({ ...u, colsOpen: false, ghost: null, modal: { kind: 'edit', form: blankForm({ personId, personName: person?.name ?? me.name, zone, date, start: pre?.start, end: pre?.end }) } }))
  }
  const openAttention = async (a: AttentionItem) => {
    if (dropped && (a.key === dropped.moved.key || a.key === dropped.other.key)) return fixDropped()
    const r = rowByKey(a.key)
    if (r) return openRow(r)
    // From the submit window: the entry sits in the period, maybe outside the view.
    const s = submit?.summary
    if (!s) return
    const res = await api.getEntries({ from: s.start, to: s.end, who: 'my' }).catch(() => null)
    const found = res?.ok ? res.data.rows.find(x => x.key === a.key) : undefined
    if (!found) return setSubmit({ summary: s, error: res && !res.ok ? res.error : 'That entry could not be found. Reload the page and try again.' })
    setOutside(found)
    openRow(found)
  }

  // ── Writing ───────────────────────────────────────────────────────────────

  const bodyOf = (f: FormState): EntryInputBody => {
    const job = catalog.jobs.find(j => j.id === f.jobcodeId)
    return {
      date: f.date,
      mode: f.type === 'range' ? 'range' : 'duration',
      ...(f.type === 'range' ? { start: hhmmOf(f.start), end: f.end === 'now' ? 'now' : hhmmOf(f.end) } : { duration: f.dur }),
      jobcodeId: f.jobcodeId!,
      fields: fieldsOf(f.values, fieldsForJob(catalog.fields, formJob(f, catalog.jobs)), job?.isI7 ?? /^2 - i7/.test(f.jobPath)),
      notes: f.notes,
      reason: f.reason.trim(),
      ...(f.fix ? { fix: f.fix } : {}),
    }
  }
  // Every write: busy while it runs, and back again however it ends (a
  // network error or a deploy mid-request rejects instead of answering).
  const call = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true)
    try { return await fn() } catch (e) { say(failText(e), true); return null } finally { setBusy(false) }
  }
  const saveForm = async (f: FormState) => {
    const body = bodyOf(f)
    const r = await call(() => (f.id === null ? api.addTime({ ...body, personId: f.personId }) : api.editEntry({ ...body, id: f.id })))
    if (!r) return
    if (r.ok) {
      setUi(u => ({ ...u, modal: null, drag: null }))
      say(r.toast)
      return reload()
    }
    if (r.overlap) {
      const span = formSpan(f, nowMs)
      const o: OverlapInfo = r.overlap
      if (span) return setModal({ kind: 'overlap', from: 'form', form: { ...f, fix: null, fixNote: null }, a: span, other: { id: o.entryId, key: `e${o.entryId}`, name: rowByKey(`e${o.entryId}`) ? nameFor(rowByKey(`e${o.entryId}`)!, catalog.combinations) : o.name, start: o.start, end: o.end } })
    }
    setModal({ kind: 'edit', form: { ...f, error: r.error } })
  }
  const trim = (m: Extract<ModalState, { kind: 'overlap' }>, which: 'other' | 'this', note: string) => {
    const fix = { otherId: m.other.id, trim: which }
    if (m.from === 'form') return void saveForm({ ...m.form, fix, fixNote: null })
    setUi(u => ({ ...u, drag: null, modal: { kind: 'edit', form: { ...m.form, fix, fixNote: note } } }))
  }
  const del = async (key: string, reason: string) => {
    const r = rowByKey(key)
    if (!r) return
    const res = await call(() => api.deleteEntry({ id: r.id, reason }))
    if (!res) return
    if (!res.ok) return say(res.error, true)
    setUi(u => ({ ...u, modal: null, drawer: null }))
    say(res.toast)
    reload()
  }
  const cont = async (r: EntryView) => {
    const running = catalog.running ?? rows.find(x => x.personId === viewer.personId && x.running)
    const prev = rows.find(x => x.personId === viewer.personId && x.running)
    const input = { jobcodeId: r.jobcodeId!, fields: r.fields, notes: r.notes }
    if (busy) return
    const res = await call(async () => (running ? await api.switchTo(input) : await api.clockIn(input)))
    if (!res) return
    if (!res.ok) return say(res.error, true)
    say(`Clock running: ${nameFor(r, catalog.combinations)}.${prev ? ` Switched from ${nameFor(prev, catalog.combinations)}.` : ''}`)
    reload()
  }
  const decideCorrection = async (r: EntryView, decision: 'approve' | 'deny', note?: string) => {
    const res = await call(() => api.decideCorrection({ id: r.id, decision, note }))
    if (!res) return
    if (!res.ok) return say(res.error, true)
    setModal(null)
    say(res.toast)
    reload()
  }
  const decideTimeOff = async (r: EntryView, decision: 'approve' | 'deny', note?: string) => {
    const res = await call(() => api.decideTimeOff({ id: r.id, decision, note }))
    if (!res) return
    if (!res.ok) return say(res.error, true)
    setModal(null)
    say(decision === 'approve' ? `Time off approved. ${r.personName} gets a notification.` : `Time off denied. ${r.personName} gets the reason.`)
    reload()
  }
  const doSubmit = async () => {
    const s = submit?.summary
    if (!s) return
    const r = await call(() => api.submitPeriod({ start: s.start, end: s.end }))
    if (!r) return
    if (!r.ok) return setSubmit({ summary: r.attention ? { ...s, attention: r.attention } : s, error: r.error })
    setModal(null)
    // A contractor's invoice opens (Invoices.dc.html 6A), with the toast on it.
    if (r.invoiceId && onInvoiceMade) return onInvoiceMade(r.invoiceId)
    // Since 4 November 2026 the contractor sends their own: straight on to it.
    if (r.sendInvoice && onSendInvoice) return onSendInvoice(s.start)
    say(r.toast)
    reload()
  }

  // ── The week grid ─────────────────────────────────────────────────────────

  const gridWho = ui.member && all ? ui.member : viewer.personId
  const gridName = gridWho === viewer.personId ? me.name : data.people.find(p => p.id === gridWho)?.name ?? ''
  const gridDays = Array.from({ length: 7 }, (_, i) => addDays(weekStartOf(ui.anchor), i))
  const gridRows = rows.filter(r => r.personId === gridWho && isWork(r) && gridDays.includes(r.date))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start ? Date.parse(a.start) : 9e15) - (b.start ? Date.parse(b.start) : 9e15)))
  const sources: GridSource[] = []
  for (const r of gridRows) {
    const key = gridRowKey(r.jobcodeId, r.activity)
    if (!sources.some(s => s.key === key)) sources.push({ key, jobcodeId: r.jobcodeId, path: r.path, activity: r.activity, fields: r.fields })
  }
  for (const s of ui.gExtra) if (!sources.some(x => x.key === s.key)) sources.push(s)
  const canGrid = addsFor(gridWho)
  // Add row lists the combinations and recents of the person whose week it is (owner, 28 October 2026).
  const [theirChoices, setTheirChoices] = useState<(GridChoices & { personId: string }) | null>(null)
  const needTheirs = tabShown === 'grid' && canGrid && gridWho !== viewer.personId && theirChoices?.personId !== gridWho
  useEffect(() => {
    if (!needTheirs) return
    let off = false
    const done = (c: GridChoices) => { if (!off) setTheirChoices({ ...c, personId: gridWho }) }
    api.getChoicesFor({ personId: gridWho })
      .then(r => done(r.ok ? r.data : { combinations: [], recents: [], error: r.error }))
      .catch(e => done({ combinations: [], recents: [], error: failText(e) }))
    return () => { off = true }
  }, [needTheirs, gridWho, api])
  const gridChoices: GridChoices | null = gridWho === viewer.personId
    ? { combinations: catalog.combinations, recents: catalog.recents }
    : theirChoices?.personId === gridWho ? theirChoices : null
  // The day Add row offers jobs for: today in this week, else the week's last day (its first, for a week ahead).
  const pickDay = today < gridDays[0] ? gridDays[0] : today > gridDays[6] ? gridDays[6] : today
  const gridPicks2026 = structureOn(pickDay, catalog.switchDate) === 2
  const grid = buildGrid({
    days: gridDays, sources, edits: ui.gEdits, editable: canGrid,
    entries: gridRows.map(r => ({ rowKey: gridRowKey(r.jobcodeId, r.activity), date: r.date, seconds: r.seconds, clocked: r.kind !== 'manual' || r.imported, locked: r.locked })),
  })
  const saveGrid = async (reason: string) => {
    const changes = gridChanges(grid, ui.gEdits).filter(c => c.source.jobcodeId !== null)
    const r = await call(() => api.saveWeekGrid({
      personId: gridWho, weekStart: gridDays[0], reason,
      rows: changes.map(c => ({ jobcodeId: c.source.jobcodeId!, fields: c.source.fields, cells: c.cells })),
    }))
    if (!r) return
    if (!r.ok) { setModal(null); return say(r.error, true) }
    setUi(u => ({ ...u, modal: null, gEdits: {}, gExtra: [] }))
    say(r.toast)
    reload()
  }

  // ── The toolbar's menus ───────────────────────────────────────────────────

  const calRef = useOutside(ui.calOpen, () => setUi(u => ({ ...u, calOpen: false })))
  const memberRef = useOutside(ui.memberOpen, () => setUi(u => ({ ...u, memberOpen: false })))
  const periods: { key: PeriodKind; label: string }[] = [
    { key: 'day', label: 'Day' }, { key: 'week', label: 'Week' },
    ...(viewer.cadence === 'biweekly' ? [{ key: 'pp' as const, label: 'Pay period' }] : []),
    { key: 'month', label: 'Month' },
  ]
  const teamName = (ids: string[]) => data.teams.find(t => ids.includes(t.id))?.name
  const q = ui.memberQ.trim().toLowerCase()
  const memberRows = [
    { id: null as string | null, name: 'Everyone', sub: '' },
    ...data.people.filter(p => (!ui.teamF || p.teamIds.includes(ui.teamF)) && (!q || p.name.toLowerCase().includes(q)))
      .map(p => ({ id: p.id as string | null, name: p.name, sub: `${teamName(p.teamIds) ?? 'No team'} · ${p.cadence === 'biweekly' ? 'every 2 weeks' : 'monthly'}` })),
  ]
  const memberName = ui.member ? data.people.find(p => p.id === ui.member)?.name ?? '' : ''
  const submitLabel = data.submit.submitted ? `${data.submit.label} submitted` : `Submit ${data.submit.label}`
  // 3C4: a block dropped on another entry puts both in Needs attention until
  // the overlap is fixed or undone (it is never saved).
  const dropped = tabShown === 'timeline' ? droppedOverlap(rows, ui.anchor, viewer.zone, ui.drag, nowMs) : null
  const droppedItems: AttentionItem[] = dropped
    ? [dropped.moved, dropped.other]
      .sort((a, b) => Date.parse(a.start!) - Date.parse(b.start!))
      .map(r => ({ key: r.key, reason: 'Overlaps another entry', sub: `${all ? `${r.personName} · ` : ''}${dayLabel(r.date)} · ${r.timeText} · ${r.short}`, cta: 'Fix' as const }))
    : []
  const fixOverlap = (r: EntryView, other: EntryView, start: string, end: string) => setModal({
    kind: 'overlap', from: 'tl', a: { start, end },
    form: { ...formFromRow(r), date: localDate(start, r.zone), start: localMinutes(start, r.zone), end: localMinutes(end, r.zone) },
    other: { id: other.id, key: other.key, name: nameFor(other, catalog.combinations), start: other.start!, end: other.end },
  })
  const fixDropped = () => { if (dropped) fixOverlap(dropped.moved, dropped.other, dropped.moved.start!, dropped.moved.end!) }
  const attention = [...droppedItems, ...data.attention.filter(a => !droppedItems.some(d => d.key === a.key))]

  // ── The open modal ────────────────────────────────────────────────────────

  const m = ui.modal
  const modalView = (() => {
    if (!m) return null
    if (m.kind === 'edit') {
      return (
        <EntryForm form={m.form} setForm={patch => setUi(u => (u.modal?.kind === 'edit' ? { ...u, modal: { kind: 'edit', form: { ...u.modal.form, ...patch } } } : u))}
          catalog={catalog} people={data.people.filter(p => addsFor(p.id))} pickPerson={all && leader} leader={addsFor(m.form.personId)} viewerId={viewer.personId} rows={rows} nowMs={nowMs} busy={busy}
          onClose={() => setUi(u => ({ ...u, modal: null, drag: null }))}
          onSave={() => void saveForm(m.form)}
          onDelete={() => m.form.id !== null && setModal({ kind: 'delete', key: `e${m.form.id}` })}
          />
      )
    }
    if (m.kind === 'overlap') {
      const zone = m.form.zone
      const a = { s: daySeconds(m.a.start, zone), e: daySeconds(m.a.end, zone) }
      const bEnd = m.other.end ?? new Date(nowMs).toISOString()
      const b = { s: daySeconds(m.other.start, zone), e: daySeconds(bEnd, zone), running: !m.other.end, name: m.other.name }
      const notes = overlapModel(a, b)
      // Back and edit: the form as it was (from the timeline, with the times dragged); Cancel closes.
      const back = () => setUi(u => ({ ...u, drag: null, modal: { kind: 'edit', form: m.form } }))
      const cancel = () => setUi(u => ({ ...u, modal: null, drag: null }))
      return <OverlapFix a={a} b={b} busy={busy} onBack={back} onCancel={cancel} onTrim={w => trim(m, w, w === 'other' ? notes.otherSub : notes.thisSub)} />
    }
    if (m.kind === 'delete') {
      const r = rowByKey(m.key)
      if (!r) return null
      return <DeleteDialog text={`${r.path}, ${dayLabel(r.date)}, ${r.timeText} (${formatDuration(r.seconds)}).`} busy={busy} onClose={() => setModal(null)} onDelete={reason => void del(m.key, reason)} />
    }
    if (m.kind === 'submit') {
      return <SubmitDialog summary={submit?.summary ?? null} error={submit?.error ?? null} busy={busy} clockHref={clockHref}
        onClose={() => { setModal(null); setSubmit(null) }} onSubmit={() => void doSubmit()} onFix={k => { const a = submit?.summary?.attention.find(x => x.key === k); if (a) void openAttention(a) }} />
    }
    if (m.kind === 'review') {
      const r = rowByKey(m.key)
      if (!r || !r.correction) return null
      const hit = r.start && r.end ? overlapAmong({ start: r.start, end: r.end }, r.personId, rows, null, nowMs) : null
      const overlap = hit && r.correction.canDecide
        ? `It overlaps ${nameFor(hit.row, catalog.combinations)} (${timeLabel(hit.row.start!, r.zone)} to ${hit.row.end ? timeLabel(hit.row.end, r.zone) : 'now'}). Fix that entry before approving.`
        : null
      return <CorrectionReview key={m.key} who={r.personName} goesTo={r.correction.goesTo} state={r.correction.state} date={`${dayLabel(r.date)}, ${r.date.slice(0, 4)}`}
        time={`${r.timeText} (${formatDuration(r.seconds)})`} job={`${r.path} · ${r.activity || 'No activity'}`} reason={r.correction.reason}
        overlap={overlap} canDecide={r.correction.canDecide} denyFirst={m.deny} busy={busy}
        onClose={() => setModal(null)} onApprove={() => void decideCorrection(r, 'approve')} onDeny={note => void decideCorrection(r, 'deny', note)} />
    }
    if (m.kind === 'off') {
      const r = rowByKey(m.key)
      if (!r || !r.timeOff) return null
      const t = r.timeOff
      const dates = t.startDate === t.endDate ? `${dayLabel(t.startDate)}, ${t.startDate.slice(0, 4)}` : `${dayLabel(t.startDate)} to ${dayLabel(t.endDate)}, ${t.endDate.slice(0, 4)}`
      return <TimeOffCard key={m.key} who={r.personName} state={t.state} type={t.type} dates={dates} hours={formatDuration(t.hoursPerDay * 3600)} note={t.note}
        canDecide={t.canDecide} denyFirst={m.deny} busy={busy} onClose={() => setModal(null)}
        onApprove={() => void decideTimeOff(r, 'approve')} onDeny={note => void decideTimeOff(r, 'deny', note)} />
    }
    if (m.kind === 'grid-reason') return <GridReasonDialog busy={busy} onClose={() => setModal(null)} onSave={reason => void saveGrid(reason)} />
    if (m.kind === 'grid-row') {
      const week = `${dayLabel(gridDays[0])} to ${dayLabel(gridDays[6])}.`
      return <GridRowPick catalog={catalog} choices={gridChoices} day={pickDay}
        whose={gridWho === viewer.personId ? `Your week, ${week}` : `${gridName}'s week, ${week}`}
        combosLabel={gridWho === viewer.personId ? undefined : `${gridName}'s combinations`}
        taken={k => grid.rows.some(r => r.key === k)} onClose={() => setModal(null)}
        onAdd={src => setUi(u => ({ ...u, gExtra: [...u.gExtra, src], modal: null }))} />
    }
    return null
  })()

  // The prototype's text sits on the browser's normal line height; the portal's
  // body sets 1.5. Normal here keeps every control the height it was drawn at.
  return (
    <div className="flex flex-col gap-4 leading-[normal]">
      <div>
        <Breadcrumb parents={['/clocky-hours']} now="Time entries" />
        <h1 className={`${PAGE_TITLE} mt-0.5`}>Time entries</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {addHere && (
          <button type="button" onClick={() => openAdd()} className={`${BTN_PAGE_NAVY} whitespace-nowrap`}>
            <Icon d={ICON.plus} size={14} color={BTN_ICON.navy} width={3} />Add time
          </button>
        )}
        <button type="button" onClick={() => { setSubmit(null); setModal({ kind: 'submit' }) }} className={`${BTN_PAGE_WHITE} whitespace-nowrap`}>
          <Icon d={ICON.send} size={15} color={BTN_ICON.white} width={2.2} />{submitLabel}
        </button>
        <span className="w-px h-[26px] bg-[var(--panel-border)] mx-1" />
        <Segmented label="Period" options={periods} value={ui.period}
          onChange={k => go({ period: k, tab: tabFor(k, ui.tab) })} />
        {/* Today shows today's day, whatever view was on (owner, 8 November 2026: on Month it changed nothing); faded once it is on. */}
        <button type="button" onClick={() => go({ period: 'day', anchor: today, tab: tabFor('day', ui.tab) })} disabled={ui.period === 'day' && ui.anchor === today}
          title={ui.period === 'day' && ui.anchor === today ? 'Today is already in view' : undefined} className={`${BTN_SMALL} disabled:opacity-45 disabled:cursor-default`}>Today</button>
        <div className="flex items-center gap-0.5 text-tn-ink">
          <button type="button" aria-label="Previous" onClick={() => go({ anchor: shiftAnchor(ui.period, ui.anchor, -1, data.anchors) })} className={ICON_BTN}><Icon d={ICON.left} size={16} width={2.4} /></button>
          <button type="button" aria-label="Next" onClick={() => go({ anchor: shiftAnchor(ui.period, ui.anchor, 1, data.anchors) })} className={ICON_BTN}><Icon d={ICON.right} size={16} width={2.4} /></button>
        </div>
        <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink tabular-nums lining-nums whitespace-nowrap">{rangeText(ui.period, range.from, range.to)}</span>
        <div className="relative" ref={calRef}>
          <button type="button" aria-label="Jump to a week" aria-expanded={ui.calOpen} onClick={() => setUi(u => ({ ...u, calOpen: !u.calOpen }))} className={`${ICON_BTN} text-tn-green!`}>
            <Icon d={ICON.calendar} size={17} />
          </button>
          {ui.calOpen && (
            <div className={`${MENU} top-[38px] left-0 w-[214px] p-1.5 gap-px`}>
              {calendarWeeks(today).map(w => (
                <button key={w.anchor} type="button" onClick={() => go({ anchor: w.anchor, period: 'week', tab: tabFor('week', ui.tab), calOpen: false })}
                  className={`border-0 text-left whitespace-nowrap rounded-[8px] px-2.5 py-2 font-(family-name:--font-display) font-semibold text-[13px] tabular-nums lining-nums ${w.current ? 'bg-tn-teal-soft text-tn-teal' : 'bg-transparent text-tn-ink hover:bg-subtle'}`}>
                  {w.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="flex-1" />
        {viewer.who && (
          <>
            <Segmented label="Whose hours" options={[{ key: 'my', label: 'My' }, { key: 'all', label: viewer.who === 'team' ? 'My team' : 'All' }]}
              value={ui.who} onChange={k => go({ who: k, member: k === 'my' ? null : ui.member })} />
            <div className="relative" ref={memberRef}>
              <button type="button" aria-expanded={ui.memberOpen} onClick={() => setUi(u => ({ ...u, memberOpen: !u.memberOpen }))}
                className={`h-9 flex items-center gap-2 px-3 whitespace-nowrap bg-white border border-[var(--panel-border)] rounded-[10px] font-(family-name:--font-display) font-semibold text-[13px] transition-colors hover:border-tn-teal ${ui.member ? 'text-tn-ink' : 'text-muted'}`}>
                {memberName || 'Team member'}<Icon d={ICON.down} size={15} color="var(--muted)" />
              </button>
              {ui.memberOpen && (
                <div className={`${MENU} top-[42px] right-0 w-[308px] p-2 gap-1.5`}>
                  <input value={ui.memberQ} onChange={e => setUi(u => ({ ...u, memberQ: e.target.value }))} autoFocus placeholder="Search people" aria-label="Search people"
                    className={INPUT} />
                  <div className="flex flex-wrap gap-1">
                    {[{ id: null as string | null, name: 'All teams', color: 'var(--faint)' }, ...data.teams.map(t => ({ id: t.id as string | null, name: t.name, color: t.color ?? 'var(--faint)' }))].map(t => {
                      const on = ui.teamF === t.id
                      return (
                        <button key={t.id ?? 'all'} type="button" onClick={() => setUi(u => ({ ...u, teamF: t.id }))}
                          className={`flex items-center gap-[5px] border rounded-full px-[9px] py-[3px] text-[11.5px] font-semibold whitespace-nowrap ${on ? 'border-tn-teal bg-tn-teal-soft text-tn-teal' : 'border-[var(--panel-border)] bg-white text-foreground'}`}>
                          <span className="w-[7px] h-[7px] rounded-full" style={{ background: t.color }} />{t.name}
                        </button>
                      )
                    })}
                  </div>
                  <div className="max-h-[230px] overflow-auto flex flex-col gap-px">
                    {memberRows.map(p => {
                      const on = ui.member === p.id
                      return (
                        <button key={p.id ?? 'everyone'} type="button" onClick={() => go({ member: p.id, who: 'all', memberOpen: false })}
                          className={`flex items-center justify-between gap-2 border-0 text-left whitespace-nowrap rounded-[8px] px-2.5 py-2 font-(family-name:--font-display) font-semibold text-[13px] ${on ? 'bg-tn-teal-soft text-tn-teal' : 'bg-transparent text-tn-ink hover:bg-subtle'}`}>
                          <span>{p.name}</span><span className="font-sans text-[11.5px] text-muted">{p.sub}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-end justify-between gap-2.5 border-b border-[var(--panel-border)]">
        <Tabs label="Views" className="-mb-px shadow-none" value={tabShown}
          items={([{ key: 'list', label: 'List' }, { key: 'grid', label: 'Week grid' }, { key: 'timeline', label: 'Day timeline' }] as const).filter(t => t.key === 'list' || views[t.key])}
          onChange={k => go({ tab: k, period: k === 'timeline' ? 'day' : k === 'grid' ? 'week' : ui.period, drag: null })} />
      </div>

      <div className="flex gap-5 items-start flex-wrap">
        <div className="flex-1 min-w-0 basis-[560px] flex flex-col gap-3">
          {tabShown === 'list' && (
            <EntriesList rows={shown} all={all} nowMs={nowMs} cols={ui.cols} setCols={cols => setUi(u => ({ ...u, cols }))}
              colsOpen={ui.colsOpen} setColsOpen={open => setUi(u => ({ ...u, colsOpen: open }))}
              collapsed={ui.collapsed} toggleDay={d => setUi(u => ({ ...u, collapsed: u.collapsed.includes(d) ? u.collapsed.filter(x => x !== d) : [...u.collapsed, d] }))}
              note={ui.attnOnly ? 'Showing only entries that need attention.' : all
                ? "Each person's times are in their own time zone; the zone shows when it differs from yours. Times round to the nearest 15 minutes."
                : `Times in your time zone (${zoneCity(viewer.zone)}), rounded to the nearest 15 minutes.`}
              emptyText={ui.attnOnly ? 'Nothing needs attention in this period.' : 'No time in this period.'}
              canAdd={addHere}
              onEdit={openRow} onHistory={r => setUi(u => ({ ...u, drawer: `${r.rowType === 'correction' ? 'c' : 'e'}${r.id}` }))} onContinue={r => void cont(r)}
              onDelete={r => setModal({ kind: 'delete', key: r.key })} onOpen={openRow} onAdd={() => openAdd()} />
          )}
          {tabShown === 'grid' && (
            <WeekGrid who={gridName} days={gridDays} today={today} model={grid} editable={canGrid} combos={gridChoices?.combinations ?? []}
              onOpenAdd={gridPicks2026 ? () => {
                // A failed read of their combinations is tried again when Add row opens.
                if (theirChoices?.error) setTheirChoices(null)
                setModal({ kind: 'grid-row' })
              } : undefined}
              addRowOpen={ui.addRowOpen} setAddRowOpen={open => setUi(u => ({ ...u, addRowOpen: open }))}
              onAddRow={s => setUi(u => ({ ...u, gExtra: [...u.gExtra, s], addRowOpen: false }))}
              onType={(k, text) => setUi(u => ({ ...u, gEdits: { ...u.gEdits, [k]: text } }))}
              onSave={() => {
                if (grid.error) return
                if (!gridChanges(grid, ui.gEdits).some(c => c.source.jobcodeId !== null)) return say('Nothing changed yet. Type the hours first.')
                setModal({ kind: 'grid-reason' })
              }} />
          )}
          {tabShown === 'timeline' && (
            <DayTimeline day={ui.anchor} today={today} rows={rows} all={all} viewer={me} teams={data.teams} canAdd={addHere}
              canChange={addsFor} combos={catalog.combinations} nowMs={nowMs}
              full={ui.tlFull} setFull={f => setUi(u => ({ ...u, tlFull: f }))}
              ghost={ui.ghost} setGhost={g => setUi(u => ({ ...u, ghost: g }))}
              drag={ui.drag} setDrag={d => setUi(u => ({ ...u, drag: d }))}
              onOpen={openRow}
              onCreate={(personId, start, end) => {
                const zone = rows.find(r => r.personId === personId)?.zone ?? viewer.zone
                openAdd({ personId, date: localDate(start, zone), start: localMinutes(start, zone), end: localMinutes(end, zone) })
              }}
              onMoved={(r, start, end) => setUi(u => ({ ...u, drag: null, modal: { kind: 'edit', form: { ...formFromRow(r), date: localDate(start, r.zone), start: localMinutes(start, r.zone), end: localMinutes(end, r.zone) } } }))}
              onUndo={() => setUi(u => ({ ...u, drag: null }))}
              onFix={fixOverlap} />
          )}
        </div>
        {/* The totals line is the first side block (owner, 9 November 2026). */}
        <SummaryAside totals={totals} attention={attention} onAttention={a => void openAttention(a)}
          title={totalsLabel(ui.period, ui.anchor, range.from, range.to, today)}
          // Their own week, the same week as the allowance: "of 40h" and a bar (a contractor's Weekly hours, plus extra hours approved).
          limit={ui.who === 'my' && viewer.allowance && range.from === viewer.allowance.from && range.to === viewer.allowance.to ? viewer.allowance.limit : null}
          attnOnly={ui.attnOnly} onAttnOnly={() => setUi(u => ({ ...u, attnOnly: !u.attnOnly, tab: 'list' }))} />
      </div>

      {modalView}
      {ui.drawer !== null && (
        <HistoryDrawer history={history?.key === ui.drawer ? history.data : null} error={history?.key === ui.drawer ? history.error : null}
          onClose={() => setUi(u => ({ ...u, drawer: null }))} />
      )}
      <Toast toast={toast} />
    </div>
  )
}
