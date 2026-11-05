'use client'

/**
 * "Who made it" beside one invoice (owner, 4 November 2026; the approved
 * mockup "Invoice page: who made it"): the contractor who sent it, when and
 * signed in as whom, how they made it (their own file or the invoice
 * builder), the sentence they confirmed, and what their invoice says. The
 * same facts are the record page of the invoice's PDF (lib/timeclock/invoice-record.ts).
 */

import type { RecordWho } from '@/lib/timeclock/invoice-record'
import { withViewAs } from '@/components/ViewAsKeeper'
import { BTN } from '@/lib/ui/buttons'
import { CARD, CARD_TITLE } from '@/lib/ui/type'

export function WhoMadeIt({ who, ownPdf }: { who: RecordWho; ownPdf?: { href: string; name: string } | null }) {
  return (
    <div className={`${CARD} p-[18px] flex flex-col gap-3`}>
      <span className={CARD_TITLE}>Who made it</span>
      <div className="flex gap-3 items-center">
        <span aria-hidden="true" className="w-10 h-10 rounded-full bg-tn-primary text-[#ffffff] font-bold text-[13px] flex items-center justify-center flex-none">{who.initials}</span>
        <span className="flex flex-col min-w-0 gap-0.5">
          <b className="text-[13.5px] text-tn-ink leading-[1.35]">{who.headline}</b>
          {(who.sentOn || who.email) && (
            <span className="text-[12px] text-muted leading-[1.45] [overflow-wrap:anywhere]">{[who.sentOn, who.email && `${who.email.label.toLowerCase()} ${who.email.value}`].filter(Boolean).join(' · ')}</span>
          )}
        </span>
      </div>
      {who.sentOn && (
        <div className="flex flex-col gap-1.5 text-[13px] leading-[1.5] text-foreground">
          <span className="[overflow-wrap:anywhere]"><b className="text-tn-ink">How:</b> {who.how}</span>
          {who.confirmed && <span><b className="text-tn-ink">Confirmed:</b> &ldquo;{who.confirmed}&rdquo;</span>}
          {who.numbers && <span className="tabular-nums lining-nums"><b className="text-tn-ink">What they typed:</b> {who.numbers}</span>}
        </div>
      )}
      {ownPdf && (
        <a href={withViewAs(ownPdf.href)} target="_blank" rel="noreferrer" className={`${BTN.navy} justify-center`}>Open their PDF</a>
      )}
    </div>
  )
}
