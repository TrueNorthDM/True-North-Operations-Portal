'use client'

/**
 * The New event drawer (owner, 30 October 2026; the approved mockup "Agenda
 * Google Calendar", section 1): a right-side drawer, half the screen, below the
 * top bar; full screen on a phone. Big title, Type and When, the date and time
 * in Washington DC with the person's own time beside it, Online or In person,
 * Who it's for (Guests, Teams or True North, everyone invited for real), a
 * description, and Send from (the creator's own Google account). "Find a time"
 * opens the panel beside it (FindTimePanel).
 */

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Icon, Modal, MODAL_TITLE } from '@/components/clocky/entries/ui'
import { Select } from '@/components/ui/Select'
import { failText } from '@/lib/ui/action-error'
import type { DrawerSetup } from '@/lib/agenda/drawer-data'
import type { DrawerEdit } from '@/lib/agenda/model'
import { typeOf, type Audience, type DrawerInput, type EventType, type When } from '@/lib/agenda/event-rules'
import { clockLabel, DC, instantOf, localOf } from '@/lib/agenda/time'
import { FindTimePanel, type FindTimeApi } from './FindTimePanel'

type Done = { ok: true; toast: string } | { ok: false; error: string }
export interface DrawerApi {
  create(i: DrawerInput): Promise<Done>
  update(i: DrawerInput & { id: number }): Promise<Done>
  remove(i: { id: number }): Promise<Done>
  findTime: FindTimeApi
}

export const TYPE_ICON: Record<EventType, string> = {
  meeting: 'M3 6h12v12H3zM15 10l6-4v12l-6-4',
  training: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5',
  deadline: 'M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM12 9v4l2 2M5 3L2 6M19 3l3 3',
  milestone: 'M4 22V4M4 4h13l-2 4 2 4H4',
  company: 'M4 5h16v16H4zM4 10h16M9 3v4M15 3v4',
  celebration: 'M5.8 11.3L2 22l10.7-3.8M11 13c1.9 1.9 2.8 4.2 2 5s-3.1-.1-5-2-2.8-4.2-2-5 3.1.1 5 2zM15 2h.01M22 8h.01M22 20h.01M4 3h.01',
}
const TYPE_TILE: Record<EventType, [string, string]> = {
  meeting: ['#e8edf6', '#012358'], training: ['#efe9fb', '#5b3fb0'], deadline: ['#fdecea', '#b2412f'],
  milestone: ['#e6f6ee', '#0d7a4f'], company: ['#012358', '#ffffff'], celebration: ['#fdf3c4', '#7a5c00'],
}

const LBL = 'font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.1em] uppercase text-muted'
const OPT = 'normal-case tracking-normal font-sans font-semibold'
const INPUT = 'h-11 box-border px-3.5 border border-[var(--panel-border)] rounded-[12px] font-sans text-[14px] text-tn-ink bg-white outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]'
const SEG = 'inline-flex flex-wrap border border-[var(--panel-border)] rounded-[14px] p-1 gap-0.5 bg-white'
const SEG_BTN = 'border-0 rounded-[10px] px-3.5 py-2 font-(family-name:--font-display) font-extrabold text-[13.5px] cursor-pointer'
const segOn = (on: boolean) => (on ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-tn-ink hover:bg-subtle')
const LINK = 'border-0 bg-transparent p-0 cursor-pointer font-bold text-[13.5px] text-tn-teal hover:underline'
const SELECT = 'h-11 px-3.5 bg-white border border-[var(--panel-border)] rounded-[12px] font-semibold text-[14px] tabular-nums'
const TIMES = Array.from({ length: 48 }, (_, i) => i * 30).map(m => ({ value: String(m), label: clockLabel(m) }))
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const fdate = (iso: string, year = false) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(year ? { year: 'numeric' } : {}), timeZone: 'UTC' })
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)

interface Guest { personId: string | null; email: string }

