'use client'

/**
 * The public booking page (owner, 30 October 2026; the approved mockup
 * "Agenda Google Calendar", section 4). Four steps: pick a time, your
 * details (with up to 10 guests), confirm your email, booked. The last one
 * is the confirmation page the email links to (BookingConfirm).
 *
 * The free times come from the server as instants, per meeting length; the
 * booker's time zone (their browser's, or the one they pick) only changes
 * which day and hour each one shows under.
 */

import { useMemo, useState, useSyncExternalStore } from 'react'
import { Select } from '@/components/ui/Select'
import { BOOKING_ZONES, bookingZoneLabel, HOLD_MINUTES, MAX_BOOKING_GUESTS, whenLine } from '@/lib/agenda/booking'
import { localOf } from '@/lib/agenda/time'
import type { Held, HoldPreview } from '@/app/meet/actions'
import { BookingFrame, HostSide, Steps, MAIN, H4, BTN_MAIN, LINK, Mark } from './BookingFrame'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const INPUT = 'w-full box-border bg-white border border-[var(--panel-border)] rounded-[12px] px-[13px] py-[11px] text-[14px] text-tn-ink outline-none focus:border-tn-teal'
const LBL = 'font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.06em] uppercase text-muted'

export interface BookingHost { name: string; initials: string; slug: string; lengths: number[] }

export interface BookingApi {
  hold(i: { slug: string; len: number; start: number; name: string; email: string; guests: string[]; note: string; zone: string }): Promise<Held>
  resend(i: { id: number; email: string }): Promise<Held>
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10)
const dow = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay()
const noSubscribe = () => () => {}
const browserZoneNow = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null } catch { return null } }
const timeIn = (ms: number, zone: string) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: zone })

