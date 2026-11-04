// The approved review as a document (design handoff, F1): US Letter, the
// True North logo, the facts, the priorities, the year's goals and how they
// went, every section, the agreed goals as a table, the Manager's Feedback,
// the meeting notes, and the "Read and agreed" and "Approved" lines. No
// signature lines. Drawn 816px wide; the PDF maker prints every page.

import { GOAL_RESULT, TERM_LABEL, monthLabel } from '@/lib/review/rules'
import { fmtInstantDay, hireLabel } from '@/lib/review/format'
import type { ReviewView } from '@/lib/review/view'

const H2 = 'm-0 pb-1.5 border-b-2 border-tn-ink font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink'
const H2_ROW = 'flex items-baseline justify-between gap-4 pb-1.5 border-b-2 border-tn-ink'
const LBL = 'font-(family-name:--font-display) font-extrabold text-[11.5px] tracking-[.08em] uppercase text-[#8593a4]'
const longDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : '')
const RESULT_COLOR: Record<string, string> = { met: '#167a52', partly: '#9a5a00', not_met: '#c8323d', dropped: '#5b6b82' }
/** A new sheet, as in the handoff: Job Description, the goals for next year and the Manager's Feedback each start a page. */
const NEW_PAGE = 'break-before-page'

function Answers({ qs, ans }: { qs: { key: string; label: string }[]; ans: (k: string) => string }) {
  return <>{qs.map(q => <div key={q.key} className="flex flex-col gap-1 break-inside-avoid"><span className="text-[13.5px] font-bold text-tn-ink">{q.label}</span><span className="text-[14.5px] leading-[1.55] whitespace-pre-wrap">{ans(q.key) || 'No answer.'}</span></div>)}</>
}

const Check = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E9E6A" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="flex-none" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>

