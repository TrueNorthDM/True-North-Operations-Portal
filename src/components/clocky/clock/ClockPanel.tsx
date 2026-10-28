'use client'

/**
 * The clock panel (design handoff of 16 October 2026, SPEC section 6, Clock
 * Panel.dc.html): a 420px drawer from the right under the top bar on a
 * desktop, the whole screen on a phone. It holds what the person is doing in
 * the panel (choosing a job, the details, the switch gate, the windows) and
 * calls the server through the `api` it is handed; the data and the toast
 * belong to the top bar (ClockyClock.tsx), which also draws the button.
 */

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { UPDATED_TEXT, isStalePage } from '@/lib/ui/action-error'
import { useConfirm } from '@/components/ui/useConfirm'
import type { ClockChoice, ClockPanelData, Fail } from '@/lib/timeclock/clocky-types'
import { clockDay, type FieldName } from '@/lib/timeclock/entry-rules'
import type { ClockApi } from './clock-api'
import { choiceRow, choiceValues, draftFor, fieldByKey, liveAnnouncement, missingOf, panelHeader, runningJobOf, saveDraftFrom, topBarState, valueOf, type Draft, type SaveDraft } from './clock-model'
import { ClockDot, FOCUS, HeadButton, ICON, Icon, PlayIcon, StopIcon, byWidth, type Phone } from './ClockParts'
import { AutoView, ChooseView, DetailsView, ErrorBanner, OffView, OfflineBanner, OnView, SwitchBar, type NoteStatus } from './ClockViews'
import { ManageCombosModal, SaveComboModal } from './ComboModals'
import { BTN_ICON } from '@/lib/ui/buttons'

export type Gate = { kind: 'switch'; to: ClockChoice } | { kind: 'out' }

/** What the person is doing in the panel, over what the data says (off, on, auto). */
export interface PanelUi {
  /** 'switch': the first screen again, opened from Switch to while the clock runs. */
  view: 'base' | 'choose' | 'details' | 'switch'
  /** Choosing for a switch rather than a clock in. */
  ret: 'switch' | null
  /** Switching: what was picked on the first screen ('form', a combination 'c<id>', a recent 'r<i>'), waiting for Switch. */
  pick: { key: string; choice: ClockChoice } | null
  query: string
  /** The folder open in Browse; null for the top of the tree. */
  browse: number | null
  draft: Draft | null
  gate: Gate | null
  /** The field opened from its "+ Add" chip. */
  editKey: FieldName | null
  more: boolean
  modal: 'save' | 'manage' | null
  save: SaveDraft | null
  /** Closing the save window goes back to Manage. */
  back: boolean
  /** 1L: "I was still working until..." and the time picked. */
  later: boolean
  autoEnd: string | null
}

export const PANEL_UI: PanelUi = {
  view: 'base', ret: null, pick: null, query: '', browse: null, draft: null, gate: null, editKey: null, more: false,
  modal: null, save: null, back: false, later: false, autoEnd: null,
}

export interface Toast { text: string; undo?: number; error?: boolean }

const subscribeOnline = (cb: () => void) => {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}

/** A refusal from the server, or a request that never got there. */
const NETWORK: Fail = { ok: false, error: 'Not saved yet. Will retry when you are back online.' }

interface PanelProps {
  data: ClockPanelData | null
  loadError: string | null
  api: ClockApi
  nowMs: number
  phone: Phone
  /** Design check: drawn inside a frame, this far below its top, instead of fixed to the window. */
  frameTop?: number | string
  initialUi?: Partial<PanelUi>
  /** Design check: show 1N3 without unplugging anything. */
  forceOffline?: boolean
  onClose: () => void
  /** Read the panel again from the server. */
  refresh: () => Promise<void>
  /** Show a change before the server has it; returns the undo, for a refusal. Absent in design checks. */
  optimistic?: (patch: (d: ClockPanelData) => ClockPanelData) => () => void
  toast: (t: Toast | null) => void
  /** Where focus goes back on close. */
  closeRef?: React.RefObject<HTMLElement | null>
  /** Opened by Home's "Clock out": run the clock out at once, through its usual gate for missing fields. */
  startOut?: boolean
}