function DayField({ label, value, min, onChange }: { label: string; value: string; min?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-2 min-w-0 flex-1 basis-[150px]">
      <span className={LBL}>{label}</span>
      <span className={`${INPUT} relative flex items-center justify-between`}>
        {fdate(value)}
        <Icon d="M6 9l6 6 6-6" size={14} color="#8593a4" width={2} />
        <input type="date" value={value} min={min} onChange={e => e.target.value && onChange(e.target.value)} aria-label={label}
          onClick={e => { try { e.currentTarget.showPicker() } catch { /* the browser opens it itself */ } }}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
      </span>
    </label>
  )
}

export function EventDrawer({ setup, editing, today, api, onClose, onDone }: {
  setup: DrawerSetup
  editing?: DrawerEdit | null
  today: string
  api: DrawerApi
  onClose: () => void
  onDone: (toast: string) => void
}) {
  const start = editing ?? null
  const firstType = start?.type ?? setup.types[0]
  const [title, setTitle] = useState(start?.title ?? '')
  const [type, setTypeRaw] = useState<EventType>(firstType)
  const [when, setWhen] = useState<When>(start?.when ?? typeOf(firstType).when)
  const [date, setDate] = useState(start?.date ?? today)
  const [end, setEnd] = useState(start?.end && start.end > (start?.date ?? today) ? start.end : addDays(start?.date ?? today, 2))
  const [from, setFrom] = useState(start?.from ?? 600)
  const [to, setTo] = useState(start?.to ?? 660)
  const [how, setHow] = useState<'online' | 'in_person'>(start?.how ?? 'online')
  const [place, setPlace] = useState(start?.place ?? '')
  const [audience, setAudience] = useState<Audience>(start?.audience && setup.audiences.includes(start.audience) ? start.audience : 'guests')
  const [teams, setTeams] = useState<string[]>(start?.teams ?? [])
  const [guests, setGuests] = useState<Guest[]>(start?.guests ?? [])
  const [also, setAlso] = useState(false)
  const [client, setClient] = useState(start?.client ?? '')
  const [desc, setDesc] = useState(start?.description ?? '')
  const [showDesc, setShowDesc] = useState(!!start?.description)
  const [account, setAccount] = useState<number | null>(start?.accountId ?? (setup.accounts.length === 1 ? setup.accounts[0].id : null))
  const [typeOpen, setTypeOpen] = useState(false)
  const [teamOpen, setTeamOpen] = useState(false)
  const [q, setQ] = useState('')
  const [gErr, setGErr] = useState('')
  const [fromErr, setFromErr] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [finding, setFinding] = useState(false)
  const [asking, setAsking] = useState(false)

  const t = typeOf(type)
  const word = t.label.toLowerCase()
  const setType = (x: EventType) => { setTypeRaw(x); setWhen(typeOf(x).when); setTypeOpen(false) }
  const nameOf = useMemo(() => new Map(setup.people.map(p => [p.personId, p.name])), [setup.people])
  const teamPeople = (ids: string[]) => setup.people.filter(p => p.teamIds.some(x => ids.includes(x)))
  const covered = (g: Guest) => !!g.personId && (audience === 'all' || (audience === 'teams' && teamPeople(teams).some(p => p.personId === g.personId)))
  const shownGuests = guests.filter(g => !covered(g))
  const base = audience === 'all' ? setup.allCount : audience === 'teams' ? new Set(teamPeople(teams).map(p => p.personId)).size : 0
  const count = base + shownGuests.length

  // Washington time, and the person's own beside it.
  const startMs = instantOf(date, from, DC), endMs = instantOf(date, to, DC)
  const mine = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: setup.me.zone })
  const myDay = localOf(startMs, setup.me.zone).date

  const suggestions = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    const out: { key: string; label: string; sub: string; tag: string; guest?: Guest; team?: string; disabled?: boolean }[] = []
    if (audience === 'teams') for (const tm of setup.teams) if (!teams.includes(tm.id) && tm.name.toLowerCase().includes(s)) out.push({ key: `t:${tm.id}`, label: `Everyone in ${tm.name}`, sub: `adds ${tm.count} people`, tag: 'Team', team: tm.id })
    for (const p of setup.people) {
      if (!(p.name.toLowerCase().split(/\s+/).some(w => w.startsWith(s)) || p.name.toLowerCase().startsWith(s) || p.emails.some(e => e.email.startsWith(s)))) continue
      for (const e of p.emails) {
        if (guests.some(g => g.email === e.email)) continue
        const inTeam = (audience === 'all' || (audience === 'teams' && p.teamIds.some(x => teams.includes(x)))) && e.tag === 'Work'
        out.push({ key: `p:${e.email}`, label: p.name, sub: e.email, tag: inTeam ? (audience === 'all' ? 'Already in True North' : 'Already in a team') : e.tag, guest: { personId: p.personId, email: e.email }, disabled: inTeam })
      }
    }
    if (EMAIL.test(s) && !setup.people.some(p => p.emails.some(e => e.email === s)) && !guests.some(g => g.email === s)) out.push({ key: `x:${s}`, label: `Invite ${s}`, sub: 'Not in the Directory', tag: 'External', guest: { personId: null, email: s } })
    return out.slice(0, 12)
  }, [q, setup, guests, audience, teams])

  const pick = (x: (typeof suggestions)[number]) => {
    if (x.disabled) return
    if (x.team) setTeams(ts => [...ts, x.team!])
    else if (x.guest) setGuests(gs => [...gs, x.guest!])
    setQ(''); setGErr('')
  }
  const addTyped = () => {
    const s = q.trim().toLowerCase()
    const first = suggestions.find(x => !x.disabled)
    if (first) { pick(first); return }
    if (s) setGErr(EMAIL.test(s) ? 'That email is already on the meeting.' : 'Type a name from the team, or a full email address.')
  }

  const input = (): DrawerInput => ({
    type, when, title, date, end: when === 'range' ? end : undefined, from: when === 'time' ? from : undefined, to: when === 'time' ? to : undefined,
    how, place, audience, teams: audience === 'teams' ? teams : [], guests, client, description: desc, accountId: account,
  })
  const save = async () => {
    if (!account) { setFromErr(true); return }
    setBusy(true); setError(null)
    try {
      const r = start ? await api.update({ ...input(), id: start.id }) : await api.create(input())
      if (r.ok) onDone(r.toast); else setError(r.error)
    } catch (e) { setError(failText(e)) } finally { setBusy(false) }
  }
  const remove = async () => {
    if (!start) return
    setBusy(true); setError(null)
    try { const r = await api.remove({ id: start.id }); if (r.ok) onDone(r.toast); else { setError(r.error); setAsking(false) } }
    catch (e) { setError(failText(e)) } finally { setBusy(false) }
  }

  const findIds = [...new Set([
    ...guests.filter(g => g.personId).map(g => g.personId as string),
    ...(audience === 'teams' ? teamPeople(teams).map(p => p.personId) : []),
    ...(audience === 'all' ? setup.people.map(p => p.personId) : []),
  ])]
  const externals = guests.filter(g => !g.personId).map(g => g.email)

  const typing = audience === 'guests' || also
  const tile = (x: EventType, attrs: { onClick?: () => void; on?: boolean; chev?: boolean; sub?: boolean }) => {
    const [bg, fg] = TYPE_TILE[x], T = typeOf(x)
    return (
      <button type="button" onClick={attrs.onClick} aria-pressed={attrs.on}
        className={`w-full flex items-center gap-2.5 text-left rounded-[12px] px-3 py-2 cursor-pointer bg-white ${attrs.on ? 'border-2 border-tn-primary bg-[#f5f7fb]' : 'border border-[var(--panel-border)] hover:border-[#b7c0cc]'}`}>
        <span className="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center flex-none" style={{ background: bg, color: fg }}><Icon d={TYPE_ICON[x]} size={15} width={2.2} /></span>
        <span className="flex-1 min-w-0 flex flex-col">
          <b className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{T.label}</b>
          {attrs.sub !== false && <small className="text-[11.5px] text-muted">{T.sub}</small>}
        </span>
        {attrs.chev && <Icon d="M6 9l6 6 6-6" size={14} color="#8593a4" width={2} />}
      </button>
    )
  }

  return createPortal(
    <>
      <div className="fixed left-0 right-0 bottom-0 top-[var(--chrome-top)] z-[60] bg-[rgba(1,35,88,.22)]" onMouseDown={onClose} />
      {finding && (
        <FindTimePanel api={api.findTime} personIds={findIds} externals={externals} names={nameOf} me={setup.me} date={date} from={from} to={to}
          onClose={() => setFinding(false)} onPick={(d, s) => { setWhen('time'); setDate(d); setTo(s + (to - from)); setFrom(s); setFinding(false) }} />
      )}
      <aside role="dialog" aria-modal="true" aria-label={start ? `Edit ${word}` : `New ${word}`}
        className="fixed right-0 bottom-0 top-[var(--chrome-top)] z-[61] w-full md:w-1/2 md:min-w-[520px] bg-white shadow-[-18px_0_40px_rgba(1,35,88,.18)] flex flex-col">
        <div className="flex-none flex items-center gap-3 px-5 md:px-7 pt-5 pb-3 bg-white">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Add a title" maxLength={160} aria-label="Title"
            className="flex-1 min-w-0 border-0 border-b-2 border-[var(--panel-border)] focus:border-tn-teal bg-transparent outline-none py-1.5 font-(family-name:--font-display) font-black text-[20px] text-tn-ink" />
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 border-0 bg-transparent rounded-[8px] text-muted text-[22px] leading-none cursor-pointer hover:bg-subtle">×</button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto [scrollbar-width:none] px-5 md:px-7 pb-6 flex flex-col gap-[22px]">
          <div className="flex flex-wrap gap-3.5 items-end">
            <div className="flex flex-col gap-2 flex-1 basis-[230px] relative">
              <span className={LBL}>Type</span>
              {setup.types.length === 1 ? tile(type, { sub: true }) : tile(type, { onClick: () => setTypeOpen(o => !o), chev: true, sub: true })}
              {typeOpen && (
                <div className="absolute top-[calc(100%+6px)] left-0 z-10 w-[min(480px,calc(100vw-48px))] bg-white border border-[var(--panel-border)] rounded-[14px] shadow-[0_14px_34px_rgba(1,35,88,.18)] p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {setup.types.map(x => <div key={x}>{tile(x, { onClick: () => setType(x), on: x === type })}</div>)}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className={LBL}>When</span>
              <div className={SEG} role="group" aria-label="When">
                {([['time', 'At a time'], ['day', 'All day'], ['range', 'A few days']] as const).map(([k, l]) => (
                  <button key={k} type="button" aria-pressed={when === k} onClick={() => setWhen(k)} className={`${SEG_BTN} ${segOn(when === k)}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap gap-3.5">
              <DayField label={when === 'range' ? 'First day' : 'Date'} value={date} onChange={v => { setDate(v); if (end < v) setEnd(addDays(v, 2)) }} />
              {when === 'range' && <DayField label="Last day" value={end} min={date} onChange={setEnd} />}
              {when === 'time' && <>
                <label className="flex flex-col gap-2 flex-1 basis-[150px] min-w-0"><span className={LBL}>From · Washington DC</span>
                  <Select value={String(from)} options={TIMES} fullWidth ariaLabel="From" className={SELECT}
                    onChange={v => { const n = Number(v), len = Math.max(to - from, 30); setFrom(n); setTo(Math.min(n + len, 1440)) }} /></label>
                <label className="flex flex-col gap-2 flex-1 basis-[150px] min-w-0"><span className={LBL}>To · Washington DC</span>
                  <Select value={String(to)} options={[...TIMES.slice(1), { value: '1440', label: '12:00 AM (midnight)' }]} fullWidth ariaLabel="To" className={SELECT}
                    onChange={v => { const n = Number(v); setTo(n); if (n <= from) setFrom(Math.max(n - 60, 0)) }} /></label>
              </>}
            </div>
            {when === 'time' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 bg-subtle rounded-[12px]">
                <div className="flex items-center gap-2.5 px-4 py-3 text-[13.5px] text-foreground leading-[1.45]">
                  <Icon d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2" size={17} color="#1E7D7F" width={2} />
                  <span>Every event is set in<br /><b className="text-tn-ink whitespace-nowrap">Washington DC time (ET)</b></span>
                </div>
                <div className="flex flex-col gap-0.5 px-4 py-3 border-t sm:border-t-0 sm:border-l border-[#e2ded3]">
                  <span className="text-[12px] text-muted font-bold">In your time zone</span>
                  <span className="text-[13.5px] text-foreground font-bold">{setup.me.zoneName}</span>
                  <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink tabular-nums mt-1">{mine(startMs)} to {mine(endMs)}</span>
                  <span className="text-[12.5px] text-foreground">{fdate(myDay)}</span>
                </div>
              </div>
            )}
            {when === 'time' && (
              <button type="button" className={`${LINK} self-start inline-flex items-center gap-1.5`} onClick={() => setFinding(true)}>
                <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" size={15} width={2.2} />Find a time when everyone is free
              </button>
            )}
          </div>

          {t.meet && (
            <div className="flex flex-wrap gap-3.5 items-end">
              <div className="flex flex-col gap-2">
                <span className={LBL}>How</span>
                <div className={SEG} role="group" aria-label="How">
                  {([['online', 'Online'], ['in_person', 'In person']] as const).map(([k, l]) => (
                    <button key={k} type="button" aria-pressed={how === k} onClick={() => setHow(k)} className={`${SEG_BTN} ${segOn(how === k)}`}>{l}</button>
                  ))}
                </div>
              </div>
              {how === 'online' && when === 'time' && (
                <div className="flex flex-col gap-2 flex-1 basis-[240px]">
                  <span className={LBL}>Video call</span>
                  <div className="h-11 flex items-center gap-2.5 px-3 rounded-[12px] bg-subtle text-[13.5px] text-foreground">
                    <span className="w-7 h-7 rounded-[8px] bg-white flex items-center justify-center"><Icon d={TYPE_ICON.meeting} size={16} color="#1E7D7F" width={2} /></span>
                    Google Meet link, created when you save
                  </div>
                </div>
              )}
              {how === 'in_person' && (
                <label className="flex flex-col gap-2 flex-1 basis-[240px]"><span className={LBL}>Place <span className={OPT}>(optional)</span></span>
                  <input value={place} onChange={e => setPlace(e.target.value)} placeholder="An address or a room" maxLength={300} className={INPUT} /></label>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center"><span className={LBL}>Who it&apos;s for</span>
              {count > 0 && <span className="ml-auto text-[12px] font-bold text-tn-teal">{count} invitation{count === 1 ? '' : 's'}</span>}</div>
            {setup.audiences.length > 1 && (
              <div className={`${SEG} self-start`} role="group" aria-label="Who it's for">
                {(['guests', 'teams', 'all'] as const).filter(a => setup.audiences.includes(a)).map(a => (
                  <button key={a} type="button" aria-pressed={audience === a} onClick={() => { setAudience(a); setAlso(false); setTeamOpen(a === 'teams' && !teams.length) }}
                    className={`${SEG_BTN} ${segOn(audience === a)}`}>{a === 'guests' ? 'Guests' : a === 'teams' ? 'Teams' : 'True North'}</button>
                ))}
              </div>
            )}
            {audience !== 'guests' && (
              <div className="relative flex flex-wrap gap-1.5 items-center">
                {audience === 'all'
                  ? <span className="inline-flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 bg-tn-primary text-[#ffffff] text-[13px] font-bold">Everyone at True North <small className="opacity-70 font-semibold">{setup.allCount} people</small></span>
                  : teams.map(id => { const tm = setup.teams.find(x => x.id === id); return tm && (
                    <button key={id} type="button" onClick={() => setTeams(ts => ts.filter(x => x !== id))}
                      className="inline-flex items-center gap-2 rounded-[8px] px-2.5 py-1.5 bg-subtle text-[13px] font-bold text-tn-ink border-0 cursor-pointer">
                      <i className="w-[9px] h-[9px] rounded-full inline-block" style={{ background: tm.color }} />{tm.name}<small className="text-muted font-semibold">{tm.count} people</small><span className="text-muted">×</span></button>) })}
                {audience === 'teams' && teams.length < setup.teams.length && (
                  <button type="button" className={`${LINK} px-2 py-1.5`} onClick={() => setTeamOpen(o => !o)}>+ Add a team</button>
                )}
                {audience === 'teams' && teamOpen && (
                  <div className="absolute top-[calc(100%+6px)] left-0 z-10 w-[min(440px,calc(100vw-48px))] bg-white border border-[var(--panel-border)] rounded-[14px] shadow-[0_14px_34px_rgba(1,35,88,.18)] p-1.5 grid grid-cols-1 sm:grid-cols-2 gap-0.5">
                    {setup.teams.map(tm => (
                      <label key={tm.id} className="flex items-center gap-2.5 px-2 py-2 rounded-[8px] text-[13.5px] font-bold text-tn-ink cursor-pointer hover:bg-subtle">
                        <input type="checkbox" checked={teams.includes(tm.id)} onChange={() => setTeams(ts => (ts.includes(tm.id) ? ts.filter(x => x !== tm.id) : [...ts, tm.id]))} />
                        <i className="w-[9px] h-[9px] rounded-full inline-block" style={{ background: tm.color }} />{tm.name}<small className="ml-auto text-muted font-semibold">{tm.count}</small>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            {(typing || shownGuests.length > 0) && <span className={`${LBL} mt-1`}>{audience === 'guests' ? 'Guests' : <>Also invite <span className={OPT}>(optional)</span></>}</span>}
            {(typing || shownGuests.length > 0) && (
              <div className={`flex flex-wrap gap-1.5 items-center ${typing ? 'border border-[var(--panel-border)] rounded-[12px] p-2 min-h-11' : ''}`}>
                {shownGuests.map(g => (
                  <button key={g.email} type="button" title={g.email} onClick={() => setGuests(gs => gs.filter(x => x.email !== g.email))}
                    className="inline-flex items-center gap-1.5 max-w-full rounded-[8px] px-2.5 py-1 bg-subtle text-[13px] font-semibold text-tn-ink border-0 cursor-pointer truncate">
                    {g.personId ? nameOf.get(g.personId) ?? g.email : g.email}<span className="text-muted">×</span></button>
                ))}
                {typing && (
                  <input value={q} onChange={e => { setQ(e.target.value); setGErr('') }} placeholder="Type a name or an email address" aria-label="Add a guest"
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTyped() } if (e.key === 'Backspace' && !q && guests.length) setGuests(gs => gs.slice(0, -1)) }}
                    className="flex-1 basis-[200px] min-w-0 border-0 outline-none bg-transparent text-[14px] text-tn-ink px-1.5 py-1" />
                )}
              </div>
            )}
            {typing && suggestions.length > 0 && (
              <div className="border border-[var(--panel-border)] rounded-[12px] shadow-[0_10px_26px_rgba(1,35,88,.12)] p-1.5 flex flex-col gap-0.5">
                {suggestions.map(x => (
                  <button key={x.key} type="button" disabled={x.disabled} onClick={() => pick(x)}
                    className="flex items-center gap-2.5 text-left px-2 py-1.5 rounded-[8px] border-0 bg-transparent cursor-pointer hover:bg-subtle disabled:opacity-50 disabled:cursor-default">
                    <span className="flex-1 min-w-0 flex flex-col"><b className="text-[13.5px] text-tn-ink">{x.label}</b><span className="text-[12px] text-muted truncate">{x.sub}</span></span>
                    <span className="text-[11px] font-extrabold rounded-[5px] px-1.5 py-px bg-subtle text-foreground flex-none">{x.tag}</span>
                  </button>
                ))}
              </div>
            )}
            {gErr && <span className="text-[12.5px] font-bold text-[#a85d00]">{gErr}</span>}
            {!typing && <button type="button" className={`${LINK} self-start`} onClick={() => setAlso(true)}>+ Also invite people</button>}
          </div>

          {t.client && (
            <label className="flex flex-col gap-2"><span className={LBL}>Client or project <span className={OPT}>(optional)</span></span>
              <Select value={client} options={[{ value: '', label: 'None' }, ...setup.clients.map(c => ({ value: c, label: c }))]} onChange={setClient} fullWidth searchable ariaLabel="Client or project" className={SELECT} /></label>
          )}

          {showDesc ? (
            <label className="flex flex-col gap-2"><span className={LBL}>Description <span className={OPT}>(optional)</span></span>
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} maxLength={2000} placeholder="Agenda, notes for the guests"
                className="w-full box-border resize-y px-3.5 py-2.5 border border-[var(--panel-border)] rounded-[12px] text-[14px] text-tn-ink bg-white outline-none focus:border-tn-teal" /></label>
          ) : <button type="button" className={`${LINK} self-start`} onClick={() => setShowDesc(true)}>+ Add a description</button>}

          <div className="flex flex-col gap-2">
            <span className={LBL}>Send from</span>
            {setup.accounts.length === 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-[#c9d0da] rounded-[12px] px-3.5 py-3 text-[13px] text-foreground">
                <span className="flex-1 basis-[220px]">You have no Google account connected yet. Connect one to send the invitations from it.</span>
                <Link href="/agenda/settings" className="inline-flex items-center rounded-[10px] px-3 py-2 bg-tn-teal text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px]">Connect a Google account</Link>
              </div>
            ) : (
              <Select value={account == null ? '' : String(account)} placeholder="Select account" options={setup.accounts.map(a => ({ value: String(a.id), label: `From ${a.email}` }))}
                onChange={v => { setAccount(v ? Number(v) : null); setFromErr(false) }} fullWidth ariaLabel="Send from"
                className={`${SELECT} ${fromErr ? '!border-[#d98c1f] shadow-[0_0_0_3px_rgba(217,140,31,.15)]' : ''}`} />
            )}
            {fromErr && <span className="text-[12.5px] font-bold text-[#a85d00]">Select the account to send the invitations from.</span>}
          </div>
          {error && <p role="alert" className="m-0 text-[13px] font-bold text-[#c8323d]">{error}</p>}
        </div>

        <div className="flex-none flex flex-wrap items-center gap-2.5 px-5 md:px-7 py-3.5 border-t border-[var(--panel-border)] bg-white">
          {start && <button type="button" disabled={busy} onClick={() => setAsking(true)} className="border border-slate-200 rounded-[12px] px-4 py-2.5 bg-white text-[#c8323d] font-(family-name:--font-display) font-extrabold text-[14px] cursor-pointer">Delete</button>}
          <span className="flex gap-2.5 ml-auto">
            <button type="button" onClick={onClose} className="border border-slate-200 rounded-[12px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[14px] cursor-pointer">Cancel</button>
            <button type="button" disabled={busy || setup.accounts.length === 0} onClick={() => void save()}
              className={`inline-flex items-center gap-2 border-0 rounded-[12px] px-5 py-2.5 font-(family-name:--font-display) font-extrabold text-[14px] text-[#ffffff] cursor-pointer disabled:opacity-50 ${account ? 'bg-tn-primary hover:bg-[#0a2f6b]' : 'bg-[#97a3b8]'}`}>
              <span className="text-[#F2C40A]">{start ? '✓' : '+'}</span>{start ? 'Save changes' : `Create ${word}`}
            </button>
          </span>
        </div>
      </aside>
      {asking && start && (
        <Modal label="Delete the event" width={420} alert onClose={() => setAsking(false)}>
          <h2 className={MODAL_TITLE}>Delete {title || 'this event'}?</h2>
          <p className="m-0 text-[13px] text-foreground leading-[1.5]">It leaves the Agenda, and everyone invited gets Google&apos;s cancellation.</p>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAsking(false)} className="border border-slate-200 rounded-[10px] px-4 py-2.5 bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer">Cancel</button>
            <button type="button" disabled={busy} onClick={() => void remove()} className="border-0 rounded-[10px] px-4 py-2.5 bg-[#c8323d] text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer">Delete</button>
          </div>
        </Modal>
      )}
    </>,
    document.body,
  )
}

