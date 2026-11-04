// The approved review as a document (design handoff, F1): US Letter, the
// True North logo, the facts, the priorities, the year's goals and how they
// went, every section, the agreed goals as a table, the Manager's Feedback,
// the meeting notes, and the "Read and agreed" and "Approved" lines. No
// signature lines. Drawn 816px wide; the PDF maker prints every page.

import { GOAL_RESULT, TERM_LABEL, monthLabel } from '@/lib/review/rules'
import { fmtInstantDay, hireLabel } from '@/lib/review/format'
import type { ReviewView } from '@/lib/review/view'

const H2 = 'm-0 mb-3 pb-2 border-b-2 border-tn-ink font-(family-name:--font-display) font-extrabold text-[17px] text-tn-ink'
const LBL = 'font-(family-name:--font-display) font-extrabold text-[10px] tracking-[.1em] uppercase text-muted'
const longDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' }) : '')
const RESULT_COLOR: Record<string, string> = { met: '#0d7a4f', partly: '#9a5a00', not_met: '#c8323d', dropped: '#5b6b82' }

export function ReviewDoc({ v, today }: { v: ReviewView; today: string }) {
  const own = v.template.sections.filter(s => s.key !== 'manager')
  const mgr = v.template.sections.find(s => s.key === 'manager')!
  const ans = (k: string) => v.answers[k]?.body?.trim() ?? ''
  const head = `Annual Performance Review ${v.year} · ${v.person.name}`
  return (
    <div className="print-doc bg-white w-[816px] text-[#435066]" data-file={v.pdf.name ?? `${v.year} - ${v.person.name}.pdf`}>
      <div className="px-[72px] pt-[56px] pb-[48px] flex flex-col gap-7 text-[13px] leading-[1.55]">
        <div className="flex items-end justify-between border-b border-[var(--panel-border)] pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/true-north.png" alt="True North Digital Marketing" width={72} />
          <span className="text-[11.5px] text-muted" data-doc-title>{head}</span>
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="m-0 font-(family-name:--font-display) font-black text-[30px] leading-tight text-tn-ink">Annual Performance Review</h1>
          <span className="font-(family-name:--font-display) font-extrabold text-[17px] text-tn-teal">{v.year} · {v.person.name}</span>
          <span className="mt-2 block w-14 h-[3px] bg-[#F2C40A]" />
        </div>
        <div className="rounded-[12px] bg-[#f6f5f1] px-5 py-4 grid grid-cols-3 gap-x-6 gap-y-3">
          {[['Employee', v.person.name], ['Position', v.person.title ?? ''], ['Team', v.person.teamName ?? ''], [v.person.teamLeaderName ? 'Team Leader' : 'Reviewer', v.person.teamLeaderName ?? v.reviewer.name], ['Date of hire', hireLabel(v.person.hireDate, today)], ['Cycle opened', fmtInstantDay(v.cycle.started_at, true).replace(/^\w+, /, '')]].map(([k, val]) => (
            <div key={k} className="flex flex-col gap-0.5"><span className={LBL}>{k}</span><span className="font-semibold text-[13.5px] text-tn-ink">{val}</span></div>
          ))}
        </div>

        {v.priorities.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className={H2}>Priorities for {v.year + 1}</h2>
            <div className="flex flex-col gap-3">
              {v.priorities.map(p => (
                <div key={p.id} className="flex gap-4 break-inside-avoid">
                  <span className="w-5 font-(family-name:--font-display) font-extrabold text-tn-teal">{p.n}</span>
                  <div className="flex-1 flex flex-col gap-0.5"><span className={`${LBL} text-tn-teal`}>{p.scope}</span><span className="font-bold text-tn-ink text-[13.5px]">{p.title}</span>{p.body && <span>{p.body}</span>}</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {v.pastGoals.length > 0 && (
          <section className="break-inside-avoid">
            <h2 className={H2}>{v.year} goals, and how they went</h2>
            <table className="w-full border-collapse text-[12.5px]">
              <thead><tr className="text-left"><th className={`${LBL} pb-2`}>Goal</th><th className={`${LBL} pb-2 w-[120px]`}>Result</th><th className={`${LBL} pb-2 w-[230px]`}>Comment</th></tr></thead>
              <tbody>
                {v.pastGoals.map(g => {
                  const r = GOAL_RESULT.find(x => x.key === g.result)
                  return (
                    <tr key={g.id} className="border-t border-[var(--panel-border)] align-top break-inside-avoid">
                      <td className="py-2.5 pr-3"><span className="block font-bold text-tn-ink">{g.what}</span><span className="text-[11.5px] text-muted">{g.fromLastReview ? g.how : `By ${monthLabel(g.byMonth)}, from the ${v.year - 1} review`}</span></td>
                      <td className="py-2.5 pr-3 font-bold" style={{ color: r ? RESULT_COLOR[r.key] : undefined }}>{r?.label ?? 'Not marked'}</td>
                      <td className="py-2.5">{g.resultComment}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>
        )}

        {own.filter(s => s.key !== 'feedback').map(s => (
          <section key={s.key}>
            <h2 className={H2}>{s.title}</h2>
            <div className="flex flex-col gap-3">
              {s.questions.map(q => <div key={q.key} className="break-inside-avoid"><span className="block font-bold text-tn-ink">{q.label}</span><span className="whitespace-pre-wrap">{ans(q.key) || 'No answer.'}</span></div>)}
            </div>
          </section>
        ))}

        <section>
          <h2 className={H2}>Goals for {v.year + 1}</h2>
          <table className="w-full border-collapse text-[12.5px]">
            <thead><tr className="text-left"><th className={`${LBL} pb-2`}>Goal and how it is measured</th><th className={`${LBL} pb-2 w-[95px]`}>By</th><th className={`${LBL} pb-2 w-[70px]`}>Term</th><th className={`${LBL} pb-2 w-[170px]`}>Serves</th></tr></thead>
            <tbody>
              {v.goals.map(g => (
                <tr key={g.id} className="border-t border-[var(--panel-border)] align-top break-inside-avoid">
                  <td className="py-2.5 pr-3"><span className="block font-bold text-tn-ink">{g.n} {g.what}</span><span>{g.how}</span>
                    {g.addedByReviewer && <span className="block text-[11px] font-bold text-[#1e40af]">Added by {g.addedByName}</span>}
                    {!g.addedByReviewer && g.changedByName && <span className="block text-[11px] font-bold text-[#1e40af]">Changed by {g.changedByName}{g.original?.by_month && g.original.by_month !== g.byMonth ? ` (was ${monthLabel(g.original.by_month)})` : ''}</span>}
                  </td>
                  <td className="py-2.5 pr-3">{g.byLabel}</td>
                  <td className="py-2.5 pr-3">{g.term ? TERM_LABEL[g.term] : ''}</td>
                  <td className="py-2.5">{g.priorityTitle ?? 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {own.filter(s => s.key === 'feedback').map(s => (
          <section key={s.key}>
            <h2 className={H2}>{s.title}</h2>
            <div className="flex flex-col gap-3">{s.questions.map(q => <div key={q.key} className="break-inside-avoid"><span className="block font-bold text-tn-ink">{q.label}</span><span className="whitespace-pre-wrap">{ans(q.key) || 'No answer.'}</span></div>)}</div>
          </section>
        ))}

        <section>
          <h2 className={H2}>{mgr.title} <span className="font-sans font-semibold text-[13px] text-muted">{v.reviewer.name}</span></h2>
          <div className="flex flex-col gap-3">{mgr.questions.map(q => <div key={q.key} className="break-inside-avoid"><span className="block font-bold text-tn-ink">{q.label}</span><span className="whitespace-pre-wrap">{ans(q.key) || 'No answer.'}</span></div>)}</div>
        </section>

        <section className="break-inside-avoid">
          <h2 className={H2}>Meeting notes <span className="font-sans font-semibold text-[13px] text-muted">{v.meeting.startsAt ? `${new Date(v.meeting.startsAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}, with ${v.reviewer.name}` : ''}</span></h2>
          <p className="m-0 whitespace-pre-wrap">{v.meeting.notes || 'No notes.'}</p>
        </section>

        <div className="flex flex-col gap-1 text-[13px] text-tn-ink break-inside-avoid">
          {v.dates.agreed && <span>Read and agreed by <strong>{v.person.name}</strong> on {longDay(v.dates.agreed)}</span>}
          {v.dates.approved && <span>Approved by <strong>{v.dates.approvedBy}</strong> on {longDay(v.dates.approved)}</span>}
        </div>
        <p className="m-0 pt-3 border-t border-[var(--panel-border)] text-[11px] text-muted">Confidential. True North Digital Marketing.</p>
      </div>
    </div>
  )
}
