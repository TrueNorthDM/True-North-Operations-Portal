'use client'

/**
 * 8E (Agenda.dc.html): a new event or milestone. Super Admins and Admins pick
 * Event or Milestone and who sees it; a Team Leader makes an event for a team
 * they lead. "Add to the team Google Calendar" sends it there through the
 * outbox (it waits while Google Calendar is not connected).
 */

import { useState } from 'react'
import { BTN_ICON } from '@/lib/ui/buttons'
import { EVENT_ZONES } from '@/lib/agenda/zones'
import { fday, hourLabel } from '@/lib/agenda/model'
import { CloseButton, FieldLabel, Icon, LabeledSelect, Modal, MODAL_TITLE, TEXTAREA_PLAIN } from '@/components/clocky/entries/ui'
import type { NewEventInput } from '@/app/(app)/agenda/actions'

type Done = { ok: true; toast: string } | { ok: false; error: string }
export type CreateEvent = (i: NewEventInput) => Promise<Done>

export interface NewEventSetup {
  mode: 'company' | 'team'
  /** Every team (company), or the teams they lead (team). */
  teams: { id: string; name: string; color: string }[]
  clients: string[]
  /** The viewer's zone, the default. */
  zone: string
  today: string
  /** The second line of the Google Calendar switch. */
  calendar: string
  /** Design checks: the prototype's filled form. */
  sample?: Partial<Form>
}

interface Form {
  title: string; kind: 'event' | 'milestone'; when: 'time' | 'day' | 'range'; date: string; end: string
  from: string; to: string; zone: string; place: string; teams: string[]; client: string; desc: string; google: boolean
}

const INPUT = 'h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] text-tn-ink bg-white outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'
const SEG = 'flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5'
const SEG_BTN = 'border-0 cursor-pointer rounded-[8px] px-[13px] py-[7px] font-(family-name:--font-display) font-bold text-[12.5px] leading-[normal]'
const pill = (on: boolean) => (on ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground')

/** 7:00 AM to 6:30 PM, every half hour, as drawn. */
const TIMES = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].flatMap(h => [h, h + 0.5])
  .map(h => ({ value: `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`, label: hourLabel(h) }))
const EVERYONE = '__everyone'

