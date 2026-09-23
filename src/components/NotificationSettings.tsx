'use client'

/**
 * The Notification settings page (22 September 2026): the whole catalogue in
 * four blocks (the two tabs of each drawer), each notification with three
 * settings: where (in app, email, both), when (as it happens, daily summary)
 * and on or off. What the portal cannot do yet is listed faded, with the
 * reason, rather than hidden.
 *
 * Admins get a second tab, "Rules for everyone": a default for each setting
 * and whether people may change it or it is fixed. A fixed setting shows on
 * the person's own tab locked, with a line saying what the admin set.
 *
 * Each change saves on its own. The person's tab lists only the notifications
 * that can reach them; the rules tab lists them all.
 */

import { useState, useTransition } from 'react'
import { NavIcon } from '@/components/NavIcon'
import {
  BLOCKS, CHANNELS, DAILY_HOUR, EMAIL_BLOCKED, KEEP_READ_DAYS, KEEP_UNREAD_DAYS,
  effective, ruleScope,
  type BlockKey, type Channel, type NotificationType, type Pref, type Rule, type Timing,
} from '@/lib/notifications/catalogue'

type Result = { ok: boolean; error?: string }
type SavePref = (key: string, pref: Pref) => Promise<Result>
type SaveRule = (key: string, rule: Rule) => Promise<Result>
type Tab = 'mine' | 'rules'

