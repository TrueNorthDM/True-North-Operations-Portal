'use client'

/**
 * The frame switcher of the Time entries design check, and the page itself in
 * the portal's content area (the same padding as MainContent). Each frame is
 * its own address, so the owner can open one beside the prototype's.
 */

import { useState } from 'react'
import Link from 'next/link'
import { TimeEntries } from '@/components/clocky/entries/TimeEntries'
import { FRAMES, NOW_ISO, buildFrame } from './frames'
import { catalogFor, makeApi } from './sample'

const LEVEL = { super: 'Super Admin', admin: 'Admin', lead: 'Team Leader', user: 'User' } as const

export function EntriesCheck({ frame }: { frame: string }) {
  const [f] = useState(() => buildFrame(frame))
  const [api] = useState(() => makeApi(f.store))
  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 pt-5 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1 bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] self-start">
          {FRAMES.map(([k, label]) => (
            <Link key={k} href={`?frame=${k}`} className={`rounded-[8px] px-2.5 py-[7px] text-[12.5px] font-semibold ${k === frame ? 'bg-tn-primary text-[#ffffff]' : 'text-foreground hover:bg-subtle'}`}>{label}</Link>
          ))}
          <Link href="/design-check/clocky-approvals?frame=3L2" className="rounded-[8px] px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground hover:bg-subtle">3L Approvals (Team Leader)</Link>
          <Link href="/design-check/clocky-approvals?frame=3L" className="rounded-[8px] px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground hover:bg-subtle">3L Approvals (Super Admin)</Link>
        </div>
        <p className="m-0 text-[12.5px] text-muted">Frame {frame}, viewing as {f.store.recs.length ? `${LEVEL[f.level]}` : ''}. Now is Thu, Oct 15, 2026, 1:20 PM (New York), frozen. Nothing is saved.</p>
      </div>
      {/* The portal's content area on a 1440 screen: the window less the 64px rail, MainContent's padding. */}
      <div className="px-6 py-8 w-full max-w-[1376px]">
        <TimeEntries key={frame} initialData={f.data} catalog={catalogFor(f.level)} api={api} initial={f.initial} clock={{ now: NOW_ISO, frozen: true }} clockHref="#" />
      </div>
    </div>
  )
}
