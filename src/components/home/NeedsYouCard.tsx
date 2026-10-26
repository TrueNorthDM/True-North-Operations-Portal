'use client'

/**
 * Home's tabs card (design_handoff_home, README "3. Needs you / My Work /
 * Requests", Home Final.dc.html): one card, three tabs with their counts, and
 * a list that scrolls inside it. On a wide screen the card stretches to the
 * right column's height and the list takes what is left (contain: size, so
 * the rows never push the grid taller); below lg it stops at 420px.
 *
 * A row's button opens the side panel (HomeSidePanel); its navy button runs
 * the page's own action. A row resolved there fades to 45% with its title
 * struck through and "Done" for a button, and leaves the list on the next
 * load: the page is refreshed behind it, and the row is kept where it was
 * until then. A read that failed is one red line in its tab, a link to its
 * page when there is one. Your own requests open their page with the same
 * small button, as a link.
 *
 * When the panel closes on a row that no longer has its button (Done, or gone
 * after the refresh), focus goes to the row, or else to the tab, never lost on
 * the page (audit, 25 October 2026).
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import { EMPTY_TAB, tabCount, type HomeRow, type HomeTab, type NeedsYouData, type TabKey } from '@/lib/home/needs-you-model'
import { HomeSidePanel } from './HomeSidePanel'
import { runPanelOp, type Runner } from './needs-you-actions'
import { DUE_FG, TypeChip } from './needs-you-ui'
import { BTN_ICON } from '@/lib/ui/buttons'

const LABEL: Record<TabKey, string> = { needs: 'Needs you', work: 'My Work', mine: 'Requests' }

// The portal's small white button (owner, 25 October 2026): navy words and a green
// symbol, a check to approve or mark paid (as the Invoices page's own Mark paid) and
// an arrow for the rest; teal border on hover.
const ROW_BUTTON = 'flex-none inline-flex items-center gap-1.5 cursor-pointer border border-[var(--panel-border)] bg-white rounded-[9px] px-[11px] py-[7px] font-(family-name:--font-display) font-extrabold text-[12.5px] text-tn-ink transition-colors hover:border-tn-teal focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40'

function RowSymbol({ label }: { label: string }) {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.white} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={label.startsWith('Approve') || label === 'Mark paid' ? 'M5 12l5 5 9-10' : 'M9 6l6 6-6 6'} /></svg>
}

export function NeedsYouCard({ data, run, className = '' }: {
  data: NeedsYouData
  /** The panel's actions; a design check passes stubs. Left out, the real server actions, and a refresh after each. */
  run?: Runner
  /** The grid's placement, from the page. */
  className?: string
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [tab, setTab] = useState<TabKey>('needs')
  const [open, setOpen] = useState<HomeRow | null>(null)
  // Rows resolved here: kept in place, faded, until the page loads again.
  const [resolved, setResolved] = useState<Map<string, { row: HomeRow; tab: TabKey; at: number }>>(new Map())
  const card = useRef<HTMLDivElement>(null)
  // The row whose panel just closed: where focus goes if its button is gone.
  const [refocus, setRefocus] = useState<{ key: string } | null>(null)
  useEffect(() => {
    // Runs after useModal has put focus back (or failed to: a button no longer drawn).
    const el = card.current
    if (!refocus || !el || el.contains(document.activeElement)) return
    const row = [...el.querySelectorAll<HTMLElement>('[data-row]')].find(x => x.dataset.row === refocus.key)
    ;(row ?? el.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]'))?.focus()
  }, [refocus])

  const tabs: [TabKey, HomeTab][] = [['needs', data.needs], ...(data.work ? [['work', data.work] as [TabKey, HomeTab]] : []), ['mine', data.mine]]
  const done = new Set(resolved.keys())
  const rowsOf = (key: TabKey, t: HomeTab): HomeRow[] => {
    const rows = [...t.rows]
    for (const r of resolved.values()) {
      if (r.tab === key && !rows.some(x => x.key === r.row.key)) rows.splice(Math.min(r.at, rows.length), 0, r.row)
    }
    return rows
  }
  const current = tabs.find(([k]) => k === tab) ?? tabs[0]
  const all = rowsOf(current[0], current[1])
  // Money waiting to be paid is pinned to the top in its own colour (owner, 25 October 2026, option A).
  const pinned = all.filter(r => r.kind === 'pay' && r.href)
  const rows = all.filter(r => !pinned.includes(r))

  const close = (row: HomeRow) => { setOpen(null); setRefocus({ key: row.key }) }
  const resolve = (row: HomeRow) => {
    setResolved(prev => new Map(prev).set(row.key, { row, tab: current[0], at: Math.max(0, rows.findIndex(r => r.key === row.key)) }))
    close(row)
    if (!run) startTransition(() => router.refresh())
  }
  // Ran, and the row stays (an invitation sent again, checks run now): the server decides on the refresh.
  const ran = () => { if (!run) startTransition(() => router.refresh()) }

  return (
    <div ref={card} className={`flex flex-col bg-white rounded-[18px] border border-[var(--panel-border)] px-[22px] py-2 max-lg:max-h-[420px] ${className}`}>
      <div role="tablist" aria-label="What needs you" className="flex gap-1 border-b border-[var(--row-rule)] max-sm:overflow-x-auto max-sm:[scrollbar-width:none]">
        {tabs.map(([k, t]) => {
          const on = k === current[0]
          return (
            <button
              key={k} type="button" role="tab" id={`home-tab-${k}`} aria-selected={on} aria-controls="home-tab-list"
              onClick={() => setTab(k)}
              className="border-0 bg-transparent cursor-pointer pt-[14px] px-3 max-sm:px-2 pb-3 -mb-px flex flex-none items-center gap-2 whitespace-nowrap font-(family-name:--font-display) font-extrabold text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40 rounded-t-md"
              style={{ color: on ? '#012358' : '#8593a4', borderBottom: `2.5px solid ${on ? '#F2C40A' : 'transparent'}` }}
            >
              {LABEL[k]}
              <span className="min-w-5 h-5 box-border px-1.5 rounded-full text-[11px] flex items-center justify-center" style={{ background: on ? '#012358' : '#f1f3f6', color: on ? '#F2C40A' : '#5b6b82' }}>
                {tabCount(k, rowsOf(k, t), done)}
              </span>
            </button>
          )
        })}
      </div>

      <div
        id="home-tab-list" role="tabpanel" aria-labelledby={`home-tab-${current[0]}`}
        className="flex-1 min-h-0 lg:min-h-[250px] lg:[contain:size] overflow-y-auto pb-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden [-webkit-mask-image:linear-gradient(to_bottom,#000_calc(100%-28px),transparent)] [mask-image:linear-gradient(to_bottom,#000_calc(100%-28px),transparent)]"
      >
        {pinned.map(r => <PinnedPay key={r.key} row={r} />)}
        {current[1].errors.map(e => (
          <p key={e.text} role="status" className="m-0 py-[13px] border-b border-[#f1f3f6] text-[13px] font-semibold text-[#c8323d]">
            {e.href ? <Link href={e.href} className="text-inherit underline-offset-2 hover:underline">{e.text}</Link> : e.text}
          </p>
        ))}
        {rows.map(r => {
          const isDone = done.has(r.key)
          return (
            // On a phone the due and the button go to a line of their own, under the text.
            <div key={r.key} data-row={r.key} tabIndex={-1} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 py-[13px] border-b border-[#f1f3f6] focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40" style={{ opacity: isDone ? 0.45 : 1 }}>
              <TypeChip row={r} size={32} />
              <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                <span className="text-[14px] font-bold text-tn-ink" style={{ textDecoration: isDone ? 'line-through' : 'none' }}>{r.title}</span>
                <span className="text-[12.5px] text-muted tabular-nums">{r.sub}</span>
              </span>
              <span className="flex-none flex items-center gap-3 max-sm:basis-full max-sm:pl-11">
              {r.due && <span className="flex-none text-[12.5px] font-bold whitespace-nowrap" style={{ color: DUE_FG[r.due.tone] }}>{r.due.label}</span>}
              {r.button && r.panel && !isDone && (
                <button type="button" onClick={() => setOpen(r)} className={ROW_BUTTON}><RowSymbol label={r.button} />{r.button}</button>
              )}
              {r.button && !r.panel && r.href && (
                <Link href={r.href} className={ROW_BUTTON}><RowSymbol label={r.button} />{r.button}</Link>
              )}
              {isDone && <span className="flex-none text-[12px] font-bold text-[#0d7a4f]">Done</span>}
              </span>
            </div>
          )
        })}
        {!rows.length && !pinned.length && !current[1].errors.length && (
          <div className="py-[26px] text-center text-[13.5px] text-muted">{EMPTY_TAB[current[0]]}</div>
        )}
      </div>

      {open?.panel && <HomeSidePanel key={open.key} row={open} run={run ?? runPanelOp} onClose={() => close(open)} onDone={() => resolve(open)} onRan={ran} />}
    </div>
  )
}

