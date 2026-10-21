// The Clocky report as one landscape page (Reports.dc.html 12C): the cards,
// by person and by client. The same sheet is the preview and, through the
// print page, the PDF (lib/pdf/sheet-pdf.ts, 860px wide).

import Image from 'next/image'
import type { ReportView } from '@/lib/timeclock/reports'

export function ReportSheet({ view, scope, file, made }: { view: ReportView; scope: string; file: string; made: string }) {
  return (
    <div className="print-doc w-[860px] flex-none min-h-[600px] box-border bg-white px-10 py-9 flex flex-col gap-[18px] leading-[normal]" data-file={`${file}.pdf`}>
      <div className="flex justify-between items-end gap-4 border-b-2 border-tn-primary pb-3">
        <div>
          <div className="font-(family-name:--font-display) font-black text-[24px] text-tn-ink" data-doc-title>Clocky report</div>
          <div className="text-[12px] text-foreground mt-[3px]">{scope}</div>
        </div>
        <div className="flex items-end gap-2">
          <Image src="/logos/true-north.png" alt="True North Digital Marketing" width={1352} height={705} className="h-[30px] w-auto" />
          <span className="text-[11px] text-muted pb-0.5">Operations Portal</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-2.5">
        {view.cards.map(c => (
          <div key={c.label} className="border border-[var(--panel-border)] rounded-[10px] px-3 py-2.5">
            <div className="font-(family-name:--font-display) font-extrabold text-[9px] tracking-[.08em] uppercase text-muted">{c.label}</div>
            <div className="font-(family-name:--font-display) font-black text-[17px] text-tn-ink mt-[3px] tabular-nums lining-nums">{c.val}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-[18px]">
        <div className="flex flex-col">
          <div className="font-(family-name:--font-display) font-extrabold text-[12px] text-tn-ink pb-1.5">By person</div>
          {view.byPerson.map(p => (
            <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_70px_60px_80px] gap-2 py-[5px] border-b border-[var(--row-rule)] text-[11px] tabular-nums lining-nums">
              <span className="text-tn-ink font-semibold">{p.name}</span>
              <span className="text-right">{p.hours}</span>
              <span className="text-right" style={{ color: p.overTone === 'bad' ? '#c8323d' : p.overTone === 'warn' ? '#8a6d1a' : '#cbd2da' }}>{p.over}</span>
              <span className="text-right">{p.last}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          <div className="font-(family-name:--font-display) font-extrabold text-[12px] text-tn-ink pb-1.5">By client</div>
          {view.byClient.map(c => (
            <div key={c.label} className="grid grid-cols-[minmax(0,1fr)_70px] gap-2 py-[5px] border-b border-[var(--row-rule)] text-[11px] tabular-nums lining-nums">
              <span className="text-tn-ink font-semibold">{c.label}</span>
              <span className="text-right">{c.hours}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-auto flex justify-between text-[10px] text-muted border-t border-[var(--row-rule)] pt-2.5">
        <span>Made by the True North Operations Portal on {made}. Totals in multiples of 15 minutes.</span>
      </div>
    </div>
  )
}
