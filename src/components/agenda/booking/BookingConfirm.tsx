'use client'

/**
 * The page the confirmation email links to. It asks for one more click rather
 * than booking on open: mail scanners open links on their own, and a meeting
 * must only be made by the person who asked for it.
 */

import { useState } from 'react'
import type { Confirmed } from '@/app/meet/actions'
import { BookingFrame, HostSide, Steps, MAIN, H4, BTN_MAIN, Mark } from './BookingFrame'

export interface ConfirmView {
  token: string
  host: { name: string; initials: string; slug: string }
  len: number
  /** "Monday, November 2, 10:30 AM to 11:00 AM, New York (ET)" in the booker's zone. */
  when: string
  short: string
  everyone: string[]
  state: 'held' | 'booked' | 'gone'
}

export function BookingConfirm({ view, confirm }: { view: ConfirmView; confirm: (i: { token: string }) => Promise<Confirmed> }) {
  const [state, setState] = useState(view.state)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); setErr('')
    try {
      const r = await confirm({ token: view.token })
      if (r.ok) setState('booked'); else setErr(r.error)
    } catch { setErr('Something went wrong. Try again in a moment.') } finally { setBusy(false) }
  }
  const again = `/meet/${view.host.slug}`
  const list = view.everyone
  return (
    <BookingFrame steps={<Steps at={state === 'booked' ? 4 : 3} />}>
      <HostSide name={view.host.name} initials={view.host.initials} len={view.len} when={view.short} />
      <div className={MAIN}>
        {state === 'booked' ? (
          <div className="flex flex-col gap-3 items-start">
            <Mark kind="ok" />
            <h4 className={H4}>You&apos;re booked with {view.host.name}</h4>
            <p className="m-0 text-[14px] leading-[1.5] text-foreground max-w-[520px]">{view.when}</p>
            <p className="m-0 text-[14px] leading-[1.5] text-foreground max-w-[520px]">
              The Google invitation with the Meet link goes to {list.length === 1 ? <b>{list[0]}</b> : <>{list.slice(0, -1).map((e, i) => <span key={e}>{i ? ', ' : ''}<b>{e}</b></span>)} and <b>{list[list.length - 1]}</b></>}.
            </p>
            <p className="m-0 text-[13px] text-muted">To change or cancel, use the links in the invitation.</p>
            <a href={again} className="font-bold text-[13px] text-tn-teal hover:underline">Book another time</a>
          </div>
        ) : state === 'held' ? (
          <div className="flex flex-col gap-3 items-start">
            <Mark kind="mail" />
            <h4 className={H4}>Confirm your meeting</h4>
            <p className="m-0 text-[14px] leading-[1.5] text-foreground max-w-[520px]">{view.when}, on Google Meet{list.length > 1 ? `, with ${list.length - 1} ${list.length === 2 ? 'guest' : 'guests'}` : ''}.</p>
            {err && <p role="alert" className="m-0 text-[13px] font-bold text-[#b2412f] max-w-[520px]">{err}</p>}
            <button type="button" className={BTN_MAIN} disabled={busy} onClick={() => void go()}>{busy ? 'Booking…' : 'Confirm my meeting'}</button>
            {err && <a href={again} className="font-bold text-[13px] text-tn-teal hover:underline">Pick another time</a>}
          </div>
        ) : (
          <div className="flex flex-col gap-3 items-start">
            <Mark kind="warn" />
            <h4 className={H4}>This time is no longer held</h4>
            <p className="m-0 text-[14px] leading-[1.5] text-foreground max-w-[520px]">The 15 minutes to confirm have passed, or a newer email replaced this one. Nothing was booked.</p>
            <a href={again} className={BTN_MAIN}>Pick a time again</a>
          </div>
        )}
      </div>
    </BookingFrame>
  )
}
