// The side panel's buttons on Home (design_handoff_home, README "Side panel"):
// each runs the same server action as the page behind its row, with the same
// rules (a reason to send back or decline, a note to approve hours over the
// allowance). The actions decide who may; this only routes the click.
//
// Two actions answer ok without resolving the row (audit, 25 October 2026):
// an invitation sent again leaves the person invited, and checks run now say
// what they found while the page, refreshed, decides whether the row stays.
// Those come back with `message`, and the row is not marked Done. An
// invitation whose email did not go out is a failure here: the panel shows why.

import type { PanelOp } from '@/lib/home/needs-you-model'
import { approveTimesheet, decideCorrection, decideExtraHours, decideInvoice, decideReimbursement, decideReimbursementReport, decideTimeOff, decideTimeOffCancel, returnTimesheet } from '@/app/(app)/clocky-hours/approvals/actions'
import { invitePerson } from '@/app/(app)/admin/people/actions'
import { runChecksNow } from '@/app/(app)/admin/automations/actions'

/** ok: the row is done. ok with `message`: it ran, the panel says this, and the row stays. */
export type RunResult = { ok: true; message?: string } | { ok: false; error: string }
export type Runner = (op: PanelOp, note: string) => Promise<RunResult>

const done = (r: { ok: boolean; error?: string }): RunResult => (r.ok ? { ok: true } : { ok: false, error: r.error ?? 'Not saved. Try again in a moment.' })

export const runPanelOp: Runner = async (op, note) => {
  switch (op.do) {
    case 'approve-timesheet': return done(await approveTimesheet({ id: op.id, note }))
    case 'return-timesheet': return done(await returnTimesheet({ id: op.id, reason: note }))
    case 'invoice': return done(await decideInvoice({ id: op.id, decision: op.decision, note }))
    case 'correction': return done(await decideCorrection({ id: op.id, decision: op.decision, note }))
    case 'time-off': return done(await (op.cancel ? decideTimeOffCancel : decideTimeOff)({ id: op.id, decision: op.decision, note }))
    case 'reimbursement': return done(await decideReimbursement({ id: op.id, decision: op.decision, note }))
    case 'reimbursement-report': return done(await decideReimbursementReport({ reportId: op.id, decisions: op.ids.map(id => ({ id, decision: op.decision, note })) }))
    case 'extra-hours': return done(await decideExtraHours({ id: op.id, decision: op.decision, note }))
    case 'resend-invite': {
      const r = await invitePerson(op.id)
      if (!r.ok) return { ok: false, error: r.error }
      return r.emailed ? { ok: true, message: `Sent again to ${r.loginEmail}.` } : { ok: false, error: `The email did not go out (${r.reason ?? 'no reason given'}).` }
    }
    case 'run-checks': {
      const r = await runChecksNow()
      return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.message }
    }
  }
}
