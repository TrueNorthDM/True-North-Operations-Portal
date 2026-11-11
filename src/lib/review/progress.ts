/**
 * The progress block on top of Human Resources › Reviews (owner, 10 November
 * 2026): each step of the year, who does it, how many have done it, its due
 * date, and the people behind the number. Pure, so it can be tested.
 *
 * A review with two reviewers counts once per reviewer in the steps that are
 * a reviewer's (review, meeting, approval), and once in the self-review.
 */

import { dayDiff } from './rules'
import type { DateKey } from './schedule'
import type { Part, PartNo } from './parts'

export type RowState = 'done' | 'now' | 'late' | 'later'

export interface ProgressItem {
  key: string; personId: string; name: string; reviewer: string | null; area: string
  where: string; done: boolean; late: boolean; reviewId: number | null; part: PartNo | null
}

export interface ProgressRow {
  key: string; label: string; who: string; due: string | null; dateKey: DateKey | null
  done: number; total: number; state: RowState; note: string | null; items: ProgressItem[]
  /** Finished before its date: the dates after it may come this many days earlier. */
  moveUp: number | null
}

export interface Progress { rows: ProgressRow[]; pct: number; week: number; weeks: number; lateCount: number }

export interface ProgressInput {
  today: string
  now: Date
  cycle: {
    year: number; started_at: string | null; leaders_open_on: string | null
    company_due?: string | null; vp_due?: string | null; self_due: string | null; review_due: string | null
    leaders_meeting_due?: string | null; meeting_due: string | null; leaders_approval_due?: string | null; approval_due: string | null
    company_done_at?: string | null; vp_done_at?: string | null
  }
  reviews: { id: number; personId: string; name: string; step: string; selfSentAt: string | null; parts: (Part & { reviewerName: string })[] }[]
  /** The Team Leaders in the review and the teams they lead. */
  leaders: { personId: string; name: string; reviewId: number | null; teams: { id: string; name: string; written: number }[] }[]
  priorities: { company: number; vp: number }
  fmt: (day: string) => string
}

const partWhere = (p: Part, fmt: (d: string) => string, now: Date): string => {
  switch (p.step) {
    case 'waiting': return 'Waiting for the self-review'
    case 'review': return 'Writing the review'
    case 'meeting':
      if (!p.meetingStartsAt) return 'Meeting to book'
      if (p.meetingEndsAt && new Date(p.meetingEndsAt) <= now) return 'Met, waiting to read and agree'
      return `Meeting booked for ${fmt(p.meetingStartsAt.slice(0, 10))}`
    case 'approval': return 'Read and agreed, waiting for approval'
    case 'approved': return p.approvedAt ? `Approved ${fmt(p.approvedAt.slice(0, 10))}` : 'Approved'
  }
}

