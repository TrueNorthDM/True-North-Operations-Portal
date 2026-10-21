/**
 * The invoice as a document (README_PART2 "Invoice / PDF style": option 1a
 * with 1b's total and table header): a navy band with "INVOICE" in gold and
 * the number, a 3px gold rule, From and To in teal labels, a navy table
 * header, zebra rows, reimbursements as rows, the total right aligned over a
 * short gold bar, and a footer with the logo. Paid ones carry a green stamp.
 *
 *   card   inside the 6C page and the invoice detail (no From/To, no footer)
 *   page   the PDF page (620px wide, as the preview window shows it)
 *
 * No hooks: the PDF's print page renders it on the server.
 */

import Image from 'next/image'

export interface InvoiceDocData {
  number: string
  date: string
  period: string
  due: string
  lines: { desc: string; hrs: string; muted: boolean; rate: string; amt: string }[]
  reimb: { desc: string; cat: string; amt: string }[]
  total: string
  from: { name: string; line: string; email: string }
  to: { name: string; line1: string; line2: string }
  paid: string | null
}

const LABEL = 'font-(family-name:--font-display) font-extrabold uppercase'

export function InvoiceDoc({ inv, variant }: { inv: InvoiceDocData; variant: 'card' | 'page' }) {
  const page = variant === 'page'
  const rows = [...inv.lines.map((l, i) => ({ key: `l${i}`, kind: 'line' as const, l, i })), ...inv.reimb.map((r, j) => ({ key: `r${j}`, kind: 'reimb' as const, r, i: inv.lines.length + j }))]
  const fs = page ? 'text-[11.5px]' : 'text-[12.5px]'
  return (
    <div className={page ? 'w-[620px] min-h-[840px] box-border bg-white flex flex-col overflow-hidden' : ''}>
      <div className={`bg-tn-primary flex justify-between items-end gap-4 ${page ? 'px-10 pt-[30px] pb-[26px]' : 'px-[18px] py-4'}`}>
        <div>
          <div className={`${LABEL} text-[10px] tracking-[.16em] text-[#F2C40A]`}>Invoice</div>
          <div className={`font-(family-name:--font-display) font-black text-[#ffffff] mt-1 whitespace-nowrap tabular-nums lining-nums ${page ? 'text-[28px]' : 'text-[20px]'}`}>{inv.number}</div>
        </div>
        <div className="grid grid-cols-[auto_auto] gap-x-3.5 gap-y-1 text-[11.5px] text-right whitespace-nowrap tabular-nums lining-nums">
          <span className="text-[rgba(255,255,255,.62)]">Date</span><span className="text-[#ffffff] font-semibold">{inv.date}</span>
          <span className="text-[rgba(255,255,255,.62)]">Period</span><span className="text-[#ffffff] font-semibold">{inv.period}</span>
          <span className="text-[rgba(255,255,255,.62)]">Due</span><span className="text-[#F2C40A] font-bold">{inv.due}</span>
        </div>
      </div>
      <div className="h-[3px] bg-[#F2C40A]" />
      <div className={page ? 'flex-1 px-10 pt-7 pb-[26px] flex flex-col gap-[22px]' : 'px-[18px] pt-4 pb-[18px] flex flex-col gap-0.5'}>
        {page && (
          <div className="grid grid-cols-2 gap-4 text-[11.5px] leading-[1.6] text-foreground">
            <div className="min-w-0">
              <div className={`${LABEL} text-[9.5px] tracking-[.1em] text-tn-teal mb-1`}>From</div>
              <div className="text-tn-ink font-bold">{inv.from.name}</div>
              <div>{inv.from.line}</div>
              <div className="truncate">{inv.from.email}</div>
            </div>
            <div className="min-w-0">
              <div className={`${LABEL} text-[9.5px] tracking-[.1em] text-tn-teal mb-1`}>To</div>
              <div className="text-tn-ink font-bold">{inv.to.name}</div>
              <div>{inv.to.line1}</div>
              <div>{inv.to.line2}</div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <div className={`grid grid-cols-[minmax(0,1fr)_76px_66px_94px] gap-2 px-2.5 py-2 rounded-[8px] bg-tn-primary ${LABEL} text-[9.5px] tracking-[.08em] text-[#ffffff]`}>
            <span>Description</span><span className="text-right">Hours</span><span className="text-right">Rate</span><span className="text-right">Amount</span>
          </div>
          {rows.map(x => x.kind === 'line' ? (
            <div key={x.key} className={`grid grid-cols-[minmax(0,1fr)_76px_66px_94px] gap-2 px-2.5 py-[9px] rounded-[8px] ${fs} tabular-nums lining-nums ${x.i % 2 ? 'bg-[#faf9f5]' : 'bg-white'}`}>
              <span className="text-tn-ink font-semibold min-w-0">{x.l.desc}</span>
              <span className={`text-right ${x.l.muted ? 'text-muted' : 'text-foreground'}`}>{x.l.hrs}</span>
              <span className="text-right text-foreground">{x.l.rate}</span>
              <span className="text-right text-tn-ink font-bold">{x.l.amt}</span>
            </div>
          ) : (
            <div key={x.key} className={`grid grid-cols-[minmax(0,1fr)_94px] gap-2 px-2.5 py-[9px] rounded-[8px] ${fs} tabular-nums lining-nums items-center ${x.i % 2 ? 'bg-[#faf9f5]' : 'bg-white'}`}>
              <span className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="text-tn-ink font-semibold">Reimbursement: {x.r.desc}</span>
                <span className="text-[11px] text-muted">{x.r.cat}, receipt attached</span>
              </span>
              <span className="text-right text-tn-ink font-bold">{x.r.amt}</span>
            </div>
          ))}
        </div>
        <div className="self-end flex flex-col items-end gap-[5px] mt-1.5">
          <span className={`${LABEL} text-[10px] tracking-[.1em] text-muted whitespace-nowrap`}>Total due</span>
          <span className={`font-(family-name:--font-display) font-black text-tn-ink leading-[1.05] whitespace-nowrap tabular-nums lining-nums ${page ? 'text-[30px]' : 'text-[28px]'}`}>{inv.total}</span>
          <span className="w-16 h-1 rounded-[2px] bg-[#F2C40A]" />
        </div>
        {inv.paid && (
          <span className="self-start mt-2 border-2 border-[#1E9E6A] text-[#0d7a4f] rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-extrabold text-[12px] tracking-[.04em] uppercase tabular-nums lining-nums">{inv.paid}</span>
        )}
        {page && (
          <div className="mt-auto flex justify-between items-center pt-3 border-t border-[var(--row-rule)] text-[9.5px] text-muted">
            <span className="flex items-center gap-2"><Image src="/logos/true-north.png" alt="True North" width={1352} height={705} className="h-[18px] w-auto" />Made by the True North Operations Portal</span>
            <span>Page 1 of 1</span>
          </div>
        )}
      </div>
    </div>
  )
}
