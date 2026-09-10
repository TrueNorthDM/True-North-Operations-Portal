// Design check: the donation records screen, without a login.
//
// The real component on fixture rows, not a copy of it. The live figures are
// the seven imported months, which are all 'created' by the import and so show
// none of what the log is actually for. These add a corrected figure, a
// deletion, and an entry someone typed, so the states are all on screen.

import { DonationRecords } from '@/components/tsheets/DonationRecords'
import type { DonationEntry, DonationLogEntry } from '@/lib/timeclock/donations-ledger'

const IMPORT = 'Imported from the tracking sheet'

const ENTRIES: DonationEntry[] = [
  {
    id: 7, project: 'AAAF', projectName: 'AskAnAdventistFriend.com', month: '2026-07',
    amount: 630, note: 'Ed & other donations, from the tracking sheet',
    lastChangedAt: '2026-09-09T18:12:00Z', lastChangedBy: IMPORT, changes: 0,
  },
  {
    id: 6, project: 'AAAF', projectName: 'AskAnAdventistFriend.com', month: '2026-06',
    amount: 22482, note: 'Ed & other donations, from the tracking sheet',
    lastChangedAt: '2026-09-09T18:12:00Z', lastChangedBy: IMPORT, changes: 0,
  },
  {
    id: 5, project: 'Africa', projectName: 'Hope for Africa', month: '2026-06',
    amount: 1450, note: 'Two cheques, one online',
    lastChangedAt: '2026-09-10T09:41:00Z', lastChangedBy: 'Tina Mills', changes: 2,
  },
  {
    id: 3, project: 'AAAF', projectName: 'AskAnAdventistFriend.com', month: '2026-03',
    amount: 467, note: 'Ed & other donations, from the tracking sheet',
    lastChangedAt: null, lastChangedBy: null, changes: 0,
  },
]

const LOG: DonationLogEntry[] = [
  {
    id: 9, month: '2026-06', projectName: 'Hope for Africa', action: 'updated',
    amountBefore: 1200, amountAfter: 1450, noteBefore: 'Two cheques', noteAfter: 'Two cheques, one online',
    actor: 'Tina Mills', at: '2026-09-10T09:41:00Z',
  },
  {
    id: 8, month: '2026-05', projectName: 'Hope for Africa', action: 'deleted',
    amountBefore: 300, amountAfter: null, noteBefore: null, noteAfter: null,
    actor: 'Tina Mills', at: '2026-09-10T09:38:00Z',
  },
  {
    id: 7, month: '2026-06', projectName: 'Hope for Africa', action: 'created',
    amountBefore: null, amountAfter: 1200, noteBefore: null, noteAfter: 'Two cheques',
    actor: 'Tina Mills', at: '2026-09-10T09:30:00Z',
  },
  {
    id: 6, month: '2026-07', projectName: 'AskAnAdventistFriend.com', action: 'created',
    amountBefore: null, amountAfter: 630, noteBefore: null,
    noteAfter: 'Ed & other donations, from the tracking sheet',
    actor: IMPORT, at: '2026-09-09T18:12:00Z',
  },
]

export default function DonationRecordsDesignCheck() {
  return (
    <div className="min-h-screen bg-[var(--page-bg,#efedE8)] px-6 py-10">
      <div className="max-w-[1200px] mx-auto space-y-6">
        <div>
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check</p>
          <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Donation records</h1>
          <p className="mt-1.5 text-muted leading-relaxed max-w-[760px] m-0">
            The real screen on fixture rows. The live data is seven imported months that have never
            been touched, so these add a corrected figure, a deletion, and one an entry someone typed,
            to show what the log looks like once it has something in it.
          </p>
        </div>

        <DonationRecords entries={ENTRIES} log={LOG} years={['2026', '2025']} year={null} logMissing={false} canEdit />
      </div>
    </div>
  )
}
