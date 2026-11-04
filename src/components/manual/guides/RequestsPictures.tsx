'use client'

// The Requests guides' pictures: the real Time off, Reimbursements, Extra
// hours and Approvals screens, fed the manual's made-up data
// (lib/manual/samples/requests.ts). Nothing saves, nothing navigates. A form or
// a card opens over its page inside the picture (ui/in-picture.ts), as it does
// over the real page; the picture around them (GuideParts) makes them inert.

import { useState, type ReactNode } from 'react'
import { InPicture } from '@/components/ui/in-picture'
import { TimeOffView, type TimeOffApi } from '@/components/requests/TimeOffView'
import { ReimbursementsView, type Draft } from '@/components/requests/ReimbursementsView'
import { RmbDocView } from '@/components/requests/RmbDocView'
import { ExtraHoursView } from '@/components/requests/ExtraHoursView'
import { ApprovalsList, type QueueApi } from '@/components/clocky/approvals/ApprovalsList'
import {
  EXTRA_FORM, QUEUE_CARDS, TIME_OFF_FORM, employeeReimbursementsSample, extraSample, queueSample, reimbursementsSample, rmbDocSample, timeOffSample,
} from '@/lib/manual/samples/requests'

const EXAMPLE = { ok: true as const, toast: 'This is an example.' }
const noop = async () => EXAMPLE

/** The page with whatever opens over it, in a box tall enough for the window. */
function Frame({ minHeight, children }: { minHeight?: number; children: ReactNode }) {
  return (
    <InPicture.Provider value={true}>
      <div className="relative isolate" style={minHeight ? { minHeight } : undefined}>{children}</div>
    </InPicture.Provider>
  )
}

const TIME_OFF_API: TimeOffApi = { askTimeOff: noop, cancelTimeOff: noop, askCancelTimeOff: noop, retryTimeOffRippling: noop }

export function TimeOffPicture({ show }: { show: 'page' | 'ask' | 'drawer' | 'cancel' }) {
  if (show === 'ask') {
    return <Frame minHeight={760}><TimeOffView data={timeOffSample(true)} api={TIME_OFF_API} initial={{ modal: 'ask', form: TIME_OFF_FORM }} /></Frame>
  }
  if (show === 'drawer') return <Frame minHeight={640}><TimeOffView data={timeOffSample()} api={TIME_OFF_API} initial={{ drawer: 2 }} /></Frame>
  if (show === 'cancel') return <Frame minHeight={520}><TimeOffView data={timeOffSample()} api={TIME_OFF_API} initial={{ modal: 'cancel', drawer: 2 }} /></Frame>
  return <Frame><TimeOffView data={timeOffSample()} api={TIME_OFF_API} /></Frame>
}

export function ReimbursementsPicture({ show }: { show: 'page' | 'receipt' | 'mileage' | 'several' | 'employee' }) {
  // Receipts are files; the browser makes them (nothing is read or sent).
  const [files] = useState(() => ({
    internet: new File(['%PDF'], 'internet-november.pdf', { type: 'application/pdf' }),
    flight: new File(['%PDF'], 'flight-receipt.pdf', { type: 'application/pdf' }),
    dinner: new File(['img'], 'dinner.jpg', { type: 'image/jpeg' }),
  }))
  const send = async () => ({ ok: true as const })
  const draft: Partial<Draft> | null = show === 'receipt'
    ? { file: files.internet, fileLabel: 'PDF, 1 page, 96 KB', date: 'Nov 9, 2026', category: 'Internet', amount: '39.00', what: 'Home internet, November.' }
    : show === 'mileage'
      ? { file: null, fileLabel: '', date: 'Nov 4, 2026', category: 'Mileage', miles: '42', what: 'Home to the airport and back' }
      : show === 'several'
        ? {
          name: 'Northwind Foods visit, Nov 3 to 4', client: 'Northwind Foods', billable: 'yes',
          file: files.flight, fileLabel: 'PDF, 180 KB', date: 'Nov 3, 2026', category: 'Travel', amount: '286.40', what: 'Flight to the client, round trip',
          more: [
            { file: files.dinner, fileLabel: 'Photo, 640 KB', date: 'Nov 3, 2026', category: 'Meals while travelling', amount: '22.50', what: 'Dinner on the trip' },
            { file: null, fileLabel: '', date: 'Nov 4, 2026', category: 'Mileage', amount: '', miles: '42', what: 'Home to the airport and back' },
          ],
        }
        : null
  if (show === 'employee') return <Frame><ReimbursementsView data={employeeReimbursementsSample()} send={send} markRmbPaid={noop} /></Frame>
  if (!draft) return <Frame><ReimbursementsView data={reimbursementsSample()} send={send} markRmbPaid={noop} /></Frame>
  return (
    <Frame minHeight={show === 'several' ? 860 : 760}>
      <ReimbursementsView data={reimbursementsSample()} send={send} markRmbPaid={noop} initial={{ form: true, draft }} />
    </Frame>
  )
}

export function RmbDocPicture() {
  return (
    <Frame>
      <RmbDocView d={rmbDocSample()} api={{ getPayDoc: async () => ({ ok: false, error: 'This is an example.' }), markRmbPaid: noop }} initial={{ sample: true }} />
    </Frame>
  )
}

export function ExtraHoursPicture({ show }: { show: 'page' | 'ask' }) {
  if (show === 'ask') return <Frame minHeight={640}><ExtraHoursView data={extraSample(true)} api={{ askExtraHours: noop }} initial={{ form: true, draft: EXTRA_FORM }} /></Frame>
  return <Frame><ExtraHoursView data={extraSample()} api={{ askExtraHours: noop }} /></Frame>
}

const QUEUE_API: QueueApi = {
  getQueue: async () => ({ ok: true, data: queueSample() }),
  getEntryHistory: async () => ({ ok: false, error: 'This is an example.' }),
  decideCorrection: noop, decideTimeOff: noop, decideTimeOffCancel: noop, decideReimbursement: noop, decideReimbursementReport: noop, decideExtraHours: noop,
}

export function ApprovalsPicture({ open, tab }: { open?: keyof typeof QUEUE_CARDS; tab?: 'wait' | 'others' | 'done' }) {
  const height = open === 'off' ? 860 : open === 'rmb' ? 760 : open === 'xh' ? 620 : undefined
  return (
    <Frame minHeight={height}>
      <ApprovalsList initialData={queueSample()} api={QUEUE_API} initial={{ tab, request: open ? QUEUE_CARDS[open] : undefined }} />
    </Frame>
  )
}