export function ClockPanel(props: PanelProps) {
  const { data, loadError, phone, frameTop, onClose, refresh, closeRef } = props
  // Fresh data whenever the panel opens; focus into it; focus back on close.
  const box = useRef<HTMLDivElement>(null)
  const refreshRef = useRef(refresh)
  useEffect(() => { refreshRef.current = refresh })
  useEffect(() => {
    void refreshRef.current()
    box.current?.focus({ preventScroll: true })
    const back = closeRef?.current
    return () => { back?.focus({ preventScroll: true }) }
  }, [closeRef])

  // Escape closes the window on top first, then the panel; never a dropdown's Escape.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('[role="listbox"], [role="alertdialog"], [aria-modal="true"]')) return
      onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  if (!data) {
    return (
      <Shell phone={phone} frameTop={frameTop} box={box} header={{ title: 'North Time', sub: '', dot: null, back: false }} onBack={() => {}} onClose={onClose} live="">
        <Body>{loadError ? <ErrorBanner text={loadError} /> : null}</Body>
      </Shell>
    )
  }
  return <PanelWithData {...props} data={data} box={box} />
}

function PanelWithData({ data, api, nowMs, phone, frameTop, initialUi, forceOffline, onClose, refresh, optimistic, toast, box, startOut }: PanelProps & {
  data: ClockPanelData
  box: React.RefObject<HTMLDivElement | null>
}) {
  const [ui, setUi] = useState<PanelUi>({ ...PANEL_UI, ...initialUi })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, confirm] = useConfirm()
  const set = (patch: Partial<PanelUi>) => setUi(u => ({ ...u, ...patch }))
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true)
  const offline = forceOffline || !online
  const contained = frameTop != null

  // The running entry's notes and fields as they are being typed, until the server has them.
  const running = data.running
  const [noteDraft, setNoteDraft] = useState<{ id: number; text: string } | null>(null)
  const [noteSt, setNoteSt] = useState<{ id: number; st: NoteStatus; error: string | null } | null>(null)
  const [overlay, setOverlay] = useState<{ id: number; values: Record<string, string> } | null>(null)
  const notes = running && noteDraft?.id === running.id ? noteDraft.text : running?.notes ?? ''
  const values = running ? { ...running.fields, ...(overlay?.id === running.id ? overlay.values : {}) } : {}
  const noteStatus = running && noteSt?.id === running.id ? noteSt.st : null
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (savedTimer.current) clearTimeout(savedTimer.current)
  }, [])

  const zone = data.me.zone
  const auto = data.toConfirm[0] ?? null
  // Everyone starts on the same first screen: combinations, choosing it yourself, Browse. (A first-time person has no combinations yet.)
  const base: 'off' | 'on' | 'auto' | 'choose' = auto ? 'auto' : running ? 'on' : 'off'
  const view = ui.view === 'switch' && base !== 'on' ? 'base' : ui.view
  const mode = base === 'auto' ? 'auto' : view !== 'base' && !(view === 'details' && !ui.draft) ? view : base
  const first = data.firstTime && ui.ret !== 'switch'
  const header = panelHeader(mode, { data, nowMs, switching: ui.ret === 'switch', first })
  const runningJob = running ? runningJobOf(data.jobs, running) : null
  const missing = running ? missingOf(values, notes, data.fields, runningJob) : []

  // ── Calls ─────────────────────────────────────────────────────────────────

  /** Run one call; a refusal shows its sentence, a stopped clock reloads into 1L (at the allowance, with its sentence). */
  async function run<T extends { ok: boolean }>(call: () => Promise<T>, then?: (r: Extract<T, { ok: true }>) => void | Promise<void>): Promise<T | Fail> {
    setBusy(true)
    setError(null)
    let res: T | Fail
    try { res = await call() } catch (e) { res = isStalePage(e) ? { ok: false, error: UPDATED_TEXT } : NETWORK }
    if (res.ok) await then?.(res as Extract<T, { ok: true }>)
    else {
      const f = res as Fail
      if (f.stopped) { set({ ...PANEL_UI }); await refresh(); if (f.allowance) setError(f.error) }
      else if (!f.missing) setError(f.error)
    }
    setBusy(false)
    return res
  }

  const finish = () => {
    const f: { fields?: Record<string, string>; notes?: string } = {}
    if (overlay && running && overlay.id === running.id) f.fields = overlay.values
    if (running && notes !== (running.notes ?? '')) f.notes = notes
    return Object.keys(f).length ? f : undefined
  }

  const startWith = (c: { jobcodeId: number; fields: Record<string, string>; notes: string; label?: string }) => {
    if (data.locked) { set({ ...PANEL_UI }); setError(null); return }
    // The timer starts on the click (owner, 25 October 2026); the server's answer then
    // fills in the rest (the quarter-hour start, the safety window), or takes it back.
    const job = data.jobs.find(j => j.id === c.jobcodeId)
    const at = new Date().toISOString()
    const undo = optimistic?.(d => ({
      ...d, now: at,
      running: {
        id: -1, jobcodeId: c.jobcodeId, path: job?.path ?? '', short: job?.short ?? '', label: c.label || job?.short || '', isI7: !!job?.isI7,
        fields: c.fields, notes: c.notes, startedAt: at, startedAtReal: at, sessionStartedAt: at, windowStartedAt: at,
        recordedSeconds: 0, roundNote: null, missing: [], imported: false,
      },
    }))
    set({ ...PANEL_UI })
    void run(() => api.clockIn({ jobcodeId: c.jobcodeId, fields: c.fields, notes: c.notes }), async () => {
      await refresh()
    }).then(r => { if (!r.ok) undo?.() })
  }

  const switchTo = (c: { jobcodeId: number; fields: Record<string, string>; notes: string; label?: string }, to: ClockChoice) => {
    if (missing.length) { set({ gate: { kind: 'switch', to }, view: 'base', query: '', browse: null, draft: null, ret: null }); return }
    void run(() => api.switchTo({ jobcodeId: c.jobcodeId, fields: c.fields, notes: c.notes, finish: finish() }), async r => {
      toast({ text: r.toast })
      set({ ...PANEL_UI })
      await refresh()
    }).then(r => { if (!r.ok && (r as Fail).missing) set({ gate: { kind: 'switch', to }, view: 'base' }) })
  }

  const clockOut = () => {
    if (missing.length) { set({ gate: { kind: 'out' } }); return }
    void run(() => api.clockOut({ finish: finish() }), async r => {
      toast({ text: r.toast, undo: r.entryId })
      set({ ...PANEL_UI })
      await refresh()
    }).then(r => { if (!r.ok && (r as Fail).missing) set({ gate: { kind: 'out' } }) })
  }

  // Home's banner asked for the clock out: once, when the panel opens on a running clock.
  const outAsked = useRef(false)
  const clockOutRef = useRef(clockOut)
  useEffect(() => { clockOutRef.current = clockOut })
  useEffect(() => {
    if (!startOut || outAsked.current || !running) return
    outAsked.current = true
    clockOutRef.current()
  }, [startOut, running])

  const gateGo = () => {
    const g = ui.gate
    if (!g || missing.length) return
    if (g.kind === 'out') {
      void run(() => api.clockOut({ finish: finish() }), async r => {
        toast({ text: r.toast, undo: r.entryId })
        set({ ...PANEL_UI })
        await refresh()
      })
    } else {
      void run(() => api.switchTo({ jobcodeId: g.to.jobcodeId, fields: g.to.fields, notes: g.to.notes, finish: finish() }), async r => {
        toast({ text: r.toast })
        set({ ...PANEL_UI })
        await refresh()
      })
    }
  }

  // The running entry's note saves on Save note, on Enter and on leaving the field; not
  // while typing, so the box does not turn into text mid-sentence. An unsaved note still
  // goes with Clock out and Switch (finish).
  const commitNotes = async (text = notes) => {
    if (!running) return
    const id = running.id
    setNoteSt({ id, st: 'saving', error: null })
    let res: { ok: boolean; error?: string }
    try { res = await api.saveRunningDetails({ notes: text }) } catch (e) { res = isStalePage(e) ? { ok: false, error: UPDATED_TEXT } : NETWORK }
    if (res.ok) {
      setNoteSt({ id, st: 'saved', error: null })
      if (savedTimer.current) clearTimeout(savedTimer.current)
      savedTimer.current = setTimeout(() => setNoteSt(s => (s?.id === id && s.st === 'saved' ? null : s)), 3000)
    } else {
      setNoteSt({ id, st: 'failed', error: res === NETWORK || !navigator.onLine ? null : res.error ?? null })
    }
  }
  const onNotes = (text: string) => {
    if (!running) return
    setNoteDraft({ id: running.id, text })
    setNoteSt({ id: running.id, st: 'typing', error: null })
  }
  const onNotesBlur = () => { if (noteStatus === 'typing') void commitNotes() }

  // Back online: the notes that could not be saved go now.
  const retry = useRef<() => void>(() => {})
  useEffect(() => { retry.current = () => { if (noteStatus === 'failed') void commitNotes() } })
  useEffect(() => {
    const on = () => retry.current()
    window.addEventListener('online', on)
    return () => window.removeEventListener('online', on)
  }, [])

  const onField = (k: FieldName, v: string, from: 'edit' | 'gate') => {
    if (!running) return
    const f = fieldByKey(data.fields, k, runningJob)
    if (!f) return
    const next = { ...(overlay?.id === running.id ? overlay.values : {}), [f.id]: v }
    setOverlay({ id: running.id, values: next })
    if (from === 'edit') {
      set({ editKey: null })
      void api.saveRunningDetails({ fields: { [f.id]: v } }).then(r => { if (!r.ok) setError(r.error) }, () => setError(NETWORK.error))
    }
  }

  const openSave = (src: { jobId: number; values: Record<string, string>; notes: string; name?: string | null; editing?: number | null }, back = false) =>
    { setError(null); set({ modal: 'save', save: saveDraftFrom(data, src), back }) }

  const saveCombo = () => {
    const s = ui.save
    if (!s || !s.name.trim()) return
    const job = data.jobs.find(j => j.id === s.jobId)
    const input = { name: s.name, jobcodeId: s.jobId, fields: choiceValues(s.values, data.fields, job), notes: s.notes }
    void run(() => (s.editing ? api.updateCombination({ ...input, id: s.editing }) : api.createCombination(input)), async r => {
      toast({ text: r.toast })
      set({ modal: ui.back ? 'manage' : null, save: null, back: false })
      await refresh()
    })
  }

  const deleteCombo = async (c: ClockChoice) => {
    const yes = await confirm({
      title: 'Delete this combination?',
      body: `${c.name}: ${c.path} · ${c.activity}. Entries you already recorded with it keep their hours.`,
      action: 'Delete',
      danger: true,
    })
    if (!yes || c.combinationId == null) return
    const id = c.combinationId
    await run(() => api.deleteCombination({ id }), async r => { toast({ text: r.toast }); await refresh() })
  }

  const goBack = () => {
    if (mode === 'details') set({ view: 'choose', draft: null })
    else if (mode === 'choose') set(ui.ret === 'switch' ? { view: 'switch', query: '', browse: null } : { view: 'base', query: '', browse: null, ret: null })
    else if (mode === 'switch') set({ view: 'base', pick: null, more: false })
  }

  const pickJob = (jobId: number) => {
    const job = data.jobs.find(j => j.id === jobId)
    if (job) set({ view: 'details', draft: draftFor(data, job), query: '', browse: null })
  }

  const setDraftField = (k: FieldName, v: string) => {
    const f = fieldByKey(data.fields, k, data.jobs.find(j => j.id === ui.draft?.jobId))
    if (!f || !ui.draft) return
    set({ draft: { ...ui.draft, values: { ...ui.draft.values, [f.id]: v }, auto: { ...ui.draft.auto, [k]: false } } })
  }

  const detailsGo = () => { if (ui.draft) goWith(ui.draft) }
  const choiceOf = (d: Draft): ClockChoice => {
    const job = data.jobs.find(j => j.id === d.jobId)
    const fields = choiceValues(d.values, data.fields, job)
    return { combinationId: null, name: null, jobcodeId: d.jobId, path: job?.path ?? '', short: job?.short ?? '', isI7: !!job?.isI7, fields, notes: d.notes, label: job?.short ?? '', activity: valueOf(d.values, data.fields, 'activity'), billable: job?.structure === 2 ? (job.billable ? 'yes' : 'no') : valueOf(d.values, data.fields, 'billable') }
  }
  const goWith = (d: Draft) => {
    const to = choiceOf(d)
    if (ui.ret === 'switch' && running) switchTo(to, to)
    else startWith(to)
  }

  // Switch to: the first screen marks a choice; the bar on top makes the switch.
  const openSwitch = () => set({ view: 'switch', pick: null, more: false, ret: 'switch', draft: null })
  const pickRow = (key: string, c: ClockChoice) => set({ pick: ui.pick?.key === key ? null : { key, choice: c } })
  const pickForm = (d: Draft | null) => setUi(u => (d ? { ...u, pick: { key: 'form', choice: choiceOf(d) } } : u.pick?.key === 'form' ? { ...u, pick: null } : u))
  const switchGo = () => { if (ui.pick) switchTo(ui.pick.choice, ui.pick.choice) }
  const pickedRow = ui.pick ? choiceRow(ui.pick.choice, ui.pick.key.startsWith('c')) : null

  // 1L
  const autoEnd = auto ? ui.autoEnd ?? (ui.later ? auto.laterOptions[0] : auto.options[0]) ?? '' : ''
  const confirmEnd = (keep: boolean) => {
    if (!auto) return
    const end = keep ? auto.stoppedAt : autoEnd
    const stillWorking = !keep && ui.later
    void run(() => api.confirmEnd({ entryId: auto.entryId, end, stillWorking }), async r => {
      toast({ text: r.toast })
      set({ ...PANEL_UI })
      await refresh()
    })
  }

  const gateLabel = ui.gate?.kind === 'switch' ? ui.gate.to.label : ''
  const isOffLike = mode === 'off' || mode === 'choose' || mode === 'details'
  const lockedLine = data.locked && isOffLike ? data.locked : null
  // Off the clock the footer holds only the phone's Resume ("Request time off" is
  // out until it has a form, owner 20 October 2026); on a desktop it is not drawn.
  const offFooter = mode === 'off' && phone !== false && !!data.resume
  const footer = mode === 'on' || offFooter

  return (
    <>
    <Shell phone={phone} frameTop={frameTop} box={box} header={header} onBack={goBack} onClose={onClose} live={liveAnnouncement(topBarState(data, nowMs).kind)}>
      <Body>
        {offline && <OfflineBanner />}
        {lockedLine && <ErrorBanner text={lockedLine} />}
        {error && error !== lockedLine && <ErrorBanner text={error} />}

        {mode === 'switch' && running && (
          <>
            <SwitchBar now={[running.label || running.short, valueOf(values, data.fields, 'activity')].filter(Boolean).join(' · ')} picked={pickedRow} busy={busy}
              onCancel={goBack} onSwitch={switchGo} />
            <OffView data={data} phone={phone} more={ui.more} busy={busy} draft={ui.draft}
              switching={{ picked: ui.pick?.key ?? null, jobcodeId: running.jobcodeId, activity: valueOf(values, data.fields, 'activity') }}
              onFormPick={pickForm}
              onPickProject={id => { const job = data.jobs.find(j => j.id === id); if (job) set({ draft: draftFor(data, job) }) }}
              onField={setDraftField}
              onNotes={v => ui.draft && set({ draft: { ...ui.draft, notes: v } })}
              onGo={detailsGo}
              onSaveDraft={() => ui.draft && openSave({ jobId: ui.draft.jobId, values: ui.draft.values, notes: ui.draft.notes })}
              onResume={() => {}} onClockIn={() => {}}
              onToggleMore={() => set({ more: !ui.more })}
              onStart={(c, key) => pickRow(key, c)}
              onSave={c => openSave({ jobId: c.jobcodeId, values: c.fields, notes: c.notes })}
              onManage={() => { setError(null); set({ modal: 'manage' }) }}
              onNew={() => openSave({ jobId: 0, values: {}, notes: '' })}
              onSaveAs={d => openSave({ jobId: d.jobId, values: d.values, notes: d.notes })}
              onBrowse={() => set({ view: 'choose', browse: null, query: '', draft: null, ret: 'switch' })} />
          </>
        )}

        {mode === 'off' && (
          <OffView data={data} phone={phone} more={ui.more} busy={busy || !!lockedLine} draft={ui.draft}
            onPickProject={id => { const job = data.jobs.find(j => j.id === id); if (job) set({ draft: draftFor(data, job) }) }}
            onField={setDraftField}
            onNotes={v => ui.draft && set({ draft: { ...ui.draft, notes: v } })}
            onGo={detailsGo}
            onSaveDraft={() => ui.draft && openSave({ jobId: ui.draft.jobId, values: ui.draft.values, notes: ui.draft.notes })}
            onToggleMore={() => set({ more: !ui.more })}
            onResume={() => data.resume && startWith(data.resume)}
            onStart={c => startWith(c)}
            onSave={c => openSave({ jobId: c.jobcodeId, values: c.fields, notes: c.notes })}
            onManage={() => { setError(null); set({ modal: 'manage' }) }}
            onNew={() => openSave({ jobId: 0, values: {}, notes: '' })}
            onClockIn={goWith}
            onSaveAs={d => openSave({ jobId: d.jobId, values: d.values, notes: d.notes })}
            onBrowse={() => set({ view: 'choose', browse: null, query: '', draft: null })} />
        )}

        {mode === 'choose' && (
          <ChooseView data={data} day={clockDay(new Date(nowMs), data.me.zone)} phone={phone} first={first} query={ui.query} browse={ui.browse}
            onQuery={q => set({ query: q })}
            onBrowse={id => set({ browse: id })}
            onPick={pickJob} />
        )}

        {mode === 'details' && ui.draft && (
          <DetailsView data={data} draft={ui.draft} switching={ui.ret === 'switch'} busy={busy || !!lockedLine}
            onChangeJob={() => set({ view: 'choose', draft: null })}
            onField={setDraftField}
            onNotes={v => ui.draft && set({ draft: { ...ui.draft, notes: v } })}
            onGo={detailsGo}
            onSave={() => ui.draft && openSave({ jobId: ui.draft.jobId, values: ui.draft.values, notes: ui.draft.notes })}
            onCancel={goBack} />
        )}

        {mode === 'on' && running && (
          <OnView data={data} running={running} values={values} nowMs={nowMs} phone={phone} busy={busy}
            editKey={ui.editKey} gate={ui.gate} gateLabel={gateLabel} missing={missing}
            notes={notes} noteStatus={noteStatus} noteError={noteSt?.error ?? null}
            onKeepGoing={() => void run(() => api.keepGoing(), async r => { toast({ text: r.toast }); await refresh() })}
            onClockOut={clockOut}
            onEditKey={k => set({ editKey: ui.editKey === k ? null : k })}
            onField={onField}
            onNotes={onNotes}
            onNotesCommit={onNotesBlur}
            onGateGo={gateGo}
            onGateCancel={() => set({ gate: null })}
            onOpenSwitch={openSwitch} />
        )}

        {mode === 'auto' && auto && (
          <AutoView item={auto} zone={zone} later={ui.later} end={autoEnd} busy={busy}
            onLater={() => set({ later: !ui.later, autoEnd: null })}
            onEnd={iso => set({ autoEnd: iso })}
            onKeep={() => confirmEnd(true)}
            onConfirm={() => confirmEnd(false)} />
        )}
      </Body>

      {footer && (
        <div className={`${mode === 'off' && phone === 'css' ? 'md:hidden ' : ''}shrink-0 border-t border-[var(--row-rule)] flex flex-col gap-2.5 bg-white ${byWidth(phone, 'pt-3.5 px-4 pb-[30px]', 'py-3.5 px-[18px]', 'pt-3.5 px-4 pb-[30px] md:py-3.5 md:px-[18px]')}`}>
          {mode === 'off' && (
            <>
              {phone !== false && data.resume && (
                <button type="button" onClick={() => data.resume && startWith(data.resume)} disabled={busy || !!lockedLine}
                  className={`${phone === 'css' ? 'md:hidden ' : ''}w-full h-[58px] flex items-center justify-center gap-[9px] border-0 rounded-[12px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[15px] cursor-pointer shadow-[0_8px_18px_-8px_rgba(1,35,88,.55)] disabled:opacity-60 ${FOCUS}`}>
                  <PlayIcon size={15} color={BTN_ICON.navy} />{`Clock in · ${data.resume.name || data.resume.path}`}
                </button>
              )}
            </>
          )}
          {mode === 'on' && (
            <div className="flex gap-2.5">
              <button type="button" onClick={clockOut} disabled={busy}
                className={`flex-1 flex items-center justify-center gap-[9px] border-0 rounded-[12px] bg-[#c8323d] text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[15px] cursor-pointer shadow-[0_8px_18px_-8px_rgba(200,50,61,.6)] hover:bg-[#b02a34] disabled:opacity-60 ${FOCUS} ${byWidth(phone, 'h-[58px]', 'h-[46px]', 'h-[58px] md:h-[46px]')}`}>
                <StopIcon size={14} color="#ffffff" />Clock out
              </button>
            </div>
          )}
        </div>
      )}

    </Shell>
      {/* Over the whole window (or the design check's frame), not only the panel. */}
      {ui.modal === 'save' && ui.save && (
        <SaveComboModal data={data} save={ui.save} busy={busy} error={error} contained={contained}
          onChange={s => set({ save: s })}
          onClose={() => { setError(null); set({ modal: ui.back ? 'manage' : null, save: null, back: false }) }}
          onSave={saveCombo} />
      )}
      {ui.modal === 'manage' && (
        <ManageCombosModal combinations={data.combinations} busy={busy} error={error} contained={contained}
          onReorder={ids => run(() => api.reorderCombinations({ ids }), async () => { await refresh() }).then(r => r.ok)}
          onEdit={c => openSave({ jobId: c.jobcodeId, values: c.fields, notes: c.notes, name: c.name, editing: c.combinationId }, true)}
          onDelete={c => void deleteCombo(c)}
          onClose={() => { setError(null); set({ modal: null }) }} />
      )}
      {confirmDialog}
    </>
  )
}

