// Design check: the daily summary emails (7 October 2026), drawn by the real
// renderer (src/lib/email/summary.ts) with invented content. ?mail=tools |
// system | catchup (tools by default). Development only.

import { notFound } from 'next/navigation'
import { renderSummary, type SummaryItem } from '@/lib/email/summary'
import { missedDays } from '@/lib/notifications/calendar'

export const dynamic = 'force-dynamic'

const i = (type: string, title: string, body: string, day: string, href = '/my-work'): SummaryItem => ({ type, title, body, day, href })

const TOOLS: SummaryItem[] = [
  i('step-assigned', '2 new steps were assigned to you', 'Translate into Portuguese: How to pray when you are tired, and Review: Hope in hard times. Due Oct 16.', '2026-10-07'),
  i('step-due-tomorrow', '2 steps of yours are due tomorrow', 'Feature image: Sabbath rest for busy people, and Publish on WordPress: Faith on the farm. Due Oct 8.', '2026-10-07'),
  i('step-late', 'A step of yours became late', 'Translate into Spanish: When prayer feels silent. Due Oct 5.', '2026-10-07'),
  i('publishing-behind', 'Publishing Goals behind pace', 'AAAF: 14 of 20 published this week, 17 expected by now.', '2026-10-07', '/publishing'),
  i('i7-budget', 'i7 budget crossed 75%', "i7 has used 78% of October's budget.", '2026-10-07', '/i7'),
]
const SYSTEM: SummaryItem[] = [
  i('sync-incomplete', "A sync didn't finish", 'The Monday sync that started at 9:15 PM stopped with 2 boards left: the time ran out.', '2026-10-07', '/admin/settings#my-work'),
  i('first-login', 'Someone signed in for the first time', 'Maria Example signed in for the first time, as Collaborator.', '2026-10-07', '/directory'),
  i('first-login', 'Someone signed in for the first time', 'John Example signed in for the first time, as Collaborator.', '2026-10-07', '/directory'),
  i('monday-account-unlinked', 'A new Monday account with no person', 'New Writer (new.writer@example.org) has no person in the Directory, so its work shows under Unknown user.', '2026-10-07', '/admin/monday-links'),
]
const CATCHUP: SummaryItem[] = [
  i('step-assigned', 'A new step was assigned to you', 'Translate into Portuguese: Grace in the ordinary. Due Oct 16.', '2026-10-12'),
  i('step-assigned', '2 new steps were assigned to you', 'Review: Water for every village, and Feature image: Learning to listen. Due Oct 15.', '2026-10-10'),
  i('step-due-tomorrow', 'A step of yours is due tomorrow', 'Publish on WordPress: Water for every village. Due Oct 14.', '2026-10-13'),
  i('step-late', 'A step of yours became late', 'Translate into Spanish: When prayer feels silent. Due Oct 12.', '2026-10-13'),
]

export default async function SummaryEmailCheck({ searchParams }: { searchParams: Promise<{ mail?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { mail = 'tools' } = await searchParams
  const origin = 'http://localhost:3000'
  const base = { firstName: 'Ana', origin, zoneLabel: 'New York (US Eastern)' }
  const out = mail === 'system'
    ? renderSummary({ ...base, category: 'system', today: '2026-10-07', missed: [], items: SYSTEM })
    : mail === 'catchup'
      ? renderSummary({ ...base, category: 'tools', today: '2026-10-13', missed: missedDays('2026-10-13'), items: CATCHUP })
      : renderSummary({ ...base, category: 'tools', today: '2026-10-07', missed: [], items: TOOLS })
  return (
    <div className="min-h-screen bg-background p-6 space-y-3">
      <p className="m-0 text-[13px] text-muted">Subject: <strong className="text-tn-ink">{out.subject}</strong></p>
      <iframe title="Summary email" srcDoc={out.html} className="w-full h-[1400px] border-0 rounded-[12px] bg-white" />
    </div>
  )
}