export function BookingPage({ host, slots, api }: { host: BookingHost; slots: Record<number, number[]>; api: BookingApi }) {
  const [len, setLen] = useState(host.lengths.includes(30) ? 30 : host.lengths[0])
  // The browser's own zone, once on the client (the server cannot know it), until they pick one.
  const browserZone = useSyncExternalStore(noSubscribe, browserZoneNow, () => null)
  const [picked, setZone] = useState<string | null>(null)
  const zone = picked ?? browserZone ?? 'America/New_York'
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [day, setDay] = useState<string | null>(null)
  const [slot, setSlot] = useState<number | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [guests, setGuests] = useState<string[]>([])
  const [gq, setGq] = useState('')
  const [gErr, setGErr] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [held, setHeld] = useState<{ id: number; preview: HoldPreview | null } | null>(null)
  const [resent, setResent] = useState('')

  const byDay = useMemo(() => {
    const m = new Map<string, number[]>()
    for (const ms of slots[len] ?? []) { const d = localOf(ms, zone).date; m.set(d, [...(m.get(d) ?? []), ms]) }
    return m
  }, [slots, len, zone])
  const days = [...byDay.keys()].sort()
  const shownDay = day && byDay.has(day) ? day : days[0] ?? null
  const shownMonth = month ?? (shownDay ?? new Date().toISOString().slice(0, 10)).slice(0, 7)
  const zones = useMemo(() => {
    const list = BOOKING_ZONES.map(([value, label]) => ({ value, label }))
    return list.some(z => z.value === zone) ? list : [{ value: zone, label: bookingZoneLabel(zone) }, ...list]
  }, [zone])

  const detailsOk = !!name.trim() && EMAIL.test(email.trim())
  const addGuest = (): boolean => {
    const v = gq.trim().replace(/[,;]$/, '').toLowerCase()
    if (!v) return true
    if (!EMAIL.test(v)) { setGErr('That does not look like an email address.'); return false }
    if (v === email.trim().toLowerCase() || guests.includes(v)) { setGErr('That email is already on the meeting.'); return false }
    if (guests.length >= MAX_BOOKING_GUESTS) { setGErr(`Up to ${MAX_BOOKING_GUESTS} guests.`); return false }
    setGuests(g => [...g, v]); setGq(''); setGErr('')
    return true
  }

  const hold = async () => {
    if (!slot || !detailsOk || !addGuest()) return
    const extra = gq.trim() ? [gq.trim().toLowerCase()] : []
    setBusy(true); setErr('')
    try {
      const r = await api.hold({ slug: host.slug, len, start: slot, name: name.trim(), email: email.trim(), guests: [...guests, ...extra], note, zone })
      if (r.ok) { setHeld({ id: r.id, preview: r.preview }); setStep(3) } else setErr(r.error)
    } catch {
      setErr('Something went wrong. Try again in a moment.')
    } finally { setBusy(false) }
  }
  const resend = async () => {
    if (!held) return
    setBusy(true)
    try {
      const r = await api.resend({ id: held.id, email: email.trim().toLowerCase() })
      if (r.ok) { setHeld({ id: r.id, preview: r.preview }); setResent('Sent again.') } else setResent(r.error)
    } catch { setResent('Something went wrong. Try again in a moment.') } finally { setBusy(false) }
  }
  const back = (to: 1 | 2) => { setStep(to); setErr(''); setResent('') }

  const when = slot ? `${new Date(slot).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: zone })}, ${timeIn(slot, zone)}` : null
  return (
    <BookingFrame steps={<Steps at={step} onGo={n => { if (n === 1 || (n === 2 && slot)) back(n) }} />}
      after={step === 3 && held?.preview ? <StagingMail preview={held.preview} to={email} /> : null}>
      <HostSide name={host.name} initials={host.initials} len={len} when={when} />
      {step === 1 && (
        <div className={MAIN}>
          <h4 className={H4}>Pick a time</h4>
          <div className="flex flex-wrap items-end gap-4">
            {host.lengths.length > 1 && (
              <div className="flex flex-col gap-[5px]">
                <span className={LBL}>Length</span>
                <div role="radiogroup" aria-label="Length" className="inline-flex bg-subtle rounded-[10px] p-[3px] gap-[3px]">
                  {host.lengths.map(l => (
                    <button key={l} type="button" role="radio" aria-checked={l === len} onClick={() => { setLen(l); setSlot(null) }}
                      className={`border-0 rounded-[8px] px-3 py-[7px] text-[13px] font-extrabold cursor-pointer ${l === len ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.15)]' : 'bg-transparent text-muted'}`}>{l} min</button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-[5px] w-[230px] max-w-full">
              <span className={LBL}>Your time zone</span>
              <Select value={zone} options={zones} onChange={z => { setZone(z); setSlot(null); setDay(null) }} ariaLabel="Your time zone" fullWidth
                className="h-9 px-2.5 bg-white border border-[var(--panel-border)] rounded-[10px] font-semibold text-[13px]" />
            </div>
          </div>
          {days.length ? (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_210px] gap-[22px]">
              <Calendar month={shownMonth} has={d => byDay.has(d)} on={shownDay} onMonth={setMonth} onDay={d => { setDay(d); setSlot(null) }} />
              <div className="flex flex-col gap-2 md:max-h-[380px] md:overflow-y-auto">
                <span className={LBL}>{shownDay ? new Date(`${shownDay}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''}</span>
                {(shownDay ? byDay.get(shownDay) ?? [] : []).map(ms => (
                  <button key={ms} type="button" onClick={() => { setSlot(ms); setDay(shownDay) }} aria-pressed={ms === slot}
                    className={`rounded-[10px] p-2.5 text-center font-(family-name:--font-display) font-extrabold text-[14px] cursor-pointer border ${ms === slot ? 'bg-tn-primary border-tn-primary text-[#ffffff]' : 'bg-white border-[#bfdcd8] text-tn-teal hover:border-tn-teal'}`}>
                    {timeIn(ms, zone)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="m-0 text-[14px] text-foreground">{host.name} has no free times in the coming weeks. Try again later.</p>
          )}
          <div className="mt-auto flex items-center justify-end gap-3">
            {!slot && days.length > 0 && <span className="mr-auto text-[12.5px] text-muted">Pick a day, then a time.</span>}
            <button type="button" className={BTN_MAIN} disabled={!slot} onClick={() => setStep(2)}>Next</button>
          </div>
        </div>
      )}
      {step === 2 && (
        <div className={MAIN}>
          <button type="button" className={LINK} onClick={() => back(1)}>‹ Back to times</button>
          <h4 className={H4}>Your details</h4>
          <form className="flex flex-col gap-3.5 max-w-[460px]" onSubmit={e => { e.preventDefault(); void hold() }}>
            <label className="flex flex-col gap-[5px]"><span className={LBL}>Name</span>
              <input className={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" autoComplete="name" maxLength={120} /></label>
            <label className="flex flex-col gap-[5px]"><span className={LBL}>Email</span>
              <input className={INPUT} value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" type="email" maxLength={254} />
              <span className="text-[12.5px] text-muted">We send a link here to confirm the meeting, then the Google invitation.</span></label>
            <div className="flex flex-col gap-[5px]">
              <span className={LBL}>Guests <span className="normal-case tracking-normal font-semibold">(optional)</span></span>
              <div className="flex flex-wrap gap-1.5 items-center bg-white border border-[var(--panel-border)] rounded-[12px] px-2 py-1.5 focus-within:border-tn-teal">
                {guests.map((g, i) => (
                  <button key={g} type="button" onClick={() => setGuests(x => x.filter((_, j) => j !== i))} aria-label={`Remove ${g}`}
                    className="inline-flex items-center gap-1.5 border-0 rounded-[8px] bg-subtle px-2 py-1 text-[13px] text-tn-ink cursor-pointer">{g} <span className="text-muted">×</span></button>
                ))}
                <input value={gq} disabled={guests.length >= MAX_BOOKING_GUESTS} aria-label="Add a guest's email"
                  onChange={e => { setGq(e.target.value); setGErr('') }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ',' || e.key === ';') { e.preventDefault(); addGuest() } }}
                  onBlur={() => { if (gq.trim()) addGuest() }}
                  placeholder={guests.length >= MAX_BOOKING_GUESTS ? `Up to ${MAX_BOOKING_GUESTS} guests` : 'Add an email, then Enter'}
                  className="flex-1 min-w-[160px] border-0 outline-none bg-transparent text-[14px] text-tn-ink py-1.5" />
              </div>
              <span className={`text-[12.5px] ${gErr ? 'text-[#b2412f] font-bold' : 'text-muted'}`}>{gErr || `They get the Google invitation too, with the Meet link. Up to ${MAX_BOOKING_GUESTS}.`}</span>
            </div>
            <label className="flex flex-col gap-[5px]"><span className={LBL}>Anything to share before the meeting? <span className="normal-case tracking-normal font-semibold">(optional)</span></span>
              <textarea className={INPUT} rows={3} value={note} onChange={e => setNote(e.target.value)} maxLength={2000} /></label>
            {err && <p role="alert" className="m-0 text-[13px] font-bold text-[#b2412f]">{err}</p>}
            <div className="flex justify-end"><button type="submit" className={BTN_MAIN} disabled={!detailsOk || busy}>{busy ? 'Sending…' : 'Continue'}</button></div>
          </form>
        </div>
      )}
      {step === 3 && slot && (
        <div className={MAIN}>
          <div className="flex flex-col gap-3 items-start">
            <Mark kind="mail" />
            <h4 className={H4}>Check your email</h4>
            <p className="m-0 text-[14px] leading-[1.5] text-foreground max-w-[520px]">We sent a link to <b>{email.trim()}</b>. Open it to confirm, and the meeting is booked. Your time is held for <b>{HOLD_MINUTES} minutes</b>.</p>
            <p className="m-0 text-[13px] leading-[1.5] text-muted max-w-[520px]">
              {whenLine(slot, len, zone)}, {bookingZoneLabel(zone)}.{' '}
              No email? Check the spam folder, or <button type="button" className={LINK} disabled={busy} onClick={() => void resend()}>send it again</button>. Wrong address? <button type="button" className={LINK} onClick={() => back(2)}>Change it</button>.
            </p>
            {resent && <p className="m-0 text-[13px] font-bold text-tn-ink">{resent}</p>}
          </div>
        </div>
      )}
    </BookingFrame>
  )
}

function Calendar({ month, has, on, onMonth, onDay }: { month: string; has: (d: string) => boolean; on: string | null; onMonth: (m: string) => void; onDay: (d: string) => void }) {
  const first = `${month}-01`, start = addDays(first, -dow(first))
  const move = (n: number) => { const [y, m] = month.split('-').map(Number); onMonth(new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)) }
  return (
    <div>
      <div className="flex items-center justify-between px-1 pb-2.5 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">
        <button type="button" aria-label="Previous month" onClick={() => move(-1)} className="border-0 bg-transparent text-[20px] text-muted cursor-pointer px-2 hover:text-tn-ink">‹</button>
        {new Date(`${first}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
        <button type="button" aria-label="Next month" onClick={() => move(1)} className="border-0 bg-transparent text-[20px] text-muted cursor-pointer px-2 hover:text-tn-ink">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <div key={i} className="text-[11px] font-extrabold text-muted py-1">{w}</div>)}
        {Array.from({ length: 42 }, (_, i) => addDays(start, i)).map(d => {
          const inMonth = d.slice(0, 7) === month, ok = inMonth && has(d)
          return (
            <button key={d} type="button" disabled={!ok} onClick={() => onDay(d)} aria-pressed={d === on}
              className={`border-0 rounded-[10px] py-2.5 text-[14px] ${!inMonth ? 'invisible' : d === on ? 'bg-tn-primary text-[#ffffff] font-extrabold' : ok ? 'bg-[#eef6f5] text-tn-teal font-extrabold cursor-pointer hover:bg-[#dcefeb]' : 'bg-transparent text-[#c3cad4]'}`}>
              {+d.slice(8)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Staging cannot email people: the email shows here instead, link and all. */
function StagingMail({ preview, to }: { preview: HoldPreview; to: string }) {
  return (
    <div className="w-full max-w-[520px] flex flex-col gap-2">
      <span className="text-[12px] font-bold text-muted text-center">Staging copy: the email that would arrive in the inbox</span>
      <div className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden shadow-[0_6px_18px_rgba(1,35,88,.08)]">
        <div className="bg-subtle px-4 py-3 flex flex-col gap-0.5 text-[12px] text-muted">
          <b className="font-(family-name:--font-display) font-extrabold text-[14.5px] text-tn-ink">{preview.subject}</b>
          <span>From: True North Operations Portal &lt;portal@truenorthportal.online&gt;</span>
          <span>To: {to}</span>
        </div>
        <div className="px-4 py-3.5 text-[14px]">
          <a href={preview.link} className={BTN_MAIN}>Confirm my meeting</a>
        </div>
      </div>
    </div>
  )
}
