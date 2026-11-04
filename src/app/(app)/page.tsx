// Home (design_handoff_home, 25 October 2026): what each person needs to do
// today. The day banner across the top, then a grid: Needs you / My Work /
// Requests and the Pay period on the left, the Agenda and the i7 budget on the
// right, Publishing goals across the bottom.
//
// Every widget reads on its own and draws in its own Suspense boundary, with a
// skeleton of its own height: none waits for another (the page used to await
// everything in one Promise.all). A read that fails says so in its widget,
// never zeros and never a missing card. Each widget's gate is the one its page
// uses, so hiding it and not reading its data come from the same check.
//
// Off Home since this handoff: Favourites, the org chart (it has
// /organization), Birthdays and Work anniversaries (in the Agenda now), and the
// health banner (its alerts are Needs you rows).

import { Suspense } from 'react'
import { DayBanner } from '@/components/home/DayBanner'
import { HomeLayout } from '@/components/home/HomeLayout'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { PublishingGoalsWidget } from '@/components/home/PublishingGoalsWidget'
import { HomeAgendaCard } from '@/components/home/HomeAgendaCard'
import { PayPeriodCard } from '@/components/home/PayPeriodCard'
import { loadAccess, type Access } from '@/lib/access/resolve'
import { getCurrentPerson } from '@/lib/auth/session'
import { loadPublishingWeeks } from '@/lib/boards/publishing-weeks'
import { loadI7Carryover } from '@/lib/tsheets/report-data'
import { currentYearMonth } from '@/lib/tsheets/report'
import { loadHomeAgenda } from '@/lib/agenda/home-data'
import { agendaViewer } from '@/lib/agenda/data'
import { loadHomePayPeriod } from '@/lib/timeclock/home-pay-period'
import { perfRun } from '@/lib/perf'
import { NeedsYouCard } from '@/components/home/NeedsYouCard'
import { loadNeedsYou } from '@/lib/home/needs-you'
import { dayCounts, unreadNeedsYou, type NeedsYouData } from '@/lib/home/needs-you-model'
import { summaryLine } from '@/lib/home/day-banner'
import { northTimeOpen } from '@/lib/timeclock/north-time-lock'
import { ReviewCard } from '@/components/review/HrParts'
import { MyGoalsCard } from '@/components/review/MyGoalsCard'
import { loadGoalsView, loadMyCard } from '@/lib/review/mine'
import { currentReviewerOf, loadHrSettings, loadRoster, reviewToday } from '@/lib/review/data'

export default async function HomePage() {
  const perf = perfRun('home')
  const accessP = loadAccess()
  const meP = getCurrentPerson()
  const [access, me] = await Promise.all([perf.time('access', accessP), perf.time('person', meP)])
  // The banner's zone is the Agenda's for the person (their profile); New York without one.
  const viewer = await agendaViewer(access).catch(() => null)
  const zone = viewer?.zone ?? 'America/New_York'
  const first = me?.full_name?.trim().split(/\s+/)[0] ?? null
  // No clock card nor pay period while North Time is closed (migration 132).
  const hasClock = access.can('clocky-hours') && await northTimeOpen()
  const seesI7 = access.canTool('i7-budget')
  const seesPublishing = access.level === 'super_admin' || access.level === 'admin' || access.level === 'team_leader'
  perf.done({ budget: seesI7 })
  // Needs you is read once: the card draws it, the banner's line counts it.
  const needsP = loadNeedsYou()

  return (
    <HomeLayout
      banner={
        <DayBanner
          firstName={first}
          zone={zone}
          serverNow={new Date().toISOString()}
          hasClock={hasClock}
          summary={<Suspense fallback={null}><Summary data={needsP} /></Suspense>}
        />
      }
      needs={<Suspense fallback={<Skeleton h={420} label="Needs you" />}><Needs data={needsP} /></Suspense>}
      pay={hasClock && me ? <Suspense fallback={<Skeleton h={420} label="Pay period" />}><PayPeriod personId={me.id} /></Suspense> : null}
      right={
        <>
          {me && <Suspense fallback={null}><Review personId={me.id} /></Suspense>}
          <Suspense fallback={<Skeleton h={560} label="Agenda" />}><Agenda access={access} /></Suspense>
          {me && <Suspense fallback={null}><Goals personId={me.id} /></Suspense>}
          {seesI7 && <Suspense fallback={<Skeleton h={190} label="i7 Budget" />}><I7 /></Suspense>}
        </>
      }
      publishing={seesPublishing ? <Suspense fallback={<Skeleton h={705} label="Publishing goals" />}><Publishing linked={access.canTool('publishing')} /></Suspense> : null}
    />
  )
}

