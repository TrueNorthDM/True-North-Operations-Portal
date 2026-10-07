'use client'

/**
 * The Notification settings page. First built 22 September 2026; redrawn on
 * 7 October 2026 as one table with a Category column, when the daily summary
 * email arrived:
 *
 *   On        on or off (a lock when an admin fixed it).
 *   When      as it happens (the bell at once) or the daily summary (the bell
 *             at 8:00 and the summary email). "When" decides "where", so there
 *             is no Where column. A type that only makes sense one way shows
 *             that way, fixed, with "only".
 *   Preview   the eye: how it looks in the bell and in the email, and "Send me
 *             a test" to either.
 *
 * The summary arrives at the person's own hour and time zone, chosen in
 * Settings, Time and region. What the portal cannot do yet is listed faded,
 * with the reason.
 *
 * Admins also get "Rules for everyone": a default for On and When, whether
 * people may change each, and how many people switched each one off. The
 * personal Settings page shows only the person's tab (`only="mine"`), Admin's
 * Notification rules only the rules (`only="rules"`). Each change saves on its
 * own.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { NavIcon } from '@/components/NavIcon'
import {
  BLOCKS, CATEGORY_LABEL, DAILY_HOUR, KEEP_READ_DAYS, KEEP_UNREAD_DAYS,
  effective, timingIsChoice,
  type NotificationType, type Pref, type Rule, type Timing,
} from '@/lib/notifications/catalogue'
import { zoneLabel } from '@/lib/notifications/zones'

type Result = { ok: boolean; error?: string }
type SavePref = (key: string, pref: Pref) => Promise<Result>
type SaveRule = (key: string, rule: Rule) => Promise<Result>
type SendTest = (key: string, channel: 'app' | 'email') => Promise<Result>
type Tab = 'mine' | 'rules'

function LockGlyph({ open = false, size = 11 }: { open?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
      <path d="M5 11h14v10H5z" />
      <path d={open ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  )
}

const BellGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
  </svg>
)
const MailGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0">
    <rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" />
  </svg>
)
const EyeGlyph = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
  </svg>
)

function Switch({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`shrink-0 w-10 h-[22px] rounded-full transition-colors disabled:cursor-default disabled:opacity-50 ${on ? 'bg-tn-teal' : 'bg-slate-300'}`}
    >
      <span className={`block w-[18px] h-[18px] rounded-full bg-white transition-transform ${on ? 'translate-x-[20px]' : 'translate-x-0.5'}`} />
    </button>
  )
}

const TIMING: Record<Timing, { label: string; glyph: React.ReactNode }> = {
  instant: { label: 'As it happens', glyph: <BellGlyph /> },
  daily: { label: 'Daily summary', glyph: <MailGlyph /> },
}

/** As it happens | Daily summary, for the types that allow both. */
function WhenChoice({ value, onChange, disabled, label }: { value: Timing; onChange: (t: Timing) => void; disabled?: boolean; label: string }) {
  return (
    <div role="radiogroup" aria-label={label}
      className={`inline-flex items-center gap-0.5 bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {(['instant', 'daily'] as const).map(k => (
        <button key={k} type="button" role="radio" aria-checked={value === k} disabled={disabled} onClick={() => onChange(k)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-[7px] text-[12px] font-bold whitespace-nowrap transition-colors ${
            value === k ? 'bg-tn-primary text-[#ffffff]' : 'text-muted hover:text-tn-ink'}`}>
          {TIMING[k].glyph}{TIMING[k].label}
        </button>
      ))}
    </div>
  )
}

