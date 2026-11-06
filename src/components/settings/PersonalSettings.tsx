'use client'

/**
 * The personal Settings page (7 October 2026), under the avatar: how the
 * portal works for each person. Five sections, with an "On this page" menu
 * that follows the scroll:
 *
 *   Notifications         the notification table (NotificationSettings).
 *   Sign-in and security  the address they sign in with, two-step sign-in, and
 *                         signing out on every device.
 *   Time and region       their time zone and the hour of the daily summary.
 *   Home and start        the page they land on after signing in, which
 *                         cards Home shows (4 November 2026), and up to
 *                         five favourite pages.
 *   Privacy               whether Home and the Agenda show their birthday and anniversary.
 *
 * Every change saves on its own (saveSettings). The two server-drawn parts
 * (the notification table and two-step sign-in) come in as nodes.
 */

import { staleOr } from '@/lib/ui/action-error'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ui/useConfirm'
import { Switch } from '@/components/ui/Switch'
import { Segmented as Choice } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import type { SaveHidden } from '@/lib/settings/columns'
import { START_PAGES, SUMMARY_HOURS, type PersonSettings, type SettingsPatch, type StartPage } from '@/lib/settings/person'
import { zoneLabel, zoneOptions } from '@/lib/notifications/zones'
import { BTN } from '@/lib/ui/buttons'
import { SECTION_TITLE } from '@/lib/ui/type'

type Result = { ok: boolean; error?: string }
type Save = (patch: SettingsPatch) => Promise<Result>

const SECTIONS = [
  { id: 'notifications', title: 'Notifications' },
  { id: 'security', title: 'Sign-in and security' },
  { id: 'time', title: 'Time and region' },
  { id: 'home', title: 'Home and start' },
  { id: 'privacy', title: 'Privacy' },
] as const

export type SettingsSection = (typeof SECTIONS)[number]['id']

function Section({ id, title, intro, children, hidden = false }: { id: string; title: string; intro: string; children: React.ReactNode; hidden?: boolean }) {
  if (hidden) return null
  return (
    <section id={id} className="scroll-mt-24 rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--row-rule)] bg-subtle">
        <h2 className={SECTION_TITLE}>{title}</h2>
        <p className="text-[13px] text-muted m-0 mt-0.5 leading-relaxed">{intro}</p>
      </div>
      <div>{children}</div>
    </section>
  )
}

function Row({ label, hint, status, children }: { label: string; hint: string; status?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-x-6 gap-y-3 flex-wrap px-5 py-4 border-t border-[var(--row-rule)] first:border-t-0">
      <div className="min-w-[240px] flex-1">
        <div className="text-[14px] font-semibold text-tn-ink">{label}</div>
        <p className="text-[12.5px] text-muted m-0 mt-0.5 leading-snug">{hint}</p>
        {status}
      </div>
      {children && <div className="flex items-center gap-3 flex-wrap">{children}</div>}
    </div>
  )
}