/** A widget's place while it reads: its own height, so nothing jumps when it lands. */
function Skeleton({ h, label }: { h: number; label: string }) {
  return <div aria-busy="true" aria-label={`${label}, loading`} className="rounded-[18px] border border-[var(--panel-border)] bg-white/60 animate-pulse" style={{ height: h }} />
}

/** "5 things need you today, 2 of them late.": open Needs you and My Work rows due late or today. */
async function Summary({ data }: { data: Promise<NeedsYouData> }) {
  const d = await data.catch(() => null)
  return d ? summaryLine(dayCounts(d)) : null
}

async function Needs({ data }: { data: Promise<NeedsYouData> }) {
  // A whole read that fails is a line in the card, never Home's error page (audit, 25 October 2026).
  const d = await data.catch(e => {
    console.error('[home] needs you:', e instanceof Error ? e.message : e)
    return unreadNeedsYou()
  })
  return <NeedsYouCard data={d} />
}

async function PayPeriod({ personId }: { personId: string }) {
  // Never null: a period that cannot be set up for the person says so (owner, 25 October 2026).
  return <PayPeriodCard data={await loadHomePayPeriod(personId)} />
}

/** A card whose read failed says so where it would be (never a blank). */
function ReadFailed({ what }: { what: string }) {
  return <div className="rounded-[14px] border border-[var(--panel-border)] bg-white px-5 py-4 text-[13px] text-muted">{what} could not be read. Reload the page in a moment.</div>
}

/** The annual review's card (C1): from the day the person's review opens until 30 days after approval. */
async function Review({ personId }: { personId: string }) {
  const card = await loadMyCard(personId, await loadRoster(), reviewToday()).catch(e => {
    console.error('[home] review card:', e instanceof Error ? e.message : e)
    return 'failed' as const
  })
  if (card === 'failed') return <ReadFailed what="Your review" />
  return card ? <ReviewCard c={card} compact /> : null
}

/** "My goals" (B2): only once a review agreed them. */
async function Goals({ personId }: { personId: string }) {
  const v = await Promise.all([loadRoster(), loadHrSettings()])
    .then(([roster, settings]) => loadGoalsView(personId, roster, reviewToday(), currentReviewerOf(roster, settings, personId)))
    .catch(e => { console.error('[home] my goals:', e instanceof Error ? e.message : e); return 'failed' as const })
  if (v === 'failed') return <ReadFailed what="Your goals" />
  return v && v.goals.length ? <MyGoalsCard v={v} /> : null
}

async function Agenda({ access }: { access: Access }) {
  const agenda = await loadHomeAgenda(access)
  return agenda ? <HomeAgendaCard agenda={agenda} /> : null
}

async function I7() {
  const month = currentYearMonth()
  // loadI7Carryover, not the whole report: the card shows the balance and nothing else.
  // A read that fails shows as unavailable, never as a figure (audit, 9 October 2026).
  const carryover = await loadI7Carryover(month).catch(e => { console.error('[home] i7 budget:', (e as Error).message); return 'unavailable' as const })
  return <I7BudgetWidget month={month} carryover={carryover} />
}

async function Publishing({ linked }: { linked: boolean }) {
  // A read that fails shows on the card as "could not be read", never as "no target" (audit, 10 October 2026).
  const data = await loadPublishingWeeks().catch(e => {
    console.error('[home] publishing goals:', e instanceof Error ? e.message : e)
    return null
  })
  return <PublishingGoalsWidget data={data} linked={linked} />
}
