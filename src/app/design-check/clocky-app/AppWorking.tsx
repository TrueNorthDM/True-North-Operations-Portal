'use client'

// Who's working as it sits in the real top bar: the frame's data from the
// Who's working design check, the drawer opening the way it does in the app
// (fixed under the top bar). 2P is the page, so the drawer stays closed.
// The clock button beside it is the viewer's own running entry in that data.

import { useState } from 'react'
import { ClockButton } from '@/components/clocky/clock/ClockButton'
import { WhosWorking } from '@/components/clocky/working/WhosWorking'
import { shortJob } from '@/lib/timeclock/format'
import { formatTimer } from '@/lib/timeclock/rounding'
import { WhosWorkingPage } from '@/components/clocky/working/WhosWorkingPage'
import { FRAMES, TEAM_ORDER, sampleApi } from '../clocky-working/sample'

const frameOf = (code: string) => FRAMES.find(x => x.code === code) ?? FRAMES[0]

export function AppWorking({ frame }: { frame: string }) {
  const f = frameOf(frame)
  const [open, setOpen] = useState(!f.page)
  const [api] = useState(() => sampleApi(f.data))
  const mine = f.data.people.find(p => p.name === f.meName)?.current ?? null
  return (
    <>
      <WhosWorking count={f.data.onTheClock} api={api} open={open} onOpenChange={setOpen} meName={f.meName}
        initialData={f.data} initialUi={f.ui} teamOrder={TEAM_ORDER} frozen />
      <ClockButton phone={false} open={false} onClick={() => {}} state={mine
        ? { kind: 'on', text: formatTimer((Date.parse(f.data.now) - Date.parse(mine.timerFrom)) / 1000), job: shortJob(mine.path), aria: 'On the clock' }
        : { kind: 'off', text: 'Clock in', job: '', aria: 'Off the clock. Clock in' }} />
    </>
  )
}

export function AppWorkingPage({ frame }: { frame: string }) {
  const f = frameOf(frame)
  const [api] = useState(() => sampleApi(f.data))
  return <WhosWorkingPage initial={{ ok: true, data: f.data }} meName={f.meName} api={api} teamOrder={TEAM_ORDER} frozen />
}
