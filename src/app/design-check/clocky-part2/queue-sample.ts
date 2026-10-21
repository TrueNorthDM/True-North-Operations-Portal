// The Approvals list with the prototype's data (Approvals.dc.html: WAIT, DONE
// and tsRow, "now" Tue, Nov 3, 2026), for frames AP1, AP3, AP2 (Arnaldo
// Oliveira, Super Admin), APL (Wendy Cacka, Team Leader of Web) and APD (Dave
// Sharpe, Admin). The same ownership rule as the prototype's lists().

import type { QueueData, QueueRow, QueueType, Tone } from '@/lib/timeclock/approval-queue'

const TEAMC: Record<string, string> = { Africa: '#F0A35E', Leadership: '#1E40AF', Operations: '#92400E', SEO: '#F4C24A', 'Social Media': '#DC2626', 'Special Projects': '#6D5EF5', Web: '#A99BD4', Writers: '#86C06A', Graphics: '#C026D3' }
const TEAM: Record<string, string> = {
  'Arnaldo Oliveira': 'Leadership', 'Dave Sharpe': 'Leadership', 'Rock Kai': 'Social Media', 'Tina Gennette': 'Operations', 'Wendy Cacka': 'Web', 'Samuel Manzi': 'Web',
  'Justus Tsofa': 'Africa', 'Joy Inyele': 'Africa', 'Clarise Nixon': 'Social Media', 'Cheyenne Wilson': 'Writers', 'Stephanie Aguirre': 'Social Media', 'Olivia Hale': 'SEO',
  'Amy Prindle': 'Writers', 'Alyssa Sommerville': 'Graphics', Andressa: 'Special Projects', Yuliberth: 'Special Projects', John: 'Special Projects',
}
const ini = (n: string) => n.split(' ').map(w => w[0]).join('').slice(0, 2)

type Seed = {
  id: string; type: QueueType; who: string; main: string; sub: string; subLead?: string; flag?: [string, Tone]; flagLead?: [string, Tone] | null
  why?: string; asked: string; owner: string; ts?: boolean
}

