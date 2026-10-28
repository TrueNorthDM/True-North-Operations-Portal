'use client'

/**
 * The notification table, in two modes. First built 22 September 2026; one
 * table with a Category column since 7 October 2026, when the daily summary
 * email arrived.
 *
 *   mine    the Notifications section of Settings: a person's own choices.
 *           On (a lock when an admin fixed it), When (as it happens, or the
 *           daily summary: the bell at the person's summary hour and the
 *           email), and Preview (the eye: how it looks, and "Send me a test").
 *   rules   Admin's Notification rules: the default On and When for everyone,
 *           whether people may change each, and how many switched it off.
 *
 * "When" decides "where", so there is no Where column. A type that only makes
 * sense one way shows that way, fixed, with "only". What the portal cannot do
 * yet is listed faded, with the reason. Each change saves on its own.
 *
 * The pieces are in components/notifications (parts, the preview window).
 */

import { staleOr } from '@/lib/ui/action-error'
import { useState, useTransition } from 'react'
import { NavIcon } from '@/components/NavIcon'
import { Switch } from '@/components/ui/Switch'
import { Segmented } from '@/components/ui/Segmented'
import {
  BLOCKS, DAILY_HOUR, KEEP_READ_DAYS, KEEP_UNREAD_DAYS,
  effective, timingIsChoice,
  type NotificationType, type Pref, type Rule, type Timing,
} from '@/lib/notifications/catalogue'
import { zoneLabel } from '@/lib/notifications/zones'
import { CategoryPill, EyeGlyph, FixToggle, LockGlyph, NameCell, TD, TH, TIMING, WhenFixed, fixedSentence } from './notifications/parts'
import { NotificationPreview, type SendTest } from './notifications/NotificationPreview'

type Result = { ok: boolean; error?: string }
type SavePref = (key: string, pref: Pref) => Promise<Result>
type SaveRule = (key: string, rule: Rule) => Promise<Result>
export type NotificationMode = 'mine' | 'rules'

/** As it happens | Daily summary, for the types that allow both. */
function WhenChoice({ value, onChange, disabled, label }: { value: Timing; onChange: (t: Timing) => void; disabled?: boolean; label: string }) {
  return <Segmented label={label} value={value} onChange={onChange} disabled={disabled}
    options={(['instant', 'daily'] as const).map(k => ({ key: k, label: TIMING[k].label, glyph: TIMING[k].glyph }))} />
}

// ── The page ────────────────────────────────────────────────────────────────

export function NotificationSettings({
  mode, types, rules: initialRules, prefs: initialPrefs = {}, savePref = null, saveRule = null, blocked,
  zone = null, hour = DAILY_HOUR, sendTest = null, offCounts,
}: {
  mode: NotificationMode
  /** mine: the types that can reach this person (faded ones included). rules: the whole catalogue. */
  types: readonly NotificationType[]
  rules: Record<string, Rule>
  prefs?: Record<string, Pref>
  /** Null in the design check: changes stay on the page. */
  savePref?: SavePref | null
  saveRule?: SaveRule | null
  /** Why nothing can be saved right now (no migration yet, no Directory person). Changes are refused with it. */
  blocked?: string
  /** The person's own time zone and summary hour, for the words above the table. Null: New York. */
  zone?: string | null
  hour?: number
  sendTest?: SendTest | null
  /** Admins: per type, how many it reaches and how many of them switched it off. */
  offCounts?: Record<string, { off: number; reach: number }>
}) {
  const tab = mode
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
      const res = await run().catch(e => ({ ok: false, error: staleOr(e, 'Not saved. Try again in a moment.') }))
      if (!res.ok) revert()
      setStatus({ key, state: res.ok ? 'saved' : 'error', error: res.error })
    })
  }

  const changePref = (key: string, patch: Pref) => {
    const before = prefs[key]
    const next = { ...before, ...patch }
    setPrefs(p => ({ ...p, [key]: next }))
    // Only the change is sent: the server keeps whatever else was stored.
    persist(`mine:${key}`, savePref && (() => savePref(key, patch)), () => setPrefs(p => ({ ...p, [key]: before })))
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
    .filter(t => t.block === 'tools' || t.block === 'system')
    .sort((a, b) => (a.block === b.block ? Number(!a.available) - Number(!b.available) : a.block === 'tools' ? -1 : 1))
  const later = BLOCKS.filter(b => !b.available)

  return (
    <div className="space-y-5">

      <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3 text-[13px] text-foreground leading-relaxed flex items-start gap-2.5">
        <NavIcon name={tab === 'rules' ? 'admin' : 'bell'} size={17} className="shrink-0 mt-0.5 text-tn-teal" />
        {tab === 'mine' ? (
          <div className="flex-1 min-w-0 space-y-1">
            <p className="m-0"><strong className="text-tn-ink">As it happens</strong> arrives in the bell right away. <strong className="text-tn-ink">Daily summary</strong>{` arrives by email at ${hour}:00 AM ${zoneLabel(zone)} time, Monday to Friday (change it in `}<a href="#time" className="text-tn-teal font-semibold">Time and region</a>), and in the bell too.</p>
            <p className="m-0">{`One summary email a day, for Tools, and none when there is nothing to tell. System notifications stay in the bell. After a weekend or a US holiday, the next one catches you up.`}</p>
            <p className="m-0">{`A lock means an admin set that choice for everyone. The eye shows how a notification looks and sends you a test. Read notifications leave the bell after ${KEEP_READ_DAYS} days, unread ones after ${KEEP_UNREAD_DAYS}. Changes save on their own.`}</p>
          </div>
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
                        <Switch on={!faded && rule.enabled} disabled={faded} label={`${t.title}, on for everyone`} onChange={v => changeRule(t.key, { enabled: v })} />
                        <FixToggle label={`${t.title}, on or off`} fixed={rule.fixEnabled} disabled={faded} onChange={v => changeRule(t.key, { fixEnabled: v })} />
                      </div>
                    </td>
                    <td className={TD}>
                      {timingIsChoice(t) ? (
                        <div className="flex items-center gap-2">
                          <WhenChoice label={`${t.title}: default when`} value={rule.timing} disabled={faded} onChange={v => changeRule(t.key, { timing: v })} />
                          <FixToggle label={`${t.title}, when`} fixed={rule.fixTiming} disabled={faded} onChange={v => changeRule(t.key, { fixTiming: v })} />
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
                        <span className="text-[#8a6703]"><LockGlyph /></span>{sentence}
                      </p>
                    )}
                    {statusFor(`mine:${t.key}`)}
                  </>} />
                  <td className={TD}><CategoryPill block={t.block} /></td>
                  <td className={TD}>
                    {!faded && rule.fixEnabled
                      ? <span className="inline-flex items-center gap-1.5 text-[#8a6703]" title="Set by an admin"><LockGlyph size={14} /><span className="text-[12px] font-bold text-tn-ink">{rule.enabled ? 'On' : 'Off'}<span className="sr-only">, set by an admin</span></span></span>
                      : <Switch on={!faded && eff.enabled} disabled={faded} label={t.title} onChange={v => changePref(t.key, { enabled: v })} />}
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

      {preview && <NotificationPreview t={preview} hour={hour} sendTest={sendTest} onClose={() => setPreview(null)} />}
    </div>
  )
}
