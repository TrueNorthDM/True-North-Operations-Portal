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
 *   Home and start        the page they land on after signing in, and up to
 *                         five favourite pages at the top of Home.
 *   Privacy               whether Home shows their birthday and anniversary.
 *
 * Every change saves on its own (saveSettings). The two server-drawn parts
 * (the notification table and two-step sign-in) come in as nodes.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useConfirm } from '@/components/ui/useConfirm'
import { Switch } from '@/components/ui/Switch'
import { Segmented as Choice } from '@/components/ui/Segmented'
import { NavIcon } from '@/components/NavIcon'
import { Select } from '@/components/ui/Select'
import type { NavItem } from '@/lib/access/nav'
import type { PageGroup } from '@/lib/settings/pages'
import { FAVOURITES_MAX, START_PAGES, SUMMARY_HOURS, type PersonSettings, type SettingsPatch, type StartPage } from '@/lib/settings/person'
import { zoneLabel, zoneOptions } from '@/lib/notifications/zones'

type Result = { ok: boolean; error?: string }
type Save = (patch: SettingsPatch) => Promise<Result>

const SECTIONS = [
  { id: 'notifications', title: 'Notifications' },
  { id: 'security', title: 'Sign-in and security' },
  { id: 'time', title: 'Time and region' },
  { id: 'home', title: 'Home and start' },
  { id: 'privacy', title: 'Privacy' },
] as const

function Section({ id, title, intro, children }: { id: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--row-rule)] bg-subtle">
        <h2 className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink m-0">{title}</h2>
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

// ── Favourites: the list in order, drag to reorder, and the page picker ─────

