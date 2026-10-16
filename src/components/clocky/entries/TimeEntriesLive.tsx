'use client'

/**
 * Time entries on the live page: the screen over the real actions
 * (entries-actions.ts, approvals/actions.ts, and the clock's for Continue).
 * After a change the page refreshes, so the top bar's clock follows.
 */

import { useRouter } from 'next/navigation'
import {
  addTime, deleteEntry, editEntry, getCorrectionHistory, getEntries, getEntryHistory, getSubmitSummary, requestCorrection, saveWeekGrid, submitPeriod,
} from '@/app/(app)/clocky-hours/entries-actions'
import { decideCorrection, decideTimeOff } from '@/app/(app)/clocky-hours/approvals/actions'
import { clockIn, switchTo } from '@/app/(app)/clocky-hours/clock-actions'
import type { EntriesData } from '@/lib/timeclock/clocky-types'
import type { Catalog, EntriesApi } from './api'
import { TimeEntries } from './TimeEntries'

const API: EntriesApi = {
  getEntries, getEntryHistory, getCorrectionHistory, getSubmitSummary, addTime, editEntry, deleteEntry, saveWeekGrid, requestCorrection, submitPeriod,
  decideCorrection, decideTimeOff, clockIn, switchTo,
}

export function TimeEntriesLive({ initialData, catalog, openEntry = null, member = null }: {
  initialData: EntriesData
  catalog: Catalog
  /** ?entry=<id>: open that entry's history. */
  openEntry?: number | null
  /** ?person=<id>, in the viewer's scope: All (My team) with that Team member picked; the data is already theirs. */
  member?: string | null
}) {
  const router = useRouter()
  const initial = { ...(openEntry ? { drawer: `e${openEntry}` } : {}), ...(member ? { who: 'all' as const, member } : {}) }
  return (
    <TimeEntries initialData={initialData} catalog={catalog} api={API} clock={{ now: catalog.now }} onChanged={() => router.refresh()} initial={initial} />
  )
}