const PAY_TONE = {
  late: { bg: '#fdeeef', border: '#f3c6ca', fg: '#c8323d', title: '#c8323d' },
  due: { bg: '#fdf8e7', border: '#f0e2a8', fg: '#8a6d1a', title: '#012358' },
} as const
const PAY_ICON = 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9.5 14.5 12 12l2.5 2.5'

/**
 * "Invoices to pay" / "Reimbursements to pay", pinned above the other rows:
 * red while one is past due, amber otherwise; the total large, and the navy
 * button (white words, gold symbol) to the page where Finance pays them.
 */
function PinnedPay({ row }: { row: HomeRow }) {
  const t = PAY_TONE[row.due?.tone === 'late' ? 'late' : 'due']
  return (
    <div data-row={row.key} tabIndex={-1} className="mt-3 mb-1 -mx-2.5 rounded-xl border px-3.5 py-3.5 flex flex-wrap sm:flex-nowrap items-center gap-x-3.5 gap-y-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-tn-teal/40" style={{ background: t.bg, borderColor: t.border }}>
      <span className="w-10 h-10 rounded-[11px] bg-white flex items-center justify-center flex-none" style={{ color: t.fg }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={PAY_ICON} /></svg>
      </span>
      <span className="flex-1 min-w-[150px] flex flex-col gap-0.5">
        <span className="font-(family-name:--font-display) font-extrabold text-[15px]" style={{ color: t.title }}>{row.title}</span>
        <span className="text-[12.5px] text-[#5b6b82] tabular-nums lining-nums">{row.sub}</span>
      </span>
      {row.figure && <span className="font-(family-name:--font-display) font-black text-[24px] leading-none text-tn-ink tabular-nums lining-nums whitespace-nowrap max-sm:pl-[54px]">{row.figure}</span>}
      <Link href={row.href!} className="inline-flex items-center gap-2 rounded-[10px] px-4 py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] whitespace-nowrap hover:bg-[#0a2f6b] max-sm:ml-auto">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={BTN_ICON.navy} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
        {row.button}
      </Link>
    </div>
  )
}