export function computeProgress(i: ProgressInput): Progress {
  const { cycle: c, today, fmt } = i
  const late = (due: string | null | undefined, done: boolean) => !done && !!due && today > due
  const rows: Omit<ProgressRow, 'state' | 'moveUp'>[] = []

  rows.push({
    key: 'start', label: 'Start the reviews', who: 'VP of Operations', due: c.leaders_open_on, dateKey: null,
    done: c.started_at ? 1 : 0, total: 1, note: c.started_at ? `Started ${fmt(c.started_at.slice(0, 10))}` : null, items: [],
  })
  rows.push({
    key: 'company', label: `Company Priorities for ${c.year + 1}`, who: 'CISO', due: c.company_due ?? null, dateKey: 'company_due',
    done: c.company_done_at ? 1 : 0, total: 1, note: `${i.priorities.company} written${c.company_done_at ? ', ready' : ''}`, items: [],
  })
  rows.push({
    key: 'vp', label: `VP of Operations' priorities for ${c.year + 1}`, who: 'VP of Operations', due: c.vp_due ?? null, dateKey: 'vp_due',
    done: c.vp_done_at ? 1 : 0, total: 1, note: `${i.priorities.vp} written${c.vp_done_at ? ', ready' : ''}`, items: [],
  })

  const teamItems: ProgressItem[] = i.leaders.map(l => {
    const empty = l.teams.filter(t => !t.written)
    const done = !empty.length
    return {
      key: `team:${l.personId}`, personId: l.personId, name: l.name, reviewer: null, area: l.teams.map(t => t.name).join(', '),
      where: done ? `${l.teams.reduce((n, t) => n + t.written, 0)} written` : `None yet for ${empty.map(t => t.name).join(', ')}`,
      done, late: late(c.self_due, done), reviewId: l.reviewId, part: null,
    }
  })
  rows.push({ key: 'team', label: 'Team priorities', who: 'Team Leaders, first in their self-review', due: c.self_due, dateKey: null, done: teamItems.filter(x => x.done).length, total: teamItems.length, note: null, items: teamItems })

  const selfItems: ProgressItem[] = i.reviews.map(r => {
    const done = r.step !== 'self' && r.step !== 'waiting'
    return {
      key: `self:${r.id}`, personId: r.personId, name: r.name, reviewer: r.parts.map(p => p.reviewerName).filter(Boolean).join(' and ') || null, area: '',
      where: done ? `Sent ${r.selfSentAt ? fmt(r.selfSentAt.slice(0, 10)) : ''}`.trim() : 'Writing', done, late: late(c.self_due, done), reviewId: r.id, part: null,
    }
  })
  rows.push({ key: 'self', label: 'Self-review', who: 'Everyone', due: c.self_due, dateKey: 'self_due', done: selfItems.filter(x => x.done).length, total: selfItems.length, note: null, items: selfItems })

  const partItems = (test: (p: Part) => boolean, done: (p: Part) => boolean, due: (p: Part) => string | null | undefined, key: string) =>
    i.reviews.flatMap(r => r.parts.filter(test).map(p => {
      const d = done(p)
      return {
        key: `${key}:${r.id}:${p.no}`, personId: r.personId, name: r.name, reviewer: p.reviewerName || null, area: p.area,
        where: partWhere(p, fmt, i.now), done: d, late: late(due(p), d), reviewId: r.id, part: p.no,
      }
    }))
  const booked = (p: Part) => (p.step === 'meeting' && !!p.meetingStartsAt) || p.step === 'approval' || p.step === 'approved'
  const agreed = (p: Part) => p.step === 'approval' || p.step === 'approved'
  const approved = (p: Part) => p.step === 'approved'
  const any = () => true
  const lane = (n: 1 | 2) => (p: Part) => p.lane === n

  const review = partItems(any, booked, () => c.review_due, 'review')
  rows.push({ key: 'review', label: 'Review written and meeting booked', who: 'VP for the Team Leaders, Team Leaders for their members', due: c.review_due, dateKey: 'review_due', done: review.filter(x => x.done).length, total: review.length, note: null, items: review })
  const meet1 = partItems(lane(1), agreed, () => c.leaders_meeting_due ?? c.meeting_due, 'meet1')
  rows.push({ key: 'meet1', label: 'Leaders: meeting, read and agreed', who: 'VP and each Team Leader', due: c.leaders_meeting_due ?? c.meeting_due, dateKey: 'leaders_meeting_due', done: meet1.filter(x => x.done).length, total: meet1.length, note: null, items: meet1 })
  const meet2 = partItems(lane(2), agreed, () => c.meeting_due, 'meet2')
  rows.push({ key: 'meet2', label: 'Teams: meeting, read and agreed', who: 'Each Team Leader and their members', due: c.meeting_due, dateKey: 'meeting_due', done: meet2.filter(x => x.done).length, total: meet2.length, note: null, items: meet2 })
  const appr1 = partItems(lane(1), approved, () => c.leaders_approval_due ?? c.approval_due, 'appr1')
  rows.push({ key: 'appr1', label: 'Leaders: final remarks and approval', who: 'VP of Operations', due: c.leaders_approval_due ?? c.approval_due, dateKey: 'leaders_approval_due', done: appr1.filter(x => x.done).length, total: appr1.length, note: null, items: appr1 })
  const appr2 = partItems(lane(2), approved, () => c.approval_due, 'appr2')
  rows.push({ key: 'appr2', label: 'Teams: final remarks and approval', who: 'Team Leaders', due: c.approval_due, dateKey: 'approval_due', done: appr2.filter(x => x.done).length, total: appr2.length, note: null, items: appr2 })

  // Late first, then the order of the step, then the name.
  for (const r of rows) r.items.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.late) - Number(a.late) || a.name.localeCompare(b.name))

  // The steps open now: not done, and the earliest due date among those, plus any already under way.
  const open = rows.filter(r => r.total > 0 && r.done < r.total)
  const firstDue = open.map(r => r.due).filter((d): d is string => !!d).sort()[0] ?? null
  const out: ProgressRow[] = rows.map(r => {
    const complete = r.total > 0 && r.done >= r.total
    const isLate = !complete && (r.items.some(x => x.late) || (!!r.due && today > r.due && r.total > 0))
    const state: RowState = complete ? 'done' : isLate ? 'late' : (r.done > 0 || (firstDue && r.due === firstDue)) && !!c.started_at ? 'now' : 'later'
    const early = complete && r.dateKey && r.due && today < r.due ? dayDiff(today, r.due) : null
    return { ...r, state, moveUp: early }
  })
  const total = out.reduce((n, r) => n + r.total, 0)
  const done = out.reduce((n, r) => n + Math.min(r.done, r.total), 0)
  const start = c.leaders_open_on
  const week = start ? Math.max(1, Math.floor(dayDiff(start, today) / 7) + 1) : 0
  const weeks = start && c.approval_due ? Math.max(1, Math.ceil((dayDiff(start, c.approval_due) + 1) / 7)) : 0
  const lateCount = new Set(out.flatMap(r => r.items.filter(x => x.late).map(x => x.personId))).size
  return { rows: out, pct: total ? Math.round((done / total) * 100) : 0, week: Math.min(week, weeks || week), weeks, lateCount }
}

