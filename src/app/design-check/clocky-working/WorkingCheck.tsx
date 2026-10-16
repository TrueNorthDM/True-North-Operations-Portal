'use client'

// Who's working, frame by frame, beside Who's Working.dc.html: the same frame
// codes (?frame=2A), the drawer from the top bar and the page (2P). The
// drawer, the button, the list and the dialog are the real components, fed
// the prototype's data and a stand-in for the server.

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { NavIcon } from '@/components/NavIcon'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { ClockButton } from '@/components/clocky/clock/ClockButton'
import { WhosWorking } from '@/components/clocky/working/WhosWorking'
import { WhosWorkingPage } from '@/components/clocky/working/WhosWorkingPage'
import { FRAMES, TEAM_ORDER, sampleApi } from './sample'

const ICON_BTN = 'inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-500'

export function WorkingCheck({ frame, frozen }: { frame: string; frozen: boolean }) {
  const f = FRAMES.find(x => x.code === frame) ?? FRAMES[0]
  const [open, setOpen] = useState(!f.page)
  const api = sampleApi(f.data)
  const me = f.data.people.find(p => p.name === 'Arnaldo Oliveira')
  const mine = me?.current ? Math.floor((Date.parse(f.data.now) - Date.parse(me.current.timerFrom)) / 1000) : 0
  const q = (code: string) => `?frame=${code}${frozen ? '&frozen=1' : ''}`

  return (
    <div className="min-h-screen bg-[#e9e6dd] px-8 pt-7 pb-12">
      <div className="max-w-[1380px] mx-auto flex flex-col gap-[18px]">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="m-0 font-(family-name:--font-display) font-black text-[24px] text-tn-ink">Clocky, Who&apos;s working (build)</h1>
            <p className="m-0 mt-1 text-[13.5px] text-muted">{`Compare com Who's Working.dc.html?frame=${f.code}. Os componentes são os reais; o servidor é simulado com os dados do protótipo.`}</p>
          </div>
          <Link href="/design-check/clocky-clock" className="text-[13px] font-semibold text-tn-teal self-start">Clock panel</Link>
          <div className="flex flex-wrap bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 self-start">
            {FRAMES.map(x => (
              <Link key={x.code} href={q(x.code)} className={`rounded-[8px] px-[11px] py-[7px] text-[12.5px] font-semibold ${x.code === f.code ? 'bg-tn-primary text-[#ffffff]' : 'text-foreground'}`}>{`${x.code} ${x.title}`}</Link>
            ))}
          </div>
        </div>

        <div className="relative h-[880px] border border-[#d9d6cc] rounded-[14px] overflow-hidden bg-white flex flex-col shadow-[0_8px_30px_rgba(1,35,88,.08)]">
          <header className="h-[65px] shrink-0 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4">
            <span className="flex items-end gap-2.5">
              <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} className="h-9 w-auto" />
              <span className="text-sm font-semibold text-slate-500 pb-0.5">Operations Portal</span>
            </span>
            <div className="flex items-center gap-2">
              <span className={ICON_BTN}><NavIcon name="launcher" /></span>
              <span className={ICON_BTN}><NavIcon name="messages" /></span>
              <WhosWorking key={f.code} count={f.data.onTheClock} api={api} open={open} onOpenChange={setOpen} meName={f.meName}
                initialData={f.data} frameTop={65} initialUi={f.ui} teamOrder={TEAM_ORDER} frozen={frozen} />
              <ClockButton state={{ kind: 'on', text: `${Math.floor(mine / 3600)}:${String(Math.floor((mine % 3600) / 60)).padStart(2, '0')}:${String(mine % 60).padStart(2, '0')}`, job: 'i7 › Web Dev', aria: 'On the clock' }} phone={false} open={false} onClick={() => {}} />
              <span className={`relative ${ICON_BTN}`}>
                <NavIcon name="bell" />
                <span className="absolute top-[3px] right-[2px] min-w-[18px] h-[18px] rounded-full px-[5px] inline-flex items-center justify-center text-[10.5px] font-bold leading-none ring-2 ring-white bg-tn-primary text-[#F2C40A]">3</span>
              </span>
            </div>
          </header>
          <div className="flex-1 flex min-h-0 bg-background">
            <nav className="w-16 shrink-0 bg-tn-primary" />
            <main className="flex-1 min-w-0 px-10 py-[34px]">
              {f.page ? (
                <Breadcrumb parents={['/clocky-hours']} now="Who's working" />
              ) : (
                <>
                  <div className="font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink tracking-[-.01em]">True North Operations Portal</div>
                  <div className="text-[15px] text-muted mt-1.5">Where would you like to go?</div>
                </>
              )}
            </main>
          </div>
          {f.page && (
            <div className="absolute top-[122px] left-[104px] right-10 bottom-6 z-[5]">
              <WhosWorkingPage initial={{ ok: true, data: f.data }} meName={f.meName} api={api} teamOrder={TEAM_ORDER} frozen={frozen} fill />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
