// Design check: Clock safety (design handoff of 16 October 2026, Clock
// Safety.dc.html), the real component with the prototype's sample data.
//
//   ?frame=data | empty     4A with data, 4B empty
//   ?level=super | admin    Super Admin (full), Admin (read only)
//
// The period and the search work on the sample, as in the prototype. Nothing
// reads the database. Development only.

import { notFound } from 'next/navigation'
import { SafetyCheck } from './SafetyCheck'

export const dynamic = 'force-dynamic'

export default async function ClockySafetyCheck({ searchParams }: { searchParams: Promise<{ frame?: string; level?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { frame = 'data', level = 'super' } = await searchParams
  return (
    <div className="min-h-screen bg-background px-6 py-8">
      <SafetyCheck empty={frame === 'empty'} access={level === 'admin' ? 'read' : 'full'} />
    </div>
  )
}
