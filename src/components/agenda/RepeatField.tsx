'use client'

/**
 * The New event drawer's Repeat (owner, 30 October 2026), as Google Calendar
 * offers it: the usual choices for the day picked, or Custom (every N days,
 * weeks, months or years, the weekdays, the month by day or by weekday), and
 * when it ends (never, on a day, after a number of times).
 */

import { Select } from '@/components/ui/Select'
import { describe, nthOf, type Freq, type Repeat } from '@/lib/agenda/recurrence'

const LBL = 'font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.1em] uppercase text-muted'
const SELECT = 'h-11 px-3.5 bg-white border border-[var(--panel-border)] rounded-[12px] font-semibold text-[14px]'
const INPUT = 'h-11 box-border px-3 border border-[var(--panel-border)] rounded-[12px] font-sans text-[14px] text-tn-ink bg-white outline-none focus:border-tn-teal'
const SEG = 'inline-flex flex-wrap border border-[var(--panel-border)] rounded-[14px] p-1 gap-0.5 bg-white'
const SEG_BTN = 'border-0 rounded-[10px] px-3 py-1.5 font-(family-name:--font-display) font-extrabold text-[13px] cursor-pointer'
const segOn = (on: boolean) => (on ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-tn-ink hover:bg-subtle')

const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const NTH = ['first', 'second', 'third', 'fourth', 'fifth']
const dowOf = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay()

type Preset = 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthDay' | 'monthNth' | 'yearly' | 'custom'

function presetOf(r: Repeat | null, date: string): Preset {
  if (!r) return 'none'
  if (r.interval !== 1) return 'custom'
  if (r.freq === 'daily') return 'daily'
  if (r.freq === 'weekly') {
    const d = [...r.days].sort().join(',')
    if (d === '1,2,3,4,5') return 'weekdays'
    return d === String(dowOf(date)) ? 'weekly' : 'custom'
  }
  if (r.freq === 'monthly') return r.monthBy === 'nth' ? 'monthNth' : 'monthDay'
  return 'yearly'
}

export function RepeatField({ date, value, onChange }: { date: string; value: Repeat | null; onChange: (r: Repeat | null) => void }) {
  const d = new Date(`${date}T00:00:00Z`), wd = dowOf(date)
  const { n, last } = nthOf(date)
  const preset = presetOf(value, date)
  const ends = value ? { ends: value.ends, until: value.until, count: value.count } : { ends: 'never' as const }
  const make = (p: Preset): Repeat | null => {
    const base = { interval: 1, days: [] as number[], monthBy: 'day' as const, ...ends }
    switch (p) {
      case 'none': return null
      case 'daily': return { ...base, freq: 'daily' }
      case 'weekly': return { ...base, freq: 'weekly', days: [wd] }
      case 'weekdays': return { ...base, freq: 'weekly', days: [1, 2, 3, 4, 5] }
      case 'monthDay': return { ...base, freq: 'monthly' }
      case 'monthNth': return { ...base, freq: 'monthly', monthBy: 'nth' }
      case 'yearly': return { ...base, freq: 'yearly' }
      default: return value ?? { ...base, freq: 'weekly', days: [wd] }
    }
  }
  const options: { value: Preset; label: string }[] = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Every day' },
    { value: 'weekly', label: `Every week on ${DAY[wd]}` },
    { value: 'weekdays', label: 'Every weekday (Monday to Friday)' },
    { value: 'monthDay', label: `Every month on day ${d.getUTCDate()}` },
    { value: 'monthNth', label: `Every month on the ${last && n >= 4 ? 'last' : NTH[n - 1]} ${DAY[wd]}` },
    { value: 'yearly', label: `Every year on ${MON[d.getUTCMonth()]} ${d.getUTCDate()}` },
    { value: 'custom', label: 'Custom…' },
  ]
  const set = (patch: Partial<Repeat>) => value && onChange({ ...value, ...patch })
  return (
    <div className="flex flex-col gap-2.5">
      <label className="flex flex-col gap-2 w-full sm:w-[360px]">
        <span className={LBL}>Repeat</span>
        <Select value={preset} options={options} fullWidth ariaLabel="Repeat" className={SELECT} onChange={v => onChange(make(v as Preset))} />
      </label>
      {value && preset === 'custom' && (
        <div className="flex flex-col gap-2.5 bg-subtle rounded-[12px] px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-foreground">
            Every
            <input type="number" min={1} max={99} value={value.interval} aria-label="Every how many"
              onChange={e => set({ interval: Math.min(99, Math.max(1, Number(e.target.value) || 1)) })} className={`${INPUT} w-[72px]`} />
            <Select value={value.freq} ariaLabel="Days, weeks, months or years" className={`${SELECT} w-[130px]`}
              options={(['daily', 'weekly', 'monthly', 'yearly'] as Freq[]).map(f => ({ value: f, label: { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[f] + (value.interval > 1 ? 's' : '') }))}
              onChange={v => set({ freq: v as Freq, days: v === 'weekly' ? (value.days.length ? value.days : [wd]) : [] })} />
          </div>
          {value.freq === 'weekly' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="On these days">
              {DAY.map((name, i) => {
                const on = value.days.includes(i)
                return (
                  <button key={name} type="button" aria-pressed={on} aria-label={name}
                    onClick={() => { const days = on ? value.days.filter(x => x !== i) : [...value.days, i].sort(); if (days.length) set({ days }) }}
                    className={`w-9 h-9 rounded-full border text-[13px] font-bold cursor-pointer ${on ? 'bg-tn-primary border-tn-primary text-[#ffffff]' : 'bg-white border-[var(--panel-border)] text-tn-ink'}`}>
                    {name[0]}
                  </button>
                )
              })}
            </div>
          )}
          {value.freq === 'monthly' && (
            <div className={SEG} role="group" aria-label="Monthly on">
              <button type="button" aria-pressed={value.monthBy === 'day'} onClick={() => set({ monthBy: 'day' })} className={`${SEG_BTN} ${segOn(value.monthBy === 'day')}`}>On day {d.getUTCDate()}</button>
              <button type="button" aria-pressed={value.monthBy === 'nth'} onClick={() => set({ monthBy: 'nth' })} className={`${SEG_BTN} ${segOn(value.monthBy === 'nth')}`}>On the {last && n >= 4 ? 'last' : NTH[n - 1]} {DAY[wd]}</button>
            </div>
          )}
        </div>
      )}
      {value && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-2">
            <span className={LBL}>Ends</span>
            <div className={SEG} role="group" aria-label="Ends">
              {([['never', 'Never'], ['until', 'On a day'], ['count', 'After']] as const).map(([k, l]) => (
                <button key={k} type="button" aria-pressed={value.ends === k} className={`${SEG_BTN} ${segOn(value.ends === k)}`}
                  onClick={() => set(k === 'until' ? { ends: k, until: value.until && value.until >= date ? value.until : new Date(Date.parse(`${date}T00:00:00Z`) + 90 * 864e5).toISOString().slice(0, 10) } : k === 'count' ? { ends: k, count: value.count ?? 10 } : { ends: k })}>{l}</button>
              ))}
            </div>
          </div>
          {value.ends === 'until' && (
            <input type="date" aria-label="Last day" min={date} value={value.until ?? ''} onChange={e => e.target.value && set({ until: e.target.value })} className={`${INPUT} w-[170px]`} />
          )}
          {value.ends === 'count' && (
            <label className="flex items-center gap-2 text-[13.5px] text-foreground">
              <input type="number" min={1} max={730} value={value.count ?? 10} aria-label="How many times"
                onChange={e => set({ count: Math.min(730, Math.max(1, Number(e.target.value) || 1)) })} className={`${INPUT} w-[84px]`} />
              times
            </label>
          )}
        </div>
      )}
      {value && <span className="text-[12.5px] font-semibold text-tn-teal">{describe(value, date)}</span>}
    </div>
  )
}