/** One timing, not a choice: "Daily summary only", or the admin's fixed value with a lock. */
function WhenFixed({ timing, only, locked, faded }: { timing: Timing; only?: boolean; locked?: boolean; faded?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-[9px] px-2.5 py-[6px] text-[12px] font-bold whitespace-nowrap ${faded ? 'text-muted' : 'bg-subtle text-tn-ink'}`}>
      {TIMING[timing].glyph}{TIMING[timing].label}
      {only && <span className="font-semibold text-muted">only</span>}
      {locked && <span className="text-[#a67c04]" title="Set by an admin"><LockGlyph /></span>}
    </span>
  )
}

function CategoryPill({ block }: { block: NotificationType['block'] }) {
  const cls = block === 'system' ? 'bg-[#efedfc] text-[#5b4bc4]' : 'bg-[rgba(30,125,127,.1)] text-tn-teal'
  return <span className={`inline-block rounded-full px-[9px] py-0.5 text-[10.5px] font-extrabold tracking-[.08em] uppercase font-(family-name:--font-display) ${cls}`}>{CATEGORY_LABEL[block]}</span>
}

/**
 * The admin's per-setting choice: people may change it (an open lock), or it
 * is fixed (a gold lock on navy). Square, so the rules table fits beside the
 * Admin panel; the words are in its label and tooltip.
 */
function FixToggle({ fixed, onChange, disabled }: { fixed: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const words = fixed ? 'Fixed for everyone. Click to let people change it.' : 'People can change it. Click to fix it for everyone.'
  return (
    <button
      type="button"
      aria-pressed={fixed}
      aria-label={words}
      title={words}
      disabled={disabled}
      onClick={() => onChange(!fixed)}
      className={`shrink-0 w-7 h-7 rounded-[8px] inline-flex items-center justify-center transition-colors disabled:opacity-40 disabled:cursor-default ${
        fixed ? 'bg-tn-primary text-[#F2C40A]' : 'bg-white text-[#b3bcc8] border border-[var(--panel-border)] hover:text-tn-ink'}`}
    >
      <LockGlyph open={!fixed} size={13} />
    </button>
  )
}

const WHEN_WORDS: Record<Timing, string> = { instant: 'always as it happens', daily: 'always in the daily summary' }

/** "Set by an admin: you can't turn it off, always as it happens." */
function fixedSentence(t: NotificationType, r: Rule): string | null {
  if (r.fixEnabled && !r.enabled) return 'An admin turned this off for everyone.'
  const parts = [
    r.fixEnabled ? "you can't turn it off" : null,
    r.fixTiming && timingIsChoice(t) ? WHEN_WORDS[r.timing] : null,
  ].filter(Boolean)
  return parts.length ? `Set by an admin: ${parts.join(', ')}.` : null
}

const TH = 'text-left font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted bg-subtle px-4 py-2.5 border-b border-[var(--panel-border)] whitespace-nowrap'
const TD = 'px-4 py-3 border-t border-[var(--row-rule)] align-middle'

function NameCell({ t, faded, below }: { t: NotificationType; faded: boolean; below?: React.ReactNode }) {
  return (
    <td className={TD}>
      <div className="flex items-start gap-3 min-w-[220px]">
        <span className={`w-8 h-8 rounded-[9px] shrink-0 inline-flex items-center justify-center ${faded ? 'bg-subtle text-muted' : 'bg-[rgba(30,125,127,.1)] text-tn-teal'}`}>
          <NavIcon name={t.icon} size={16} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-tn-ink">{t.title}</span>
            {faded && <span className="rounded bg-[#fbf1cf] px-[5px] py-0.5 text-[9.5px] font-bold tracking-[.06em] text-[#a67c04]">NOT YET</span>}
          </div>
          <p className="text-[12px] text-muted m-0 mt-0.5 leading-snug">{faded ? t.blockedBy : `${t.description} Goes to: ${t.who}.`}</p>
          {below}
        </div>
      </div>
    </td>
  )
}

// ── The preview window ──────────────────────────────────────────────────────

function Preview({ t, hour, sendTest, onClose }: { t: NotificationType; hour: number; sendTest: SendTest | null; onClose: () => void }) {
  const router = useRouter()
  const [tab, setTab] = useState<'app' | 'email'>('app')
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'sent' | 'error'; text?: string }>({ kind: 'idle' })
  const [, start] = useTransition()
  const canEmail = timingIsChoice(t) || t.timings === 'daily'
  const send = () => {
    if (!sendTest) { setState({ kind: 'sent', text: 'Here in the design check nothing is sent.' }); return }
    setState({ kind: 'sending' })
    start(async () => {
      const res = await sendTest(t.key, tab).catch(e => ({ ok: false, error: String(e) }))
      if (res.ok) {
        setState({ kind: 'sent', text: tab === 'app' ? 'Sent: it is in your bell now, marked Test.' : 'Sent: check your inbox in a minute.' })
        if (tab === 'app') router.refresh()
      } else setState({ kind: 'error', text: res.error ?? 'Not sent.' })
    })
  }
  const pick = (k: 'app' | 'email') => { setTab(k); setState({ kind: 'idle' }) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-[rgba(1,35,88,.35)] flex items-center justify-center p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby="notif-preview-title" className="w-full max-w-[560px] bg-white rounded-[18px] shadow-[0_30px_60px_-20px_rgba(1,35,88,.5)] overflow-hidden">
        <div className="px-5 pt-[18px]">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.12em] uppercase text-tn-teal">Preview</span>
          <h3 id="notif-preview-title" className="font-(family-name:--font-display) font-black text-[18px] text-tn-ink m-0 mt-0.5">{t.title}</h3>
        </div>
        <div role="tablist" className="flex gap-0.5 px-5 mt-3 border-b border-[var(--panel-border)]">
          {([['app', 'In the portal'], ['email', 'By email']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => pick(k)}
              className={`px-3 py-2.5 -mb-px border-b-2 text-[13px] font-bold transition-colors ${tab === k ? 'text-tn-ink border-tn-teal' : 'text-muted border-transparent hover:text-tn-ink'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="bg-subtle px-5 py-[18px] space-y-2.5">
          {tab === 'app' ? (
            <>
              <div className="rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden">
                <div className="flex justify-between px-3.5 py-2.5 border-b border-[var(--row-rule)]">
                  <span className="font-(family-name:--font-display) font-extrabold text-[13px] text-tn-ink">Notifications</span>
                  <span className="text-[12px] font-semibold text-tn-teal">Mark all read</span>
                </div>
                <div className="flex gap-3 px-3.5 py-3 bg-[#f8fbfb]">
                  <span className="w-[34px] h-[34px] rounded-[10px] shrink-0 inline-flex items-center justify-center bg-[rgba(30,125,127,.12)] text-tn-teal"><NavIcon name={t.icon} size={17} /></span>
                  <span className="flex-1 min-w-0 flex flex-col gap-[3px]">
                    <span className="flex justify-between items-baseline gap-2">
                      <span className="flex items-baseline gap-1.5 min-w-0">
                        <span className="w-[7px] h-[7px] rounded-full bg-tn-teal shrink-0 -translate-y-px" />
                        <span className="text-[13.5px] font-bold text-tn-ink leading-snug">{t.example.title}</span>
                      </span>
                      <span className="text-[11.5px] text-muted whitespace-nowrap">9:40 AM</span>
                    </span>
                    <span className="text-[12.5px] text-foreground leading-normal">{t.example.body}</span>
                    <span className="text-[10.5px] font-bold tracking-[.06em] uppercase text-muted mt-0.5">{t.src}</span>
                  </span>
                </div>
              </div>
              <p className="text-[12px] text-muted m-0">How it shows in the bell at the top right. Example content.</p>
            </>
          ) : canEmail ? (
            <>
              <div className="rounded-[12px] border border-[var(--row-rule)] bg-white flex items-center gap-3.5 pr-3.5 overflow-hidden">
                <span className={`self-stretch w-1 shrink-0 ${t.alarm ? 'bg-[#c8323d]' : t.key === 'step-due-tomorrow' ? 'bg-[#F2C40A]' : t.block === 'system' ? 'bg-[#5b4bc4]' : 'bg-tn-teal'}`} />
                <div className="flex-1 min-w-0 py-3">
                  <div className="font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.08em] uppercase text-muted">{t.src}</div>
                  <div className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink leading-snug">{t.example.title}</div>
                  <div className="text-[13px] text-foreground leading-normal">{t.example.body}</div>
                </div>
                <span className="text-[12.5px] font-bold text-tn-teal whitespace-nowrap">Open →</span>
              </div>
              <p className="text-[12px] text-muted m-0">
                {`One line in your ${CATEGORY_LABEL[t.block]} summary email, under "${t.section}". The summary arrives at ${hour}:00, Monday to Friday. Example content.`}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted m-0 py-3">This one is never emailed: it always arrives in the bell the moment it happens.</p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3.5">
          <div className="flex items-center gap-3 flex-wrap">
            <button type="button" onClick={send} disabled={state.kind === 'sending' || (tab === 'email' && !canEmail) || !t.available}
              className="rounded-[9px] bg-tn-primary text-[#ffffff] px-3.5 py-2 text-[13px] font-bold disabled:opacity-40">
              {state.kind === 'sending' ? 'Sending…' : tab === 'app' ? 'Send me a test' : 'Email me a test'}
            </button>
            {state.text && <span className={`text-[12.5px] font-bold ${state.kind === 'error' ? 'text-[#b3271f]' : 'text-[#0d7a4f]'}`}>{state.text}</span>}
          </div>
          <button type="button" onClick={onClose} className="rounded-[9px] border border-[var(--panel-border)] bg-white text-tn-ink px-3.5 py-2 text-[13px] font-bold">Close</button>
        </div>
      </div>
    </div>
  )
}

// ── The page ────────────────────────────────────────────────────────────────

export function NotificationSettings({
  types, mine, rules: initialRules, prefs: initialPrefs, isAdmin, savePref, saveRule, initialTab = 'mine', only, blocked,
  zone, hour = DAILY_HOUR, sendTest, offCounts,
}: {
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
  /** Show one tab alone, with no switch: the Settings page ('mine'), Admin's rules ('rules'). */
  only?: Tab
  /** Why nothing can be saved right now (no migration yet, no Directory person). Changes are refused with it. */
  blocked?: string
  /** The person's own time zone and summary hour, for the words above the table. Null: New York. */
  zone: string | null
  hour?: number
  sendTest: SendTest | null
  /** Admins: per type, how many it reaches and how many of them switched it off. */
  offCounts?: Record<string, { off: number; reach: number }>
}) {
  const [tab, setTab] = useState<Tab>(only ?? (isAdmin ? initialTab : 'mine'))
  const [rules, setRules] = useState(initialRules)
  const [prefs, setPrefs] = useState(initialPrefs)
  const [preview, setPreview] = useState<NotificationType | null>(null)
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
      <span className={`block text-[11.5px] mt-1 ${s.state === 'error' ? 'text-[#b3271f]' : 'text-muted'}`}>
        {s.state === 'saving' ? 'Saving…' : s.state === 'saved' ? 'Saved' : s.error ?? 'Not saved'}
      </span>
    )
  }

  // Tools first, then System, in the catalogue's order; the ones still to come last in each.
  const listed = types
    .filter(t => (t.block === 'tools' || t.block === 'system') && (tab === 'rules' || mine.includes(t.key)))
    .sort((a, b) => (a.block === b.block ? Number(!a.available) - Number(!b.available) : a.block === 'tools' ? -1 : 1))
  const later = BLOCKS.filter(b => !b.available)

  const tabBtn = (k: Tab, text: string) => (
    <button type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
      className={`px-3.5 py-1.5 rounded-[8px] text-[13px] font-semibold transition-colors ${tab === k ? 'bg-tn-primary text-[#ffffff]' : 'text-muted hover:text-tn-ink'}`}>
      {text}
    </button>
  )

  return (
    <div className="space-y-5">
      {isAdmin && !only && (
        <div role="tablist" className="inline-flex items-center gap-1 rounded-[11px] border border-[var(--panel-border)] bg-white p-1">
          {tabBtn('mine', 'My notifications')}
          {tabBtn('rules', 'Rules for everyone')}
        </div>
      )}

      <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3 text-[13px] text-foreground leading-relaxed flex items-start gap-2.5">
        <NavIcon name={tab === 'rules' ? 'admin' : 'bell'} size={17} className="shrink-0 mt-0.5 text-tn-teal" />
        {tab === 'mine' ? (
          <p className="m-0 flex-1 min-w-0">
            <strong className="text-tn-ink">As it happens</strong> arrives in the bell right away. <strong className="text-tn-ink">Daily summary</strong>
            {` arrives by email at ${hour}:00 ${zoneLabel(zone)} time (change it in Time and region), Monday to Friday, and also in the bell; after a weekend or a US holiday, the next summary catches you up. You get at most two summary emails a day, one per category, and none when there is nothing to tell. A lock means an admin set that choice for everyone. Use the eye to see how a notification looks, and to send yourself a test. Read notifications leave the bell after ${KEEP_READ_DAYS} days, unread ones after ${KEEP_UNREAD_DAYS}. Changes save on their own.`}
          </p>
        ) : (
          <span>
            The rule for everyone each notification reaches. Pick the default, and click the lock beside it to make it
            <strong className="text-tn-ink"> fixed</strong> (gold) or let people change it (open). People who never changed an open setting follow its default; a fixed one shows on
            their page locked. &quot;Turned off by&quot; counts the people it reaches who switched it off: a high share can mean it is noisy or not useful.
          </span>
        )}
      </div>

      <div className="rounded-[14px] border border-[var(--panel-border)] bg-white overflow-x-auto">
        <table className="w-full border-collapse text-[13.5px] min-w-[760px]">
          <thead>
            {tab === 'mine' ? (
              <tr><th className={TH}>Notification</th><th className={TH}>Category</th><th className={TH}>On</th><th className={TH}>When</th><th className={`${TH} text-center`}>Preview</th></tr>
            ) : (
              <tr><th className={TH}>Notification</th><th className={TH}>Category</th><th className={TH}>Default on</th><th className={TH}>Default when</th><th className={TH}>Turned off by</th></tr>
            )}
          </thead>
          <tbody>
            {listed.map(t => {
              const faded = !t.available
              const rule = rules[t.key]

              if (tab === 'rules') {
                const c = offCounts?.[t.key]
                const pct = c && c.reach ? Math.round((100 * c.off) / c.reach) : 0
                return (
                  <tr key={t.key} className={faded ? 'opacity-55' : ''}>
                    <NameCell t={t} faded={faded} below={statusFor(`rules:${t.key}`)} />
                    <td className={TD}><CategoryPill block={t.block} /></td>
                    <td className={TD}>
                      <div className="flex items-center gap-2">
                        <Switch on={!faded && rule.enabled} disabled={faded} label={`${t.title}: ${rule.enabled ? 'on' : 'off'} for everyone`} onChange={v => changeRule(t.key, { enabled: v })} />
                        <FixToggle fixed={rule.fixEnabled} disabled={faded} onChange={v => changeRule(t.key, { fixEnabled: v })} />
                      </div>
                    </td>
                    <td className={TD}>
                      {timingIsChoice(t) ? (
                        <div className="flex items-center gap-2">
                          <WhenChoice label={`${t.title}: default when`} value={rule.timing} disabled={faded} onChange={v => changeRule(t.key, { timing: v })} />
                          <FixToggle fixed={rule.fixTiming} disabled={faded} onChange={v => changeRule(t.key, { fixTiming: v })} />
                        </div>
                      ) : <WhenFixed timing={t.timings as Timing} only faded={faded} />}
                    </td>
                    <td className={TD}>
                      {faded || !c ? <span className="text-[12.5px] text-muted">{faded ? 'not built yet' : 'n/a'}</span> : (
                        <div className={`flex items-center gap-2 text-[12.5px] whitespace-nowrap ${pct >= 25 ? 'text-[#b25e09] font-bold' : 'text-foreground'}`}>
                          <span className="w-[90px] h-1.5 rounded-full bg-[var(--row-rule)] overflow-hidden">
                            <span className="block h-full rounded-full bg-[#e8a33a]" style={{ width: `${pct}%` }} />
                          </span>
                          {`${c.off} of ${c.reach}`}
                        </div>
                      )}
                    </td>
                  </tr>
                )
              }

              const eff = effective(t, rule, prefs[t.key])
              const sentence = faded ? null : fixedSentence(t, rule)
              const offForAll = rule.fixEnabled && !rule.enabled
              const whenLocked = rule.fixTiming && timingIsChoice(t)
              return (
                <tr key={t.key} className={faded ? 'opacity-55' : ''}>
                  <NameCell t={t} faded={faded} below={<>
                    {sentence && (
                      <p className="text-[11.5px] font-semibold text-tn-primary m-0 mt-1 inline-flex items-center gap-1.5">
                        <span className="text-[#a67c04]"><LockGlyph /></span>{sentence}
                      </p>
                    )}
                    {statusFor(`mine:${t.key}`)}
                  </>} />
                  <td className={TD}><CategoryPill block={t.block} /></td>
                  <td className={TD}>
                    {!faded && rule.fixEnabled
                      ? <span className="inline-flex items-center gap-1.5 text-[#a67c04]" title="Set by an admin"><LockGlyph size={14} /><span className="text-[12px] font-bold text-tn-ink">{rule.enabled ? 'On' : 'Off'}</span></span>
                      : <Switch on={!faded && eff.enabled} disabled={faded} label={`${t.title}: ${eff.enabled ? 'on' : 'off'}`} onChange={v => changePref(t.key, { enabled: v })} />}
                  </td>
                  <td className={TD}>
                    {faded ? <WhenFixed timing={t.defaultTiming} faded />
                      : !timingIsChoice(t) ? <WhenFixed timing={eff.timing} only />
                      : whenLocked || offForAll ? <WhenFixed timing={eff.timing} locked={whenLocked} />
                      : <WhenChoice label={`${t.title}: when`} value={eff.timing} disabled={!eff.enabled} onChange={v => changePref(t.key, { timing: v })} />}
                  </td>
                  <td className={`${TD} text-center`}>
                    <button type="button" onClick={() => setPreview(t)} aria-label={`Preview: ${t.title}`}
                      className="w-[34px] h-[34px] rounded-[9px] border border-[var(--panel-border)] bg-white text-tn-teal inline-flex items-center justify-center hover:border-tn-teal hover:bg-[rgba(30,125,127,.08)]">
                      <EyeGlyph />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {later.length > 0 && (
        <p className="text-[12.5px] text-muted m-0">
          {`Still to come: ${later.map(b => b.title).join(' and ')} notifications, which arrive with those parts of the portal.`}
        </p>
      )}

      {preview && <Preview t={preview} hour={hour} sendTest={sendTest} onClose={() => setPreview(null)} />}
    </div>
  )
}
