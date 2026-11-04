/**
 * The annual review's questions (design handoff, 3 November 2026). Kept in
 * code, one template a year: a year's reviews keep the questions they were
 * written with, and a new year can change them without touching the old ones.
 * A year with no template of its own uses the latest one before it.
 *
 * Answers are stored by key (review_answers.key), so a key never changes
 * meaning: a new question gets a new key.
 */

export interface Question { key: string; label: string; hint: string }
export interface Section { key: SectionKey; title: string; questions: Question[] }
export type SectionKey = 'job' | 'self' | 'feedback' | 'manager'

export interface Template { sections: Section[] }

const T2026: Template = {
  sections: [
    {
      key: 'job', title: 'Job Description', questions: [
        { key: 'job_current', label: 'Current responsibilities', hint: 'What you do in a normal week, and for whom.' },
        { key: 'job_initial', label: 'Initial role expectations', hint: 'What the role was meant to be when you started in it.' },
        { key: 'job_alignment', label: 'Role alignment', hint: 'How well your work today matches the role, and where it drifts.' },
        { key: 'job_success', label: 'Success indicators', hint: 'How you and your Team Leader can tell the work is going well.' },
      ],
    },
    {
      key: 'self', title: 'Self-Evaluation', questions: [
        { key: 'self_strengths', label: 'Strengths', hint: 'What you do well, with an example from this year.' },
        { key: 'self_accomplishments', label: 'Accomplishments', hint: 'What you finished or improved in {year}, beyond the goals above.' },
        { key: 'self_challenges', label: 'Challenges', hint: 'What got in the way, and what you did about it.' },
        { key: 'self_improve', label: 'Areas for improvement', hint: 'What you want to get better at.' },
        { key: 'self_plan', label: 'Development plan', hint: 'How you plan to get there next year.' },
        { key: 'self_support', label: 'Support needed', hint: 'What you need from your Team Leader or the company.' },
      ],
    },
    {
      key: 'feedback', title: 'Feedback and Suggestions', questions: [
        { key: 'fb_company', label: 'Company improvements', hint: 'What True North could do better.' },
        { key: 'fb_other', label: 'Additional comments', hint: 'Anything else you want on the record.' },
      ],
    },
    {
      key: 'manager', title: "Manager's Feedback", questions: [
        { key: 'mgr_summary', label: 'Performance summary', hint: 'The year in a few sentences.' },
        { key: 'mgr_strengths', label: 'Strengths', hint: 'What the employee does well.' },
        { key: 'mgr_develop', label: 'Areas for development', hint: 'Where the employee should grow next.' },
        { key: 'mgr_alignment', label: 'Goal alignment', hint: "How next year's goals serve the company priorities." },
        { key: 'mgr_support', label: 'Support plan', hint: 'What you and the company will do to help.' },
      ],
    },
  ],
}

const TEMPLATES: Record<number, Template> = { 2026: T2026 }

/** The template a year's reviews use: its own, or the latest one before it. */
export function templateFor(year: number): Template {
  const years = Object.keys(TEMPLATES).map(Number).sort((a, b) => b - a)
  const pick = years.find(y => y <= year) ?? years[years.length - 1]
  const t = TEMPLATES[pick]
  return { sections: t.sections.map(s => ({ ...s, questions: s.questions.map(q => ({ ...q, hint: q.hint.replace('{year}', String(year)) })) })) }
}

/** The person's own questions (everything but the Manager's Feedback). */
export const ownSections = (t: Template) => t.sections.filter(s => s.key !== 'manager')
export const managerSection = (t: Template) => t.sections.find(s => s.key === 'manager')!
export const allKeys = (t: Template) => new Set(t.sections.flatMap(s => s.questions.map(q => q.key)))
export const ownKeys = (t: Template) => new Set(ownSections(t).flatMap(s => s.questions.map(q => q.key)))
export const managerKeys = (t: Template) => new Set(managerSection(t).questions.map(q => q.key))

/** "Copy from your last review": the Job Description keys, in order. */
export const JOB_KEYS = ['job_current', 'job_initial', 'job_alignment', 'job_success'] as const
