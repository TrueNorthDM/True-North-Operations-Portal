'use client'

/**
 * Where team priority is reached from on My Work, drawn on the page as it is
 * today: breadcrumb and title, the My Work / Report / My Team switch, the one
 * row of controls, the refresh line, the pinned column heading and the rows.
 *
 * Two ways in, both only for team leaders and admins:
 *   1. a third option beside Mine and Everyone, "Team priority";
 *   2. "Edit order" on the line above the list that says whose order it follows.
 * A team member gets neither: the same line, read only.
 *
 * Numbered markers on the page match the notes under it. Fixture data only.
 */

import { chip } from '@/components/monday/tokens'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { SearchField } from '@/components/ui/SearchField'

const ROWS = [
  { team: 1, item: 'Lead Magnet - How to Use Bessemeter Pro', language: '', board: 'BM - General Audits', step: 'Audit', status: "Hasn't Started Yet", color: '#C4C4C4', due: 'Sep 25, 2026', time: 'in 9d', badge: 'upcoming' },
  { team: 5, item: 'B82: best moisture meter for water restoration', language: '', board: 'BM - General Audits', step: 'SEO Review', status: 'Stuck', color: '#E2445C', due: 'Aug 29, 2026', time: '18d', badge: 'late' },
  { team: 7, item: 'Wagner Meters Wood Flooring Newsletter', language: '', board: 'WM - Schema Audits', step: 'Audit', status: 'Stuck', color: '#E2445C', due: 'Sep 12, 2026', time: '4d', badge: 'late' },
  { team: 10, item: 'Monthly Reporting Steps - adventist.org', language: '', board: "SOP's for the SEO's", step: 'Status', status: 'Working on it', color: '#FDAB3D', due: 'Sep 18, 2026', time: 'in 2d', badge: 'upcoming' },
]

/** Stephanie's own steps, in the same team order as the team priority screens. */
const MEMBER_ROWS = [
  { team: 1, item: 'Lead Magnet - How to Use Bessemeter Pro', language: '', board: 'BM - General Audits', step: 'Audit', status: "Hasn't Started Yet", color: '#C4C4C4', due: 'Sep 25, 2026', time: 'in 9d', badge: 'upcoming' },
  { team: 2, item: 'How Do Adventists Do Baby Dedications?', language: '', board: 'AAAF - Photo Curation Audits', step: 'Photo Curation Audit', status: 'Working on it', color: '#FDAB3D', due: 'Sep 17, 2026', time: 'in 1d', badge: 'upcoming' },
  { team: 6, item: '137 - How does the Holy Spirit work?', language: 'English', board: 'AAAF - Publishing', step: 'On-Page SEO', status: "Hasn't Started Yet", color: '#C4C4C4', due: 'Sep 30, 2026', time: 'in 14d', badge: 'upcoming' },
  { team: 9, item: '02 - Good Vs. Evil (Salvation)', language: '', board: 'AAAF - SEO & Writing', step: 'Brief Draft SEO', status: "Hasn't Started Yet", color: '#C4C4C4', due: 'Sep 30, 2026', time: 'in 14d', badge: 'upcoming' },
]

const head = 'px-3 py-[11px] font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.07em] uppercase text-muted whitespace-nowrap'
const control = 'inline-flex items-center gap-2 px-3 py-[9px] rounded-[10px] border border-[var(--panel-border)] bg-white font-(family-name:--font-display) font-semibold text-[13px] text-muted whitespace-nowrap'
const caret = <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg>

