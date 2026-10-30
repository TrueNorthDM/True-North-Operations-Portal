'use client'

/**
 * Find a time (owner, 30 October 2026; the approved mockup's panel): beside the
 * New event drawer on a computer, full screen over it on a phone. The month,
 * the week's days, the best times (everyone free, or the most people free and
 * who cannot), the next three times everyone is free when the day has none,
 * then a bar per person (five at most, then "+ N more"). Times in Washington
 * DC. Picking a time fills the drawer.
 */

import { useEffect, useMemo, useState } from 'react'
import { failText } from '@/lib/ui/action-error'
import { findDay, nextFree, WINDOW, type Avail } from '@/lib/agenda/find-time'
import { clockLabel, DC, instantOf } from '@/lib/agenda/time'

type Person = { id: string; name: string; place: string; avail: Avail }
export type FindTimeApi = (i: { personIds: string[]; from: string }) => Promise<{ ok: true; people: Person[] } | { ok: false; error: string }>

const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const dow = (d: string) => new Date(`${d}T12:00:00Z`).getUTCDay()
const monday = (d: string) => { const w = dow(d); return addDays(d, w === 0 ? 1 : w === 6 ? 2 : 1 - w) }
const month = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })
const LBL = 'font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.1em] uppercase text-muted'
const [LO, HI] = WINDOW
const pct = (m: number) => `${((Math.min(Math.max(m, LO), HI) - LO) / (HI - LO)) * 100}%`
const wid = (a: number, b: number) => `${((Math.min(b, HI) - Math.max(a, LO)) / (HI - LO)) * 100}%`

