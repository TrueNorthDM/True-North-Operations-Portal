// Design check: Clocky in the bell and its one email (design handoff of 16
// October 2026, Clock Safety.dc.html), the real drawer and email renderer with
// the prototype's rows.
//
//   ?frame=bell       N1, a Super Admin's bell (corrections, time off, the clock, the daily line)
//   ?frame=bellLead   N3, a Team Leader's bell (their team's correction)
//   ?frame=bellUser   N4, the requester's bell (approved, denied)
//   ?frame=email      N2, "Your clock stopped by itself" (lib/email/clock-stopped.ts)
//
// Nothing reads or writes the database. Development only.

import { notFound } from 'next/navigation'
import Image from 'next/image'
import { renderClockStopped } from '@/lib/email/clock-stopped'
import { BellCheck } from './BellCheck'

export const dynamic = 'force-dynamic'

const LEVEL = { bell: 'super', bellLead: 'lead', bellUser: 'user' } as const

export default async function ClockyBellCheck({ searchParams }: { searchParams: Promise<{ frame?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { frame = 'bell' } = await searchParams

  if (frame === 'email') {
    const origin = 'http://localhost:3002'
    const m = renderClockStopped({ stoppedAt: '1:00 PM', clockedInAt: '8:00 AM', url: `${origin}/clocky-hours?clock=open`, origin })
    return (
      <div className="min-h-screen bg-background p-8 space-y-2">
        <p className="m-0 text-[12.5px] text-foreground"><b className="text-tn-ink">Subject:</b> {m.subject}</p>
        <p className="m-0 text-[12px] text-muted">Preheader: Confirm when you really stopped.</p>
        <iframe title="The email" srcDoc={m.html} className="w-full max-w-[680px] h-[620px] border border-[#d9d6cc] rounded-[12px] bg-background" />
      </div>
    )
  }

  const level = LEVEL[frame as keyof typeof LEVEL] ?? 'super'
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-slate-200 bg-white px-6 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20">
        <span className="flex items-end gap-2.5">
          <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} priority className="h-9 w-auto" />
          <span className="text-sm font-semibold text-slate-500 pb-0.5">Operations Portal</span>
        </span>
        <BellCheck level={level} />
      </header>
    </div>
  )
}
