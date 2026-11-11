/**
 * The annual review's emails (design handoff, 3 November 2026, B2), drawn as
 * the handoff draws them (the owner's choice, 4 November 2026): one white
 * card with the logo, the words, one navy button and the line on why it came.
 * The subject is the only title. Tables and inline styles, readable with
 * images blocked. Pure: each notice is its words, the renderer draws them.
 */

export interface ReviewMail { subject: string; pre: string; title: string; body: string[]; button: string; url: string; footer: string }

const e = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function renderReviewMail(m: ReviewMail, origin: string): { subject: string; html: string; text: string } {
  const paras = m.body.map(p => `<p style="margin:0 0 12px;font-size:13.5px;line-height:1.55;color:#435066;">${e(p)}</p>`).join('\n        ')
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(m.subject)}</title>
<link href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Raleway:wght@800&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#f1efe8;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(m.pre)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1efe8;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #e4e7ec;border-radius:14px;">
      <tr><td style="padding:16px;font-family:'Open Sans',Arial,sans-serif;color:#435066;">
        <img src="${e(origin)}/logos/true-north.png" height="24" alt="True North" style="display:block;height:24px;width:auto;margin:0 0 12px;border:0;font-family:Raleway,Arial,sans-serif;font-weight:800;font-size:14px;color:#012358;">
        ${paras}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 12px;"><tr>
          <td style="border-radius:10px;background:#012358;">
            <a href="${e(m.url)}" style="display:inline-block;padding:10px 16px;font-family:Raleway,Arial,sans-serif;font-weight:800;font-size:13px;color:#ffffff;text-decoration:none;border-radius:10px;">${e(m.button)}</a>
          </td>
        </tr></table>
        <p style="margin:0;font-size:11.5px;line-height:1.5;color:#8593a4;">${e(m.footer)}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
  const text = [...m.body.flatMap(p => [p, '']), `${m.button}: ${m.url}`, '', m.footer].join('\n')
  return { subject: m.subject, html, text }
}

const FOOT = (year: number) => `You get this because you take part in the ${year} review.`
const FOOT_MGR = (year: number) => `You get this because someone who reports to you takes part in the ${year} review.`
const FOOT_LEAD = (year: number) => `You get this because you lead a team in the ${year} review.`

/** "Mon, Nov 30" from YYYY-MM-DD. */
export function dayLabel(day: string, withYear = false): string {
  const d = new Date(`${day}T12:00:00Z`)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' })
}

// "the Writing Team", "the Leadership team": how a sentence names a team.
const teamOf = (name: string) => `the ${name}${/\bteam$/i.test(name) ? '' : ' team'}`
const TeamOf = (name: string) => teamOf(name).replace(/^the/, 'The')