// ── The 6-month check-in (owner, 10 November 2026): four steps ─────────────

export interface CheckinInput {
  today: string
  cycle: { checkin_started_at?: string | null; checkin_told_at?: string | null; ck_priorities_due?: string | null; ck_book_due?: string | null; ck_done_due?: string | null }
  priorities: { total: number; checked: number }
  /** Every approved review's parts, with that part's check-in. */
  items: { reviewId: number; personId: string; name: string; reviewer: string; area: string; part: PartNo; booked: string | null; finished: string | null }[]
  fmt: (day: string) => string
}

export function computeCheckinProgress(i: CheckinInput): Progress {
  const { cycle: c, today, fmt } = i
  const late = (due: string | null | undefined, done: boolean) => !done && !!due && today > due
  const rows: Omit<ProgressRow, 'state' | 'moveUp'>[] = []
  rows.push({ key: 'ck-start', label: 'Start the check-in', who: 'VP of Operations', due: null, dateKey: null, done: c.checkin_started_at ? 1 : 0, total: 1, note: c.checkin_started_at ? `Started ${fmt(c.checkin_started_at.slice(0, 10))}` : null, items: [] })
  rows.push({ key: 'ck-pri', label: 'Check the priorities', who: 'VP of Operations with the CISO', due: c.ck_priorities_due ?? null, dateKey: null, done: c.checkin_told_at ? 1 : 0, total: 1, note: `${i.priorities.checked} of ${i.priorities.total} gone through${c.checkin_told_at ? ', everyone told' : ''}`, items: [] })
  const item = (x: CheckinInput['items'][number], done: boolean, where: string, due: string | null | undefined, key: string): ProgressItem => ({
    key: `${key}:${x.reviewId}:${x.part}`, personId: x.personId, name: x.name, reviewer: x.reviewer, area: x.area, where, done, late: late(due, done), reviewId: x.reviewId, part: x.part,
  })
  const book = i.items.map(x => item(x, !!x.booked || !!x.finished, x.finished ? 'Done' : x.booked ? `Booked for ${fmt(x.booked.slice(0, 10))}` : 'Meeting to book', c.ck_book_due, 'ck-book'))
  rows.push({ key: 'ck-book', label: 'Book the meetings', who: 'VP with Team Leaders, Team Leaders with members', due: c.ck_book_due ?? null, dateKey: null, done: book.filter(x => x.done).length, total: book.length, note: null, items: book })
  const done = i.items.map(x => item(x, !!x.finished, x.finished ? `Finished ${fmt(x.finished.slice(0, 10))}` : x.booked ? `Booked for ${fmt(x.booked.slice(0, 10))}` : 'Not booked yet', c.ck_done_due, 'ck-done'))
  rows.push({ key: 'ck-done', label: 'Fill in the check-in', who: 'Each person and their reviewer', due: c.ck_done_due ?? null, dateKey: null, done: done.filter(x => x.done).length, total: done.length, note: null, items: done })
  for (const r of rows) r.items.sort((a, b) => Number(a.done) - Number(b.done) || Number(b.late) - Number(a.late) || a.name.localeCompare(b.name))
  const open = rows.filter(r => r.total > 0 && r.done < r.total)
  const firstDue = open.map(r => r.due).filter((d): d is string => !!d).sort()[0] ?? null
  const out: ProgressRow[] = rows.map((r, idx) => {
    const complete = r.total > 0 && r.done >= r.total
    const isLate = !complete && (r.items.some(x => x.late) || (!!r.due && today > r.due && r.total > 0))
    const prevDone = idx === 0 || (rows[idx - 1].total > 0 && rows[idx - 1].done >= rows[idx - 1].total)
    const state: RowState = complete ? 'done' : isLate ? 'late' : (r.done > 0 || (firstDue && r.due === firstDue) || prevDone) && !!c.checkin_started_at ? 'now' : 'later'
    return { ...r, state, moveUp: null }
  })
  const total = out.reduce((n, r) => n + r.total, 0)
  const doneN = out.reduce((n, r) => n + Math.min(r.done, r.total), 0)
  return { rows: out, pct: total ? Math.round((doneN / total) * 100) : 0, week: 0, weeks: 0, lateCount: new Set(out.flatMap(r => r.items.filter(x => x.late).map(x => x.personId))).size }
}