function LockGlyph({ open = false, size = 11 }: { open?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M5 11h14v10H5z" />
      <path d={open ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  )
}

function Switch({ on, onChange, disabled, locked, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; locked?: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {locked && <span className="text-muted" title="Set by an admin"><LockGlyph /></span>}
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled || locked}
        onClick={() => onChange(!on)}
        className={`shrink-0 w-10 h-[22px] rounded-full transition-colors disabled:cursor-default ${on ? 'bg-tn-teal' : 'bg-slate-300'} ${locked ? 'opacity-60' : ''}`}
      >
        <span className={`block w-[18px] h-[18px] rounded-full bg-white transition-transform ${on ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
      </button>
    </span>
  )
}

interface SegOption<K extends string> { key: K; label: string; available?: boolean; title?: string }

function Segmented<K extends string>({ options, value, onChange, disabled, locked, label }: {
  options: readonly SegOption<K>[]; value: K; onChange: (k: K) => void; disabled?: boolean; locked?: boolean; label: string
}) {
  const seg = (on: boolean, off: boolean) =>
    `px-2.5 py-1 rounded-[7px] text-[12px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default ${
      on ? 'bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]' : off ? 'text-muted/50' : 'text-muted hover:text-tn-ink'}`
  return (
    <div
      role="radiogroup"
      aria-label={label}
      title={locked ? 'Set by an admin' : undefined}
      className={`inline-flex items-center bg-subtle border border-[var(--panel-border)] rounded-[9px] p-[3px] ${disabled ? 'opacity-50 pointer-events-none' : ''} ${locked ? 'pointer-events-none' : ''}`}
    >
      {locked && <span className="px-1.5 text-muted"><LockGlyph /></span>}
      {options.map(o => {
        const off = o.available === false || (!!locked && o.key !== value)
        return (
          <button key={o.key} type="button" role="radio" aria-checked={value === o.key} disabled={off || locked} title={o.title}
            onClick={() => onChange(o.key)} className={seg(value === o.key, off)}>
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

const TIMING_OPTIONS: readonly SegOption<Timing>[] = [
  { key: 'instant', label: 'As it happens' },
  { key: 'daily', label: 'Daily summary' },
]
const CHANNEL_OPTIONS: readonly SegOption<Channel>[] = CHANNELS.map(c => ({ ...c, title: c.available ? undefined : EMAIL_BLOCKED }))

/** The admin's per-setting choice: people may change it, or it is fixed. */
function FixToggle({ fixed, onChange, disabled }: { fixed: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={fixed}
      disabled={disabled}
      onClick={() => onChange(!fixed)}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-[3px] text-[10.5px] font-bold tracking-[.02em] whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-default ${
        fixed ? 'bg-tn-primary text-[#ffffff]' : 'bg-subtle text-muted border border-[var(--panel-border)] hover:text-tn-ink'}`}
    >
      <span className={fixed ? 'text-[#F2C40A]' : ''}><LockGlyph open={!fixed} size={10} /></span>
      {fixed ? 'Fixed' : 'People can change'}
    </button>
  )
}

/** Fixed-width columns, so the controls line up from row to row whether or not a lock sits in them. */
const COL = { where: 'w-[178px]', when: 'w-[236px]', on: 'w-[64px]' } as const
function Col({ w, stack, children }: { w: keyof typeof COL; stack?: boolean; children: React.ReactNode }) {
  return <div className={`${COL[w]} shrink-0 flex ${stack ? 'flex-col items-center gap-1.5' : 'justify-end'}`}>{children}</div>
}

const WHEN_WORDS: Record<Timing, string> = { instant: 'always as it happens', daily: 'always in the daily summary' }
const WHERE_WORDS: Record<Channel, string> = { app: 'always in the portal', email: 'always by email', both: 'always in the portal and by email' }

/** "Set by an admin: you can't turn it off, always as it happens." */
function fixedSentence(r: Rule): string | null {
  if (r.fixEnabled && !r.enabled) return 'An admin turned this off for everyone.'
  const parts = [
    r.fixEnabled ? "you can't turn it off" : null,
    r.fixTiming ? WHEN_WORDS[r.timing] : null,
    r.fixChannel ? WHERE_WORDS[r.channel] : null,
  ].filter(Boolean)
  return parts.length ? `Set by an admin: ${parts.join(', ')}.` : null
}

const SCOPE_TAG: Record<ReturnType<typeof ruleScope>, { text: string; cls: string }> = {
  full: { text: 'FULL CONTROL', cls: 'bg-[rgba(30,158,106,.12)] text-[#16794f]' },
  partial: { text: 'PARTLY FIXED', cls: 'bg-[#fbf1cf] text-[#a67c04]' },
  fixed: { text: 'FIXED', cls: 'bg-tn-primary text-[#F2C40A]' },
}

function RowShell({ t, faded, tags, children, below }: { t: NotificationType; faded: boolean; tags?: React.ReactNode; children: React.ReactNode; below?: React.ReactNode }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 border-b border-[var(--row-rule)] last:border-b-0 flex-wrap ${faded ? 'opacity-50' : ''}`}>
      <span className={`w-8 h-8 rounded-[9px] shrink-0 inline-flex items-center justify-center ${faded ? 'bg-subtle text-muted' : 'bg-[rgba(30,125,127,.1)] text-tn-teal'}`}>
        <NavIcon name={t.icon} size={16} />
      </span>
      <div className="flex-1 min-w-[240px]">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13.5px] font-semibold text-tn-ink">{t.title}</span>
          {faded && <span className="rounded bg-[#fbf1cf] px-[5px] py-0.5 text-[9.5px] font-bold tracking-[.06em] text-[#a67c04]">NOT YET</span>}
          {tags}
        </div>
        <p className="text-[12.5px] text-muted m-0 mt-0.5 leading-snug">{faded ? t.blockedBy : t.description}</p>
        <p className="text-[11.5px] text-muted m-0 mt-0.5"><span className="font-semibold">Goes to:</span> {t.who}</p>
        {below}
      </div>
      {children}
    </div>
  )
}

export function NotificationSettings({ types, mine, rules: initialRules, prefs: initialPrefs, isAdmin, savePref, saveRule, initialTab = 'mine', blocked }: {
  /** The whole catalogue. */
  types: readonly NotificationType[]
  /** Keys of the ones that can reach this person (faded ones included). */
  mine: readonly string[]
  rules: Record<string, Rule>
  prefs: Record<string, Pref>
  isAdmin: boolean
  /** Null in the design check: changes stay on the page. */
  savePref: SavePref | null
  saveRule: SaveRule | null
  initialTab?: Tab
  /** Why nothing can be saved right now (no migration yet, no Directory person). Changes are refused with it. */
  blocked?: string
}) {
  const [tab, setTab] = useState<Tab>(isAdmin ? initialTab : 'mine')
  const [rules, setRules] = useState(initialRules)
  const [prefs, setPrefs] = useState(initialPrefs)
  const [status, setStatus] = useState<{ key: string; state: 'saving' | 'saved' | 'error'; error?: string } | null>(null)
  const [, start] = useTransition()

  const persist = (key: string, run: (() => Promise<Result>) | null, revert: () => void) => {
    if (blocked) { revert(); setStatus({ key, state: 'error', error: blocked }); return }
    if (!run) { setStatus({ key, state: 'saved' }); return }
    setStatus({ key, state: 'saving' })
    start(async () => {
      const res = await run().catch(e => ({ ok: false, error: String(e) }))
      if (!res.ok) revert()
      setStatus({ key, state: res.ok ? 'saved' : 'error', error: res.error })
    })
  }

  const changePref = (key: string, patch: Pref) => {
    const before = prefs[key]
    const next = { ...before, ...patch }
    setPrefs(p => ({ ...p, [key]: next }))
    persist(`mine:${key}`, savePref && (() => savePref(key, next)), () => setPrefs(p => ({ ...p, [key]: before })))
  }

  const changeRule = (key: string, patch: Partial<Rule>) => {
    const before = rules[key]
    const next = { ...before, ...patch }
    setRules(r => ({ ...r, [key]: next }))
    persist(`rules:${key}`, saveRule && (() => saveRule(key, next)), () => setRules(r => ({ ...r, [key]: before })))
  }

  const statusFor = (id: string) => {
    const s = status?.key === id ? status : null
    if (!s) return null
    return (
      <span className={`text-[11.5px] ${s.state === 'error' ? 'text-[#b3271f]' : 'text-muted'}`}>
        {s.state === 'saving' ? 'Saving…' : s.state === 'saved' ? 'Saved' : s.error ?? 'Not saved'}
      </span>
    )
  }

  const listed = (b: BlockKey) => types.filter(t => t.block === b && (tab === 'rules' || mine.includes(t.key)))

  const tabBtn = (k: Tab, text: string) => (
    <button type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors ${tab === k ? 'bg-tn-primary text-[#ffffff]' : 'text-muted hover:text-tn-ink'}`}>
      {text}
    </button>
  )

  return (
    <div className="space-y-5">
      {isAdmin && (
        <div role="tablist" className="inline-flex items-center gap-1 rounded-[11px] border border-[var(--panel-border)] bg-white p-1">
          {tabBtn('mine', 'My notifications')}
          {tabBtn('rules', 'Rules for everyone')}
        </div>
      )}

      <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3 text-[13px] text-foreground leading-relaxed flex items-start gap-2.5">
        <NavIcon name={tab === 'rules' ? 'admin' : 'bell'} size={17} className="shrink-0 mt-0.5 text-tn-teal" />
        {tab === 'mine' ? (
          <span>
            {`Notifications arrive in the two icons at the top right: the bell (Tools and System) and the speech bubble (Chat and Email). A daily summary lands at ${DAILY_HOUR}:00 New York time. Read notifications are cleared after ${KEEP_READ_DAYS} days, unread ones after ${KEEP_UNREAD_DAYS}. A lock means an admin set that choice for everyone. Email is coming: until it is built, everything arrives in the portal. Changes save on their own.`}
          </span>
        ) : (
          <span>
            The rule for everyone each notification reaches. For each setting, pick the default and whether people can change it
            or it is <strong className="text-tn-ink">fixed</strong>. People who never changed an open setting follow its default;
            a fixed one shows on their page locked, with a line saying what you set. Your own page follows these rules too.
          </span>
        )}
      </div>

      {BLOCKS.map(b => {
        const list = listed(b.key)
        return (
          <section key={b.key} className={`rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden ${b.available ? '' : 'opacity-55'}`}>
            <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-[var(--row-rule)] bg-subtle">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink m-0">{b.title}</h2>
                  <span className="text-[10.5px] font-bold tracking-[.06em] uppercase text-muted">{`In ${b.drawer}`}</span>
                </div>
                <p className="text-[12.5px] text-muted m-0 mt-0.5">{b.description}</p>
              </div>
              {!b.available && <span className="shrink-0 rounded bg-[#fbf1cf] px-2 py-0.5 text-[10px] font-bold tracking-[.06em] text-[#a67c04]">NOT YET</span>}
            </div>

            {!b.available && <p className="px-5 py-4 text-[13px] text-muted m-0">{b.blockedBy}</p>}

            {b.available && list.length === 0 && (
              <p className="px-5 py-4 text-[13px] text-muted m-0">Nothing in this block reaches you at your level.</p>
            )}

            {b.available && list.map(t => {
              const faded = !t.available
              const rule = rules[t.key]

              if (tab === 'rules') {
                const scope = SCOPE_TAG[ruleScope(rule)]
                return (
                  <RowShell key={t.key} t={t} faded={faded}
                    tags={!faded && <span className={`rounded px-[6px] py-0.5 text-[9.5px] font-bold tracking-[.06em] ${scope.cls}`}>{scope.text}</span>}>
                    <div className="flex items-start gap-3 ml-auto">
                      {statusFor(`rules:${t.key}`)}
                      <Col w="where" stack>
                        <Segmented label="Where" options={CHANNEL_OPTIONS} value={rule.channel} disabled={faded} onChange={v => changeRule(t.key, { channel: v })} />
                        <FixToggle fixed={rule.fixChannel} disabled={faded} onChange={v => changeRule(t.key, { fixChannel: v })} />
                      </Col>
                      <Col w="when" stack>
                        <Segmented label="When" options={TIMING_OPTIONS} value={rule.timing} disabled={faded} onChange={v => changeRule(t.key, { timing: v })} />
                        <FixToggle fixed={rule.fixTiming} disabled={faded} onChange={v => changeRule(t.key, { fixTiming: v })} />
                      </Col>
                      <div className="w-[120px] shrink-0 flex flex-col items-center gap-1.5 pt-[3px]">
                        <Switch on={faded ? false : rule.enabled} disabled={faded} label={`${t.title}: ${rule.enabled ? 'on' : 'off'} for everyone`} onChange={v => changeRule(t.key, { enabled: v })} />
                        <span className="pt-[5px]"><FixToggle fixed={rule.fixEnabled} disabled={faded} onChange={v => changeRule(t.key, { fixEnabled: v })} /></span>
                      </div>
                    </div>
                  </RowShell>
                )
              }

              const eff = effective(rule, prefs[t.key])
              const sentence = faded ? null : fixedSentence(rule)
              const offForAll = rule.fixEnabled && !rule.enabled
              return (
                <RowShell key={t.key} t={t} faded={faded}
                  below={sentence && (
                    <p className="text-[11.5px] font-semibold text-tn-primary m-0 mt-1 inline-flex items-center gap-1.5">
                      <span className="text-[#a67c04]"><LockGlyph /></span>{sentence}
                    </p>
                  )}>
                  <div className="flex items-center gap-3 ml-auto">
                    {statusFor(`mine:${t.key}`)}
                    <Col w="where">
                      <Segmented label="Where" options={CHANNEL_OPTIONS} value={eff.channel}
                        disabled={faded || !eff.enabled} locked={!faded && !offForAll && rule.fixChannel}
                        onChange={v => changePref(t.key, { channel: v })} />
                    </Col>
                    <Col w="when">
                      <Segmented label="When" options={TIMING_OPTIONS} value={eff.timing}
                        disabled={faded || !eff.enabled} locked={!faded && !offForAll && rule.fixTiming}
                        onChange={v => changePref(t.key, { timing: v })} />
                    </Col>
                    <Col w="on">
                      <Switch on={faded ? false : eff.enabled} disabled={faded} locked={!faded && rule.fixEnabled}
                        label={`${t.title}: ${eff.enabled ? 'on' : 'off'}`} onChange={v => changePref(t.key, { enabled: v })} />
                    </Col>
                  </div>
                </RowShell>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
