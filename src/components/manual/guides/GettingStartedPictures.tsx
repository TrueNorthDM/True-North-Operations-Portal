'use client'

// The Getting started guides' pictures: the real rail, avatar menu, bell,
// Home and Settings, fed the manual's made-up data
// (lib/manual/samples/getting-started.ts). Nothing saves, nothing navigates;
// the picture around them (GuideParts) makes them inert anyway.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { UserMenu } from '@/components/UserMenu'
import { NotificationDrawer } from '@/components/NotificationDrawer'
import { DayBanner } from '@/components/home/DayBanner'
import { HomeLayout } from '@/components/home/HomeLayout'
import { NeedsYouCard } from '@/components/home/NeedsYouCard'
import { HomeAgendaCard } from '@/components/home/HomeAgendaCard'
import { I7BudgetWidget } from '@/components/home/I7BudgetWidget'
import { PublishingGoalsWidget } from '@/components/home/PublishingGoalsWidget'
import type { Runner } from '@/components/home/needs-you-actions'
import { PersonalSettings, type SettingsSection } from '@/components/settings/PersonalSettings'
import { NotificationSettings } from '@/components/NotificationSettings'
import { TwoStepSelf } from '@/components/mfa/TwoStepSelf'
import { PersonPage } from '@/components/person/PersonPage'
import { dayCounts } from '@/lib/home/needs-you-model'
import { summaryLine } from '@/lib/home/day-banner'
import { defaultRule } from '@/lib/notifications/catalogue'
import {
  BELL, EMAIL, FIRST_NAME, I7_MONTH, I7_SAMPLE, NAME, NEEDS_YOU, NOW, PUBLISHING_SAMPLE, RAIL_COUNTS, SETTINGS_SAMPLE, ZONE,
  homeAgendaSample, notificationTypesSample, profileSample, railSample,
} from '@/lib/manual/samples/getting-started'

const USER = { email: EMAIL, name: NAME, avatarUrl: null }
const RAIL = railSample()
const TYPES = notificationTypesSample()
const PROFILE = profileSample()
const noop = () => {}
const run: Runner = async () => ({ ok: true })

/**
 * Keeps an open menu or panel open. The rail and the avatar menu close on any
 * click elsewhere on the page and on Escape; here they are drawn again as they
 * started, in the same render, so the picture never changes under the reader.
 */
function Held({ children }: { children: ReactNode }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const again = () => setN(x => x + 1)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') again() }
    document.addEventListener('mousedown', again)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', again)
      document.removeEventListener('keydown', onKey)
    }
  }, [])
  return <div key={n} className="contents">{children}</div>
}

/** The rail as a Team Leader sees it on Home, with a hub's panel open or not. */
export function RailPicture({ hub = null }: { hub?: string | null }) {
  return (
    // The rail fills the window's height and hides on a phone; here it is a fixed 540px, always shown.
    <div className="flex [&>aside]:flex [&>aside]:static [&>aside]:h-[540px]">
      <Held><Sidebar rail={RAIL} user={USER} startHub={hub} startCounts={RAIL_COUNTS} activePath="/" /></Held>
    </div>
  )
}

/** The avatar's menu, open. */
export function AvatarMenuPicture() {
  return (
    <div className="flex justify-end h-[300px] pr-2">
      <Held><UserMenu userEmail={EMAIL} userName={NAME} avatarUrl={null} startOpen /></Held>
    </div>
  )
}

/** The Notifications drawer on its Tools tab, drawn inside the picture instead of over the page. */
export function BellPicture() {
  return (
    <div className="relative h-[520px]" style={{ contain: 'layout paint', '--chrome-top': '0px' } as CSSProperties}>
      <NotificationDrawer kind="bell" tab="tools" onTab={noop} items={BELL} read={new Set()} onRead={noop} onClose={noop} />
    </div>
  )
}

const banner = <DayBanner firstName={FIRST_NAME} zone={ZONE} serverNow={NOW} hasClock={false} sample={null} summary={summaryLine(dayCounts(NEEDS_YOU))} />

/** The whole of Home, in its own layout. */
export function HomePicture() {
  return (
    // HomeLayout runs edge to edge over the page's padding; this gives it that padding back.
    <div className="px-6 pt-8 pb-8">
      <HomeLayout
        banner={banner}
        needs={<NeedsYouCard data={NEEDS_YOU} run={run} />}
        pay={null}
        right={<><HomeAgendaCard agenda={homeAgendaSample()} /><I7BudgetWidget month={I7_MONTH} carryover={I7_SAMPLE} /></>}
        publishing={<PublishingGoalsWidget data={PUBLISHING_SAMPLE} linked />}
      />
    </div>
  )
}

export function DayBannerPicture() {
  return banner
}

export function NeedsYouPicture() {
  return <div className="flex flex-col h-[400px] [&>*]:flex-1"><NeedsYouCard data={NEEDS_YOU} run={run} /></div>
}

export function HomeRightPicture() {
  return (
    <div className="flex flex-col gap-5 max-w-[340px]">
      <HomeAgendaCard agenda={homeAgendaSample()} />
      <I7BudgetWidget month={I7_MONTH} carryover={I7_SAMPLE} />
    </div>
  )
}

export function PublishingPicture() {
  return <PublishingGoalsWidget data={PUBLISHING_SAMPLE} linked />
}

/** Settings, one section or more at a time. */
export function SettingsPicture({ only }: { only: readonly SettingsSection[] }) {
  return (
    <PersonalSettings
      settings={SETTINGS_SAMPLE}
      zone={{ text: 'Central time (CT), Chicago', profileHref: null }}
      email={EMAIL}
      save={null}
      signOutEverywhere={null}
      only={only}
      twoStep={<TwoStepSelf since="2026-09-30" daysLeft={null} />}
      notifications={
        <NotificationSettings
          mode="mine" types={TYPES}
          rules={Object.fromEntries(TYPES.map(t => [t.key, defaultRule(t)]))}
          zone={SETTINGS_SAMPLE.timeZone} hour={SETTINGS_SAMPLE.summaryHour}
        />
      }
    />
  )
}

/** Your own page in the Directory, on its Personal tab. */
export function ProfilePicture() {
  return <PersonPage data={PROFILE} tab="personal" canRemove={false} />
}