// owner: a person, or 'super' (any Super Admin; time corrections: the Team Leader or a Super Admin).
const WAIT: Seed[] = [
  { id: 'r1', type: 'ts', ts: true, who: 'Cheyenne Wilson', main: 'October 2026 · 151h 15m', sub: 'Invoice INV-2026-0143 · $3,357.50', flag: ['3h 15m over the allowance, not approved', 'warn'], why: 'Submitted with 1 reimbursement.', asked: 'Submitted Nov 1, 9:14 AM', owner: 'Arnaldo Oliveira' },
  { id: 'r11', type: 'ts', ts: true, who: 'Samuel Manzi', main: 'October 2026 · 160h 00m', sub: 'Invoice INV-2026-0147 · $3,200.00', subLead: 'Hours only', flag: ['Hours approved by Wendy Cacka', 'ok'], flagLead: ['Hours with Wendy Cacka', 'neu'], asked: 'Submitted Oct 31, 6:40 PM', owner: 'Arnaldo Oliveira' },
  { id: 'r2', type: 'ts', ts: true, who: 'Justus Tsofa', main: 'October 2026 · 162h 30m', sub: 'Invoice INV-2026-0142 · $2,310.00', why: 'Submitted with 1 reimbursement.', asked: 'Submitted Nov 1, 2:05 AM', owner: 'Arnaldo Oliveira' },
  { id: 'r4', type: 'ts', ts: true, who: 'Olivia Hale', main: 'October 2026 · 118h 45m', sub: 'Invoice INV-2026-0144 · $1,800.00, fixed monthly', asked: 'Submitted Oct 31, 6:40 PM', owner: 'Arnaldo Oliveira' },
  { id: 'r5', type: 'ts', ts: true, who: 'Wendy Cacka', main: 'Oct 4 to 17 · 80h 00m + 8h 00m Vacation', sub: 'Payroll summary, goes to Rippling', asked: 'Submitted Oct 17, 5:40 PM', owner: 'Arnaldo Oliveira' },
  { id: 'r14', type: 'ts', ts: true, who: 'Andressa', main: 'October 2026 · fixed monthly', sub: 'Invoice INV-2026-0149 · $2,000.00', subLead: 'No timesheet', flag: ['No timesheet', 'neu'], why: 'Fixed monthly, no timesheet.', asked: 'Created by itself, Nov 1', owner: 'Arnaldo Oliveira' },
  { id: 'r15', type: 'ts', ts: true, who: 'Yuliberth', main: 'October 2026 · fixed monthly', sub: 'Invoice INV-2026-0150 · $1,600.00', subLead: 'No timesheet', flag: ['No timesheet', 'neu'], why: 'Fixed monthly, no timesheet.', asked: 'Created by itself, Nov 1', owner: 'Arnaldo Oliveira' },
  { id: 'r16', type: 'ts', ts: true, who: 'John', main: 'October 2026 · fixed monthly', sub: 'Invoice INV-2026-0151 · $2,400.00', subLead: 'No timesheet', flag: ['No timesheet', 'neu'], why: 'Fixed monthly, no timesheet.', asked: 'Created by itself, Nov 1', owner: 'Dave Sharpe' },
  { id: 'r3', type: 'ts', ts: true, who: 'Clarise Nixon', main: 'October 2026 · 132h 00m', sub: 'Invoice INV-2026-0145 · $2,376.00', subLead: 'Hours only', flag: ['Hours with Rock Kai', 'neu'], why: '2 end times not confirmed.', asked: 'Submitted Nov 1, 11:30 AM', owner: 'Rock Kai' },
  { id: 'r12', type: 'ts', ts: true, who: 'Rock Kai', main: 'October 2026 · 140h 00m', sub: 'Invoice INV-2026-0148 · $2,800.00', asked: 'Submitted Nov 1, 10:20 AM', owner: 'Dave Sharpe' },
  { id: 'r13', type: 'ts', who: 'Arnaldo Oliveira', main: 'October 2026', sub: 'Hours and invoice, one step', asked: 'Submitted Nov 1, 8:05 AM', owner: 'Dave Sharpe' },
  { id: 'r6', type: 'off', who: 'Tina Gennette', main: 'Vacation · 24h 00m', sub: 'Mon, Nov 23 to Wed, Nov 25', flag: ['Wendy Cacka is off Wed, Nov 25', 'neu'], why: '"Family trip for Thanksgiving."', asked: 'Asked Mon, Nov 2, 4:40 PM', owner: 'super' },
  { id: 'r7', type: 'rmb', who: 'Wendy Cacka', main: 'Software · $45.00', sub: 'Figma Professional, Oct to Dec', why: 'Employee: goes on a reimbursement document for Finance.', asked: 'Asked Mon, Nov 2, 10:05 AM', owner: 'super' },
  { id: 'r8', type: 'rmb', who: 'Joy Inyele', main: 'Equipment · $48.00', sub: 'USB headset for client calls', why: 'Contractor: goes on her next invoice.', asked: 'Asked Fri, Oct 30, 3:15 PM', owner: 'super' },
  { id: 'r9', type: 'xh', who: 'Cheyenne Wilson', main: 'Extra hours · 8h 00m', sub: 'November 2026 · 2 - i7 Marketing', why: '"Six extra i7 blog posts for the Q4 push."', asked: 'Asked Sun, Nov 1, 8:30 PM', owner: 'super' },
  { id: 'r10', type: 'cor', who: 'Clarise Nixon', main: 'Time correction · 1h 30m', sub: 'Wed, Oct 28, 3:00 PM to 4:30 PM', why: '"Client call ran long and I forgot to switch."', asked: 'Asked Thu, Oct 29, 8:40 AM', owner: 'Rock Kai' },
]

