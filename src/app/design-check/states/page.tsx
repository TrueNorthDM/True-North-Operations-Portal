// Screens 2.1 to 2.8: the states the list can be in, side by side.
//
// Each one is the real component with the data that produces that state, not a
// picture of it: 2.1 is a block whose rows are genuinely empty, 2.7 is the
// segmented control with no person behind the login. A state that only exists
// in a mock is a state nobody has tested.

import { notFound } from 'next/navigation'
import { WorkList } from '@/components/monday/WorkList'
import type { WorkRow, Worklist } from '@/lib/monday/worklist/data'

export const dynamic = 'force-dynamic'

const day = (o: number) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10) }

const row = (n: number, o: Partial<WorkRow> = {}): WorkRow => ({
  id: n, boardId: 1, boardName: 'AAAF Publishing', workspaceName: 'AAAF',
  itemId: 100 + n, itemName: 'Portuguese', parentItemName: 'How do Adventists read the Bible?',
  language: null, groupTitle: null, stepName: 'Translate', peopleCol: 'people', statusText: 'Working on it', statusColor: '#FDAB3D',
  statusDone: false, mondayUserId: 1, who: 'Lana Prado', itemUpdatedAt: null,
  dueDate: day(-12), dueSuspect: false, dueLabel: 'Due Date',
  url: 'https://x.monday.com/boards/1/pulses/1', assigneeKnown: true, priority: 'medium', ...o,
})

const base = (rows: WorkRow[], over: Partial<Worklist> = {}): Worklist => ({
  rows,
  open: rows.filter(r => r.statusDone !== true).length,
  total: rows.length,
  unlinked: 0,
  unlinkedAssignments: 0,
  truncated: false,
  matching: rows.length,
  oldestSyncAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
  ...over,
})

function State({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-[#dcd8cc] rounded-[16px] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#eceae2] bg-[#faf9f5]">
        <span className="font-(family-name:--font-display) font-black text-[11px] tracking-[.09em] text-tn-teal">{id}</span>
        <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{title}</span>
        {note && <span className="ml-auto text-[12px] text-muted">{note}</span>}
      </div>
      <div className="p-5 bg-[#f8f7f3]">{children}</div>
    </section>
  )
}

const ROWS = [row(1), row(2, { itemName: 'Spanish', priority: 'high' }), row(3, { itemName: 'French', priority: 'low' })]
const MANY = Array.from({ length: 260 }, (_, i) => row(10 + i, { itemName: `Item ${i + 1}` }))

// 2.9 lives on its own page: a thousand finished rows is more document than
// this one should carry.

export default function DesignCheckStates() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1340px] mx-auto space-y-5">
        <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] text-tn-ink m-0">
          2 · Estados da lista
        </h1>

        <State id="2.1" title="Bloco aberto e vazio">
          <WorkList data={base([])} people={[]} teams={[]} selfPersonId="me" />
        </State>

        <State id="2.2" title="Busca ativa" note="contagem troca para “matching”">
          <WorkList data={base(ROWS)} people={[]} teams={[]} selfPersonId="me" preview={{ query: 'late' }} />
        </State>

        <State id="2.3" title="Aviso do filtro de time" note="só com um time escolhido">
          <WorkList
            data={base(ROWS, { unlinked: 6, unlinkedAssignments: 43 })}
            people={[{ value: 'p1', label: 'Amy Marsh' }]}
            teams={[{ value: 't1', label: 'SEO' }]}
            selfPersonId="me"
            isAdmin
            preview={{ team: 't1' }}
          />
        </State>

        <State id="2.4" title="Lista truncada" note="tudo, sem pessoa nem time">
          <WorkList
            data={base(ROWS, { truncated: true, total: 3000, matching: 53412 })}
            people={[]} teams={[]} selfPersonId={null}
          />
        </State>

        <State id="2.5" title="Teto de 200 linhas">
          <WorkList data={base(MANY)} people={[]} teams={[]} selfPersonId="me" />
        </State>

        <State id="2.6" title="Carregando (troca de filtro)" note="lista a 60% até o servidor responder">
          <div className="opacity-60">
            <WorkList data={base(ROWS)} people={[]} teams={[]} selfPersonId="me" />
          </div>
        </State>

        <State id="2.7" title="“Mine” indisponível" note="login não ligado ao Directory">
          <WorkList data={base(ROWS)} people={[]} teams={[]} selfPersonId={null} preview={{ tip: true }} />
        </State>

        <State id="2.8" title="Todos os blocos fechados">
          <WorkList
            data={base([...ROWS, row(50, { assigneeKnown: false, who: 'Removed account 22812214' })])}
            people={[]} teams={[]} selfPersonId={null} preview={{ closed: true }}
          />
        </State>
      </div>
    </div>
  )
}
