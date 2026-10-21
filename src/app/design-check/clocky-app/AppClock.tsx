'use client'

// The clock as it sits in the real top bar: the frame's data from the clock
// design check, the panel opening the way it does in the app (fixed under the
// top bar), nothing of the design check's own chrome.

import { useState } from 'react'
import { ClockyClock } from '@/components/clocky/clock/ClockyClock'
import { WhosWorkingButton } from '@/components/clocky/working/WhosWorking'
import { ENTRIES_CLOCK, FRAMES, sampleApi } from '../clocky-clock/sample'

export function AppClock({ frame, open: startOpen, working = true }: { frame: string; open: boolean; working?: boolean }) {
  // device="auto": the panel goes full screen on a phone-width window, as in the app.
  // 'RUN': the clock as the Time entries frames have it.
  const f = frame === 'RUN' ? { ...FRAMES[0], code: 'RUN', data: ENTRIES_CLOCK, ui: undefined, toast: undefined, offline: undefined } : FRAMES.find(x => x.code === frame) ?? FRAMES[0]
  const [open, setOpen] = useState(startOpen)
  return (
    <>
      {working && <WhosWorkingButton count={12} open={false} onClick={() => {}} />}
      <ClockyClock key={f.code} initial={{ ok: true, data: f.data }} api={sampleApi(f.data)} open={open} onOpenChange={setOpen}
        device="auto" initialUi={f.ui} initialToast={f.toast} forceOffline={f.offline} />
    </>
  )
}
