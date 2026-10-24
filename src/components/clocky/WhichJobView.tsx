'use client'

/**
 * "Which job?" (Clocky part 2, Job Catalogue.dc.html 11D): every job, when to
 * use it, and whether it is billable by default; the same lines show under
 * each job when people clock in. A search, a billable filter, and the i7
 * Codes by brand.
 */

import { useState } from 'react'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { Icon } from '@/components/clocky/entries/ui'
import type { GuideGroup } from '@/lib/timeclock/job-catalogue'

const FOLDER = 'M3 6.5A1.5 1.5 0 0 1 4.5 5h4l2 2.5h9A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z'
const BRANDS: [string, (c: string) => boolean][] = [
  ['i7 itself', c => c.startsWith('i7-')],
  ['Bessemeters', c => c.startsWith('BE-')],
  ['Wagner', c => c.startsWith('WM-')],
  ['Other codes', c => !/^(i7|BE|WM)-/.test(c)],
]

export function WhichJobView({ groups, codes }: { groups: GuideGroup[]; codes: string[] }) {
  const [q, setQ] = useState('')
  const [bill, setBill] = useState<'all' | 'yes' | 'no'>('all')
  const needle = q.trim().toLowerCase()
  const shown = groups.map(g => ({
    ...g,
    rows: g.rows.filter(r => (bill === 'all' || (bill === 'yes') === r.billable) && (!needle || `${r.path} ${r.use}`.toLowerCase().includes(needle))),
  })).filter(g => g.rows.length)
  const brands = BRANDS.map(([brand, test]) => ({ brand, list: codes.filter(test) })).filter(b => b.list.length)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div>
        <Breadcrumb parents={['/clocky-hours']} now="Which job?" />
        <h1 className="m-0 font-(family-name:--font-display) font-extrabold text-[30px] leading-[normal] text-tn-ink" style={{ letterSpacing: '-.01em' }}>Which job?</h1>
        <p className="m-0 mt-1 text-[13.5px] text-muted [text-wrap:pretty]">Every job, when to use it, and whether it is billable by default. The same lines show under each job when you clock in.</p>
      </div>
      <div className="flex gap-2.5 items-center flex-wrap">
        <div className="relative w-[300px] max-w-full">
          <Icon d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" size={15} color="#8593a4" width={2} className="absolute left-[11px] top-[11px] pointer-events-none" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search jobs and lines, e.g. Wagner" aria-label="Search jobs"
            className="w-full box-border h-[38px] pl-[33px] pr-2.5 border border-[var(--panel-border)] rounded-[10px] font-sans text-[13px] text-tn-ink bg-white outline-none focus:border-tn-teal focus:shadow-[0_0_0_3px_rgba(30,125,127,.15)]" />
        </div>
        <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5" role="group" aria-label="Billable">
          {([['all', 'All'], ['yes', 'Billable'], ['no', 'Not billable']] as const).map(([k, l]) => (
            <button key={k} type="button" aria-pressed={bill === k} onClick={() => setBill(k)}
              className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] leading-[normal] ${bill === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{l}</button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        <div className="flex flex-col gap-3.5">
          {shown.map(g => (
            <div key={g.folder} className="bg-white border border-[var(--panel-border)] rounded-[14px] overflow-hidden">
              {/* On a phone the folder's line goes under its name, and each job's line under the job and its label. */}
              <div className="flex flex-wrap md:flex-nowrap items-center gap-x-2.5 gap-y-1 px-4 py-3 bg-subtle border-b border-[var(--panel-border)] leading-[normal]">
                <Icon d={FOLDER} size={16} color="#8593a4" width={1.9} className="flex-none" />
                <span className="font-(family-name:--font-display) font-extrabold text-[14px] text-tn-ink">{g.folder}</span>
                <span className="text-[12.5px] text-foreground basis-full md:basis-auto md:flex-1 min-w-0 leading-[1.45]">{g.use}</span>
              </div>
              {g.rows.map(r => (
                <div key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[200px_minmax(0,1fr)_120px] gap-x-3.5 gap-y-1 md:gap-y-3.5 items-start px-4 py-[11px] border-b border-[var(--row-rule)] text-[13px] leading-[normal]">
                  <span className="font-(family-name:--font-display) font-bold text-tn-ink">{r.name}</span>
                  <span className="col-span-2 row-start-2 md:col-span-1 md:row-start-auto text-foreground leading-[1.5] [text-wrap:pretty]">{r.use}</span>
                  <span className={`col-start-2 row-start-1 md:col-start-auto md:row-start-auto justify-self-end text-[10.5px] font-bold rounded-full px-[9px] py-[3px] whitespace-nowrap ${r.billable ? 'bg-[#e6f6ee] text-[#0d7a4f]' : 'bg-[#f1f3f6] text-[#5b6b82]'}`}>{r.billable ? 'Billable' : 'Not billable'}</span>
                </div>
              ))}
            </div>
          ))}
          {!shown.length && <div className="bg-white border border-[var(--panel-border)] rounded-[14px] px-5 py-10 text-center text-[13.5px] text-muted">{needle ? `No job matches "${q.trim()}".` : 'No job here.'}</div>}
        </div>
        {brands.length > 0 && (
          <div className="bg-white border border-[var(--panel-border)] rounded-[14px] p-4 flex flex-col gap-3 leading-[normal]">
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">i7 Codes, by brand</span>
            <span className="text-[12.5px] text-foreground leading-[1.5]">Every 2 - i7 Marketing job asks for an i7 Code. Pick the job by the kind of work, then the code by the brand.</span>
            {brands.map(b => (
              <div key={b.brand} className="flex flex-col gap-[5px]">
                <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-[.08em] uppercase text-muted">{b.brand}</span>
                <div className="flex flex-wrap gap-[5px]">{b.list.map(x => <span key={x} className="font-mono text-[11.5px] text-tn-ink bg-subtle rounded-[6px] px-[7px] py-[3px]">{x}</span>)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
