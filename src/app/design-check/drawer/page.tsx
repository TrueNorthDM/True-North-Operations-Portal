'use client'

// Screens 4.1 to 4.4: the four things the history drawer can be showing.
//
// Each panel is handed its state directly instead of being asked to fetch one,
// which is the only way to look at "asking", "empty" and "failed" side by side:
// two of them are moments and one needs Monday to be down.

import { useState } from 'react'
import { HistoryPanel, type HistoryEvent } from '@/components/monday/WorkList'
import type { WorkRow } from '@/lib/monday/worklist/data'

const day = (o: number) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10) }

const row = (o: Partial<WorkRow> = {}): WorkRow => ({
  id: 1, boardId: 1, boardName: 'AAAF Publishing', workspaceName: 'AAAF',
  itemId: 1, itemName: 'Portuguese', parentItemName: 'How do Adventists read the Bible?',
  language: null, groupTitle: null, stepName: 'Translate', peopleCol: 'people', statusText: 'Working on it', statusColor: '#FDAB3D',
  statusDone: false, mondayUserId: 1, who: 'Lana Prado', itemUpdatedAt: null,
  dueDate: day(0), dueSuspect: false, dueLabel: 'Due',
  url: 'https://example.monday.com', assigneeKnown: true, priority: 'high', ...o,
})

const EVENTS: HistoryEvent[] = [
  { id: '1', event: 'update_column_value', at: '2026-08-19T16:12:00Z', userId: 1, column: 'Status', from: 'Waiting for review', to: 'Working on it' },
  { id: '2', event: 'update_column_value', at: '2026-08-12T09:03:00Z', userId: 2, column: 'Due date', from: 'Aug 14, 2026', to: 'Aug 20, 2026' },
  { id: '3', event: 'update_column_value', at: '2026-08-02T11:40:00Z', userId: 2, column: 'Assignee', from: null, to: 'Lana Prado' },
  { id: '4', event: 'create_pulse', at: '2026-07-28T14:18:00Z', userId: null, column: null, from: null, to: null },
]

const NAMES = { 1: 'Lana Prado', 2: 'Wendy Clark' }

const STATES = [
  { id: '4.1', title: 'Carregado', row: row(), state: { loading: false, events: EVENTS, names: NAMES } },
  { id: '4.2', title: 'Buscando', row: row({ boardName: 'i7 Marketing', itemName: 'i7 Monthly Report - MME billing', parentItemName: null, dueDate: null }), state: { loading: true } },
  { id: '4.3', title: 'Log vazio', row: row({ boardName: 'Team Reports Scheduled', itemName: 'SEO Bi-Weekly Company Report, Nov 25 2025', parentItemName: null, dueDate: null }), state: { loading: false, events: [] } },
  { id: '4.4', title: 'Erro', row: row({ boardName: 'HFA Publishing', itemName: 'Hope For Africa launch page', parentItemName: null, dueDate: null }), state: { loading: false, error: 'Monday returned 429: rate limit exceeded. Try again in a minute.' } },
]

export default function DesignCheckDrawer() {
  const [open, setOpen] = useState(0)
  if (process.env.NODE_ENV === 'production') return null

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1340px] mx-auto space-y-5">
        <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] text-tn-ink m-0">
          4 · Drawer de histórico
        </h1>
        <p className="text-[13px] text-muted m-0">Clique num estado para abri-lo.</p>

        {/* Above the drawer's own overlay, which covers the page by design. */}
        <div className="relative z-[60] flex gap-2.5 flex-wrap">
          {STATES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setOpen(i)}
              className={`px-4 py-2.5 rounded-[10px] border text-[13px] font-semibold transition-colors ${
                open === i ? 'border-tn-teal text-tn-teal bg-[rgba(30,125,127,.07)]' : 'border-[var(--panel-border)] bg-white text-muted hover:text-tn-ink'
              }`}
            >
              {s.id} · {s.title}
            </button>
          ))}
        </div>

        <HistoryPanel row={STATES[open].row} state={STATES[open].state} onClose={() => {}} />
      </div>
    </div>
  )
}