/** A day field that reads "Fri, Dec 11, 2026" whatever the browser's language; the browser's own picker opens on it. */
function DayField({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-[5px] min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <span className={`${INPUT} relative flex items-center ${value ? '' : 'text-muted'}`}>
        {value ? `${fday(value)}, ${value.slice(0, 4)}` : 'Pick a day'}
        <input type="date" value={value} min={min} onChange={e => onChange(e.target.value)} aria-label={label}
          onClick={e => { try { e.currentTarget.showPicker() } catch { /* the browser opens it itself */ } }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </span>
    </label>
  )
}

export function NewEventDialog({ setup, api, onClose, onDone }: { setup: NewEventSetup; api: CreateEvent; onClose: () => void; onDone: (toast: string) => void }) {
  const lead = setup.mode === 'team'
  const [f, setF] = useState<Form>(() => ({
    title: '', kind: 'event', when: 'time', date: setup.today, end: '', from: '09:00', to: '10:00',
    zone: EVENT_ZONES.some(z => z.zone === setup.zone) ? setup.zone : EVENT_ZONES[0].zone,
    place: '', teams: lead && setup.teams[0] ? [setup.teams[0].id] : [], client: '', desc: '', google: true,
    ...setup.sample,
  }))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF(x => ({ ...x, [k]: v }))
  const ok = !!f.title.trim() && !!f.date
  const ms = f.kind === 'milestone'

  const toggleTeam = (id: string) => {
    if (lead) { set('teams', [id]); return }
    if (id === EVERYONE) { set('teams', []); return }
    setF(x => ({ ...x, teams: x.teams.includes(id) ? x.teams.filter(t => t !== id) : [...x.teams, id] }))
  }
  const chips = lead ? setup.teams.map(t => ({ id: t.id, label: t.name, sw: t.color, on: f.teams.includes(t.id) }))
    : [{ id: EVERYONE, label: 'Everyone', sw: '#012358', on: !f.teams.length }, ...setup.teams.map(t => ({ id: t.id, label: t.name, sw: t.color, on: f.teams.includes(t.id) }))]

  const submit = async () => {
    if (!ok || busy) return
    setBusy(true); setError(null)
    try {
      const r = await api({ kind: f.kind, when: f.when, title: f.title, date: f.date, end: f.end, from: f.from, to: f.to, zone: f.zone, place: f.place, teams: f.teams, client: f.client, description: f.desc, google: f.google })
      if (r.ok) onDone(r.toast)
      else setError(r.error)
    } catch {
      setError('That did not go through. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal label={ms ? 'New milestone' : 'New event'} width={596} onClose={onClose}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className={MODAL_TITLE}>{ms ? 'New milestone' : lead ? 'New team event' : 'New event'}</h2>
        <CloseButton onClick={onClose} />
      </div>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Title</FieldLabel>
        <input value={f.title} onChange={e => set('title', e.target.value)} placeholder="e.g. i7 site launch" maxLength={160} className={`${INPUT} text-[13.5px]`} />
      </label>
      <div className="flex gap-3.5 flex-wrap items-end">
        <div className="flex flex-col gap-1.5">
          <FieldLabel>Kind</FieldLabel>
          <div className={SEG} role="group" aria-label="Kind">
            {(lead ? [['event', 'Team event']] as const : [['event', 'Event'], ['milestone', 'Milestone']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={f.kind === k} onClick={() => set('kind', k)} className={`${SEG_BTN} ${pill(f.kind === k)}`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <FieldLabel>When</FieldLabel>
          <div className={SEG} role="group" aria-label="When">
            {([['time', 'At a time'], ['day', 'All day'], ['range', 'A few days']] as const).map(([k, l]) => (
              <button key={k} type="button" aria-pressed={f.when === k} onClick={() => set('when', k)} className={`${SEG_BTN} ${pill(f.when === k)}`}>{l}</button>
            ))}
          </div>
        </div>
      </div>
      {/* On a phone the date takes its own line, From and To side by side under it. */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className={`min-w-0 ${f.when === 'time' ? 'col-span-2 md:col-span-1' : ''}`}>
          <DayField label={f.when === 'range' ? 'First day' : 'Date'} value={f.date} onChange={v => set('date', v)} />
        </div>
        {f.when === 'time' && <>
          <LabeledSelect label="From" value={f.from} onChange={v => set('from', v)} options={TIMES} />
          <LabeledSelect label="To" value={f.to} onChange={v => set('to', v)} options={TIMES} />
        </>}
        {f.when === 'range' && (
          <DayField label="Last day" value={f.end} min={f.date} onChange={v => set('end', v)} />
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-3">
        <LabeledSelect label="Time zone" value={f.zone} onChange={v => set('zone', v)} options={EVENT_ZONES.map(z => ({ value: z.zone, label: z.label }))} />
        <label className="flex flex-col gap-[5px] min-w-0">
          <FieldLabel>Place or video link</FieldLabel>
          <input value={f.place} onChange={e => set('place', e.target.value)} placeholder="meet.google.com/… or an address" maxLength={300} className={INPUT} />
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <FieldLabel>Who sees it</FieldLabel>
        <div className="flex gap-1.5 flex-wrap">
          {chips.map(c => (
            <button key={c.id} type="button" aria-pressed={c.on} onClick={() => toggleTeam(c.id)}
              className={`inline-flex items-center gap-1.5 border rounded-full px-[11px] py-1.5 font-(family-name:--font-display) font-bold text-[12px] leading-[normal] ${lead ? 'cursor-default' : 'cursor-pointer'} ${c.on ? 'bg-tn-primary border-tn-primary text-[#ffffff]' : 'bg-white border-slate-200 text-foreground'}`}>
              <span className="w-2 h-2 rounded-full" style={{ background: c.sw }} />{c.label}
            </button>
          ))}
        </div>
      </div>
      {ms && (
        <LabeledSelect label="Client or project (optional)" value={f.client} onChange={v => set('client', v)} search
          options={[{ value: '', label: 'None' }, ...setup.clients.map(c => ({ value: c, label: c }))]} />
      )}
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Description</FieldLabel>
        <textarea value={f.desc} onChange={e => set('desc', e.target.value)} rows={2} maxLength={2000} className={TEXTAREA_PLAIN} />
      </label>
      <button type="button" role="switch" aria-checked={f.google} onClick={() => set('google', !f.google)}
        className="flex items-center gap-3 border border-[var(--panel-border)] rounded-[12px] px-[13px] py-[11px] bg-white cursor-pointer text-left leading-[normal]">
        <span className="w-9 h-5 rounded-full relative flex-none" style={{ background: f.google ? '#1E7D7F' : '#cbd2da' }}>
          <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_3px_rgba(1,35,88,.3)]" style={{ left: f.google ? 18 : 2 }} />
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Add to the team Google Calendar</span>
          <span className="text-[12px] text-muted">{setup.calendar}</span>
        </span>
      </button>
      {error && <p role="alert" className="m-0 text-[12.5px] font-semibold text-[#c8323d]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] leading-[normal] cursor-pointer hover:border-tn-teal">Cancel</button>
        <button type="button" disabled={!ok || busy} onClick={() => void submit()}
          className="inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] leading-[normal] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-45 disabled:cursor-not-allowed">
          <Icon d="M12 5v14M5 12h14" size={14} color={BTN_ICON.navy} width={3} />{ms ? 'Create milestone' : 'Create event'}
        </button>
      </div>
    </Modal>
  )
}