/** A numbered marker on the page, matching a note underneath. */
function Marker({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-full bg-[#E08A1E] text-white font-(family-name:--font-display) font-extrabold text-[12px] shadow-[0_0_0_3px_rgba(224,138,30,.25)] shrink-0">
      {n}
    </span>
  )
}

function Page({ leader, children }: { leader: boolean; children?: React.ReactNode }) {
  const cols = `44px 44px ${leader ? '92px' : '64px'} minmax(0,1fr) 150px 110px 184px 112px 160px`
  return (
    <div className="rounded-[18px] border border-[var(--panel-border)] bg-background p-6 space-y-5">
      {/* The page header, as it is today. */}
      <div className="flex items-start justify-between gap-5 pb-[18px] border-b border-[var(--panel-border)]">
        <div>
          <Breadcrumb self="/my-work" />
          <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0 mt-1">My Work</h2>
          <p className="text-[14.5px] text-muted mt-1 m-0">Every step assigned to you across Monday, in one list.</p>
        </div>
        <div className="flex items-center bg-subtle border border-[var(--panel-border)] rounded-[11px] p-1">
          <span className="px-[15px] py-2 rounded-[8px] bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)] font-(family-name:--font-display) font-extrabold text-[13.5px]">My Work</span>
          <span className="px-[15px] py-2 text-muted font-(family-name:--font-display) font-extrabold text-[13.5px]">Report</span>
          <span className="px-[15px] py-2 text-muted font-(family-name:--font-display) font-extrabold text-[13.5px]">My Team</span>
        </div>
      </div>

      {/* The row of controls. */}
      <div className="flex items-center gap-2.5">
        <SearchField value="" onChange={() => {}} placeholder="Search items, boards, people…" className="flex-1 min-w-[160px]" />
        <span className="inline-flex items-center gap-2">
          <span className="inline-flex items-center bg-subtle border border-[var(--panel-border)] rounded-[10px] p-[3px]">
            <span className="font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] bg-white text-tn-ink shadow-[0_1px_3px_rgba(1,35,88,.14)]">Mine</span>
            <span className="font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 text-muted">Everyone</span>
            {leader && (
              <span className="font-(family-name:--font-display) font-extrabold text-[13px] px-3.5 py-1.5 rounded-[8px] text-tn-teal ring-2 ring-[#E08A1E] ring-offset-1 ring-offset-subtle">Team priority</span>
            )}
          </span>
          {leader && <Marker n={1} />}
        </span>
        <span className={control}>Finished work: 6 months</span>
        <span className={control}>Any status {caret}</span>
        <span className={control}>Any board {caret}</span>
        <span className={control}>Any due date {caret}</span>
        <span className={control}>Columns</span>
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--panel-border)] pt-3 text-[12.5px] text-muted">
        <span>Work pulled from Monday at 02:15, 06:15, 10:15, 14:15, 18:15, 22:15 (GMT-3) · last refreshed 2 hours ago</span>
        <span className="ml-auto text-[13px]">4 open · 211 in view</span>
      </div>

      {/* The line that says whose order the list is in. */}
      <div className="flex items-center gap-3 rounded-[12px] border border-[rgba(30,125,127,.28)] bg-[rgba(30,125,127,.06)] px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="stroke-tn-teal shrink-0"><path d="M4 6h16M4 12h10M4 18h6" /></svg>
        <span className="text-[13px] text-tn-ink">
          <span className="font-semibold">Ordered by the SEO Team priority</span>
          <span className="text-muted">{leader ? ', set by you · updated today at 10:32' : ', set by Jeannette Owens · updated today at 10:32'}</span>
        </span>
        {leader ? (
          <span className="ml-auto inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-tn-teal rounded-[8px] px-2 py-1 ring-2 ring-[#E08A1E]">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
              Edit order
            </span>
            <Marker n={2} />
          </span>
        ) : (
          <span className="ml-auto text-[12px] text-muted">Team leaders and admins set priorities</span>
        )}
      </div>

      {/* The pinned heading and a few rows, in the team's order. */}
      <div>
        <div className="rounded-[12px] border border-[var(--panel-border)] bg-subtle">
          <div className="grid" style={{ gridTemplateColumns: cols }}>
            <div className={head} />
            <div className={head} />
            <div className={`${head} flex items-center gap-1.5`}>Team{leader && <Marker n={3} />}</div>
            <div className={head}>Item</div>
            <div className={head}>Board</div>
            <div className={head}>Step</div>
            <div className={head}>Status</div>
            <div className={`${head} text-right`}>Due</div>
            <div className={`${head} text-right`}>Time</div>
          </div>
        </div>
        <div className="mt-2.5 rounded-[14px] border border-[var(--panel-border)] bg-white overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-[13px]">
            <span className="text-muted text-[15px] leading-none">⌄</span>
            <span className="font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">On-going</span>
            <span className="text-[12px] font-bold text-muted">4</span>
            <span className="text-[12px] text-muted ml-auto">Steps still open, in the team&apos;s order</span>
          </div>
          {(leader ? ROWS : MEMBER_ROWS).map(r => (
            <div key={r.item} className="grid items-center border-t border-[var(--row-rule)]" style={{ gridTemplateColumns: cols }}>
              <div className="px-2 py-2.5 flex justify-center"><span className="w-7 h-7 rounded-[7px] bg-[var(--chip-neutral-bg)]" /></div>
              <div className="px-2 py-2.5 flex justify-center"><span className="w-7 h-7 rounded-[7px] bg-[var(--chip-neutral-bg)]" /></div>
              <div className="px-3 font-(family-name:--font-display) font-extrabold text-[15px] text-tn-ink">{r.team}</div>
              <div className="px-3 text-[13px] font-semibold text-tn-ink truncate">{r.item}</div>
              <div className="px-3 text-[13px] text-muted truncate">{r.board}</div>
              <div className="px-3 text-[13px] text-muted truncate">{r.step}</div>
              <div className="px-3"><span className={`${chip} text-white`} style={{ background: r.color }}>{r.status}</span></div>
              <div className="px-3 text-[13px] text-tn-ink text-right whitespace-nowrap">{r.due}</div>
              <div className="px-3 flex items-center justify-end gap-2 text-[12px]">
                <span className={`whitespace-nowrap ${r.badge === 'late' ? 'text-[#c2410c] font-semibold' : 'text-tn-teal font-semibold'}`}>{r.time}</span>
                <span className={`${chip} ${r.badge === 'late' ? 'bg-[rgba(194,65,12,.12)] text-[#c2410c]' : 'bg-[rgba(30,125,127,.12)] text-tn-teal'}`}>{r.badge}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      {children}
    </div>
  )
}

function Note({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Marker n={n} />
      <p className="text-[13.5px] leading-relaxed text-foreground m-0">{children}</p>
    </div>
  )
}

export function EntryDemo({ only }: { only?: string }) {
  const show = (k: string) => !only || only === k
  return (
    <div className="space-y-10">
      {show('1') && (
        <section className="space-y-3">
          <div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0">A team leader&apos;s My Work</h2>
            <p className="text-[13.5px] text-muted mt-1 m-0 leading-relaxed">Jeannette, on her own list. The two ways in are marked; everything else on the page is as it is today.</p>
          </div>
          <Page leader>
            <div className="rounded-[14px] border border-[var(--panel-border)] bg-white p-4 space-y-2.5">
              <Note n={1}><span className="font-semibold">Team priority</span>, beside Mine and Everyone, only for team leaders and admins. It opens the editor: every open step on the team, the agreement card, and the arrows. Choosing Mine again comes back here.</Note>
              <Note n={2}><span className="font-semibold">Edit order</span> on the line that says whose order the list follows. Same editor, from the place a leader looks when the order seems wrong.</Note>
              <Note n={3}><span className="font-semibold">Team</span>: each step&apos;s place in the team&apos;s order. On while the list is in team order, like the other columns in Columns.</Note>
            </div>
          </Page>
        </section>
      )}
      {show('2') && (
        <section className="space-y-3">
          <div>
            <h2 className="font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink m-0">A team member&apos;s My Work</h2>
            <p className="text-[13.5px] text-muted mt-1 m-0 leading-relaxed">Stephanie. No third option and no Edit: the line says whose order it is and when it changed, and the list follows it.</p>
          </div>
          <Page leader={false} />
        </section>
      )}
    </div>
  )
}