const DONE: (Seed & { st: string; tone: Tone; by: string })[] = [
  { id: 'd1', type: 'ts', who: 'Stephanie Aguirre', main: 'October 2026 · 128h 00m', sub: 'Invoice INV-2026-0138 · $2,304.00', st: 'Approved', tone: 'ok', by: 'Hours: Rock Kai, Oct 31. Invoice: Arnaldo Oliveira, Mon, Nov 2, 3:10 PM.', asked: '', owner: '' },
  { id: 'd9', type: 'ts', who: 'Dave Sharpe', main: 'Oct 18 to 31 · 80h 00m', sub: 'Payroll summary, sent to Rippling', st: 'Recorded', tone: 'neu', by: 'No approval for the Deputy Director. Recorded and sent to Rippling, Sun, Nov 1, 7:05 AM.', asked: '', owner: '' },
  { id: 'd2', type: 'ts', who: 'Alyssa Sommerville', main: 'October 2026 · 98h 00m', sub: 'Invoice INV-2026-0146 · back to Draft', st: 'Returned', tone: 'bad', by: 'Arnaldo Oliveira, Mon, Nov 2, 2:30 PM: "Oct 12 has 2 entries on DDI that belong to GNA."', asked: '', owner: '' },
  { id: 'd3', type: 'off', who: 'Dave Sharpe', main: 'Sick · 8h 00m', sub: 'Thu, Oct 29', st: 'Rippling refused it', tone: 'bad', by: 'Approved by Arnaldo Oliveira, Mon, Nov 2, 11:18 AM. Open it to try again.', asked: '', owner: '' },
  { id: 'd4', type: 'rmb', who: 'Justus Tsofa', main: 'Internet · $35.00', sub: 'Internet, October · on invoice INV-2026-0142', st: 'Approved', tone: 'ok', by: 'Arnaldo Oliveira, Oct 27', asked: '', owner: '' },
  { id: 'd5', type: 'off', who: 'Wendy Cacka', main: 'Vacation · 8h 00m', sub: 'Wed, Nov 25 to Fri, Nov 27 (Thu and Fri are company holidays)', st: 'Approved', tone: 'ok', by: 'Arnaldo Oliveira, Oct 21. Sent to Rippling, on the team calendar.', asked: '', owner: '' },
  { id: 'd6', type: 'xh', who: 'Cheyenne Wilson', main: 'Extra hours · 8h 00m', sub: 'October 2026 · 2 - i7 Marketing', st: 'Approved', tone: 'ok', by: 'Arnaldo Oliveira, Oct 20', asked: '', owner: '' },
  { id: 'd7', type: 'rmb', who: 'Amy Prindle', main: 'Meals with a client · $64.20', sub: 'Lunch, Thu, Oct 22', st: 'Denied', tone: 'bad', by: 'Arnaldo Oliveira, Oct 26: "No client meeting that day. Send it again with the meeting."', asked: '', owner: '' },
  { id: 'd8', type: 'cor', who: 'Stephanie Aguirre', main: 'Time correction · 0h 45m', sub: 'Mon, Oct 12, 5:30 PM to 6:15 PM', st: 'Approved', tone: 'ok', by: 'Rock Kai, Oct 13', asked: '', owner: '' },
]

const ME = { super: 'Arnaldo Oliveira', admin: 'Dave Sharpe', lead: 'Wendy Cacka' } as const

export function sampleQueue(level: 'super' | 'admin' | 'lead'): QueueData {
  const me = ME[level]
  const sup = level === 'super'
  const lead = level === 'lead'
  // Wendy (Team Leader) has not approved Samuel's hours yet: they are hers.
  const ownerOf = (s: Seed) => (lead && s.id === 'r11' ? 'Wendy Cacka' : s.owner)
  const row = (s: Seed, done: QueueRow['done']): QueueRow => {
    const team = TEAM[s.who]
    return {
      key: s.id, type: s.type, id: Number(s.id.slice(1)), personId: s.who, name: s.who, initials: ini(s.who), team: team ? { name: team, color: TEAMC[team] ?? null } : null,
      main: s.main, sub: lead && s.subLead ? s.subLead : s.sub,
      flag: lead && s.flagLead !== undefined ? (s.flagLead ? { text: s.flagLead[0], tone: s.flagLead[1] } : null) : s.flag ? { text: s.flag[0], tone: s.flag[1] } : null,
      why: s.why ?? null, asked: s.asked, askedAt: s.asked,
      ownerName: ownerOf(s) === 'super' ? 'a Super Admin' : ownerOf(s), own: s.who === me, done,
      href: s.ts ? `/design-check/clocky-app?frame=6C` : null, card: null,
    }
  }
  const mine = (s: Seed) => s.who !== me && (ownerOf(s) === me || (ownerOf(s) === 'super' && sup) || (s.type === 'cor' && sup))
  const inTeam = (s: Seed) => !lead || TEAM[s.who] === TEAM[me]
  return {
    level: lead ? 'team_leader' : sup ? 'super_admin' : 'admin',
    subtitle: sup ? 'Your decisions: hours of the people who report to you, invoices, time off, reimbursements and extra hours. "With others" shows, read only, what Team Leaders and Dave Sharpe still have.'
      : level === 'admin' ? 'You approve the hours and invoices of the people who report to you (Rock Kai, Arnaldo Oliveira). Everything else is read only.'
        : 'Hours from the Web team, and time corrections. Invoices are not shown to Team Leaders: Arnaldo Oliveira finishes each timesheet after you.',
    wait: WAIT.filter(mine).map(s => row(s, null)),
    others: WAIT.filter(s => !mine(s) && inTeam(s)).map(s => row(s, null)),
    done: DONE.filter(inTeam).map(s => row(s, { label: s.st, tone: s.tone, by: s.by })),
    note: "Hours go to the person each one reports to. Invoices go to Arnaldo Oliveira, or to Dave Sharpe for the people who report to him. When both land on the same person it is one step. The Deputy Director's timesheet is recorded without approval.",
  }
}
