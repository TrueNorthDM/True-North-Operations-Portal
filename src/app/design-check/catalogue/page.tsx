// 6 · Catálogo de células.
//
// Not a screen. It is the reference sheet the handoff ends with, and its use is
// as a checklist: every badge the list can draw, side by side, so a value that
// drifted is visible without hunting for the row that produces it.
//
// Rendered from the same constants the table uses, not copied. A catalogue that
// restates the values proves nothing; this one goes wrong the moment the table
// does.

import { notFound } from 'next/navigation'
import { chip, PRIORITY_CHIP, DUE_BADGE, DUE_TIME, STATUS_COLOURS, type DueState } from '@/components/monday/tokens'

export const dynamic = 'force-dynamic'

function Column({ title, children, note }: { title: string; children: React.ReactNode; note?: string }) {
  return (
    <div>
      <div className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.07em] uppercase text-muted mb-3.5">
        {title}
      </div>
      <div className="flex flex-col gap-2.5 items-start">{children}</div>
      {note && <p className="text-[12px] text-muted leading-[1.55] mt-3.5 m-0">{note}</p>}
    </div>
  )
}

export default function Catalogue() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1340px] mx-auto space-y-5">
        <h1 className="font-(family-name:--font-display) font-extrabold text-[24px] text-tn-ink m-0">
          6 · Catálogo de células
        </h1>

        <div className="bg-white border border-[#dcd8cc] rounded-[16px] p-7 grid gap-7 md:grid-cols-2 xl:grid-cols-4">
          <Column
            title="Priority"
            note="On-going é o único bloco ordenado por prioridade; dentro de cada faixa, a data decide."
          >
            {(['high', 'medium', 'low'] as const).map(k => (
              <span key={k} className={`${chip} ${PRIORITY_CHIP[k]}`}>{k}</span>
            ))}
          </Column>

          <Column title="Status (cor do board)">
            {STATUS_COLOURS.map(([label, colour]) => (
              <span key={label} className={`${chip} text-white`} style={{ background: colour }}>{label}</span>
            ))}
            <span className={`${chip} bg-[var(--chip-neutral-bg)] text-[var(--chip-neutral-fg)]`}>sem cor no board</span>
          </Column>

          <Column
            title="Prazo"
            note="Coluna Time: 8m 26d atrasado, in 4d a vencer, vazio quando é hoje."
          >
            {(['late', 'today', 'upcoming', 'odd'] as DueState[]).map(k => (
              <span key={k} className={`${chip} ${DUE_BADGE[k].className}`}>{DUE_BADGE[k].label}</span>
            ))}
            <div className="flex gap-3 mt-1 text-[12px]">
              <span className={DUE_TIME.late}>8m 26d</span>
              <span className={DUE_TIME.upcoming}>in 4d</span>
              <span className={DUE_TIME.odd}>—</span>
            </div>
          </Column>

          <Column title="Vazios e regras">
            <div className="flex flex-col gap-2.5 text-[12.5px] text-muted leading-[1.55]">
              <span><span className="text-[var(--faint)] font-bold">-</span>&nbsp;&nbsp;célula sem valor (parent, status, due, link)</span>
              <span>Uma linha é um <strong className="text-tn-ink font-semibold">step</strong>, não um item: três steps do mesmo item = três linhas.</span>
              <span>Nome do item e do board quebram em até duas linhas; a data nunca quebra.</span>
              <span>Data suspeita (ano 202) não vira “1824y late”: vira <strong className="text-tn-ink font-semibold">Check date</strong>.</span>
            </div>
          </Column>
        </div>
      </div>
    </div>
  )
}
