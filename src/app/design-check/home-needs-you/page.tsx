// Design check: Home's Needs you / My Work / Requests card and its side panel
// (design_handoff_home, README section 3), with the prototype's rows per level.
// /design-check/home-needs-you?level=super|admin|lead|emp|con|fin (fin: Finance's
// To pay rows, with the Mark paid form in the panel); &error=1 adds a
// failed read; &fail=1 makes the panel's actions refuse. The right column is a
// stand-in of the prototype's height, so the card stretches as it does on Home.

import Link from 'next/link'
import { LEVELS, SAMPLE, withError, type Level } from './sample'
import { NeedsYouPreview } from './NeedsYouPreview'

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') return null
  const sp = await searchParams
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k]![0] : sp[k]) ?? ''
  const level = (LEVELS.some(l => l.key === one('level')) ? one('level') : 'super') as Level
  const data = one('error') === '1' ? withError(SAMPLE[level]) : SAMPLE[level]
  const right = level === 'super' || level === 'admin' ? 590 : 400

  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <div className="max-w-[1216px] mx-auto flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white border border-[#d9d6cc] rounded-[12px] p-1 gap-0.5">
            {LEVELS.map(l => (
              <Link key={l.key} href={`?level=${l.key}`} className={`rounded-[9px] px-3.5 py-2 text-[14px] font-semibold whitespace-nowrap ${l.key === level ? 'bg-tn-primary text-[#ffffff]' : 'text-foreground'}`}>{l.label}</Link>
            ))}
          </div>
          <span className="text-[13.5px] text-[#5b6b82]">{LEVELS.find(l => l.key === level)!.note}</span>
        </div>
        <div className="p-7 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] lg:grid-rows-[1fr_auto] gap-x-6 gap-y-[22px] items-start bg-background">
          <NeedsYouPreview key={level} data={data} fail={one('fail') === '1'} />
          <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 rounded-[18px] border border-dashed border-[#c9d1dc] flex items-center justify-center text-[13px] text-muted" style={{ height: right }}>
            Right column: Agenda{level === 'super' || level === 'admin' ? ' and i7 Budget' : ''}
          </div>
          <div className="lg:col-start-1 lg:row-start-2 h-[300px] rounded-[20px] border border-dashed border-[#c9d1dc] flex items-center justify-center text-[13px] text-muted">Pay period</div>
        </div>
      </div>
    </div>
  )
}
