'use client'

/**
 * Agenda settings (owner, 30 October 2026; the approved mockup "Agenda Google
 * Calendar", sections 2 and 3): the team calendar, the person's Google
 * accounts, their working hours, the holidays they see and their time zone.
 * What only a Super Admin changes is a white card with buttons; what everyone
 * else only reads sits in a beige block, with no "view only" badge.
 */

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FieldLabel, Icon, Modal, MODAL_TITLE, Toast, type ToastState } from '@/components/clocky/entries/ui'
import { Select } from '@/components/ui/Select'
import { failText } from '@/lib/ui/action-error'
import type { AgendaAccount, AgendaSettingsData } from '@/lib/agenda/settings-data'
import { APPROVED_DOMAIN } from '@/lib/agenda/accounts'
import { clockLabel } from '@/lib/agenda/time'
import { copyDay, DAY_NAMES, tidy, WEEKDAYS, type Block, type Weekday, type WorkingHours } from '@/lib/agenda/working-hours'

type Done = { ok: true; toast: string } | { ok: false; error: string }

export interface AgendaSettingsApi {
  connectAccount(i: { email: string }): Promise<Done>
  disconnectAccount(i: { id: number }): Promise<Done>
  setInviteAccount(i: { id: number | null }): Promise<Done>
  saveWorkingHours(i: { hours: WorkingHours }): Promise<Done>
  connectTeamCalendar(i: { email: string }): Promise<Done>
  disconnectTeamCalendar(): Promise<Done>
  setAllLevels(i: { levels: string[] }): Promise<Done>
}

const CARD = 'bg-white border border-[var(--panel-border)] rounded-[18px] p-5 flex flex-col gap-3.5'
const TITLE = 'font-(family-name:--font-display) font-extrabold text-[16px] text-tn-ink'
const SUB = 'text-[13px] text-foreground leading-[1.5]'
const BEIGE = 'bg-subtle rounded-[12px] px-3.5 py-3'
const BTN_TEAL = 'inline-flex items-center gap-2 border-0 rounded-[12px] px-4 py-2.5 bg-tn-teal text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13.5px] cursor-pointer disabled:opacity-50'
const BTN_W = 'inline-flex items-center gap-2 border border-slate-200 rounded-[10px] px-3.5 py-[9px] bg-white text-tn-ink font-(family-name:--font-display) font-extrabold text-[12.5px] cursor-pointer hover:border-tn-teal disabled:opacity-50'
const BTN_N = 'inline-flex items-center gap-2 border-0 rounded-[10px] px-[18px] py-[11px] bg-tn-primary text-[#ffffff] font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer hover:bg-[#0a2f6b] disabled:opacity-50'
const LINK = 'border-0 bg-transparent p-0 cursor-pointer font-bold text-[13px] text-tn-teal hover:underline disabled:opacity-50'
const LINK_RED = 'border-0 bg-transparent p-0 cursor-pointer font-bold text-[13px] text-[#b2412f] hover:underline disabled:opacity-50'
const PILL_OK = 'text-[11px] font-extrabold rounded-[6px] px-[7px] py-0.5 bg-[#e2f2ee] text-[#16695c]'
const PILL_SAMPLE = 'text-[11px] font-extrabold rounded-[6px] px-[7px] py-0.5 bg-subtle text-muted'
const TIMES = Array.from({ length: 49 }, (_, i) => i * 30).map(m => ({ value: String(m), label: m === 1440 ? '12:00 AM (midnight)' : clockLabel(m) }))
const when = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const say = (t: ToastState) => { setToast(t); setTimeout(() => setToast(null), 4200) }
  return [toast, say] as const
}

