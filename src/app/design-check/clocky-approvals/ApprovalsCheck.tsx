'use client'

/** The two Approvals frames: 3L (Super Admin, with Clarise's request) and 3L2 (Team Leader of Web). */

import { useState } from 'react'
import Link from 'next/link'
import { Approvals } from '@/components/clocky/approvals/Approvals'
import { approvalsData, generate, makeApi, makeStore, reqSeed } from '../clocky-entries/sample'

export function ApprovalsCheck({ frame }: { frame: '3L' | '3L2' }) {
  const [store] = useState(() => (frame === '3L' ? makeStore('super', [...generate(), reqSeed()]) : makeStore('lead', generate())))
  const [api] = useState(() => makeApi(store))
  const [data] = useState(() => approvalsData(store))
  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 pt-5 flex flex-col gap-2">
        <div className="flex flex-wrap gap-1 bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] self-start">
          <Link href="/design-check/clocky-entries?frame=3A1" className="rounded-[8px] px-2.5 py-[7px] text-[12.5px] font-semibold text-foreground hover:bg-subtle">Time entries frames</Link>
          {(['3L2', '3L'] as const).map(k => (
            <Link key={k} href={`?frame=${k}`} className={`rounded-[8px] px-2.5 py-[7px] text-[12.5px] font-semibold ${k === frame ? 'bg-tn-primary text-[#ffffff]' : 'text-foreground hover:bg-subtle'}`}>
              {k === '3L' ? '3L Approvals (Super Admin)' : '3L Approvals (Team Leader)'}
            </Link>
          ))}
        </div>
        <p className="m-0 text-[12.5px] text-muted">Frame {frame}, viewing as {frame === '3L' ? 'Super Admin (Arnaldo Oliveira)' : 'Team Leader (Wendy Cacka, Web)'}. Nothing is saved.</p>
      </div>
      <div className="px-6 py-8 w-full max-w-[1376px]">
        <Approvals key={frame} initialData={data} api={api} />
      </div>
    </div>
  )
}