export function PersonalSettings({
  settings, email, notifications, twoStep, signOutEverywhere, save, blocked, only, home, saveHome = null,
}: {
  settings: PersonSettings
  email: string | null
  /** The notification table, drawn by the server. */
  notifications: React.ReactNode
  /** Two-step sign-in (TwoStepSelf), or a note in View Stage. */
  twoStep: React.ReactNode
  /** Null in the design check. Answers only when it could not sign out (otherwise it goes to the sign-in page). */
  signOutEverywhere: (() => Promise<{ ok: false; error: string }>) | null
  /** Null in the design check: changes stay on the page. */
  save: Save | null
  /** Why nothing can be saved (View Stage, no Directory person). */
  blocked?: string
  /** The System manual's pictures show one section at a time, without the menu; left out, every section. */
  only?: readonly SettingsSection[]
  /** The Home cards this person can have, and the ones they hide. Left out, the choice is not shown. */
  home?: { cards: readonly { key: string; label: string; hint: string }[]; hidden: readonly string[] }
  /** Null in the design check: the choice stays on the page. */
  saveHome?: SaveHidden | null
}) {
  const [s, setS] = useState(settings)
  const [homeHidden, setHomeHidden] = useState<readonly string[]>(home?.hidden ?? [])
  const [status, setStatus] = useState<{ key: string; state: 'saving' | 'saved' | 'error'; error?: string } | null>(null)
  const [confirmDialog, confirm] = useConfirm()
  const router = useRouter()
  const [active, setActive] = useState<string>(SECTIONS[0].id)
  const [, start] = useTransition()

  // The menu follows the section in view.
  useEffect(() => {
    const els = SECTIONS.map(x => document.getElementById(x.id)).filter((e): e is HTMLElement => !!e)
    const obs = new IntersectionObserver(es => {
      const v = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
      if (v) setActive(v.target.id)
    }, { rootMargin: '-15% 0px -70% 0px' })
    els.forEach(e => obs.observe(e))
    return () => obs.disconnect()
  }, [])

  const change = (key: string, patch: SettingsPatch, apply: () => void, revert: () => void) => {
    apply()
    if (blocked) { revert(); setStatus({ key, state: 'error', error: blocked }); return }
    if (!save) { setStatus({ key, state: 'saved' }); return }
    setStatus({ key, state: 'saving' })
    start(async () => {
      const res = await save(patch).catch(e => ({ ok: false, error: staleOr(e, 'Not saved. Try again in a moment.') }))
      if (!res.ok) revert()
      setStatus({ key, state: res.ok ? 'saved' : 'error', error: res.error })
      // The Notifications section says when the summary arrives: drawn by the
      // server, so it is drawn again with the new zone or hour.
      if (res.ok && (key === 'zone' || key === 'hour')) router.refresh()
    })
  }
  const set = <K extends keyof PersonSettings>(key: string, field: K, value: PersonSettings[K], patch: SettingsPatch) => {
    const before = s[field]
    change(key, patch, () => setS(x => ({ ...x, [field]: value })), () => setS(x => ({ ...x, [field]: before })))
  }

  // A Home card on or off: saved on its own, like every other choice here.
  const setHomeCard = (key: string, show: boolean) => {
    const before = homeHidden
    const next = show ? before.filter(k => k !== key) : [...before, key]
    setHomeHidden(next)
    if (blocked) { setHomeHidden(before); setStatus({ key: `home-${key}`, state: 'error', error: blocked }); return }
    if (!saveHome) { setStatus({ key: `home-${key}`, state: 'saved' }); return }
    setStatus({ key: `home-${key}`, state: 'saving' })
    start(async () => {
      const res = await saveHome('home', [...next]).catch(e => ({ ok: false, error: staleOr(e, 'Not saved. Try again in a moment.') }))
      if (!res.ok) setHomeHidden(before)
      setStatus({ key: `home-${key}`, state: res.ok ? 'saved' : 'error', error: res.error })
    })
  }

  async function signOutAll() {
    if (!signOutEverywhere || blocked) return
    const yes = await confirm({
      title: 'Sign out on all devices?',
      body: 'Every computer and phone signed in to your account is signed out, this one too. You sign in again with a code.',
      action: 'Sign out everywhere',
      danger: true,
    })
    if (!yes) return
    setStatus(null)
    start(async () => {
      const res = await signOutEverywhere().catch(e => ({ ok: false as const, error: staleOr(e, 'Could not sign out every device. Try again in a moment.') }))
      if (res && !res.ok) setStatus({ key: 'signout', state: 'error', error: res.error })
    })
  }

  const statusFor = (key: string) => {
    const st = status?.key === key ? status : null
    if (!st) return null
    return (
      <span className={`block text-[11.5px] mt-1 ${st.state === 'error' ? 'text-[#b3271f]' : 'text-muted'}`}>
        {st.state === 'saving' ? 'Saving…' : st.state === 'saved' ? 'Saved' : st.error ?? 'Not saved'}
      </span>
    )
  }

  return (
    <div className={`grid grid-cols-1 gap-6 items-start ${only ? '' : 'lg:grid-cols-[200px_minmax(0,1fr)]'}`}>
      {confirmDialog}
      <nav aria-label="On this page" className={only ? 'hidden' : 'hidden lg:block sticky top-24'}>
        <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.12em] uppercase text-muted mb-2">On this page</div>
        <ul className="list-none m-0 p-0 space-y-0.5 border-l-2 border-[var(--panel-border)]">
          {SECTIONS.map(x => (
            <li key={x.id}>
              <a href={`#${x.id}`} aria-current={active === x.id ? 'location' : undefined} className={`block -ml-0.5 pl-3 py-1.5 border-l-2 text-[13.5px] font-semibold transition-colors ${active === x.id ? 'border-tn-teal text-tn-ink' : 'border-transparent text-muted hover:text-tn-ink'}`}>{x.title}</a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="space-y-6 min-w-0">
        <Section id="notifications" hidden={!!only && !only.includes('notifications')} title="Notifications" intro="What reaches you, and when: in the bell as it happens, or in the daily summary email.">
          <div className="p-4">{notifications}</div>
        </Section>

        <Section id="security" hidden={!!only && !only.includes('security')} title="Sign-in and security" intro="How you get into the portal, and how to get everyone else out of your account.">
          <Row label="Signs in with" hint="The address your sign-in codes go to. An admin can change it.">
            <span className="text-[14px] font-semibold text-tn-ink">{email ?? '-'}</span>
          </Row>
          <Row label="Two-step sign-in" hint="A 6-digit code from the authenticator app on your phone, after the email code.">
            <div className="min-w-[260px]">{twoStep}</div>
          </Row>
          <Row label="Sign out on all devices" hint="Ends your sessions on every computer and phone: this one at once, the others within the hour. Useful after using a shared computer." status={statusFor('signout')}>
            <button type="button" disabled={!!blocked} title={blocked} onClick={signOutAll}
              className={`${BTN.whiteDanger} disabled:opacity-50`}>Sign out on all devices</button>
          </Row>
        </Section>

        <Section id="time" hidden={!!only && !only.includes('time')} title="Time and region" intro="When the daily summary reaches you, and the times in the bell.">
          <Row label="Your time zone" hint="Your daily summary and the times in the bell follow it. Until you choose, it is the time where your Directory profile says you live (New York time when it does not say)." status={statusFor('zone')}>
            <Select value={s.timeZone} onChange={z => set('zone', 'timeZone', z, { timeZone: z })} options={zoneOptions()} searchable ariaLabel="Your time zone" />
          </Row>
          <Row label="Daily summary at" hint={`When the daily summary reaches you, in ${zoneLabel(s.timeZone)} time, Monday to Friday.`} status={statusFor('hour')}>
            <Choice label="Daily summary at" value={s.summaryHour} onChange={h => set('hour', 'summaryHour', h, { summaryHour: h })}
              options={SUMMARY_HOURS.map(h => ({ key: h, label: `${h}:00 AM` }))} />
          </Row>
        </Section>

        <Section id="home" hidden={!!only && !only.includes('home')} title="Home and start" intro="Where you land, what Home shows you, and the pages you reach for most.">
          <Row label="After you sign in, open" hint="The page you land on. A link you followed before signing in still takes you to that page." status={statusFor('start')}>
            <Choice label="After you sign in, open" value={s.startPage} onChange={(k: StartPage) => set('start', 'startPage', k, { startPage: k })}
              options={START_PAGES.map(p => ({ key: p.key, label: p.label }))} />
          </Row>
          {home && home.cards.map(c => (
            <Row key={c.key} label={`Show ${c.label} on Home`} hint={c.hint} status={statusFor(`home-${c.key}`)}>
              <Switch on={!homeHidden.includes(c.key)} label={`Show ${c.label} on Home`} onChange={v => setHomeCard(c.key, v)} />
            </Row>
          ))}
        </Section>

        <Section id="privacy" hidden={!!only && !only.includes('privacy')} title="Privacy" intro="What Home and the Agenda show the team about you.">
          <Row label="Show my birthday on Home and in the Agenda" hint="The day and month only, never the year. Off, nobody gets the birthday bell for you either." status={statusFor('birthday')}>
            <Switch on={s.showBirthday} label="Show my birthday on Home and in the Agenda" onChange={v => set('birthday', 'showBirthday', v, { showBirthday: v })} />
          </Row>
          <Row label="Show my work anniversary on Home and in the Agenda" hint="How many years you have been with True North." status={statusFor('anniversary')}>
            <Switch on={s.showAnniversary} label="Show my work anniversary on Home and in the Agenda" onChange={v => set('anniversary', 'showAnniversary', v, { showAnniversary: v })} />
          </Row>
        </Section>
      </div>
    </div>
  )
}
