// Design check: North Time > TSheets transition, the real component with
// sample data (sample.ts).
//
//   ?frame=data | empty | none   entries with every problem, no entries, no switch date
//
// The filters work on the sample. Nothing reads the database. Development only.

import { notFound } from 'next/navigation'
import { TransitionCheck } from './TransitionCheck'

export const dynamic = 'force-dynamic'

export default async function ClockyTransitionCheck({ searchParams }: { searchParams: Promise<{ frame?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { frame } = await searchParams
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <TransitionCheck frame={frame === 'empty' || frame === 'none' ? frame : 'data'} />
    </div>
  )
}
