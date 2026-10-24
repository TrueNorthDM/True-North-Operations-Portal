'use client'

// The Requests frames (Requests.dc.html 7A to 10C): the real screens with the
// prototype's data (requests-sample.ts). Sending answers as the prototype's
// toasts; nothing saves.

import { useState } from 'react'
import { TimeOffView } from '@/components/requests/TimeOffView'
import { ReimbursementsView } from '@/components/requests/ReimbursementsView'
import { RmbDocView } from '@/components/requests/RmbDocView'
import { ExtraHoursView } from '@/components/requests/ExtraHoursView'
import type { TimeOffPage } from '@/lib/timeclock/time-off-data'
import type { ExtraPage, ReimbursementsPage, RmbDocPage } from '@/lib/timeclock/requests-data'
import type { DocSheetData } from '@/lib/timeclock/pay-docs'

export function RequestsCheck({ frame, timeOff, rmb, doc, sheet, extra }: { frame: string; timeOff?: TimeOffPage; rmb?: ReimbursementsPage; doc?: RmbDocPage; sheet?: DocSheetData; extra?: ExtraPage }) {
  const [file] = useState(() => (frame === '9A' ? new File(['%PDF'], 'safaricom-oct.pdf', { type: 'application/pdf' }) : frame === '9Ap' ? new File(['img'], 'IMG_4471.jpg', { type: 'image/jpeg' }) : frame === '9Ar' ? new File(['%PDF'], 'latam-gru.pdf', { type: 'application/pdf' }) : null))
  // 9Ar: a trip, four receipts in one request (owner, 2026-10-23).
  const [trip] = useState(() => frame === '9Ar' ? [
    { file: new File(['%PDF'], 'hotel-ibis.pdf', { type: 'application/pdf' }), fileLabel: 'PDF, 210 KB', date: 'Oct 15, 2026', category: 'Travel', amount: '378.60', what: 'Hotel, 3 nights' },
    { file: new File(['img'], 'uber-oct13.jpg', { type: 'image/jpeg' }), fileLabel: 'Photo, 640 KB', date: 'Oct 13, 2026', category: 'Travel', amount: '18.40', what: 'Uber to the client' },
    { file: new File(['img'], 'lunch.jpg', { type: 'image/jpeg' }), fileLabel: 'Photo, 1.1 MB', date: 'Oct 13, 2026', category: 'Meals with a client', amount: '64.00', what: 'Lunch with the i7 team' },
  ] : [])
  if (timeOff) {
    const ok = async () => ({ ok: true as const, toast: 'Sent. A Super Admin decides; you hear back in the bell.' })
    return (
      <TimeOffView key={frame} data={timeOff} api={{ askTimeOff: ok, cancelTimeOff: async () => ({ ok: true, toast: 'Request cancelled. Nothing was sent anywhere.' }), askCancelTimeOff: async () => ({ ok: true, toast: 'Asked. When a Super Admin approves, it comes off Rippling and the team calendar.' }), retryTimeOffRippling: async () => ({ ok: true, toast: 'Sent to Rippling, Nov 3, 2026, 9:41 AM.' }) }}
        initial={frame === '7A' || frame === '7Ap' ? { modal: 'ask', form: { type: 1, a: '2026-11-23', b: '2026-11-25', note: 'Family trip for Thanksgiving.', month: '2026-11' } }
          : frame === '7D' ? { drawer: 2 } : frame === '7Dx' ? { drawer: 5, tab: 'all' } : frame === '7E' ? { modal: 'cancel', drawer: 2 } : undefined} />
    )
  }
  if (rmb) {
    return (
      <ReimbursementsView key={frame} data={rmb} send={async () => ({ ok: true })}
        initial={frame === '9A' ? { form: true, draft: { file, fileLabel: 'PDF, 1 page, 96 KB', category: 'Internet', amount: '35.00', what: 'Home internet for October (Safaricom Home Fibre).', date: 'Oct 31, 2026' } }
          : frame === '9Ap' ? { form: true, draft: { file, fileLabel: 'Photo from the camera, 1.2 MB', category: 'Software', amount: '12.99', what: 'Canva Pro for November, for client social posts.', date: 'Oct 31, 2026' } }
          : frame === '9Be' ? { tab: 'all' }
          : frame === '9Ar' ? { form: true, draft: { file, fileLabel: 'PDF, 180 KB', category: 'Travel', amount: '412.00', what: 'Flight GRU, round trip', date: 'Oct 12, 2026', name: 'São Paulo trip, Oct 12 to 15', client: '2 - i7 Marketing', billable: 'yes', more: trip } } : undefined} />
    )
  }
  if (doc) {
    return <RmbDocView key={frame} d={doc} api={{ getPayDoc: async () => (sheet ? { ok: true, doc: sheet } : { ok: false, error: 'No sheet.' }), markRmbPaid: async () => ({ ok: true, toast: 'RMB-2026-0031 marked paid. Wendy Cacka sees it in the bell.' }) }}
      initial={frame === '9Dp' ? { pdf: sheet, sample: true } : { sample: true }} />
  }
  if (extra) {
    return <ExtraHoursView key={frame} data={extra} api={{ askExtraHours: async () => ({ ok: true, toast: 'Sent. A Super Admin decides on Approvals.' }) }}
      initial={frame === '10C' ? { form: true, draft: { why: 'Six extra i7 blog posts for the Q4 push, asked by the i7 team.', hours: '8', client: '2 - i7 Marketing' } } : undefined} />
  }
  return null
}