function Favourites({ items, groups, onChange }: { items: NavItem[]; groups: PageGroup[]; onChange: (next: NavItem[]) => void }) {
  const [open, setOpen] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const chosen = new Set(items.map(i => i.key))
  const full = items.length >= FAVOURITES_MAX

  const move = (from: number, to: number) => {
    if (from === to || to < 0 || to >= items.length) return
    const next = [...items]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    onChange(next)
  }

  return (
    <div className="w-full space-y-2.5">
      {items.length > 0 && (
        <ol className="list-none m-0 p-0 space-y-1.5">
          {items.map((it, i) => (
            <li key={it.key} draggable onDragStart={() => setDrag(i)} onDragEnd={() => setDrag(null)}
              onDragOver={e => e.preventDefault()} onDrop={() => { if (drag !== null) move(drag, i); setDrag(null) }}
              className={`flex items-center gap-3 rounded-[10px] border bg-white px-3 py-2 ${drag === i ? 'border-tn-teal opacity-60' : 'border-[var(--panel-border)]'}`}>
              <span className="cursor-grab text-[#b3bcc8] select-none" aria-hidden>⋮⋮</span>
              <span className="w-7 h-7 rounded-[8px] bg-[rgba(30,125,127,.1)] text-tn-teal inline-flex items-center justify-center shrink-0"><NavIcon name={it.icon} size={15} /></span>
              <span className="flex-1 min-w-0 text-[13.5px] font-semibold text-tn-ink">{it.label}</span>
              <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} aria-label={`Move ${it.label} up`} className="w-7 h-7 rounded-[7px] text-muted hover:bg-subtle disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, i + 1)} disabled={i === items.length - 1} aria-label={`Move ${it.label} down`} className="w-7 h-7 rounded-[7px] text-muted hover:bg-subtle disabled:opacity-30">↓</button>
              <button type="button" onClick={() => onChange(items.filter(x => x.key !== it.key))} aria-label={`Remove ${it.label}`} className="w-7 h-7 rounded-[7px] text-muted hover:bg-subtle hover:text-[#b3271f] text-[17px] leading-none">×</button>
            </li>
          ))}
        </ol>
      )}
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} disabled={full && !open}
        className="inline-flex items-center gap-2 rounded-[10px] border border-dashed border-[#b3bcc8] px-3.5 py-2 text-[13px] font-bold text-tn-teal hover:border-tn-teal disabled:opacity-50">
        + Add a page
      </button>
      {open && (
        <div className="rounded-[12px] border border-[var(--panel-border)] bg-subtle p-4 space-y-4">
          <p className="text-[12.5px] text-muted m-0">
            {`Only pages you can open are listed. ${full ? `You have all ${FAVOURITES_MAX}: remove one to add another.` : `Pick up to ${FAVOURITES_MAX - items.length} more.`}`}
          </p>
          {groups.map(g => (
            <div key={g.label}>
              <div className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted mb-1.5">{g.label}</div>
              <div className="flex flex-wrap gap-1.5">
                {g.rows.map(r => {
                  const on = chosen.has(r.key)
                  return (
                    <button key={r.key} type="button" aria-pressed={on} disabled={!on && full}
                      onClick={() => onChange(on ? items.filter(x => x.key !== r.key) : [...items, r])}
                      className={`inline-flex items-center gap-1.5 rounded-[9px] border px-2.5 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-40 ${
                        on ? 'border-tn-teal bg-[rgba(30,125,127,.08)] text-tn-ink' : 'border-[var(--panel-border)] bg-white text-foreground hover:border-tn-teal'}`}>
                      <NavIcon name={r.icon} size={13} />
                      {r.label}
                      {on && <span className="text-[10.5px] font-bold text-tn-teal">On Home</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setOpen(false)} className="rounded-[9px] bg-tn-primary text-[#ffffff] px-3.5 py-2 text-[13px] font-bold">Done</button>
        </div>
      )}
    </div>
  )
}

// ── The page ────────────────────────────────────────────────────────────────

export function PersonalSettings({
  settings, email, notifications, twoStep, signOutEverywhere, favourites: initialFavourites, groups, save, blocked,
}: {
  settings: PersonSettings
  email: string | null
  /** The notification table, drawn by the server. */
  notifications: React.ReactNode
  /** Two-step sign-in (TwoStepSelf), or a note in View Stage. */
  twoStep: React.ReactNode
  /** Null in the design check. Answers only when it could not sign out (otherwise it goes to the sign-in page). */
  signOutEverywhere: (() => Promise<{ ok: false; error: string }>) | null
  favourites: NavItem[]
  /** What can be pinned: the pages this person can open. */
  groups: PageGroup[]
  /** Null in the design check: changes stay on the page. */
  save: Save | null
  /** Why nothing can be saved (View Stage, no Directory person). */
  blocked?: string
}) {
  const [s, setS] = useState(settings)
  const [favs, setFavs] = useState(initialFavourites)
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
      const res = await save(patch).catch(() => ({ ok: false, error: 'Not saved. Try again in a moment.' }))
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
  const setFavourites = (next: NavItem[]) => {
    const before = favs
    change('favourites', { favourites: next.map(n => n.key) }, () => setFavs(next), () => setFavs(before))
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
      const res = await signOutEverywhere().catch(() => ({ ok: false as const, error: 'Could not sign out every device. Try again in a moment.' }))
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
    <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-6 items-start">
      {confirmDialog}
      <nav aria-label="On this page" className="hidden lg:block sticky top-24">
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
        <Section id="notifications" title="Notifications" intro="What reaches you, and when: in the bell as it happens, or in the daily summary email.">
          <div className="p-4">{notifications}</div>
        </Section>

        <Section id="security" title="Sign-in and security" intro="How you get into the portal, and how to get everyone else out of your account.">
          <Row label="Signs in with" hint="The address your sign-in codes go to. An admin can change it.">
            <span className="text-[14px] font-semibold text-tn-ink">{email ?? '-'}</span>
          </Row>
          <Row label="Two-step sign-in" hint="A 6-digit code from the authenticator app on your phone, after the email code.">
            <div className="min-w-[260px]">{twoStep}</div>
          </Row>
          <Row label="Sign out on all devices" hint="Ends your sessions on every computer and phone: this one at once, the others within the hour. Useful after using a shared computer." status={statusFor('signout')}>
            <button type="button" disabled={!!blocked} title={blocked} onClick={signOutAll}
              className="rounded-[9px] border border-[var(--panel-border)] bg-white text-tn-ink px-3.5 py-2 text-[13px] font-bold hover:border-[#b3271f] hover:text-[#b3271f] disabled:opacity-50 disabled:hover:border-[var(--panel-border)] disabled:hover:text-tn-ink">Sign out on all devices</button>
          </Row>
        </Section>

        <Section id="time" title="Time and region" intro="When the daily summary reaches you, and the times in the bell.">
          <Row label="Your time zone" hint="Your daily summary and the times in the bell follow it. Until you choose, it is New York time." status={statusFor('zone')}>
            <Select value={s.timeZone} onChange={z => set('zone', 'timeZone', z, { timeZone: z })} options={zoneOptions()} searchable ariaLabel="Your time zone" />
          </Row>
          <Row label="Daily summary at" hint={`When the daily summary reaches you, in ${zoneLabel(s.timeZone)} time, Monday to Friday.`} status={statusFor('hour')}>
            <Choice label="Daily summary at" value={s.summaryHour} onChange={h => set('hour', 'summaryHour', h, { summaryHour: h })}
              options={SUMMARY_HOURS.map(h => ({ key: h, label: `${h}:00 AM` }))} />
          </Row>
        </Section>

        <Section id="home" title="Home and start" intro="Where you land, and the pages you reach for most.">
          <Row label="After you sign in, open" hint="The page you land on. A link you followed before signing in still takes you to that page." status={statusFor('start')}>
            <Choice label="After you sign in, open" value={s.startPage} onChange={(k: StartPage) => set('start', 'startPage', k, { startPage: k })}
              options={START_PAGES.map(p => ({ key: p.key, label: p.label }))} />
          </Row>
          <Row label="Favourites on Home" hint={`Up to ${FAVOURITES_MAX} pages, in the order you drag them. They show at the top of Home. ${favs.length} of ${FAVOURITES_MAX}.`} status={statusFor('favourites')} />
          <div className="px-5 pb-4 -mt-1">
            <Favourites items={favs} groups={groups} onChange={setFavourites} />
          </div>
        </Section>

        <Section id="privacy" title="Privacy" intro="What Home shows the team about you.">
          <Row label="Show my birthday on Home" hint="The day and month only, never the year." status={statusFor('birthday')}>
            <Switch on={s.showBirthday} label="Show my birthday on Home" onChange={v => set('birthday', 'showBirthday', v, { showBirthday: v })} />
          </Row>
          <Row label="Show my work anniversary on Home" hint="How many years you have been with True North." status={statusFor('anniversary')}>
            <Switch on={s.showAnniversary} label="Show my work anniversary on Home" onChange={v => set('anniversary', 'showAnniversary', v, { showAnniversary: v })} />
          </Row>
        </Section>
      </div>
    </div>
  )
}
