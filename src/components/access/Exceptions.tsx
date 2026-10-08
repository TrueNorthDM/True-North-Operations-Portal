'use client'

import { useState, useTransition } from 'react'
import { Select } from '@/components/ui/Select'
import { CATALOGUE, ITEM, LEVEL_LABEL, type ItemKind } from '@/lib/access/catalogue'

import { addException, endException } from '@/app/(app)/admin/access-levels/actions'
import { type AccessPageData, type Person, Tag, btn, btnNavy, card, Modal, when, addDays, endOfMonth } from './parts'

export function Exceptions({ data, people, onDone }: { data: AccessPageData; people: Person[]; onDone: () => void }) {
  const [adding, setAdding] = useState(false)
  const [ending, setEnding] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const end = (id: string) => {
    setError(null)
    start(async () => {
      const res = await endException(id, reason).catch(e => ({ ok: false as const, error: String(e) }))
      if (res.ok) { setEnding(null); setReason(''); onDone() } else setError(res.error)
    })
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-[13.5px] text-muted m-0">One person, one item, for a while, without changing their level or their teams. Each one ends on its date by itself, and every exception is in the change log.</p>
        <button type="button" className={btnNavy} onClick={() => setAdding(true)}>+ Add an exception</button>
      </div>
      <div className={`${card} overflow-x-auto`}>
        <table className="w-full border-collapse text-[13px] min-w-[820px]">
          <thead><tr>{['Person', 'Item', 'Effect', 'Until', 'Reason', 'Added', ''].map(h => <th key={h} className="text-left bg-subtle px-3 py-2.5 font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.1em] uppercase text-muted">{h}</th>)}</tr></thead>
          <tbody>
            {data.exceptions.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-muted">No exceptions. Everyone follows their level and teams.</td></tr>}
            {data.exceptions.map(e => {
              const item = ITEM.get(e.key)
              return (
                <tr key={e.id} className="border-t border-[var(--row-rule)] align-top">
                  <td className="px-3 py-2.5"><b className="text-tn-ink">{e.person}</b></td>
                  <td className="px-3 py-2.5">{item?.label ?? e.key} {item && item.kind !== 'module' && <Tag kind={item.kind as Exclude<ItemKind, 'module'>} />}</td>
                  <td className="px-3 py-2.5"><span className={`text-[11.5px] font-bold rounded-full px-2 py-0.5 ${e.effect === 'grant' ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#fce8e9] text-[#c8323d]'}`}>{e.effect === 'grant' ? 'Can open' : 'Cannot open'}</span></td>
                  <td className="px-3 py-2.5">{e.until ?? 'Until removed'}</td>
                  <td className="px-3 py-2.5">{e.reason}</td>
                  <td className="px-3 py-2.5 text-muted">{e.by ?? 'Someone'}, {when(e.at)}</td>
                  <td className="px-3 py-2.5">
                    {ending === e.id ? (
                      <div className="space-y-1.5 min-w-[220px]">
                        <input value={reason} onChange={x => setReason(x.target.value)} placeholder="Why end it now?" className="w-full rounded-[8px] border border-[var(--panel-border)] px-2 py-1 text-[12.5px]" />
                        <div className="flex gap-1.5"><button type="button" className={btnNavy} disabled={reason.trim().length < 8 || pending} onClick={() => end(e.id)}>End it</button><button type="button" className={btn} onClick={() => setEnding(null)}>Cancel</button></div>
                        {error && <p className="text-[12px] text-[#b3271f] m-0">{error}</p>}
                      </div>
                    ) : <button type="button" className="text-[12.5px] font-bold text-tn-teal" onClick={() => { setEnding(e.id); setReason('') }}>End now</button>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {adding && <AddException people={people} today={data.today} onClose={() => setAdding(false)} onDone={() => { setAdding(false); onDone() }} />}
    </div>
  )
}

function AddException({ people, today, onClose, onDone }: { people: Person[]; today: string; onClose: () => void; onDone: () => void }) {
  const [personId, setPersonId] = useState('')
  const [key, setKey] = useState('')
  const [effect, setEffect] = useState<'grant' | 'deny'>('grant')
  const [until, setUntil] = useState<string | null>(endOfMonth(today))
  const [custom, setCustom] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const items = CATALOGUE.filter(i => i.kind !== 'module' && !i.superOnly && !i.always && !i.soon)
  const options = items.map(i => {
    let mod = i
    while (mod.parent) mod = ITEM.get(mod.parent)!
    const parent = i.parent && ITEM.get(i.parent)?.kind !== 'module' ? `${ITEM.get(i.parent)!.label} › ` : ''
    return { value: i.key, label: `${parent}${i.label}`, group: mod.label }
  })
  const p = people.find(x => x.id === personId)
  const item = ITEM.get(key)
  const save = () => {
    setError(null)
    start(async () => {
      const res = await addException({ personId, key, effect, until, reason }).catch(e => ({ ok: false as const, error: String(e) }))
      if (res.ok) onDone(); else setError(res.error)
    })
  }
  return (
    <Modal kicker="Exception" title="Add an exception" onClose={onClose}
      foot={<><span /><span className="flex gap-2"><button type="button" className={btn} onClick={onClose}>Cancel</button><button type="button" className={btnNavy} disabled={!p || !item || reason.trim().length < 8 || pending} onClick={save}>{pending ? 'Adding…' : 'Add exception'}</button></span></>}>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Person</span>
        <Select value={personId} onChange={setPersonId} options={people.filter(x => x.level !== 'super_admin').map(x => ({ value: x.id, label: `${x.name} · ${LEVEL_LABEL[x.level]}` }))} searchable fullWidth placeholder="Choose a person…" ariaLabel="Person" /></div>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Item</span>
        <Select value={key} onChange={setKey} options={options} searchable fullWidth placeholder="Choose a page, tool, tab or action…" ariaLabel="Item" /></div>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Effect</span>
        <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5">
          {([['grant', 'Can open'], ['deny', 'Cannot open']] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={effect === v} onClick={() => setEffect(v)} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${effect === v ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{l}</button>)}
        </div></div>
      <div className="space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Until</span>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[10px] border border-[var(--panel-border)] p-[3px] gap-0.5 flex-wrap">
            {([['1 week', addDays(today, 7)], ['End of the month', endOfMonth(today)], ['Until removed', null]] as const).map(([l, v]) => <button key={l} type="button" aria-pressed={!custom && until === v} onClick={() => { setCustom(false); setUntil(v) }} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${!custom && until === v ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>{l}</button>)}
            <button type="button" aria-pressed={custom} onClick={() => { setCustom(true); setUntil(addDays(today, 14)) }} className={`px-3 py-1.5 rounded-[7px] text-[12.5px] font-bold ${custom ? 'bg-tn-primary text-[#ffffff]' : 'text-muted'}`}>A date…</button>
          </div>
          {custom && <input type="date" value={until ?? ''} min={today} onChange={e => setUntil(e.target.value || null)} className="rounded-[9px] border border-[var(--panel-border)] px-2 py-1.5 text-[13px] text-tn-ink" />}
        </div></div>
      {p && item && (
        <div className="rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[12.5px]">
          {p.name.split(' ')[0]} will {effect === 'grant' ? 'open' : 'not open'} <b className="text-tn-ink">{item.label}</b>{until ? ` until ${until}` : ' until the exception is removed'}, whatever their level and teams say.{effect === 'grant' && item.parent && ITEM.get(item.parent)?.kind !== 'module' ? ` It still needs ${ITEM.get(item.parent)!.label} to be open to them.` : ''}
        </div>
      )}
      <label className="block space-y-1"><span className="text-[12.5px] font-bold text-tn-ink">Why? Required</span>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full rounded-[10px] border border-[var(--panel-border)] px-3 py-2 text-[13.5px] text-tn-ink outline-none focus:border-tn-teal" /></label>
      {error && <p className="text-[12.5px] font-semibold text-[#b3271f] m-0">{error}</p>}
    </Modal>
  )
}