export function AgendaSettings({ data, api }: { data: AgendaSettingsData; api: AgendaSettingsApi }) {
  const router = useRouter()
  const [toast, say] = useToast()
  const [busy, setBusy] = useState(false)
  const run = async (p: Promise<Done>, after?: () => void) => {
    setBusy(true)
    try {
      const r = await p
      say(r.ok ? { text: r.toast } : { text: r.error, error: true })
      if (r.ok) { after?.(); router.refresh() }
    } catch (e) {
      say({ text: failText(e), error: true })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col gap-[18px]">
      <TeamCalendarCard data={data} busy={busy} run={run} api={api} />
      {data.superAdmin && <AllLevelsCard levels={data.allLevels} busy={busy} run={run} api={api} />}
      <AccountsCard data={data} busy={busy} run={run} api={api} />
      <WorkingHoursCard hours={data.hours} zone={data.zone.name} busy={busy} run={run} api={api} />
      <HolidaysCard country={data.country} />
      <YourTimeCard zone={data.zone} />
      <Toast toast={toast} />
    </div>
  )
}

type Run = (p: Promise<Done>, after?: () => void) => Promise<void>

function TeamCalendarCard({ data, busy, run, api }: { data: AgendaSettingsData; busy: boolean; run: Run; api: AgendaSettingsApi }) {
  const t = data.teamCalendar
  const [asking, setAsking] = useState(false)
  return (
    <section className={CARD} aria-label="Team calendar">
      <div>
        <div className={TITLE}>Team calendar</div>
        <p className={`${SUB} m-0 mt-1`}>
          The True North calendar the whole team sees. Approved time off goes here on its own, and anyone can send an event here from the New event drawer. Events added on it straight in Google show in the portal too.
        </p>
      </div>
      {data.superAdmin ? (
        <>
          {t ? (
            <div className="flex flex-wrap items-center gap-3 border border-[var(--panel-border)] rounded-[12px] px-3.5 py-3">
              <AccountWho a={t} line={`Connected${t.by ? ` by ${t.by}` : ''}, ${when(t.connectedAt)}`} />
              <span className={PILL_OK}>Connected</span>
              <button type="button" className={LINK} disabled={busy} onClick={() => setAsking(true)}>Reconnect</button>
              <button type="button" className={LINK_RED} disabled={busy} onClick={() => void run(api.disconnectTeamCalendar())}>Disconnect</button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3 border border-dashed border-[#c9d0da] rounded-[12px] px-3.5 py-3">
              <span className={SUB}>No team calendar yet. Connect office@{APPROVED_DOMAIN}.</span>
              <button type="button" className={BTN_TEAL} disabled={busy} onClick={() => setAsking(true)}>+ Connect the team calendar</button>
            </div>
          )}
          <FieldLabel>From the portal to Google</FieldLabel>
          <div className={`${BEIGE} ${SUB}`}>Approved time off, as &quot;Olivia Hale: Time off&quot;. The type (vacation, sick) stays private.</div>
          {asking && <ConnectDialog title="Connect the team calendar" placeholder={`office@${APPROVED_DOMAIN}`} busy={busy}
            onClose={() => setAsking(false)} onConnect={email => void run(api.connectTeamCalendar({ email }), () => setAsking(false))} />}
        </>
      ) : (
        <div className={`${BEIGE} flex flex-wrap items-center gap-3`}>
          {t ? <><AccountWho a={t} line="Set up by a Super Admin" /><span className={PILL_OK}>Connected</span></>
            : <span className={SUB}>Not connected yet. A Super Admin connects it.</span>}
        </div>
      )}
    </section>
  )
}

const LEVELS: [string, string][] = [['super_admin', 'Super Admin'], ['admin', 'Admin'], ['team_leader', 'Team Leader'], ['user', 'Member']]

function AllLevelsCard({ levels, busy, run, api }: { levels: string[]; busy: boolean; run: Run; api: AgendaSettingsApi }) {
  const [on, setOn] = useState<string[]>(levels)
  const changed = [...on].sort().join() !== [...levels].sort().join()
  return (
    <section className={CARD} aria-label="Who can invite True North">
      <div>
        <div className={TITLE}>Who can invite True North</div>
        <p className={`${SUB} m-0 mt-1`}>In the New event drawer, &quot;True North&quot; invites everyone in the company. Choose who has it.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {LEVELS.map(([k, l]) => (
          <label key={k} className={`inline-flex items-center gap-2 border rounded-[10px] px-3 py-2 text-[13.5px] font-bold text-tn-ink ${k === 'super_admin' ? 'opacity-70' : 'cursor-pointer'} ${on.includes(k) ? 'border-tn-teal bg-[#f2f8f7]' : 'border-[var(--panel-border)]'}`}>
            <input type="checkbox" checked={on.includes(k)} disabled={k === 'super_admin' || busy}
              onChange={() => setOn(x => (x.includes(k) ? x.filter(y => y !== k) : [...x, k]))} />{l}
          </label>
        ))}
      </div>
      {changed && (
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN_W} disabled={busy} onClick={() => setOn(levels)}>Undo changes</button>
          <button type="button" className={BTN_N} disabled={busy} onClick={() => void run(api.setAllLevels({ levels: on }))}>Save</button>
        </div>
      )}
    </section>
  )
}

function AccountWho({ a, line }: { a: AgendaAccount; line: string }) {
  return (
    <span className="flex-1 min-w-[200px] flex flex-col gap-0.5">
      <b className="text-[14px] text-tn-ink font-bold break-all">{a.email}</b>
      <span className="text-[12px] text-muted">{line}</span>
    </span>
  )
}

function AccountsCard({ data, busy, run, api }: { data: AgendaSettingsData; busy: boolean; run: Run; api: AgendaSettingsApi }) {
  const [asking, setAsking] = useState(false)
  const inviteOptions = [
    ...(data.workEmail ? [{ value: '', label: `${data.workEmail} (work)` }] : [{ value: '', label: 'Your work address' }]),
    ...data.accounts.filter(a => a.email.toLowerCase() !== (data.workEmail ?? '').toLowerCase()).map(a => ({ value: String(a.id), label: a.email })),
  ]
  return (
    <section className={CARD} aria-label="Your Google accounts">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex-1 min-w-[240px]">
          <div className={TITLE}>Your Google accounts</div>
          <p className={`${SUB} m-0 mt-1`}>Events you create are made on one of these, with the Google Meet link, and Find a time and your booking link read when they are busy. Connect as many as you like.</p>
        </div>
        <button type="button" className={BTN_TEAL} disabled={busy} onClick={() => setAsking(true)}>+ Connect a Google account</button>
      </div>
      {data.accounts.length > 0 ? (
        <div className="border border-[var(--panel-border)] rounded-[12px] overflow-hidden">
          {data.accounts.map((a, i) => (
            <div key={a.id} className={`flex flex-wrap items-center gap-3 px-3.5 py-3 ${i ? 'border-t border-[var(--panel-border)]' : ''}`}>
              <AccountWho a={a} line={`Connected ${when(a.connectedAt)}`} />
              {a.sample && <span className={PILL_SAMPLE} title="Google sign-in is not set up yet: this account works with sample data in the portal.">Sample</span>}
              <span className={PILL_OK}>Connected</span>
              <button type="button" className={LINK_RED} disabled={busy} onClick={() => void run(api.disconnectAccount({ id: a.id }))}>Disconnect</button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 px-3.5 py-3 border-t border-[var(--panel-border)] bg-subtle">
            <span className="flex-1 min-w-[200px] flex flex-col gap-0.5">
              <b className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">Invitations to you go to</b>
              <span className="text-[12px] text-muted">When someone invites you from the portal, the Google invitation goes to this account.</span>
            </span>
            <div className="w-full sm:w-[320px]">
              <Select value={data.inviteAccountId == null ? '' : String(data.inviteAccountId)} options={inviteOptions} fullWidth ariaLabel="Invitations to you go to"
                disabled={busy} onChange={v => void run(api.setInviteAccount({ id: v ? Number(v) : null }))}
                className="h-10 px-3 bg-white border border-[var(--panel-border)] rounded-[10px] font-semibold text-[13px]" />
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-dashed border-[#c9d0da] rounded-[12px] px-3.5 py-3 text-[13px] text-foreground leading-[1.5]">
          No account connected yet. Connect one to create events and send invitations from it. Until then, invitations to you go to your work address.
        </div>
      )}
      <div className="flex gap-2.5 items-start bg-[var(--warn-bg)] border border-[#e9d48a] rounded-[12px] px-3 py-2.5 text-[13px] text-[#5c4502] leading-[1.45]">
        <Icon d="M12 8v5M12 16h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={17} color="#8a6703" width={2} />
        <span>For now you can only connect <b>@{APPROVED_DOMAIN}</b> accounts. Other Google accounts, like Gmail or another company, can connect once Google approves the portal.</span>
      </div>
      {asking && <ConnectDialog title="Connect a Google account" placeholder={`you@${APPROVED_DOMAIN}`} busy={busy}
        onClose={() => setAsking(false)} onConnect={email => void run(api.connectAccount({ email }), () => setAsking(false))} />}
    </section>
  )
}

/** Google sign-in comes with the connection task; until then the account is added by its address. */
function ConnectDialog({ title, placeholder, busy, onClose, onConnect }: { title: string; placeholder: string; busy: boolean; onClose: () => void; onConnect: (email: string) => void }) {
  const [email, setEmail] = useState('')
  return (
    <Modal label={title} width={440} onClose={onClose}>
      <h2 className={MODAL_TITLE}>{title}</h2>
      <p className="m-0 text-[13px] text-foreground leading-[1.5]">Google sign-in is not set up yet. For now, type the account&apos;s address: the portal adds it with sample busy times so the Agenda works end to end. Nothing goes to Google.</p>
      <label className="flex flex-col gap-[5px]">
        <FieldLabel>Google account</FieldLabel>
        <input autoFocus value={email} onChange={e => setEmail(e.target.value)} placeholder={placeholder} type="email"
          onKeyDown={e => { if (e.key === 'Enter' && email.trim()) onConnect(email) }}
          className="h-10 box-border px-3 border border-[var(--panel-border)] rounded-[10px] text-[13.5px] text-tn-ink outline-none bg-white focus:border-tn-teal" />
      </label>
      <div className="flex justify-end gap-2">
        <button type="button" className={BTN_W} onClick={onClose}>Cancel</button>
        <button type="button" className={BTN_N} disabled={busy || !email.trim()} onClick={() => onConnect(email)}>Connect</button>
      </div>
    </Modal>
  )
}

function WorkingHoursCard({ hours, zone, busy, run, api }: { hours: WorkingHours; zone: string; busy: boolean; run: Run; api: AgendaSettingsApi }) {
  const [h, setH] = useState<WorkingHours>(hours)
  const [copying, setCopying] = useState<Weekday | null>(null)
  const [copyTo, setCopyTo] = useState<Set<Weekday>>(new Set())
  const changed = JSON.stringify(h) !== JSON.stringify(hours)
  const set = (d: Weekday, blocks: Block[] | null) => setH(x => { const n = { ...x }; if (blocks?.length) n[d] = blocks; else delete n[d]; return n })
  const setBlock = (d: Weekday, i: number, k: 0 | 1, v: number) => {
    const blocks = (h[d] ?? []).map(b => [...b] as Block)
    blocks[i][k] = v
    if (blocks[i][1] <= blocks[i][0]) { if (k === 0) blocks[i][1] = Math.min(v + 60, 1440); else blocks[i][0] = Math.max(v - 60, 0) }
    set(d, tidy(blocks))
  }
  const addBlock = (d: Weekday) => {
    const blocks = h[d] ?? []
    const last = blocks[blocks.length - 1]?.[1] ?? 480
    const start = Math.min(last + 60, 1320)
    set(d, tidy([...blocks, [start, Math.min(start + 180, 1440)]]))
  }
  return (
    <section className={CARD} aria-label="Your working hours">
      <div>
        <div className={TITLE}>Your working hours</div>
        <p className={`${SUB} m-0 mt-1`}>In your time zone ({zone}). Find a time and your booking link only offer meeting times inside these hours.</p>
      </div>
      <div className="flex flex-col">
        {WEEKDAYS.map((d, di) => {
          const blocks = h[d] ?? []
          const on = blocks.length > 0
          return (
            <div key={d} className={`flex flex-wrap items-start gap-3 py-2 ${di ? 'border-t border-[#f0f2f5]' : ''}`}>
              <button type="button" role="switch" aria-checked={on} aria-label={`${DAY_NAMES[d]} working`} disabled={busy}
                onClick={() => set(d, on ? null : [[540, 1080]])}
                className="mt-2.5 flex-none w-9 h-5 border-0 rounded-full relative cursor-pointer p-0" style={{ background: on ? '#1E7D7F' : '#cbd2da' }}>
                <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_3px_rgba(1,35,88,.3)]" style={{ left: on ? 18 : 2 }} />
              </button>
              <span className="w-[92px] pt-2.5 font-bold text-[13.5px] text-tn-ink">{DAY_NAMES[d]}</span>
              <div className="flex flex-col gap-1.5 min-w-0">
                {on ? blocks.map((b, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <TimePick label={`${DAY_NAMES[d]} from`} value={b[0]} onChange={v => setBlock(d, i, 0, v)} disabled={busy} />
                    <span className="text-[13px] text-muted">to</span>
                    <TimePick label={`${DAY_NAMES[d]} to`} value={b[1]} onChange={v => setBlock(d, i, 1, v)} disabled={busy} />
                    {blocks.length > 1 && (
                      <button type="button" aria-label="Remove these hours" title="Remove these hours" disabled={busy}
                        onClick={() => set(d, blocks.filter((_, j) => j !== i))}
                        className="w-[26px] h-[26px] border-0 bg-transparent rounded-[8px] text-muted text-[17px] cursor-pointer hover:bg-subtle hover:text-tn-ink">×</button>
                    )}
                  </div>
                )) : <span className="pt-2.5 text-[13px] text-muted">Not working</span>}
                {on && (
                  <div className="relative flex gap-[18px] justify-center pt-0.5">
                    <button type="button" className={LINK} disabled={busy} onClick={() => addBlock(d)}>+ Add hours</button>
                    <button type="button" className={LINK} disabled={busy} onClick={() => { setCopying(copying === d ? null : d); setCopyTo(new Set()) }}>Copy to other days</button>
                    {copying === d && (
                      <div className="absolute top-[calc(100%+6px)] right-0 z-10 w-[240px] bg-white border border-[var(--panel-border)] rounded-[14px] shadow-[0_14px_34px_rgba(1,35,88,.18)] p-1.5 flex flex-col gap-0.5">
                        <div className="text-[12px] font-extrabold text-muted px-2 pt-1 pb-1.5">Copy {DAY_NAMES[d]}&apos;s hours to</div>
                        {WEEKDAYS.filter(o => o !== d).map(o => (
                          <label key={o} className="flex items-center gap-2.5 px-2 py-[7px] rounded-[8px] text-[13.5px] font-bold text-tn-ink cursor-pointer hover:bg-subtle">
                            <input type="checkbox" checked={copyTo.has(o)} onChange={() => setCopyTo(s => { const n = new Set(s); if (n.has(o)) n.delete(o); else n.add(o); return n })} />
                            {DAY_NAMES[o]}
                          </label>
                        ))}
                        <div className="flex gap-3.5 px-2 py-1.5 text-[12.5px]">
                          <button type="button" className={LINK} onClick={() => setCopyTo(new Set(WEEKDAYS.slice(0, 5).filter(o => o !== d)))}>Weekdays</button>
                          <button type="button" className={LINK} onClick={() => setCopyTo(new Set(WEEKDAYS.filter(o => o !== d)))}>Every day</button>
                        </div>
                        <div className="flex justify-end gap-2 border-t border-[var(--panel-border)] pt-1.5 px-1">
                          <button type="button" className={BTN_W} onClick={() => setCopying(null)}>Cancel</button>
                          <button type="button" className={BTN_N} disabled={!copyTo.size} onClick={() => { setH(x => copyDay(x, d, [...copyTo])); setCopying(null) }}>Copy</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {changed && (
        <div className="flex justify-end gap-2">
          <button type="button" className={BTN_W} disabled={busy} onClick={() => setH(hours)}>Undo changes</button>
          <button type="button" className={BTN_N} disabled={busy} onClick={() => void run(api.saveWorkingHours({ hours: h }))}>Save working hours</button>
        </div>
      )}
    </section>
  )
}

function TimePick({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <div className="w-[132px]">
      <Select value={String(value)} options={TIMES} onChange={v => onChange(Number(v))} ariaLabel={label} fullWidth disabled={disabled}
        className="h-9 px-2.5 bg-white border border-[var(--panel-border)] rounded-[10px] font-semibold text-[13px] tabular-nums" />
    </div>
  )
}

function HolidaysCard({ country }: { country: AgendaSettingsData['country'] }) {
  return (
    <section className={CARD} aria-label="Holidays">
      <div>
        <div className={TITLE}>Holidays</div>
        <p className={`${SUB} m-0 mt-1`}>They show in the portal Agenda only, not in Google. Birthdays and work anniversaries too.</p>
      </div>
      <div className={`${BEIGE} flex flex-col gap-2`}>
        <div className="flex items-center gap-2.5 text-[13.5px] text-foreground"><span className="text-[18px] leading-none">🇺🇸</span><span><b className="text-tn-ink">United States:</b> True North&apos;s official holidays.</span></div>
        {country && <div className="flex items-center gap-2.5 text-[13.5px] text-foreground"><span className="text-[18px] leading-none">{country.flag}</span><span><b className="text-tn-ink">{country.name}:</b> your country, for reference (from your address).</span></div>}
      </div>
    </section>
  )
}

function YourTimeCard({ zone }: { zone: AgendaSettingsData['zone'] }) {
  return (
    <section className={CARD} aria-label="Your time">
      <div>
        <div className={TITLE}>Your time</div>
        <p className={`${SUB} m-0 mt-1`}>Every event is set in Washington DC time (ET). The portal shows your local time beside it.</p>
      </div>
      <div className={`${BEIGE} flex items-start gap-2.5 text-[13.5px] text-foreground leading-[1.45]`}>
        <Icon d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2" size={17} color="#1E7D7F" width={2} />
        <span><b className="text-tn-ink">{zone.name}</b>{zone.isDc ? ', the same as Washington.' : `. Right now Washington is ${zone.versus}.`} You can change it in <Link href="/settings" className="font-bold text-tn-teal hover:underline">your Settings</Link>.</span>
      </div>
    </section>
  )
}
