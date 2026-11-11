/**
 * The System manual's Annual review section (4 November 2026), written from
 * what was built (lib/review/*, components/review/*), rewritten for the workflow
 * of 10 November 2026: who does what, the two levels and two reviewers, the
 * year in order, the priorities, the four steps, who sees what, the dates, the
 * check-in and the first year. Roles, never names: the people are picked in
 * Company settings, Human Resources. Static content: SystemManual draws it and
 * lists its id in its table of contents (ANNUAL_REVIEW_TOC).
 */

import { Eyebrow, Heading, Lede, Rich, SubHeading, card } from './ManualParts'

export const ANNUAL_REVIEW_TOC = [
  { id: 'annual-review', label: 'Annual review', eyebrow: 'Human Resources', heading: 'The annual performance review' },
] as const

type Block = { t: string; d: string }

function Cards({ items, cols = 2 }: { items: readonly Block[]; cols?: 2 | 3 }) {
  return (
    <div className={`grid grid-cols-1 ${cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
      {items.map(c => (
        <div key={c.t} className={`${card} p-4`}>
          <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">{c.t}</div>
          <div className="text-[13px] leading-relaxed text-muted mt-1.5"><Rich text={c.d} /></div>
        </div>
      ))}
    </div>
  )
}

const ROLES: Block[] = [
  { t: 'VP of Operations', d: '**Starts the reviews** each November and adds their own priorities for next year. Reviews the people who report to them (the Team Leaders) and approves them. Starts the 6-month check-in. Reviewed by the CISO.' },
  { t: 'CISO', d: 'Writes the **Company Priorities** for next year, which every review shows. Reviews the VP of Operations and the people who report to them. Nobody reviews the CISO, who has no review of their own.' },
  { t: 'HR', d: 'Sees every review and is told by email when one is approved. Can change Company settings, Human Resources, like a Super Admin, except the roles and the second reviewers.' },
  { t: 'Team Leader', d: 'Writes their team’s priorities first thing in their own self-review, with no approval. Reviews, meets and approves the people on their team.' },
  { t: 'Everyone', d: 'Every employee in the Directory has a review, and anyone added in **Who takes part** (a contractor, for example). Each writes their own self-review, then reads and agrees.' },
  { t: 'Super Admin', d: 'The back-up: can start the reviews and the check-in when the VP of Operations cannot, and changes the roles and the second reviewers.' },
]

const FLOW = [
  { t: 'Start', d: 'From the second Monday of November the VP of Operations is asked in Needs you. **Start Reviews** opens everyone’s self-review and sets every date from that day.' },
  { t: 'Week 1', d: 'The CISO writes the Company Priorities (2 days), the VP adds theirs (4 days). When both are ready, the goals for next year open in every self-review.' },
  { t: 'Weeks 2 and 3', d: 'Everyone sends their self-review (11 days). Reviews are written and meetings booked (16 days), the VP for the Team Leaders and the Team Leaders for their teams at once.' },
  { t: 'Weeks 4 and 5', d: 'Meetings, read and agree, final remarks and approval: the leaders by day 25 and 32, the teams by day 30 and 36.' },
  { t: 'Approved', d: 'The review locks, the PDF is made and copied to Google Drive, and HR is told. The agreed goals become My goals for the year.' },
]

const STEPS: { n: string; who: string; what: string; locks: string }[] = [
  { n: '1 Self-review', who: 'The person', what: 'Marks how last year’s goals went (Met, Partly met, Not met or No longer relevant, and why), answers Job Description, Self-Evaluation and Feedback and Suggestions, and proposes the coming year’s goals, each with the priority it serves. A Team Leader writes their team’s priorities first. It saves as they type.', locks: 'Submit locks their part.' },
  { n: '2 Review', who: 'The one they report to', what: 'Reads the self-review, changes or adds goals (each change is marked for the person, with the original kept) and writes the Manager’s Feedback. **Save and book the meeting** moves on.', locks: 'The feedback locks.' },
  { n: '3 Meeting', who: 'Both', what: 'Booked from the review: the Agenda’s New event drawer opens filled in, on the first slot both are free, with a Google Meet link. The reviewer writes the meeting notes; after the meeting the person clicks **I have read and agree**.', locks: 'Agreeing sends it to approval.' },
  { n: '4 Approval', who: 'The one they report to', what: '**Final remarks and approval**, one by one or with **Approve all**. The PDF (US Letter) is copied to Google Drive, into the Human Resources folder and a folder for the year, and HR is told.', locks: 'The whole review locks for good.' },
]

const SEES: Block[] = [
  { t: 'Human Resources, Reviews', d: 'The progress block (each step, its date, how many are done, who is late, with Remind) for the VP of Operations, the CISO, HR and Super Admins; and the year’s list: the step, who it waits for, the due date and the Drive copy. A reviewer sees the people who report to them; everyone else opens only their own review.' },
  { t: 'The review card', d: 'At the top of Human Resources and on Home, from the day the self-review opens until 30 days after approval. Its button follows the step.' },
  { t: 'Needs you', d: 'Every step that needs someone is a row on their Home, on their turn: start the reviews, write the priorities, write your self-review, review and book, read and agree, approve, the approved review, the check-in. The row goes away when the step is done.' },
  { t: 'History', d: 'Human Resources, My reviews, and the person’s page in the Directory: every year with its PDF, and last year’s imported file. The person, the ones who review them now and HR see them; a former manager stops seeing them.' },
]

export function AnnualReviewSection() {
  return (
    <section id="annual-review" className="scroll-mt-6">
      <Eyebrow>Human Resources</Eyebrow>
      <Heading>The annual performance review</Heading>
      <Lede>Once a year, each person reviews their year and agrees their goals for the next one with the person they report to. The VP of Operations starts it in November and it is all approved by mid-December; six months later there is a check-in on the goals. It lives in People, Human Resources, and everyone in the Directory has one.</Lede>

      <SubHeading first>Who does what</SubHeading>
      <Cards items={ROLES} cols={3} />

      <SubHeading>Two levels</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-muted">A review is always between a person and the one they report to: their Team Leader or, for someone with no Team Leader, the person they report to in the Directory (Work, Reports to). The CISO reviews the VP of Operations, and nobody reviews the CISO, who has no review of their own. Someone who leads their own team and also works in another team has <strong>two reviewers</strong>: the person they report to and the other team’s Team Leader, each with their own part (feedback, meeting, read and agree, approval), and each goal is for one of them. The review is approved when both have approved.</p>

      <SubHeading>The year, in order</SubHeading>
      <div className="flex flex-col sm:flex-row gap-2">
        {FLOW.map((f, i) => (
          <div key={f.t} className={`${card} p-4 flex-1`}>
            <div className="font-(family-name:--font-display) font-extrabold text-[11px] tracking-[.08em] uppercase text-tn-teal">{i + 1}</div>
            <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink mt-1">{f.t}</div>
            <div className="text-[12.5px] leading-relaxed text-muted mt-1.5"><Rich text={f.d} /></div>
          </div>
        ))}
      </div>

      <SubHeading>Priorities</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-muted">Three kinds, shown in this order: the CISO’s <strong>Company Priorities</strong>, the <strong>VP of Operations’</strong>, and each team’s. A person sees the first two and the priorities of the teams they are in, never another team’s, and the goal picker offers only those. A Team Leader writes their team’s first in their self-review, with no approval, and cannot submit without one. Each priority shows how many goals serve it.</p>

      <SubHeading>The four steps</SubHeading>
      <div className="flex flex-col gap-2">
        {STEPS.map(s => (
          <div key={s.n} className={`${card} p-4 grid gap-2 sm:grid-cols-[150px_150px_1fr_170px]`}>
            <div className="font-(family-name:--font-display) font-extrabold text-sm text-tn-ink">{s.n}</div>
            <div className="text-[13px] text-tn-ink font-semibold">{s.who}</div>
            <div className="text-[13px] leading-relaxed text-muted"><Rich text={s.what} /></div>
            <div className="text-[12.5px] text-muted">{s.locks}</div>
          </div>
        ))}
      </div>
      <p className="text-[13px] leading-relaxed text-muted mt-3">Any step can go back one step, always with a reason the other person reads: the review back to the self-review, the meeting back to the review, the approval back to the meeting.</p>

      <SubHeading>Who sees what</SubHeading>
      <Cards items={SEES} />

      <SubHeading>Dates</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-muted">Every date comes from the day the reviews start (a weekend moves to the Monday after). The VP of Operations, HR and Super Admins can change them in Reviews. When a step is done before its date, the progress block offers to move the later dates up by the days saved; a late step never pushes the dates after it. Reminders go out by email, and show in Needs you, 3 days before, the day before and on the day of each one, and of each goal (the end of its month). From 2 days late, the VP sees the people in Needs you.</p>

      <SubHeading>Goals during the year and the 6-month check-in</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-muted">The agreed goals become Human Resources, My goals: Not started, On track, At risk, Done or No longer relevant. The person updates a goal whenever they like; the reviewer sees it in My team’s goals. Six months after the start, the VP of Operations starts the check-in: with the CISO they mark each Company Priority no change, changed or added, then tell everyone. Each approved review gets a check-in part: the reviewer books the meeting, they tick goals done, adjust or add goals and leave notes, and the reviewer finishes it (booked within 11 days, done within 25).</p>

      <SubHeading>First year</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-muted">The 2025 reviews are imported once from Google Drive (Company settings, Human Resources, Import last year’s reviews): each file is matched to a person by its name, kept in the portal as a PDF and shown beside that person’s 2026 self-review. When a file is imported the portal reads the 2026 goals it set and the Job Description, and HR checks them on the import screen; in the 2026 review those goals are already there, locked, for the person to mark. From the 2027 review on, the history is in the portal, and the goals agreed the year before come in by themselves to be marked.</p>

      <div className="flex gap-3 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 items-start">
        <svg className="shrink-0 mt-0.5 text-amber-700" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16v-4M12 8h.01" /><circle cx="12" cy="12" r="10" /></svg>
        <div className="text-[13px] leading-relaxed text-amber-800"><strong className="font-extrabold">The goals for next year wait for the priorities.</strong> They open in every self-review when the CISO and the VP of Operations have marked their priorities ready, or after the VP’s date at the latest.</div>
      </div>
    </section>
  )
}
