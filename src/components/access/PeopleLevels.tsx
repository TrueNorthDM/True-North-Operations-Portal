'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Select } from '@/components/ui/Select'
import { TeamPriorityAccess } from '@/components/admin/TeamPriorityAccess'
import { CATALOGUE, ITEM, LEVELS, LEVEL_LABEL, type AccessLevel, type ItemKind } from '@/lib/access/catalogue'
import { allowedKeys, decide, type Decision, type Rules } from '@/lib/access/decide'
import { setPersonLevel } from '@/app/(app)/admin/access-levels/actions'
import { type AccessPageData, type Person, KIND_TAG, Glyph, btn, btnNavy, card, Modal, Face, descendants } from './parts'

// ── People and levels ──────────────────────────────────────────────────────

export function PeopleLevels({ people, teams, base, today, meId, priority, staged, onDone }: {
  people: Person[]; teams: AccessPageData['teams']; base: Rules; today: string; meId: string | null
  priority: AccessPageData['priority']; staged: boolean; onDone: () => void
}) {
  const [changing, setChanging] = useState<{ personId: string; to: 'super_admin' | 'admin' | null } | null>(null)
  const teamName = new Map(teams.map(t => [t.id, t.name]))
  const teamsText = (p: Person) => [...p.teams].map(([id, lead]) => `${lead ? 'Lead' : 'Member'} of ${teamName.get(id) ?? 'a team'}`).join(' · ') || 'No team'
  const intro: Record<AccessLevel, string> = {
    super_admin: 'Everything, always. At least two.',
    admin: 'Given by a Super Admin. Opens what the Admin column has ticked.',
    team_leader: 'Automatic: Lead of at least one team. Change it on the Directory\'s Teams tab.',
    user: 'Automatic: everyone else.',
  }
  return (
    <div className="space-y-6">
      <div className="rounded-[12px] border border-[var(--panel-border)] bg-white px-4 py-3 text-[13px] leading-relaxed">
        <strong className="text-tn-ink">Super Admin</strong> and <strong className="text-tn-ink">Admin</strong> are given here, with a reason. <strong className="text-tn-ink">Team Leader</strong> and <strong className="text-tn-ink">User</strong> are automatic: whoever is Lead of any team on the Directory&apos;s Teams tab is a Team Leader; everyone else is a User. There are always at least two Super Admins.
      </div>
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-start">
        {LEVELS.map(l => {
          const list = people.filter(p => p.level === l.key)
          return (
            <div key={l.key} className={`${card} p-4 space-y-2.5`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-(family-name:--font-display) font-black text-[15px] text-tn-ink m-0">{l.label}</h3>
                <span className="text-[11.5px] font-bold rounded-full bg-subtle px-2">{list.length}</span>
              </div>
              <p className="text-[12px] text-muted m-0">{intro[l.key]}</p>
              {(l.key === 'super_admin' || l.key === 'admin')
                ? <button type="button" className={btn} onClick={() => setChanging({ personId: '', to: l.key as 'super_admin' | 'admin' })}>+ Add</button>
                : <Link href="/directory" className="text-[12.5px] font-bold text-tn-teal">Directory, Teams tab →</Link>}
              <div>
                {list.map(p => (
                  <div key={p.id} className="flex items-center gap-2.5 py-1.5 border-t border-[var(--row-rule)] first:border-t-0">
                    <Face p={p} />
                    <span className="flex-1 min-w-0"><b className="block text-[13px] text-tn-ink">{p.name}{p.id === meId ? ' (you)' : ''}</b><span className="text-[11.5px] text-muted">{teamsText(p)}</span></span>
                    {(l.key === 'super_admin' || l.key === 'admin') && <button type="button" className="text-[12px] font-bold text-tn-teal" onClick={() => setChanging({ personId: p.id, to: null })}>Change</button>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <TeamPriorityAccess people={priority.people} data={priority.data} editingMatrix={staged} onChanged={onDone} />
      {changing && <LevelChange people={people} base={base} today={today} initial={changing} onClose={() => setChanging(null)} onDone={() => { setChanging(null); onDone() }} />}
    </div>
  )
}

function LevelChange({ people, base, today, initial, onClose, onDone }: {
  people: Person[]; base: Rules; today: string; initial: { personId: string; to: 'super_admin' | 'admin' | null }
  onClose: () => void; onDone: () => void
}) {
  const [personId, setPersonId] = useState(initial.personId)
  const [to, setTo] = useState<'super_admin' | 'admin' | null>(initial.to)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const p = people.find(x => x.id === personId)
  const supers = people.filter(x => x.given === 'super_admin').length
  const autoLevel: AccessLevel = p && [...p.teams.values()].some(Boolean) ? 'team_leader' : 'user'
  const newLevel: AccessLevel = to ?? autoLevel
  const blocked = !!p && p.given === 'super_admin' && to !== 'super_admin' && supers <= 2
  const diff = useMemo(() => {
    if (!p) return { gained: [] as string[], lost: [] as string[] }
    const was = allowedKeys(p, base, { today })
    const is = allowedKeys({ ...p, level: newLevel }, base, { today })
    const keep = (k: string) => ITEM.get(k)?.kind !== 'module'
    return { gained: [...is].filter(k => !was.has(k) && keep(k)), lost: [...was].filter(k => !is.has(k) && keep(k)) }
  }, [p, newLevel, base, today])
  const save = () => {
    setError(null)
    start(async () => {
      const res = await setPersonLevel(personId, to, reason).catch(e => ({ ok: false as const, error: String(e) }))
      if (res.ok) onDone(); else setError(res.error)
    })
  }
  return (
    <Modal kicker="Change a level" title={p ? p.name : 'Choose a person'} onClose={onClose}
      foot={<><span /><span className="flex gap-2"><button type="button" className={btn} onClick={onClose}>Cancel</button><button type="button" className={btnNavy} disabled={!p || blocked || p.given === to || reason.trim().length < 8 || pending} onClick={save}>{pending ? 'Saving…' : 'Save the level'}</button></span></>}>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Person</span>
        <Select value={personId} onChange={setPersonId} options={people.map(x => ({ value: x.id, label: `${x.name} · ${LEVEL_LABEL[x.level]}` }))} searchable fullWidth placeholder="Choose a person…" ariaLabel="Person" /></div>
      {p && (
        <>
          <div className="space-y-1.5">
            {([['super_admin', 'Super Admin', 'Everything, always, including this page.'], ['admin', 'Admin', 'What the Admin column has ticked.'], [null, 'Automatic', `Team Leader if Lead of a team, otherwise User. For ${p.name.split(' ')[0]}: ${LEVEL_LABEL[autoLevel]}.`]] as const).map(([v, label, help]) => (
              <button key={String(v)} type="button" aria-pressed={to === v} onClick={() => setTo(v)} className={`w-full text-left rounded-[10px] border px-3 py-2 ${to === v ? 'border-tn-teal bg-[rgba(30,125,127,.06)]' : 'border-[var(--panel-border)]'}`}>
                <b className="text-[13px] text-tn-ink">{label}</b>{p.given === v && <span className="text-[11px] text-muted ml-2">today</span>}
                <div className="text-[12px] text-muted">{help}</div>
              </button>
            ))}
          </div>
          {blocked
            ? <div className="rounded-[10px] border border-[#f0d98a] bg-[#fbf1cf] px-3 py-2 text-[12.5px] text-[#6b5000]">There must always be <b>at least two Super Admins</b>, so nobody can be locked out by one mistake or one lost phone. Make someone else a Super Admin first.</div>
            : p.given !== to && (
              <div className="rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[12.5px] space-y-1">
                <div><b className="text-[#0d7a4f]">Gains {diff.gained.length}</b>{diff.gained.length ? `: ${diff.gained.slice(0, 6).map(k => ITEM.get(k)?.label).join(', ')}${diff.gained.length > 6 ? ` and ${diff.gained.length - 6} more` : ''}` : ''}</div>
                <div><b className="text-[#c8323d]">Loses {diff.lost.length}</b>{diff.lost.length ? `: ${diff.lost.slice(0, 6).map(k => ITEM.get(k)?.label).join(', ')}${diff.lost.length > 6 ? ` and ${diff.lost.length - 6} more` : ''}` : ''}</div>
              </div>
            )}
          <label className="block space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Why? Required</span>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[13.5px] text-tn-ink outline-none focus:border-tn-teal" /></label>
          {error && <p className="text-[12.5px] font-semibold text-[#b3271f] m-0">{error}</p>}
        </>
      )}
    </Modal>
  )
}

// ── Check a person ─────────────────────────────────────────────────────────

export function CheckPerson({ people, rules, teamName, today, initialWho, onPreview }: {
  people: Person[]; rules: Rules; teamName: Map<string, string>; today: string; initialWho: string | null
  onPreview: (p: Person) => void
}) {
  const [who, setWho] = useState(initialWho && people.some(p => p.id === initialWho) ? initialWho : people[0]?.id ?? '')
  const p = people.find(x => x.id === who)
  const memo = new Map<string, Decision>()
  return (
    <div className="space-y-4">
      <div className={`${card} p-4 flex items-center gap-3 flex-wrap`}>
        <span className="text-[13px] font-bold text-tn-ink">Whose access?</span>
        <div className="min-w-[260px]"><Select value={who} onChange={setWho} options={people.map(x => ({ value: x.id, label: `${x.name} · ${LEVEL_LABEL[x.level]}` }))} searchable fullWidth ariaLabel="Person" /></div>
        <span className="text-[12px] text-muted">Every page, tool, tab and action, and the rule that decided it. From the saved rules.</span>
      </div>
      {p && (
        <div className={`${card} p-4 space-y-3`}>
          <div className="flex items-center gap-3 flex-wrap">
            <Face p={p} size={40} />
            <div className="min-w-0">
              <h3 className="font-(family-name:--font-display) font-black text-[19px] text-tn-ink m-0">{p.name}</h3>
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                <span className="text-[11.5px] font-bold rounded-full bg-tn-primary text-[#ffffff] px-2">{LEVEL_LABEL[p.level]}{p.given ? '' : ' (automatic)'}</span>
                {[...p.teams].map(([id, lead]) => <span key={id} className="text-[11.5px] font-semibold rounded-full bg-[#efedfc] text-[#5b4bc4] px-2">{lead ? 'Lead' : 'Member'} of {teamName.get(id) ?? 'a team'}</span>)}
                {(p.exceptions ?? []).filter(e => !e.until || e.until >= today).map(e => <span key={e.key} className="text-[11.5px] font-semibold rounded-full bg-[#fbf1cf] text-[#8a6703] px-2">Exception: {ITEM.get(e.key)?.label ?? e.key}</span>)}
              </div>
            </div>
            {p.level !== 'super_admin' && (
              <button type="button" className={`${btn} ml-auto`} onClick={() => onPreview(p)}>{Glyph.eye} See their portal</button>
            )}
          </div>
          {CATALOGUE.filter(m => m.kind === 'module').map(m => {
            const items = descendants(m.key).filter(i => !i.soon)
            if (!items.length) return null
            return (
              <div key={m.key} className="space-y-0.5">
                <h4 className="font-(family-name:--font-display) font-extrabold text-[12px] tracking-[.08em] uppercase text-tn-teal mt-2 mb-1">{m.label}</h4>
                {items.map(i => {
                  const x = decide(p, i.key, rules, { today, teamNames: teamName, memo })
                  const deep = i.parent && ITEM.get(i.parent)?.kind !== 'module'
                  return (
                    <div key={i.key} className="grid grid-cols-[18px_minmax(0,1fr)_auto] gap-2.5 items-center rounded-[8px] px-2.5 py-1 odd:bg-[#fafbfc]" style={{ paddingLeft: deep ? 34 : 10 }}>
                      <span className={x.ok ? 'text-[#1E9E6A] font-black' : 'text-[#b3bcc8]'}>{x.ok ? '✓' : '–'}</span>
                      <span className={`text-[13px] ${x.ok ? 'text-tn-ink' : 'text-muted'}`}>{i.label} <span className="text-[11px] text-muted">{KIND_TAG[i.kind as Exclude<ItemKind, 'module'>]?.label}</span></span>
                      <span className="flex flex-wrap gap-1 justify-end">{x.reasons.map(r => <span key={r.text} className={`text-[11px] font-semibold rounded-full px-2 ${r.kind === 'exception' ? 'bg-[#fbf1cf] text-[#8a6703]' : x.ok ? 'bg-[rgba(30,125,127,.1)] text-tn-teal' : 'bg-subtle text-muted'}`}>{r.text}</span>)}</span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
