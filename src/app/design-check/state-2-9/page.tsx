// 2.9 on its own page: the states page holds nine lists and one of them is a
// thousand rows, which is more document than a screenshot can hold.

import { notFound } from 'next/navigation'
import { WorkList } from '@/components/monday/WorkList'
import type { WorkRow, Worklist } from '@/lib/monday/worklist/data'

export const dynamic = 'force-dynamic'

const day = (o: number) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10) }

const row = (n: number, o: Partial<WorkRow> = {}): WorkRow => ({
  id: n, boardId: 1, boardName: 'AAAF Publishing', workspaceName: 'AAAF',
  itemId: 100 + n, itemName: 'French', parentItemName: 'How do Adventists read the Bible?',
  groupTitle: null, stepName: 'Translate', peopleCol: 'people', statusText: 'Done', statusColor: '#00C875',
  statusDone: true, mondayUserId: 1, who: 'Lana Prado', itemUpdatedAt: null,
  dueDate: day(-40), dueSuspect: false, dueLabel: 'Due Date',
  url: 'https://x.monday.com/boards/1/pulses/1', assigneeKnown: true, priority: 'medium', ...o,
})

// 1,236 finished plus 50 open, so both counts need their separator.
const DONE = Array.from({ length: 1236 }, (_, i) => row(1000 + i, { dueDate: day(-40 - (i % 120)) }))
const OPEN = Array.from({ length: 50 }, (_, i) =>
  row(i, { itemName: 'Spanish', statusText: 'Working on it', statusColor: '#FDAB3D', statusDone: false, dueDate: day(-12) }))

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

export default function State29() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1340px] mx-auto">
        <div className="bg-white border border-[#dcd8cc] rounded-[16px] overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-[#eceae2] bg-[#faf9f5]">
            <span className="font-(family-name:--font-display) font-black text-[11px] tracking-[.09em] text-tn-teal">2.9</span>
            <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">
              Completed aberto, com “Finished work: all of it”
            </span>
            <span className="ml-auto text-[12px] text-muted">o botão fica com a borda teal quando amplia o histórico</span>
          </div>
          <div className="p-5 bg-[#f8f7f3]">
            <WorkList
              data={DATA}
              people={[]}
              teams={[]}
              selfPersonId="me"
              preview={{ done: true, openCompleted: true, closed: true }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
