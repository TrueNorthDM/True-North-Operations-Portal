/**
 * The System manual's Annual review section (4 November 2026), written from
 * what was built (lib/review/*, components/review/*): who does what, the two
 * levels, the year in order, the priorities, the four steps, who sees what,
 * the dates and the first year. Roles, never names: the people are picked in
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
  { t: 'VP of Operations', d: 'Writes the **Company Priorities** with the CISO and approves each team’s priorities. Reviews only the people who report to them, and sees only their reviews.' },
  { t: 'CISO', d: 'Writes the Company Priorities with the VP of Operations and approves each team’s priorities. Reviews only the people who report to them, and sees only their reviews.' },
  { t: 'HR', d: 'Sees every review and is told by email when one is approved. Can change Company settings, Human Resources, like a Super Admin, except the three roles.' },
  { t: 'Team Leader', d: 'Writes their team’s priorities inside their own self-review and sends them for approval on their own. Reviews, meets and approves the people on their team.' },
  { t: 'Everyone', d: 'Every employee in the Directory has a review, and anyone added in **Who takes part** (a contractor, for example). Each writes their own self-review, then reads and agrees.' },
  { t: 'Super Admin', d: 'Starts the year’s cycle in Human Resources, Reviews. Nothing opens before that.' },
]

const FLOW = [
  { t: 'Before the cycle', d: 'Company settings, Human Resources: the roles, who takes part, the dates, the Drive folder, and last year’s reviews (first year only). The VP of Operations and the CISO write the Company Priorities.' },
  { t: 'Phase 1', d: 'A Super Admin clicks **Start**. Team Leaders, and everyone with no Team Leader, get their self-review. Each Team Leader writes and sends their team’s priorities.' },
  { t: 'Phase 2', d: 'A team’s self-reviews open when its priorities are approved, or on **Teams open by** at the latest.' },
  { t: 'Steps 2 to 4', d: 'Review, meeting (read and agree), approval, by the one each person reports to.' },
  { t: 'Approved', d: 'The review locks, the PDF is made and copied to Google Drive, and HR is told. The agreed goals become My goals for the year.' },
]

const STEPS: { n: string; who: string; what: string; locks: string }[] = [
  { n: '1 Self-review', who: 'The person', what: 'Marks how last year’s goals went (Met, Partly met, Not met or No longer relevant, and why), answers Job Description, Self-Evaluation and Feedback and Suggestions, and proposes the coming year’s goals, each with the priority it serves. It saves as they type.', locks: 'Submit locks their part.' },
  { n: '2 Review', who: 'The one they report to', what: 'Reads the self-review, changes or adds goals (each change is marked for the person, with the original kept) and writes the Manager’s Feedback. **Save and book the meeting** moves on.', locks: 'The feedback locks.' },
  { n: '3 Meeting', who: 'Both', what: 'The manager books it from the review: the Agenda’s New event drawer opens filled in, on the first slot both are free, with a Google Meet link, on both Google Calendars. The manager writes the meeting notes; after the meeting the person clicks **I have read and agree**.', locks: 'Agreeing sends it to approval.' },
  { n: '4 Approval', who: 'The one they report to', what: '**Approve and make the PDF**. The PDF (US Letter, no signature lines) is copied to Google Drive, into the Human Resources folder and a folder for the year, and HR is told.', locks: 'The whole review locks for good.' },
]

const SEES: Block[] = [
  { t: 'Human Resources, Reviews', d: 'The year’s list: the step, who it waits for, the due date and the Drive copy. HR and Super Admins see everyone; a manager sees the people who report to them; everyone else opens only their own review.' },
  { t: 'The review card', d: 'At the top of Human Resources and on Home, from the day the person’s self-review opens until 30 days after approval. Its button follows the step.' },
  { t: 'Needs you', d: 'Every step that needs someone is a row on that person’s Home: write your self-review, send or approve team priorities, review, book the meeting, read and agree, approve, update a goal, book a check-in. The row goes away when the step is done.' },
  { t: 'History', d: 'Human Resources, My reviews, and the person’s page in the Directory: every year with its PDF, and last year’s imported file. The person, the one they report to now and HR see them; a former manager stops seeing them.' },
]

const DATES = ['Team Leaders open on', 'Team Leaders’ self-review by', 'Teams open by', 'Self-review by', 'Review by', 'Meeting by', 'Approval by', 'Check-ins by']

export function AnnualReviewSection() {
  return (
    <section id="annual-review" className="scroll-mt-6">
      <Eyebrow>Human Resources</Eyebrow>
      <Heading>The annual performance review</Heading>
      <Lede>Once a year, each person reviews their year and agrees their goals for the next one with the person they report to. It lives in People, Human Resources, and everyone in the Directory has one.</Lede>

      <SubHeading first>Who does what</SubHeading>
      <Cards items={ROLES} cols={3} />

      <SubHeading>Two levels</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-muted">A review is always between a person and the one they report to: their Team Leader or, for someone with no Team Leader, the person they report to in the Directory (Work, Reports to). Nobody above that manager takes part. The VP of Operations and the CISO review each other when nobody is above them. Only the Company Priorities reach everyone.</p>

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
      <p className="text-[13.5px] leading-relaxed text-muted">Each priority is for the whole company or for one team. A person sees the Company Priorities and their own team’s, never another team’s, and the goal picker offers only those. Teams with no Team Leader have no team priorities. Once a team’s priorities are sent, only the VP of Operations and the CISO change their text. Each priority shows how many goals serve it.</p>

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
      <p className="text-[13.5px] leading-relaxed text-muted">Set every year in Company settings, Human Resources: {DATES.join(', ')}. Reminders go out by email, and show in Needs you, 1 week before, 3 days before and on the day of each one, of each goal (the end of its month) and of the 6-month check-ins (the managers get the list a month before Check-ins by).</p>

      <SubHeading>Goals during the year</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-muted">The agreed goals become Human Resources, My goals: Not started, On track, At risk, Done or No longer relevant. The person updates a goal whenever they like; the manager sees it in My team’s goals and comments. At the 6-month check-in, booked from My team’s goals in the same drawer, the manager comments on every goal and finishes it; the person gets the comments by email and in Needs you.</p>

      <SubHeading>First year</SubHeading>
      <p className="text-[13.5px] leading-relaxed text-muted">The 2025 reviews are imported once from Google Drive (Company settings, Human Resources, Import last year’s reviews): each file is matched to a person by its name, kept in the portal as a PDF and shown beside that person’s 2026 self-review. When a file is imported the portal reads the 2026 goals it set and the Job Description, and HR checks them on the import screen; in the 2026 review those goals are already there, locked, for the person to mark. From the 2027 review on, the history is in the portal, and the goals agreed the year before come in by themselves to be marked.</p>

      <div className="flex gap-3 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5 items-start">
        <svg className="shrink-0 mt-0.5 text-amber-700" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16v-4M12 8h.01" /><circle cx="12" cy="12" r="10" /></svg>
        <div className="text-[13px] leading-relaxed text-amber-800"><strong className="font-extrabold">Approving a team’s priorities opens that team’s self-reviews.</strong> Before that, or before Teams open by, the team’s people see that their review opens soon.</div>
      </div>
    </section>
  )
}
