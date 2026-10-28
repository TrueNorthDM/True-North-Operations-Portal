// Design check: "Add time" on the 2026 structure (owner, 28 October 2026), the
// clock panel's Client, Division, Project, Activity, Billable and Notes in the
// real form, over the clock panel's 2026 sample. Nothing is saved. Development only.

import { notFound } from 'next/navigation'
import { AddTimeCheck } from './AddTimeCheck'

export const dynamic = 'force-dynamic'

export default function AddTime2026Check() {
  if (process.env.NODE_ENV === 'production') notFound()
  return <AddTimeCheck />
}
