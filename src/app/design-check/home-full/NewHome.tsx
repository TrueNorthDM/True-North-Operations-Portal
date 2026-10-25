// The whole new Home (design_handoff_home, 25 October 2026) on the
// prototype's sample, level by level (proto.ts), in the page's own layout
// (HomeLayout). Drawn by /design-check/home-full and by the shell check
// (/design-check/rail?page=home), with the prototype's switches above it.

import Link from 'next/link'
import { DayBanner } from '@/components/home/DayBanner'
import { HomeLayout } from '@/components/home/HomeLayout'
import { HomeAgendaCard } from '@/components/home/HomeAgendaCard'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { PayPeriodCard } from '@/components/home/PayPeriodCard'
import { PublishingGoalsWidget } from '@/components/home/PublishingGoalsWidget'
import { homeAgenda } from '@/lib/agenda/home'
import { dayCounts } from '@/lib/home/needs-you-model'
import { summaryLine } from '@/lib/home/day-banner'
import { NeedsYouPreview } from '@/app/design-check/home-needs-you/NeedsYouPreview'
import type { Level } from '@/app/design-check/home-needs-you/sample'
import { NORMAL } from '@/app/design-check/home-right/sample'
import { AAAF, BM, BM_FIRST, HFA, UPDATED } from '@/app/design-check/home-publishing/sample'
import { LEVELS, NOW, TODAY, agendaItemsOf, clockOf, needsOf, payOf, type PayMode } from './proto'

export interface HomeChoice { level: Level; pay: PayMode; bess: boolean }

export function readChoice(sp: Record<string, string | string[] | undefined>): HomeChoice {
  const level = (typeof sp.home === 'string' && sp.home in LEVELS ? sp.home : 'super') as Level
  const pay = (['auto', 'running', 'today', 'late', 'sent'].includes(String(sp.pay)) ? sp.pay : 'auto') as PayMode
  return { level, pay, bess: sp.bess !== '0' }
}

export function NewHome({ choice }: { choice: HomeChoice }) {
  const { level, pay, bess } = choice
  const L = LEVELS[level]
  const needs = needsOf(level)
  const rank = { super: 4, admin: 3, lead: 2, emp: 1, con: 1, fin: 1 }[level]
  return (
    <HomeLayout
      banner={<DayBanner firstName={L.first} zone="America/New_York" summary={summaryLine(dayCounts(needs))} serverNow={NOW} hasClock sample={clockOf(level)} />}
      needs={<NeedsYouPreview data={needs} fail={false} />}
      pay={<PayPeriodCard data={{ ok: true, view: payOf(level, pay).view }} />}
      right={
        <>
          <HomeAgendaCard agenda={homeAgenda(agendaItemsOf(level), TODAY, 10 + 46 / 60)} />
          {rank >= 3 && <I7BudgetWidget month="2026-10" carryover={NORMAL} />}
        </>
      }
      publishing={rank >= 2 ? <PublishingGoalsWidget data={{ boards: [AAAF, HFA, bess ? BM : BM_FIRST], updatedAt: UPDATED }} linked /> : null}
    />
  )
}

/** The prototype's three switches: the level, the Pay period's state, Bessemeters with or without data. */
export function HomeSwitches({ choice, base }: { choice: HomeChoice; base: string }) {
  const href = (c: Partial<HomeChoice>) => {
    const n = { ...choice, ...c }
    return `${base}${base.includes('?') ? '&' : '?'}home=${n.level}&pay=${n.pay}&bess=${n.bess ? 1 : 0}`
  }
  const pill = (on: boolean) => `rounded-[9px] px-3 py-2 text-[13px] font-semibold whitespace-nowrap ${on ? 'bg-[#012358] text-[#ffffff]' : 'text-[#435066]'}`
  const group = 'flex flex-wrap bg-white border border-[#d9d6cc] rounded-xl p-1 gap-0.5'
  const now = payOf(choice.level, choice.pay).state
  return (
    <div className="flex flex-wrap items-center gap-3 px-6 py-3 bg-[#e9e6dd] border-b border-[#d9d6cc]">
      <div className={group}>
        {(Object.keys(LEVELS) as Level[]).map(k => <Link key={k} href={href({ level: k })} className={pill(choice.level === k)}>{LEVELS[k].label}</Link>)}
      </div>
      <span className="text-[13.5px] font-bold text-[#012358]">Pay period:</span>
      <div className={group}>
        {([['auto', 'Auto'], ['running', 'Em andamento'], ['today', 'Fecha hoje'], ['late', 'Atrasado'], ['sent', 'Enviado']] as const).map(([k, l]) => (
          <Link key={k} href={href({ pay: k })} className={pill(choice.pay === k)}>{l}</Link>
        ))}
      </div>
      <span className="text-[13px] text-[#8593a4]">Agora: {{ running: 'em andamento', today: 'fecha hoje', late: 'atrasado', sent: 'enviado' }[now]}</span>
      <span className="text-[13.5px] font-bold text-[#012358]">Bessemeters:</span>
      <div className={group}>
        <Link href={href({ bess: false })} className={pill(!choice.bess)}>Sem dados (hoje)</Link>
        <Link href={href({ bess: true })} className={pill(choice.bess)}>Com dados</Link>
      </div>
    </div>
  )
}
