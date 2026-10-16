'use client'

/**
 * Who's working as a page inside Clocky (2P, Who's Working.dc.html "Full
 * page"): the drawer's list in a card that fills the window under the
 * breadcrumb, its title at page size, without "Open as a page" and Close.
 */

import { useState } from 'react'
import type { Result, WhosWorkingData } from '@/lib/timeclock/clocky-types'
import { useLiveNow } from '../clock/hooks'
import { WORKING_API, type WorkingApi } from './working-api'
import { WhosWorkingPanel, type WorkingUi } from './WhosWorkingPanel'

export function WhosWorkingPage({ initial, meName, api = WORKING_API, initialUi, teamOrder, frozen = false, fill = false }: {
  initial: Result<{ data: WhosWorkingData }>
  meName: string
  api?: WorkingApi
  initialUi?: Partial<WorkingUi>
  teamOrder?: readonly string[]
  frozen?: boolean
  /** Design check: fill the frame instead of the window. */
  fill?: boolean
}) {
  const [data, setData] = useState<WhosWorkingData | null>(initial.ok ? initial.data : null)
  const nowMs = useLiveNow(data?.now ?? null, !frozen)
  return (
    <div className={fill ? 'h-full' : 'mt-1'}>
      <WhosWorkingPanel data={data} loadError={initial.ok ? null : initial.error} api={api} variant="page" meName={meName} nowMs={nowMs}
        initialUi={initialUi} teamOrder={teamOrder} onData={setData} fill={fill} />
    </div>
  )
}