export function ReviewDoc({ v, today }: { v: ReviewView; today: string }) {
  const own = v.template.sections.filter(s => s.key !== 'manager')
  const mgr = v.template.sections.find(s => s.key === 'manager')!
  const ans = (k: string) => v.answers[k]?.body?.trim() ?? ''
  const head = `Annual Performance Review ${v.year} · ${v.person.name}`
  const facts = [['Employee', v.person.name], ['Position', v.person.title ?? ''], ['Team', v.person.teamName ?? ''], [v.person.teamLeaderName ? 'Team Leader' : 'Reviewer', v.person.teamLeaderName ?? v.reviewer.name], ['Date of hire', hireLabel(v.person.hireDate, today)], ['Cycle opened', fmtInstantDay(v.cycle.started_at, true).replace(/^\w+, /, '')]]
  return (
    <div className="print-doc bg-white w-[816px] text-[#435066]" data-file={v.pdf.name ?? `${v.year} - ${v.person.name}.pdf`}>
      <div className="px-[72px] flex flex-col gap-[22px]">
        {/* On screen only: the PDF draws this header and the footer on every page (lib/pdf/sheet-pdf.ts, running). */}
        <div data-running className="pt-12">
          <div className="flex items-end justify-between border-b border-[#e4e7ec] pb-3.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logos/true-north.png" alt="True North Digital Marketing" className="h-[34px] w-auto block" />
            <span className="text-[12px] text-[#8593a4]" data-doc-title>{head}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5 mt-1.5">
          <h1 className="m-0 font-(family-name:--font-display) font-black text-[30px] tracking-[-.01em] text-tn-ink">Annual Performance Review</h1>
          <span className="font-(family-name:--font-display) font-bold text-[18px] text-tn-teal">{v.year} · {v.person.name}</span>
          <span className="mt-2 block w-14 h-[3px] bg-[#F2C40A]" />
        </div>
        <div className="rounded-[10px] bg-[#f8f7f3] px-[18px] py-4 grid grid-cols-3 gap-x-6 gap-y-4">
          {facts.map(([k, val]) => (
            <div key={k} className="flex flex-col gap-[3px]"><span className={LBL}>{k}</span><span className="font-bold text-[15px] text-tn-ink">{val}</span></div>
          ))}
        </div>

        {v.priorities.length > 0 && (
          <section className="flex flex-col gap-3 break-inside-avoid">
            <h2 className={H2}>Priorities for {v.year + 1}</h2>
            {v.priorities.map(p => (
              <div key={p.id} className="grid grid-cols-[26px_minmax(0,1fr)] gap-2.5 break-inside-avoid">
                <span className="font-(family-name:--font-display) font-black text-[15px] text-tn-teal">{p.n}</span>
                <div className="flex flex-col gap-[3px]"><span className="text-[12px] font-bold tracking-[.06em] uppercase text-tn-teal">{p.scope}</span><span className="font-bold text-tn-ink text-[15px]">{p.title}</span>{p.body && <span className="text-[14.5px] leading-[1.5]">{p.body}</span>}</div>
              </div>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className={H2}>{v.year} goals, and how they went</h2>
          {v.pastGoals.length === 0
            ? <p className="m-0 text-[14.5px] leading-[1.55]">{v.year} is the first year goals are tracked in the portal. The {v.year - 1} goals were written in the Word review{v.lastImport ? `, kept in Google Drive as ${v.lastImport.file_name}` : ''}.</p>
            : <div className="flex flex-col">
                <div className={`grid grid-cols-[minmax(0,1.3fr)_120px_minmax(0,1fr)] gap-3.5 py-2 border-b border-[#d9dee6] ${LBL}`}><span>Goal</span><span>Result</span><span>Comment</span></div>
                {v.pastGoals.map(g => {
                  const r = GOAL_RESULT.find(x => x.key === g.result)
                  return (
                    <div key={g.id} className="grid grid-cols-[minmax(0,1.3fr)_120px_minmax(0,1fr)] gap-3.5 py-[11px] border-b border-[#eceff3] items-start break-inside-avoid">
                      <div className="flex flex-col gap-0.5"><span className="text-[14.5px] font-bold text-tn-ink">{g.what}</span><span className="text-[13px] text-[#5b6b82]">{g.fromLastReview ? g.how : `By ${monthLabel(g.byMonth)}, from the ${v.year - 1} review`}</span></div>
                      <span className="text-[14px] font-bold" style={{ color: r ? RESULT_COLOR[r.key] : '#8593a4' }}>{r?.label ?? 'Not marked'}</span>
                      <span className="text-[14px] leading-[1.45]">{g.resultComment}</span>
                    </div>
                  )
                })}
              </div>}
        </section>

        {own.filter(s => s.key !== 'feedback').map((s, i) => (
          <section key={s.key} className={`flex flex-col gap-5 ${i === 0 ? NEW_PAGE : 'mt-1.5'}`}>
            <h2 className={H2}>{s.title}</h2>
            <Answers qs={s.questions} ans={ans} />
          </section>
        ))}

        <section className={`flex flex-col ${NEW_PAGE}`}>
          <h2 className={`${H2} mb-0`}>Goals for {v.year + 1}</h2>
          <div className={`grid grid-cols-[24px_minmax(0,1fr)_92px_78px_minmax(0,.8fr)] gap-3 py-2 border-b border-[#d9dee6] ${LBL}`}><span /><span>Goal and how it is measured</span><span>By</span><span>Term</span><span>Serves</span></div>
          {v.goals.map(g => (
            <div key={g.id} className="grid grid-cols-[24px_minmax(0,1fr)_92px_78px_minmax(0,.8fr)] gap-3 py-3 border-b border-[#eceff3] items-start break-inside-avoid">
              <span className="font-(family-name:--font-display) font-black text-[15px] text-tn-teal">{g.n}</span>
              <div className="flex flex-col gap-[3px]">
                <span className="text-[14.5px] font-bold text-tn-ink">{g.what}</span>
                {g.how && <span className="text-[13.5px] leading-[1.45]">{g.how}</span>}
                {g.addedByReviewer && <span className="text-[12px] font-bold text-[#1e40af]">Added by {g.addedByName}</span>}
                {!g.addedByReviewer && g.changedByName && <span className="text-[12px] font-bold text-[#1e40af]">Changed by {g.changedByName}{g.original?.by_month && g.original.by_month !== g.byMonth ? ` (was ${monthLabel(g.original.by_month)})` : ''}</span>}
              </div>
              <span className="text-[14px] text-tn-ink">{g.byLabel}</span>
              <span className="text-[14px] text-tn-ink">{g.term ? TERM_LABEL[g.term] : ''}</span>
              <span className="text-[13.5px] leading-[1.4]">{g.priorityTitle ?? 'None'}</span>
            </div>
          ))}
        </section>

        {own.filter(s => s.key === 'feedback').map(s => (
          <section key={s.key} className="flex flex-col gap-5 mt-1.5">
            <h2 className={H2}>{s.title}</h2>
            <Answers qs={s.questions} ans={ans} />
          </section>
        ))}

        <section className={`flex flex-col gap-5 ${NEW_PAGE}`}>
          <div className={H2_ROW}><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">{mgr.title}</h2><span className="text-[12.5px] text-[#8593a4]">{v.reviewer.name}</span></div>
          <Answers qs={mgr.questions} ans={ans} />
        </section>

        <section className="flex flex-col gap-5 mt-1.5 break-inside-avoid">
          <div className={H2_ROW}><h2 className="m-0 font-(family-name:--font-display) font-extrabold text-[18px] text-tn-ink">Meeting notes</h2><span className="text-[12.5px] text-[#8593a4]">{v.meeting.startsAt ? `${new Date(v.meeting.startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}, with ${v.reviewer.name}` : ''}</span></div>
          <p className="m-0 text-[14.5px] leading-[1.55] whitespace-pre-wrap">{v.meeting.notes || 'No notes.'}</p>
        </section>

        <div className="flex flex-col gap-3 px-5 py-[18px] border border-[#d9dee6] rounded-[10px] text-[15px] text-tn-ink break-inside-avoid">
          {v.dates.agreed && <span className="flex items-center gap-3"><Check /><span>Read and agreed by <b>{v.person.name}</b> on <b>{longDay(v.dates.agreed)}</b></span></span>}
          {v.dates.approved && <span className="flex items-center gap-3"><Check /><span>Approved by <b>{v.dates.approvedBy}</b> on <b>{longDay(v.dates.approved)}</b></span></span>}
        </div>
        <p data-running className="m-0 pb-[30px] pt-6 text-[11.5px] text-[#8593a4]">Confidential. True North Digital Marketing.</p>
      </div>
    </div>
  )
}