// ── The drawer ──────────────────────────────────────────────────────────────

function Shell({ phone, frameTop, box, header, onBack, onClose, live, children }: {
  phone: Phone
  frameTop?: number | string
  box: React.RefObject<HTMLDivElement | null>
  header: { title: string; sub: string; dot: 'green' | 'red' | null; back: boolean }
  onBack: () => void
  onClose: () => void
  live: string
  children: React.ReactNode
}) {
  const contained = frameTop != null
  // In the app the place follows the window width in CSS (full screen under
  // 768px, the 420px drawer, plus its 1px edge, from md up), so a phone gets the full-screen sheet
  // from the first paint instead of the drawer first and the sheet once the
  // width is read in the browser.
  const place = !contained
    ? 'fixed inset-0 z-[45] md:left-auto md:top-[var(--chrome-top)] md:w-[421px] md:max-w-full md:border-l md:border-[var(--panel-border)] md:shadow-[-24px_0_50px_-24px_rgba(1,35,88,.35)] md:z-[35]'
    : phone
      ? 'absolute left-0 right-0 bottom-0 z-[45]'
      : 'absolute right-0 bottom-0 w-[421px] max-w-full border-l border-[var(--panel-border)] shadow-[-24px_0_50px_-24px_rgba(1,35,88,.35)] z-[35]'
  return (
    <div ref={box} role="dialog" aria-label="North Time" tabIndex={-1} style={contained ? { top: frameTop } : undefined}
      className={`${place} bg-white flex flex-col outline-none leading-[normal]`}>
      <div className="shrink-0 flex items-start gap-2 pt-4 pr-3.5 pb-3.5 pl-[18px] border-b border-[var(--row-rule)]">
        {header.back && (
          <button type="button" onClick={onBack} aria-label="Back"
            className={`shrink-0 w-[30px] h-[30px] -mt-[3px] -ml-2 border-0 bg-transparent rounded-[8px] cursor-pointer text-tn-ink flex items-center justify-center hover:bg-subtle ${FOCUS}`}>
            <Icon d={ICON.back} size={18} sw={2.2} />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[9px]">
            {header.dot && <ClockDot color={header.dot === 'red' ? '#c8323d' : '#1E9E6A'} pulse={header.dot === 'green'} />}
            <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink tabular-nums lining-nums">{header.title}</span>
          </div>
          <div className="text-[12.5px] text-muted mt-1 tabular-nums lining-nums">{header.sub}</div>
        </div>
        <HeadButton label="Close" onClick={onClose}><Icon d={ICON.close} size={17} sw={2.2} join={null} /></HeadButton>
      </div>
      <div aria-live="polite" className="sr-only">{live}</div>
      {children}
    </div>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 min-h-0 overflow-auto px-[18px] pt-4 pb-5 flex flex-col gap-[18px]">{children}</div>
}
