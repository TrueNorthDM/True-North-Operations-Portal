/**
 * A payroll summary or a reimbursement document as the PDF page (Company
 * Settings.dc.html, the document window of 10P): the invoice's style, with
 * the document's own words in the band, its two parties, a four column table,
 * the total over the gold bar, the stamp once it is sent or paid, and the
 * footer with the logo. 620px wide, as the preview window shows it.
 *
 * No hooks: the PDF's print page renders it on the server.
 */

import Image from 'next/image'
import type { DocSheetData } from '@/lib/timeclock/pay-docs'

const LABEL = 'font-(family-name:--font-display) font-extrabold uppercase'
const COLS = 'grid grid-cols-[minmax(0,1fr)_92px_92px_96px] gap-2 px-2.5'

export function DocSheet({ doc }: { doc: DocSheetData }) {
  return (
    <div data-file={doc.file} className="w-[620px] min-h-[840px] box-border bg-white flex flex-col overflow-hidden">
      <div className="bg-tn-primary flex justify-between items-end gap-4 px-10 pt-[30px] pb-[26px]">
        <div>
          <div className={`${LABEL} text-[10px] tracking-[.16em] text-[#F2C40A]`}>{doc.kind}</div>
          <div data-doc-title className={`font-(family-name:--font-display) font-black text-[#ffffff] mt-1 whitespace-nowrap tabular-nums lining-nums ${doc.titleSize === 24 ? 'text-[24px]' : 'text-[28px]'}`}>{doc.title}</div>
        </div>
        <div className="grid grid-cols-[auto_auto] gap-x-3.5 gap-y-1 text-[11.5px] text-right whitespace-nowrap tabular-nums lining-nums">
          {doc.meta.map(m => [
            <span key={`${m.k}k`} className="text-[rgba(255,255,255,.62)]">{m.k}</span>,
            <span key={`${m.k}v`} className={`font-bold ${m.gold ? 'text-[#F2C40A]' : 'text-[#ffffff]'}`}>{m.v}</span>,
          ])}
        </div>
      </div>
      <div className="h-[3px] bg-[#F2C40A]" />
      <div className="flex-1 px-10 pt-7 pb-[26px] flex flex-col gap-[22px]">
        <div className="grid grid-cols-2 gap-4 text-[11.5px] leading-[1.6] text-foreground">
          {doc.parties.map(p => (
            <div key={p.k} className="min-w-0">
              <div className={`${LABEL} text-[9.5px] tracking-[.1em] text-tn-teal mb-1`}>{p.k}</div>
              <div className="text-tn-ink font-bold">{p.name}</div>
              <div>{p.l1}</div>
              <div>{p.l2}</div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-0.5">
          <div className={`${COLS} py-2 rounded-[8px] bg-tn-primary ${LABEL} text-[9.5px] tracking-[.08em] text-[#ffffff]`}>
            {doc.heads.map((h, i) => <span key={h} className={i ? 'text-right' : ''}>{h}</span>)}
          </div>
          {doc.rows.map((r, i) => (
            <div key={i} className={`${COLS} py-[9px] rounded-[8px] text-[11.5px] tabular-nums lining-nums ${i % 2 ? 'bg-[#faf9f5]' : 'bg-white'}`}>
              <span className="text-tn-ink font-semibold">{r.a}</span>
              <span className="text-right text-foreground">{r.b}</span>
              <span className="text-right text-foreground">{r.c}</span>
              <span className="text-right text-tn-ink font-bold">{r.d}</span>
            </div>
          ))}
        </div>
        <div className="self-end flex flex-col items-end gap-[5px] mt-1.5">
          <span className={`${LABEL} text-[10px] tracking-[.1em] text-muted whitespace-nowrap`}>{doc.totalLabel}</span>
          <span className="font-(family-name:--font-display) font-black text-tn-ink leading-[1.05] whitespace-nowrap tabular-nums lining-nums text-[30px]">{doc.total}</span>
          <span className="w-16 h-1 rounded-[2px] bg-[#F2C40A]" />
        </div>
        {doc.stamp && (
          <span className="self-start border-2 border-[#0d7a4f] text-[#0d7a4f] rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-black text-[13px] tracking-[.08em] uppercase tabular-nums lining-nums">{doc.stamp}</span>
        )}
        <div className="mt-auto flex justify-between items-center pt-3 border-t border-[var(--row-rule)] text-[9.5px] text-muted">
          <span className="flex items-center gap-2"><Image src="/logos/true-north.png" alt="True North" width={1352} height={705} className="h-[18px] w-auto" />Made by the True North Operations Portal</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  )
}
