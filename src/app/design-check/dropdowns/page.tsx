'use client'

// Screens 3.1 to 3.4: the states that only exist while somebody is pointing at
// something. Forced open here so they can be looked at without being chased.

import { Select } from '@/components/ui/Select'
import { OpenInMonday } from '@/components/monday/WorkList'

const PEOPLE = [
  { value: '', label: 'Anyone' },
  { value: 'p1', label: 'Amy Marsh' },
  { value: 'p2', label: 'Cheyenne Ruiz' },
  { value: 'p3', label: 'Lana Prado' },
  { value: 'p4', label: 'Kevin Brown' },
]

const TEAMS = [
  { value: '', label: 'All teams' },
  { value: 't1', label: 'SEO' },
  { value: 't2', label: 'Writing' },
  { value: 't3', label: 'Web' },
]

const TRIGGER = 'gap-2 px-3 py-[9px] rounded-[10px] border border-[var(--panel-border)] bg-white font-(family-name:--font-display) font-semibold text-[13px] text-muted'

function State({ id, title, note, tall, children }: {
  id: string; title: string; note?: string; tall?: boolean; children: React.ReactNode
}) {
  return (
    <section className="bg-white border border-[#dcd8cc] rounded-[16px] overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-[#eceae2] bg-[#faf9f5]">
        <span className="font-(family-name:--font-display) font-black text-[11px] tracking-[.09em] text-tn-teal">{id}</span>
        <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{title}</span>
        {note && <span className="ml-auto text-[12px] text-muted">{note}</span>}
      </div>
      {/* Room below for a menu or a label to hang into, since both are
          positioned out of the flow and would otherwise be clipped. */}
      <div className={`p-5 bg-[#f8f7f3] ${tall ? 'pb-[300px]' : 'pb-16'}`}>{children}</div>
    </section>
  )
}

export default function DesignCheckDropdowns() {
  // A client page cannot call notFound() at render, and NEXT_PUBLIC is not
  // set here, so the guard is the proxy's: /design-check is only routable in
  // development. Nothing on this page reads any real data either way.
  if (process.env.NODE_ENV === 'production') return null
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1340px] mx-auto space-y-5">
        <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] text-tn-ink m-0">
          3 · Popups e dropdowns
        </h1>

        <State id="3.1" title="Person aberto" tall>
          <Select
            value="p3"
            onChange={() => {}}
            options={PEOPLE}
            ariaLabel="Person"
            className={TRIGGER}
            searchable
            defaultOpen
          />
        </State>

        <State id="3.2" title="Sem resultado" tall>
          <Select
            value=""
            onChange={() => {}}
            options={PEOPLE}
            ariaLabel="Person"
            className={TRIGGER}
            searchable
            defaultOpen
            defaultQuery="zzz"
          />
        </State>

        <State id="3.3" title="Team aberto" tall>
          <Select
            value=""
            onChange={() => {}}
            options={TEAMS}
            ariaLabel="Team"
            className={TRIGGER}
            defaultOpen
          />
        </State>

        <State id="3.4" title="Abrir no Monday" note="a linha abre o histórico; o olho abre o Monday em outra aba">
          <div className="flex items-center gap-2.5 bg-white border border-[var(--panel-border)] rounded-[10px] px-3 py-2.5 max-w-[420px]">
            <span className="flex-1 text-[13px] font-semibold text-tn-ink">Portuguese</span>
            <OpenInMonday href="https://example.monday.com" label="Portuguese" showLabel />
          </div>
        </State>
      </div>
    </div>
  )
}
