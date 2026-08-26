// A place to look at My Work without signing in, using the handoff's own rows.
//
// Only exists in development: rendering real people's work behind no login is
// not a preview, it is a leak, so the production build refuses to serve this.
//
// The fixtures are copied from the design file rather than invented, so what
// shows here is what the handoff drew, down to the odd year on the last row.

import { notFound } from 'next/navigation'
import { WorkList } from '@/components/monday/WorkList'
import type { WorkRow, Worklist } from '@/lib/monday/worklist/data'

export const dynamic = 'force-dynamic'

const row = (n: number, o: Partial<WorkRow>): WorkRow => ({
  id: n,
  boardId: 1,
  boardName: 'i7 Marketing',
  workspaceName: 'i7',
  itemId: 100 + n,
  itemName: 'Item',
  parentItemName: null,
  groupTitle: null,
  stepName: 'Approve',
  peopleCol: 'people',
  statusText: 'Stuck',
  statusColor: '#E2445C',
  statusDone: false,
  mondayUserId: 1,
  who: 'Kevin Brown',
  itemUpdatedAt: null,
  dueDate: null,
  dueSuspect: false,
  dueLabel: 'Due Date',
  url: 'https://truenorthdigitalmarketing.monday.com/boards/1/pulses/1',
  assigneeKnown: true,
  priority: 'high',
  ...o,
})

// Dates the handoff shows, expressed relative to today so the states hold.
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const OPEN: WorkRow[] = [
  row(1, { itemName: 'i7 Monthly Report — MME billing', boardName: 'i7 Marketing', workspaceName: 'i7', who: 'Kevin Brown', priority: 'high', stepName: 'Approve', statusText: 'Stuck', statusColor: '#E2445C', dueDate: day(-12) }),
  row(2, { itemName: 'SEO Bi-Weekly Company Report, Nov 25 2025', boardName: 'Team Reports Scheduled', workspaceName: 'Reports', who: 'Amy Marsh', priority: 'high', stepName: 'Write', statusText: 'Working on it', statusColor: '#FDAB3D', dueDate: day(-269) }),
  row(3, { itemName: 'Portuguese', parentItemName: 'How do Adventists read the Bible?', boardName: 'AAAF Publishing', workspaceName: 'AAAF', who: 'Lana Prado', priority: 'high', stepName: 'Translate', statusText: 'Working on it', statusColor: '#FDAB3D', dueDate: day(0) }),
  row(4, { itemName: 'SEO Bi-Weekly Company Report, Dec 9 2025', boardName: 'Team Reports Scheduled', workspaceName: 'Reports', who: 'Amy Marsh', priority: 'medium', stepName: 'Write', statusText: 'Working on it', statusColor: '#FDAB3D', dueDate: day(-254) }),
  row(5, { itemName: 'Spanish', parentItemName: 'What Adventists believe about health', boardName: 'AAAF Publishing', workspaceName: 'AAAF', who: 'Lana Prado', priority: 'medium', stepName: 'Review', statusText: 'Waiting for review', statusColor: '#579BFC', dueDate: day(4) }),
  row(6, { itemName: 'Landing copy pass', parentItemName: 'Hope For Africa launch page', boardName: 'HFA Publishing', workspaceName: 'HFA', who: 'Cheyenne Ruiz', priority: 'low', stepName: 'Publish', statusText: 'Ready to publish', statusColor: '#00C875', dueDate: '0202-08-21', dueSuspect: true }),
]

const DONE: WorkRow[] = Array.from({ length: 128 }, (_, i) =>
  row(100 + i, {
    itemName: 'French', parentItemName: 'How do Adventists read the Bible?',
    boardName: 'AAAF Publishing', workspaceName: 'AAAF', who: 'Lana Prado',
    priority: 'medium', stepName: 'Translate', statusText: 'Done', statusColor: '#00C875',
    statusDone: true, dueDate: day(-40),
  }))

const DATA: Worklist = {
  rows: [...OPEN, ...DONE],
  open: OPEN.length,
  total: OPEN.length + DONE.length,
  unlinked: 0,
  unlinkedAssignments: 0,
  truncated: false,
  matching: OPEN.length + DONE.length,
  oldestSyncAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
}

const UNKNOWN: WorkRow[] = Array.from({ length: 6 }, (_, i) =>
  row(900 + i, {
    itemName: 'Home Page', boardName: 'TCA Website', workspaceName: 'Marketing',
    who: 'Removed account 22812214', assigneeKnown: false, priority: 'medium',
    stepName: 'Editor', statusText: null, statusColor: null, dueDate: day(-1748),
  }))

export default async function DesignCheck(
  { searchParams }: { searchParams: Promise<{ view?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { view } = await searchParams
  const everyone = view === 'everyone'
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1340px] mx-auto space-y-6">
        <div className="flex items-center gap-2 text-[13px]">
          <span className="font-semibold text-muted">Dashboard</span>
          <span className="text-[#cbd2da]">/</span>
          <span className="font-semibold text-tn-ink">My Work</span>
        </div>

        <div className="flex items-start justify-between gap-5 flex-wrap pb-[18px] border-b border-[#e4e7ec]">
          <div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">My Work</h2>
            <p className="text-[14.5px] text-muted mt-1.5 m-0">Every step assigned to you across Monday, in one list.</p>
          </div>
          <div className="flex items-center bg-subtle border border-[#e4e7ec] rounded-[11px] p-1">
            <span className="inline-flex items-center gap-[7px] px-[15px] py-2 rounded-[8px] bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)] font-(family-name:--font-display) font-extrabold text-[13.5px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
              My Work
            </span>
            <span className="inline-flex items-center gap-[7px] px-[15px] py-2 rounded-[8px] text-muted font-(family-name:--font-display) font-extrabold text-[13.5px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              My Team
            </span>
          </div>
        </div>

        <WorkList
          data={everyone ? { ...DATA, rows: [...UNKNOWN, ...DATA.rows], open: DATA.open + UNKNOWN.length } : DATA}
          people={everyone ? [{ value: 'p1', label: 'Amy Marsh' }, { value: 'p2', label: 'Lana Prado' }] : []}
          teams={everyone ? [{ value: 't1', label: 'SEO' }, { value: 't2', label: 'Writing' }] : []}
          selfPersonId="me"
          isAdmin={false}
        />
      </div>
    </div>
  )
}