export function FindTimePanel({ api, personIds, externals, names, me, date, from, to, onClose, onPick }: {
  api: FindTimeApi
  personIds: string[]
  externals: string[]
  names: ReadonlyMap<string, string>
  me: { id: string; zone: string }
  date: string
  from: number
  to: number
  onClose: () => void
  onPick: (day: string, start: number) => void
}) {
  const dur = Math.max(to - from, 30)
  const [day, setDay] = useState(() => (dow(date) % 6 === 0 ? monday(date) : date))
  const [week, setWeek] = useState(() => monday(dow(date) % 6 === 0 ? monday(date) : date))
  const [people, setPeople] = useState<Person[] | null>(null)
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [who, setWho] = useState<number | null>(null)
  const key = personIds.join(',')

  // Five weeks from the week on screen, read again when the week leaves them or the people change.
  useEffect(() => {
    const needFrom = week
    if (loadedFrom && people && needFrom >= loadedFrom && needFrom <= addDays(loadedFrom, 7) && people.length === personIds.length + 1) return
    let live = true
    api({ personIds, from: needFrom })
      .then(r => { if (!live) return; if (r.ok) { setPeople(r.people); setLoadedFrom(needFrom); setError(null) } else setError(r.error) })
      .catch(e => { if (live) setError(failText(e)) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, key])

  const avail = useMemo(() => (people ?? []).map(p => p.avail), [people])
  const answer = useMemo(() => (people ? findDay(avail, day, dur) : null), [people, avail, day, dur])
  const next = useMemo(() => (people && answer && !answer.allFree.length ? nextFree(avail, day, dur) : []), [people, answer, avail, day, dur])
  const nameOf = (id: string) => (id === me.id ? 'You' : names.get(id) ?? people?.find(p => p.id === id)?.name ?? 'Someone')
  const yours = (d: string, s: number) => new Date(instantOf(d, s, DC)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: me.zone })
  const days = [0, 1, 2, 3, 4].map(i => addDays(week, i))
  const m0 = month(days[0]), m4 = month(days[4]), y0 = days[0].slice(0, 4), y4 = days[4].slice(0, 4)
  const title = m0 === m4 ? `${m0} ${y0}` : y0 === y4 ? `${m0} / ${m4} ${y4}` : `${m0} ${y0} / ${m4} ${y4}`
  const rows = answer?.rows ?? []
  const shown = rows.length > 5 ? rows.slice(0, 5) : rows
  const sel = date === day ? <div className="absolute top-0 bottom-0 border-2 border-tn-teal rounded-[6px] bg-[rgba(30,125,127,.12)]" style={{ left: pct(from), width: wid(from, to) }} /> : null
  const chip = (d: string, s: number, extra?: React.ReactNode, dayLabel?: string) => (
    <div key={`${d}:${s}`} className="min-w-0 overflow-hidden text-left border border-[var(--panel-border)] rounded-[10px] px-3.5 py-2.5 bg-white flex flex-col gap-[3px] hover:border-tn-teal hover:bg-[#f2f8f7]">
      <button type="button" onClick={() => onPick(d, s)} className="border-0 bg-transparent p-0 text-left cursor-pointer flex flex-col gap-[3px]">
        {dayLabel && <small className="text-[10.5px] font-extrabold uppercase tracking-[.04em] text-tn-teal">{dayLabel}</small>}
        <b className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{clockLabel(s)}</b>
        <small className="text-[11px] text-muted truncate">You: {yours(d, s)}</small>
      </button>
      {extra}
    </div>
  )

  return (
    <section aria-label="Find a time"
      className="fixed z-[62] bottom-0 top-[var(--chrome-top)] left-0 right-0 md:left-16 md:right-[max(50%,520px)] bg-white md:border-r border-[var(--panel-border)] overflow-y-auto [scrollbar-width:none] px-5 md:px-[30px] pt-[26px] pb-8 flex flex-col gap-[26px]">
      <div className="flex justify-between items-center">
        <b className="font-(family-name:--font-display) font-black text-[20px] text-tn-ink">Find a time</b>
        <button type="button" onClick={onClose} aria-label="Close Find a time" className="w-8 h-8 border-0 bg-transparent rounded-[8px] text-muted text-[22px] leading-none cursor-pointer hover:bg-subtle">×</button>
      </div>
      <p className="-mt-3.5 m-0 text-[12.5px] text-muted leading-[1.45]">Times in Washington DC (ET). Busy times come from everyone&apos;s connected Google accounts, their time off and the US holidays. You only see busy or free, never what the event is.</p>

      <div className="flex flex-col gap-2">
        <div className="text-center font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{title}</div>
        <div className="grid grid-cols-[auto_repeat(5,minmax(0,1fr))_auto] gap-1.5">
          <button type="button" aria-label="Week before" onClick={() => { const w = addDays(week, -7); setWeek(w); setDay(w); setWho(null) }} className="border-0 bg-transparent px-2 text-tn-teal text-[20px] cursor-pointer rounded-[8px] hover:bg-subtle">‹</button>
          {days.map(d => (
            <button key={d} type="button" onClick={() => { setDay(d); setWho(null) }}
              className={`border rounded-[10px] py-1.5 flex flex-col items-center min-w-0 cursor-pointer ${d === day ? 'bg-tn-primary border-tn-primary' : 'bg-white border-[var(--panel-border)]'}`}>
              <small className={`text-[10.5px] font-extrabold uppercase tracking-[.06em] ${d === day ? 'text-[#ffffff]' : 'text-muted'}`}>{new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</small>
              <b className={`font-(family-name:--font-display) font-black text-[17px] ${d === day ? 'text-[#ffffff]' : 'text-tn-ink'}`}>{Number(d.slice(8))}</b>
            </button>
          ))}
          <button type="button" aria-label="Week after" onClick={() => { const w = addDays(week, 7); setWeek(w); setDay(w); setWho(null) }} className="border-0 bg-transparent px-2 text-tn-teal text-[20px] cursor-pointer rounded-[8px] hover:bg-subtle">›</button>
        </div>
      </div>

      {error && <p role="alert" className="m-0 text-[13px] font-bold text-[#c8323d]">{error}</p>}
      {!answer && !error && <p className="m-0 text-[13px] text-muted">Reading everyone&apos;s free and busy times…</p>}

      {answer && (
        <div className="flex flex-col gap-3">
          {answer.allFree.length ? <>
            <span className={LBL}>Everyone is free at</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{answer.allFree.map(s => chip(day, s))}</div>
          </> : answer.best.length ? <>
            <span className={LBL}>Best times</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{answer.best.map(b => chip(day, b.start, <>
              <small className="text-[11px] font-bold text-[#a85d00]">{b.free} of {rows.length} free</small>
              <button type="button" onClick={() => setWho(who === b.start ? null : b.start)} className="border-0 bg-transparent p-0 text-left text-[11px] font-bold text-tn-teal underline decoration-dotted underline-offset-[3px] cursor-pointer">{who === b.start ? 'Hide' : 'Who can\'t?'}</button>
            </>))}</div>
            {who != null && (() => { const b = answer.best.find(x => x.start === who); return b && (
              <div className="border border-[var(--panel-border)] rounded-[12px] px-3.5 py-3 flex flex-col gap-2">
                <span className={LBL}>Not free at {clockLabel(who)}</span>
                {b.missing.map(m => (
                  <div key={m.id} className="flex items-center gap-3 text-[13px]">
                    <span className="flex-1 min-w-0 flex flex-col"><b className="text-tn-ink">{nameOf(m.id)}</b><small className="text-[11.5px] text-muted">{people?.find(p => p.id === m.id)?.place}</small></span>
                    <span className={`text-[11px] font-extrabold rounded-[6px] px-2 py-0.5 ${m.why === 'Busy' ? 'bg-[#e8edf6] text-tn-ink' : 'bg-subtle text-[#5b6b82]'}`}>{m.why}</span>
                  </div>
                ))}
              </div>) })()}
          </> : <span className="text-[13px] text-muted">No one is free on this day. Try another day.</span>}
        </div>
      )}

      {answer && !answer.allFree.length && (
        <div className="flex flex-col gap-2.5 bg-[#f2f8f7] border border-[#cfe6e2] rounded-[14px] p-3.5">
          <span className={`${LBL} !text-tn-teal`}>Next times everyone is free</span>
          {next.length
            ? <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{next.map(n => chip(n.day, n.start, null, new Date(`${n.day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })))}</div>
            : <span className="text-[13px] text-muted leading-[1.45]">No time works for everyone in the next 4 weeks. Pick one of the best times above, or invite fewer people.</span>}
        </div>
      )}

      {answer && (
        <div className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-x-3.5 gap-y-3.5 items-center">
          <div />
          <div className="relative h-4 -mb-1 text-[10.5px] font-bold text-muted">
            {[6, 9, 12, 15, 18].map(h => <span key={h} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: pct(h * 60) }}>{h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}</span>)}
          </div>
          <div className="min-w-0 text-[13px] font-bold text-tn-ink leading-[1.3]">Everyone free<small className="block text-[11px] font-semibold text-muted">{rows.length} people, {dur} min</small></div>
          <div className="relative h-[26px] rounded-[7px] bg-[#f2f4f7] overflow-hidden">
            {answer.allFree.map(s => <div key={s} className="absolute top-[3px] bottom-[3px] bg-[#bfe5d6] rounded-[5px]" style={{ left: pct(s), width: wid(s, s + dur) }} />)}
            {sel}
          </div>
          {shown.map(r => (
            <PersonBar key={r.id} name={nameOf(r.id)} place={people?.find(p => p.id === r.id)?.place ?? ''} work={r.work} busy={r.busy} sel={sel} />
          ))}
          {rows.length > shown.length && <><div className="text-[13px] font-bold text-tn-ink">+ {rows.length - shown.length} more<small className="block text-[11px] font-semibold text-muted">counted in Everyone free</small></div><div /></>}
          {externals.map(e => (
            <div key={e} className="contents">
              <div className="min-w-0 text-[13px] font-bold text-tn-ink truncate" title={e}>{e}<span className="block w-fit mt-[3px] text-[10.5px] font-extrabold tracking-[.04em] uppercase text-[#8a6703] bg-[var(--warn-bg)] border border-[#e9d48a] rounded-[6px] px-[7px] py-px">External guest</span></div>
              <div className="h-[26px] rounded-[7px] bg-[#f6f4ee] px-2.5 text-[11.5px] text-muted leading-[26px] truncate">Their calendar is not in the portal</div>
            </div>
          ))}
          <div className="col-span-2 flex flex-wrap gap-x-5 gap-y-2.5 pt-3.5 border-t border-[#eef0f3] text-[11.5px] text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="w-3.5 h-2.5 rounded-[3px] inline-block bg-[#bfe5d6]" />Everyone free</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-3.5 h-2.5 rounded-[3px] inline-block bg-[#97a3b8]" />Busy</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-3.5 h-2.5 rounded-[3px] inline-block bg-white border border-[#e3e7ec]" />Working hours</span>
            <span className="inline-flex items-center gap-1.5"><i className="w-3.5 h-2.5 rounded-[3px] inline-block bg-[repeating-linear-gradient(45deg,#f1f3f6_0_3px,#e7eaef_3px_6px)]" />Outside working hours</span>
          </div>
        </div>
      )}
    </section>
  )
}

function PersonBar({ name, place, work, busy, sel }: { name: string; place: string; work: [number, number][]; busy: [number, number][]; sel: React.ReactNode }) {
  return (
    <>
      <div className="min-w-0 text-[13px] font-bold text-tn-ink leading-[1.3] truncate">{name}<small className="block text-[11px] font-semibold text-muted truncate">{place}</small></div>
      <div className="relative h-[26px] rounded-[7px] overflow-hidden bg-[repeating-linear-gradient(45deg,#f1f3f6_0_6px,#e7eaef_6px_12px)]">
        {work.map(([a, b], i) => <div key={`w${i}`} className="absolute top-0 bottom-0 bg-white border border-[#e3e7ec] rounded-[6px]" style={{ left: pct(a), width: wid(a, b) }} />)}
        {busy.map(([a, b], i) => <div key={`b${i}`} className="absolute top-[3px] bottom-[3px] bg-[#97a3b8] rounded-[5px]" style={{ left: pct(a), width: wid(a, b) }} />)}
        {sel}
      </div>
    </>
  )
}
