'use client'

/**
 * EmailsTab — which mailboxes each person holds (True North / GoodNews / COE /
 * Personal). A check means the address exists; a row opens the person in edit
 * mode so addresses can be changed.
 */

import { TEAM_COLOR, initialsOf, type PersonView } from './people-types'

const COLS: { key: keyof PersonView['emails']; label: string }[] = [
  { key: 'trueNorth', label: 'True North' },
  { key: 'goodnews', label: 'GoodNews' },
  { key: 'coe', label: 'COE' },
  { key: 'personal', label: 'Personal' },
]

const shorten = (a: string) => (a.length > 22 ? a.slice(0, 20) + '…' : a)

export function EmailsTab({ people, onOpen }: { people: PersonView[]; onOpen: (id: string) => void }) {
  const groups = [
    { key: 'active', label: 'Active', on: true, rows: people.filter(p => p.status === 'active') },
    { key: 'inactive', label: 'Inactive', on: false, rows: people.filter(p => p.status === 'inactive') },
  ].filter(g => g.rows.length > 0)

  return (
    <div>
      <p className="text-[13.5px] text-muted mb-[18px] max-w-[620px] leading-relaxed">
        Which mailboxes each person holds. A check means the account exists; click a row to open the person and edit addresses.
      </p>
      <div className="border border-slate-200 bg-white rounded-[16px] overflow-hidden shadow-[0_1px_2px_rgba(1,35,88,.06)]">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3.5 items-center px-[22px] py-[13px] bg-subtle border-b border-slate-200">
          <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">Person</span>
          {COLS.map(c => (
            <span key={c.key} className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">{c.label}</span>
          ))}
        </div>

        {groups.map(g => (
          <div key={g.key}>
            <div className="flex items-center gap-2.5 px-[22px] py-[11px] bg-subtle border-t border-slate-200">
              <span className="w-2 h-2 rounded-full" style={{ background: g.on ? '#1f8a5b' : '#c3ccd6' }} />
              <span className="font-(family-name:--font-display) font-extrabold text-[10.5px] tracking-wide uppercase text-muted">{g.label}</span>
              <span className="font-(family-name:--font-display) font-extrabold text-[11px] text-muted bg-subtle rounded-full px-2 py-px">{g.rows.length}</span>
            </div>
            {g.rows.map((p, i) => (
              <div
                key={p.id}
                onClick={() => onOpen(p.id)}
                className={`grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3.5 items-center px-[22px] py-[13px] cursor-pointer transition-colors hover:bg-subtle ${i === 0 ? '' : 'border-t border-slate-200'}`}
              >
                <span className="inline-flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 inline-flex items-center justify-center rounded-full text-white font-(family-name:--font-display) font-extrabold text-[12px] ${p.status === 'inactive' ? 'opacity-45 grayscale-[.4]' : ''}`} style={{ width: 38, height: 38, background: TEAM_COLOR[p.teamKey] }}>{initialsOf(p.full_name)}</span>
                  <span className="min-w-0">
                    <span className="block font-(family-name:--font-display) font-bold text-sm text-tn-ink truncate">{p.full_name}</span>
                    <span className="block text-xs text-muted truncate">{p.title ?? '—'}</span>
                  </span>
                </span>
                {COLS.map(c => {
                  const addr = p.emails[c.key]
                  return (
                    <span key={c.key} className="flex flex-col gap-[3px] min-w-0">
                      {addr ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="shrink-0 w-[18px] h-[18px] rounded-full bg-[#d7f3e3] text-[#136c43] inline-flex items-center justify-center">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                          </span>
                          <span className="text-[11.5px] text-foreground truncate" title={addr}>{shorten(addr)}</span>
                        </span>
                      ) : (
                        <span className="text-[13px] text-slate-300">—</span>
                      )}
                    </span>
                  )
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-[12.5px] text-muted mt-3.5 mx-0.5">{people.length} people</p>
    </div>
  )
}