const left = (n: number) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`)

export const reviewMails = {
  opened: (v: { first: string; year: number; due: string | null; url: string }): ReviewMail => ({
    subject: `Your ${v.year} review is open`, pre: 'Write your self-review.', title: `Your ${v.year} review is open`,
    body: [`Hi ${v.first}, your ${v.year} annual performance review is open.${v.due ? ` Write your self-review by ${dayLabel(v.due)}.` : ''} It saves as you type, so you can do it in more than one go.`],
    button: 'Open your review', url: v.url, footer: FOOT(v.year),
  }),
  selfDue: (v: { year: number; due: string; days: number; answered: number; total: number; goals: number; url: string }): ReviewMail => ({
    subject: v.days === 0 ? 'Your self-review is due today' : `${v.days} days left: your self-review`, pre: `Due ${dayLabel(v.due)}.`,
    title: v.days === 0 ? 'Your self-review is due today' : `${v.days} days left: your self-review`,
    body: [`Your self-review is due ${dayLabel(v.due)}. You have answered ${v.answered} of ${v.total} questions and added ${v.goals} ${v.goals === 1 ? 'goal' : 'goals'}.`],
    button: 'Continue your self-review', url: v.url, footer: FOOT(v.year),
  }),
  toReviewer: (v: { year: number; who: string; what: 'review' | 'meeting' | 'approve'; due: string | null; days: number | null; url: string }): ReviewMail => {
    const verb = v.what === 'review' ? `Review ${v.who}'s self-review` : v.what === 'meeting' ? `Book the meeting with ${v.who}` : `Approve ${v.who}'s review`
    const when = v.due ? (v.days === null ? ` It is due ${dayLabel(v.due)}.` : ` It is due ${left(v.days)}, ${dayLabel(v.due)}.`) : ''
    return {
      subject: verb, pre: v.due ? `Due ${dayLabel(v.due)}.` : verb, title: verb,
      body: [`${v.what === 'review' ? `${v.who} sent their ${v.year} self-review.` : v.what === 'meeting' ? `Your review of ${v.who} is done. Book the meeting to agree the goals.` : `${v.who} read the review and agreed. It is ready for you to approve.`}${when}`],
      button: 'Open the review', url: v.url, footer: FOOT_MGR(v.year),
    }
  },
  agree: (v: { year: number; manager: string; url: string }): ReviewMail => ({
    subject: 'Read and agree your review', pre: 'The meeting is done.', title: 'Read and agree your review',
    body: [`Your meeting with ${v.manager} is done. Read the meeting notes, the goals and the feedback, then click "I have read and agree".`],
    button: 'Read and agree', url: v.url, footer: FOOT(v.year),
  }),
  sentBack: (v: { year: number; by: string; reason: string; url: string }): ReviewMail => ({
    subject: `${v.by} sent your review back`, pre: v.reason, title: `${v.by} sent your review back`,
    body: [`${v.by} sent your ${v.year} review back one step, with this reason:`, `"${v.reason}"`],
    button: 'Open your review', url: v.url, footer: FOOT(v.year),
  }),
  approved: (v: { year: number; who: string; by: string; url: string; toHr: boolean }): ReviewMail => ({
    subject: v.toHr ? `${v.who}'s ${v.year} review is approved` : `Your ${v.year} review is approved`, pre: 'The PDF is ready.',
    title: v.toHr ? `${v.who}'s ${v.year} review is approved` : `Your ${v.year} review is approved`,
    body: [v.toHr ? `${v.by} approved ${v.who}'s ${v.year} review. The PDF is made and copied to Google Drive.` : `${v.by} approved your ${v.year} review. Your goals are recorded on your profile and in Human Resources, My review, and in 6 months there is a check-in to look at them again.`],
    button: 'Open the review', url: v.url, footer: v.toHr ? `You get this because you are HR in Company settings.` : FOOT(v.year),
  }),
  prioritiesDue: (v: { year: number; due: string; days: number; teams: string[]; url: string }): ReviewMail => ({
    subject: v.days === 0 ? `${v.teams.length === 1 ? `${TeamOf(v.teams[0])}'s` : 'Your teams\''} priorities are due today` : `${left(v.days).replace(/^./, c => c.toUpperCase())}: ${v.teams.length === 1 ? `${teamOf(v.teams[0])}'s` : 'your teams\''} priorities`,
    pre: `Due ${dayLabel(v.due)}.`, title: v.days === 0 ? 'Your team\'s priorities are due today' : 'Your team\'s priorities',
    body: [`The priorities for ${v.year + 1} of ${listOf(v.teams.map(teamOf))} are the first part of your self-review, due ${dayLabel(v.due)}. Your team builds its goals on them, so write them first.`],
    button: 'Open your review', url: v.url, footer: FOOT_LEAD(v.year),
  }),
  /** The CISO's Company Priorities or the VP of Operations' own, asked for at the kickoff and reminded (owner, 10 November 2026). */
  prioritiesAsk: (v: { year: number; which: 'company' | 'vp'; due: string | null; days: number | null; url: string }): ReviewMail => {
    const what = v.which === 'company' ? `the Company Priorities for ${v.year + 1}` : `your priorities for ${v.year + 1}`
    const title = v.days === 0 ? `Due today: ${what}` : `Write ${what}`
    return {
      subject: title, pre: v.due ? `Due ${dayLabel(v.due)}.` : title, title,
      body: [`The ${v.year} reviews have started. ${v.which === 'company' ? 'The Company Priorities come first: every review shows them, and everyone builds their goals on them.' : 'After the Company Priorities, yours: every review shows them too.'}${v.due ? ` They are due ${v.days === null ? '' : `${left(v.days)}, `}${dayLabel(v.due)}.` : ''} When they are written, mark them ready: the goals for ${v.year + 1} open in every review.`],
      button: 'Open the priorities', url: v.url, footer: FOOT(v.year),
    }
  },
  checkinTime: (v: { year: number; first: string; with: string; reviewer: boolean; by: string | null; url: string }): ReviewMail => ({
    subject: 'Time for the 6-month check-in', pre: v.by ? `By ${dayLabel(v.by)}.` : 'Look at the goals again.', title: 'Time for the 6-month check-in',
    body: [v.reviewer
      ? `Hi ${v.first}, it is time for the 6-month check-in with ${v.with}. Book the meeting${v.by ? ` by ${dayLabel(v.by)}` : ''}; together you tick the goals done, adjust or add goals and leave notes, in the review's check-in part.`
      : `Hi ${v.first}, it is time for your 6-month check-in with ${v.with}. ${v.with.split(' ')[0]} books the meeting; before it, look at your goals and write your notes in the review's check-in part.`],
    button: 'Open the check-in', url: v.url, footer: v.reviewer ? FOOT_MGR(v.year) : FOOT(v.year),
  }),
  goalDue: (v: { year: number; goal: string; month: string; manager: string; url: string }): ReviewMail => ({
    subject: 'Your goal is due this month', pre: v.goal, title: 'Your goal is due this month',
    body: [`${v.goal} is due by ${v.month}. Say where it is: it takes a minute, and ${v.manager || 'your manager'} sees it.`],
    button: 'Update the goal', url: v.url, footer: FOOT(v.year),
  }),
  checkinsOpen: (v: { year: number; first: string; by: string; names: string[]; url: string }): ReviewMail => ({
    subject: 'Time to book the 6-month check-ins', pre: `Due by ${dayLabel(v.by)}.`, title: 'Time to book the 6-month check-ins',
    body: [`Hi ${v.first}, the 6-month check-ins are due by ${dayLabel(v.by)}. Book one with each person who reports to you: ${listOf(v.names)}. Book opens the Agenda, filled in.`],
    button: "Open My team's goals", url: v.url, footer: FOOT_MGR(v.year),
  }),
  checkinDue: (v: { year: number; who: string; by: string; days: number; url: string }): ReviewMail => ({
    subject: `Book ${v.who}'s 6-month check-in`, pre: `Due ${left(v.days)}.`, title: `Book ${v.who}'s 6-month check-in`,
    body: [`${v.who}'s 6-month check-in is due by ${dayLabel(v.by)} and is not booked yet.`],
    button: "Open My team's goals", url: v.url, footer: FOOT_MGR(v.year),
  }),
  checkinDone: (v: { year: number; manager: string; url: string }): ReviewMail => ({
    subject: `${v.manager} finished your 6-month check-in`, pre: 'Read the comments on your goals.', title: 'Your 6-month check-in is done',
    body: [`${v.manager} finished your 6-month check-in and commented on your goals.`],
    button: 'Open My goals', url: v.url, footer: FOOT(v.year),
  }),
}

/** "Amy, Grace and Joy". */
export function listOf(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}
