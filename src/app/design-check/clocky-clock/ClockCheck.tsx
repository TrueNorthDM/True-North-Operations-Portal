'use client'

// The clock panel, frame by frame, beside Clock Panel.dc.html: the same frame
// codes (?frame=1E), the same two sizes (&device=phone), the same jump bar,
// and the top-bar button's four states under it. The panel and the button are
// the real components, fed the prototype's data and a stand-in for the server.

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { NavIcon } from '@/components/NavIcon'
import { DemoRail } from './DemoRail'
import { ClockyClock } from '@/components/clocky/clock/ClockyClock'
import { WhosWorkingButton } from '@/components/clocky/working/WhosWorking'
import { FRAMES, TB_STATES, sampleApi } from './sample'

const ICON_BTN = 'inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-500'

function TopIcons() {
  return (
    <>
      <span className={ICON_BTN}><NavIcon name="launcher" /></span>
      <span className={ICON_BTN}><NavIcon name="messages" /></span>
    </>
  )
}

function Bell() {
  return (
    <span className={`relative ${ICON_BTN}`}>
      <NavIcon name="bell" />
      <span className="absolute top-[3px] right-[2px] min-w-[18px] h-[18px] rounded-full px-[5px] inline-flex items-center justify-center text-[10.5px] font-bold leading-none ring-2 ring-white bg-tn-primary text-[#F2C40A]">3</span>
    </span>
  )
}

export function ClockCheck({ frame, device, frozen, bare = false }: { frame: string; device: 'desktop' | 'phone'; frozen: boolean; /** &bare=1: the frame alone, as Clock Panel.dc.html?bare=1. */ bare?: boolean }) {
  // TB: only the top-bar button's four states, at the top (as the overview's TB card).
  const tbOnly = frame === 'TB'
  const f = FRAMES.find(x => x.code === frame) ?? FRAMES[0]
  const [open, setOpen] = useState(true)
  const api = sampleApi(f.data)
  const phone = device === 'phone'
  const q = (o: { frame?: string; device?: string }) => `?frame=${o.frame ?? f.code}&device=${o.device ?? device}${frozen ? '&frozen=1' : ''}`
  const clock = (
    <ClockyClock key={`${f.code}-${device}`} initial={{ ok: true, data: f.data }} api={api} open={open} onOpenChange={setOpen}
      device={device} frameTop={phone ? 44 : 65} initialUi={f.ui} initialToast={f.toast} frozen={frozen} forceOffline={f.offline} />
  )

  return (
    <div className="min-h-screen bg-[#e9e6dd] px-8 pt-7 pb-12">
      <div className="max-w-[1380px] mx-auto flex flex-col gap-[18px]">
        {!bare && <div className="flex flex-col gap-3.5">
          <div>
            <h1 className="m-0 font-(family-name:--font-display) font-black text-[24px] text-tn-ink">North Time, painel do relógio (build)</h1>
            <p className="m-0 mt-1 text-[13.5px] text-muted">{tbOnly ? 'Compare com o card TB de North Time (todas as telas).dc.html. Os componentes são os reais; o servidor é simulado com os dados do protótipo.' : `Compare com Clock Panel.dc.html?frame=${f.code}${phone ? '&device=phone' : ''}. Os componentes são os reais; o servidor é simulado com os dados do protótipo.`}</p>
          </div>
          <div className="flex gap-4 items-center flex-wrap">
            <Link href={`/design-check/clocky-working`} className="text-[13px] font-semibold text-tn-teal">Who&apos;s working</Link>
            <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5">
              {(['desktop', 'phone'] as const).map(d => (
                <Link key={d} href={q({ device: d })} className={`rounded-[8px] px-3 py-[7px] text-[13px] font-semibold ${device === d ? 'bg-tn-primary text-[#ffffff]' : 'text-foreground'}`}>{d === 'desktop' ? 'Desktop 1440' : 'Phone 390'}</Link>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 self-start">
            <Link href={q({ frame: 'TB' })} className={`rounded-[8px] px-[11px] py-[7px] text-[12.5px] font-semibold ${tbOnly ? 'bg-tn-primary text-[#ffffff]' : 'text-foreground'}`}>TB Top bar</Link>
            {FRAMES.map(x => (
              <Link key={x.code} href={q({ frame: x.code })} className={`rounded-[8px] px-[11px] py-[7px] text-[12.5px] font-semibold ${!tbOnly && x.code === f.code ? 'bg-tn-primary text-[#ffffff]' : 'text-foreground'}`}>{`${x.code} ${x.title}`}</Link>
            ))}
          </div>
        </div>}

        {tbOnly ? null : phone ? (
          <div className="relative w-[390px] h-[844px] mx-auto my-3.5 rounded-[46px] overflow-hidden bg-white flex flex-col shadow-[0_0_0_10px_#10203a,0_40px_80px_-30px_rgba(1,35,88,.55)]">
            <div className="h-11 shrink-0 flex items-center justify-between px-7 font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink tabular-nums">
              <span>11:50</span>
              <span className="w-6 h-[11px] rounded-[3px] border-[1.5px] border-tn-ink relative"><span className="absolute inset-[1.5px] right-[5px] bg-tn-ink rounded-[1px]" /></span>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200">
              <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} className="h-[30px] w-auto" />
              {clock}
            </div>
          </div>
        ) : (
          <div className="relative h-[860px] border border-[#d9d6cc] rounded-[14px] overflow-hidden bg-white flex flex-col shadow-[0_8px_30px_rgba(1,35,88,.08)]">
            <header className="h-[65px] shrink-0 border-b border-slate-200 bg-white px-6 flex items-center justify-between gap-4">
              <span className="flex items-end gap-2.5">
                <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} className="h-9 w-auto" />
                <span className="text-sm font-semibold text-slate-500 pb-0.5">Operations Portal</span>
              </span>
              <div className="flex items-center gap-2">
                <TopIcons />
                <WhosWorkingButton count={12} open={false} onClick={() => {}} />
                {clock}
                <Bell />
              </div>
            </header>
            <div className="flex-1 flex min-h-0 bg-background">
              <DemoRail />
              <main className="flex-1 min-w-0 px-10 py-[34px]">
                <div className="font-(family-name:--font-display) font-extrabold text-[30px] text-tn-ink tracking-[-.01em]">True North Operations Portal</div>
                <div className="text-[15px] text-muted mt-1.5">Where would you like to go?</div>
              </main>
            </div>
          </div>
        )}

        {!bare && <div className="flex flex-col gap-3 mt-2.5">
          <h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink">Botão do relógio na top bar, os 4 estados</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {TB_STATES.map(s => (
              <div key={s.label} className="bg-white border border-[var(--panel-border)] rounded-[12px] px-4 py-3.5 flex flex-col gap-3">
                <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{s.label}</span>
                <div className="flex items-center justify-end gap-2">
                  <ClockyClock initial={{ ok: true, data: s.data }} api={sampleApi(s.data)} open={false} onOpenChange={() => {}} device="desktop" frozen setsTitle={false} />
                  <Bell />
                </div>
              </div>
            ))}
          </div>
          <p className="m-0 text-[12.5px] text-muted">Com o relógio rodando, a aba do navegador mostra: <b className="text-foreground">1:58 · i7 › Web Dev · True North</b></p>
        </div>}
      </div>
    </div>
  )
}
