'use client'

// The card with the prototype's rows and stubbed actions: nothing is sent to
// the server. A decline or send back without a reason answers as the action
// does; ?fail=1 makes every action answer as a refused one. Resend and Run
// checks answer with their message, as the real ones do. Mark paid answers as
// markInvoicePaid and markRmbPaid do about the day: none, or one after the
// sample's today.

import { NeedsYouCard } from '@/components/home/NeedsYouCard'
import type { Runner } from '@/components/home/needs-you-actions'
import type { NeedsYouData } from '@/lib/home/needs-you-model'

export function NeedsYouPreview({ data, fail }: { data: NeedsYouData; fail: boolean }) {
  const run: Runner = async (op, note, paid) => {
    await new Promise(r => setTimeout(r, 400))
    if (fail) return { ok: false, error: 'View Stage is only a preview. Close it to decide.' }
    const reasoned = ('decision' in op && op.decision !== 'approve') || op.do === 'return-timesheet'
    if (reasoned && !note.trim()) return { ok: false, error: 'Type the reason for the change first.' }
    // As the real actions answer: these two run and leave the row where it is.
    if (op.do === 'resend-invite') return { ok: true, message: 'Sent again to someone@goodnewsadvocates.org.' }
    if (op.do === 'run-checks') return { ok: true, message: 'Checks finished: 1 service needs attention.' }
    if (op.do === 'pay-invoice' || op.do === 'pay-document') {
      if (!paid) return { ok: false, error: 'Write the day it was paid, like Nov 3, 2026.' }
      if (data.today && paid.paidOn > data.today) return { ok: false, error: 'Paid on cannot be after today.' }
    }
    return { ok: true }
  }
  return <NeedsYouCard data={data} run={run} className="lg:col-start-1 lg:row-start-1 lg:self-stretch" />
}
