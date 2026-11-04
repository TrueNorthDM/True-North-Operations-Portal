/**
 * The System manual's My Work and My Team pictures (owner, 4 November 2026:
 * the guides show the real screens with made-up data). Everyone, every board
 * and every item here is invented. Seen by Alex Rivera, a writer, on Tue,
 * Nov 10, 2026; the Writers team is led by Chris Taylor.
 */

import type { Worklist, WorkRow } from '@/lib/monday/worklist/data'
import { stepKey, type SavedOrder, type TeamOrderView } from '@/lib/monday/worklist/team-priority'
import type { EditorStep } from '@/components/monday/TeamPriorityEditor'
import type { RestrictedPerson, RestrictedTeam } from '@/components/admin/RestrictedDirectory'

/** New York's day the pictures are seen on. */
export const WORK_TODAY = '2026-11-10'

const STATUS: Record<string, string> = {
  'Working on it': '#FDAB3D',
  Stuck: '#E2445C',
  'Waiting for review': '#579BFC',
  Done: '#00C875',
}

const ALEX = 101
const MARIA = 102
const BEN = 103

const row = (id: number, o: Partial<WorkRow> & Pick<WorkRow, 'itemName' | 'boardName' | 'stepName'>): WorkRow => {
  const status = o.statusText === undefined ? 'Working on it' : o.statusText
  return {
    id,
    boardId: 1,
    workspaceName: 'Sample Client',
    itemId: 5000 + id,
    parentItemName: null,
    language: null,
    groupTitle: null,
    peopleCol: 'person',
    statusText: status,
    statusColor: status ? STATUS[status] ?? '#C4C4C4' : null,
    statusDone: status === 'Done',
    mondayUserId: ALEX,
    who: 'Alex Rivera',
    itemUpdatedAt: '2026-11-09T14:00:00Z',
    dueDate: null,
    dueSuspect: false,
    dueLabel: 'Due date',
    url: 'https://monday.com/',
    assigneeKnown: true,
    priority: 'medium',
    ...o,
  }
}

// Alex's open steps. Default order (board priority, then deadline) puts them
// 1, 2, 3, 4, 5, 6; the Writers team's order (below) moves 2 and 3 up.
const R1 = row(1, { itemName: 'November newsletter', boardId: 11, boardName: 'Sample Client Marketing', stepName: 'Write', priority: 'high', dueDate: '2026-11-06' })
const R2 = row(2, { itemName: 'Spanish', language: 'Spanish', parentItemName: 'Ten tips for a calmer home office', boardId: 12, boardName: 'Sample Project Publishing', workspaceName: 'Publishing', stepName: 'Review', statusText: 'Waiting for review', priority: 'high', dueDate: '2026-11-10' })
const R3 = row(3, { itemName: 'Blog post: planning a spring garden', boardId: 13, boardName: 'Sample Client Blog', stepName: 'Write', statusText: 'Stuck', priority: 'medium', dueDate: '2026-11-03' })
const R4 = row(4, { itemName: 'Portuguese', language: 'Portuguese', parentItemName: 'Ten tips for a calmer home office', boardId: 12, boardName: 'Sample Project Publishing', workspaceName: 'Publishing', stepName: 'Translate', priority: 'medium', dueDate: '2026-11-14' })
const R5 = row(5, { itemName: 'Writers Bi-Weekly Report, Nov 16 2026', boardId: 14, boardName: 'Team Reports', workspaceName: 'Reports', stepName: 'Write', statusText: null, priority: 'low', dueDate: '2026-11-16' })
// A date typed wrong in Monday (year 202): kept, and marked Check date.
const R6 = row(6, { itemName: 'About page copy', boardId: 15, boardName: 'Sample Client Website', stepName: 'Approve', statusText: 'Waiting for review', priority: 'low', dueDate: '0202-11-21', dueSuspect: true })

const DONE: WorkRow[] = [
  row(21, { itemName: 'October newsletter', boardId: 11, boardName: 'Sample Client Marketing', stepName: 'Write', statusText: 'Done', priority: 'high', dueDate: '2026-10-07' }),
  row(22, { itemName: 'French', language: 'French', parentItemName: 'Ten tips for a calmer home office', boardId: 12, boardName: 'Sample Project Publishing', workspaceName: 'Publishing', stepName: 'Review', statusText: 'Done', dueDate: '2026-10-28' }),
  row(23, { itemName: 'Writers Bi-Weekly Report, Nov 2 2026', boardId: 14, boardName: 'Team Reports', workspaceName: 'Reports', stepName: 'Write', statusText: 'Done', priority: 'low', dueDate: '2026-11-02' }),
]

const OPEN = [R1, R2, R3, R4, R5, R6]

const list = (rows: WorkRow[]): Worklist => {
  const open = rows.filter(r => !r.statusDone).length
  return {
    rows, open, total: rows.length, unlinked: 0, unlinkedAssignments: 0, truncated: false,
    matching: rows.length, oldestSyncAt: '2026-11-10T13:15:00Z',
  }
}

/** Alex's own list, in True North's order (no team order set). */
export function myWorkSample(): Worklist {
  return list([...OPEN, ...DONE])
}

// The Writers team's open steps, in True North's order: Alex's six and three of
// Maria Gomez and Ben Carter.
const M1 = row(31, { itemName: 'Case study: Sample Project', boardId: 13, boardName: 'Sample Client Blog', stepName: 'Write', priority: 'high', dueDate: '2026-11-02', mondayUserId: MARIA, who: 'Maria Gomez' })
const B1 = row(32, { itemName: 'Holiday campaign emails', boardId: 11, boardName: 'Sample Client Marketing', stepName: 'Edit', priority: 'high', dueDate: '2026-11-12', mondayUserId: BEN, who: 'Ben Carter' })
const M2 = row(33, { itemName: 'German', language: 'German', parentItemName: 'Ten tips for a calmer home office', boardId: 12, boardName: 'Sample Project Publishing', workspaceName: 'Publishing', stepName: 'Translate', priority: 'medium', dueDate: '2026-11-18', mondayUserId: MARIA, who: 'Maria Gomez' })
const TEAM_TN = [M1, R1, R2, B1, R3, R4, M2, R5, R6]
// The leader placed Alex's Spanish review first and the stuck blog post second.
const TEAM_ORDER = [R2, R3, M1, R1, B1, R4, M2, R5, R6]
const PINNED = new Set([R2.id, R3.id])

/** Alex's list following the Writers team's order, with each step's place. */
export function myWorkOrderedSample(): { data: Worklist; teamOrder: TeamOrderView } {
  const tn = new Map(TEAM_TN.map((r, i) => [r.id, i + 1]))
  let above = 0
  const ranked = new Map<number, Pick<WorkRow, 'teamRank' | 'tnRank' | 'placedByHand' | 'placedAbove'>>()
  TEAM_ORDER.forEach((r, i) => {
    ranked.set(r.id, { teamRank: i + 1, tnRank: tn.get(r.id) ?? null, placedByHand: PINNED.has(r.id), placedAbove: above })
    if (PINNED.has(r.id)) above++
  })
  const rows = [...OPEN.map(r => ({ ...r, ...ranked.get(r.id) })), ...DONE]
  return {
    data: list(rows),
    teamOrder: {
      teamId: 'writers', teamName: 'Writers', placed: PINNED.size, levels: false,
      updatedAt: '2026-11-09T15:30:00Z', updatedBy: 'Chris Taylor', updatedBySelf: false, canEdit: false,
      choices: [{ id: 'writers', name: 'Writers' }],
    },
  }
}

/** The Team priority editor as Chris Taylor, the Writers' lead, sees it. */
export function teamPrioritySample(): { steps: EditorStep[]; saved: SavedOrder } {
  const steps = TEAM_TN.map(r => ({
    key: stepKey(r), itemName: r.itemName, language: r.language, parentItemName: r.parentItemName,
    boardName: r.boardName, boardId: r.boardId, workspaceName: r.workspaceName, stepName: r.stepName,
    who: r.who, priority: r.priority, dueDate: r.dueDate, dueSuspect: r.dueSuspect, url: r.url,
  }))
  return {
    steps,
    saved: { order: TEAM_ORDER.map(r => stepKey(r)), pinned: TEAM_ORDER.filter(r => PINNED.has(r.id)).map(r => stepKey(r)), levels: null },
  }
}

// ── My Team ────────────────────────────────────────────────────────────────

const WRITERS = '#86C06A'
const SOCIAL = '#DC2626'

const person = (id: string, name: string, title: string, teamName: string, color: string, roleType: string, active = true, href: string | null = null): RestrictedPerson => ({
  id, name, title, teamName, teamKey: 'writing', color, avatarUrl: null, roleType,
  status: active ? 'active' : 'inactive', href,
})

/** My Team as Chris Taylor, Lead of Writers, sees it: the people he leads open. */
export function myTeamSample(): { people: RestrictedPerson[]; teams: RestrictedTeam[]; selfId: string } {
  return {
    selfId: 'chris',
    people: [
      person('alex', 'Alex Rivera', 'Content Writer', 'Writers', WRITERS, 'user', true, '/manual'),
      person('ben', 'Ben Carter', 'Copy Editor', 'Writers', WRITERS, 'user', true, '/manual'),
      person('chris', 'Chris Taylor', 'Head of Content', 'Writers', WRITERS, 'team_leader', true, '/manual'),
      person('maria', 'Maria Gomez', 'Writer and Translator', 'Writers', WRITERS, 'user', true, '/manual'),
      person('priya', 'Priya Nair', 'Social Media Coordinator', 'Social Media', SOCIAL, 'user'),
      person('sam', 'Sam Patel', 'Content Writer', 'Writers', WRITERS, 'user', false, '/manual'),
    ],
    teams: [
      {
        id: 'writers', name: 'Writers', teamKey: 'writing', color: WRITERS,
        members: [
          { id: 'chris', name: 'Chris Taylor', title: 'Head of Content', avatarUrl: null, positionLabel: 'Lead' },
          { id: 'alex', name: 'Alex Rivera', title: 'Content Writer', avatarUrl: null, positionLabel: 'Member' },
          { id: 'ben', name: 'Ben Carter', title: 'Copy Editor', avatarUrl: null, positionLabel: 'Member' },
          { id: 'maria', name: 'Maria Gomez', title: 'Writer and Translator', avatarUrl: null, positionLabel: 'Member' },
        ],
        tools: [
          { label: 'Publishing Goals', audience: 'all' },
          { label: 'Client Reports', audience: 'lead' },
        ],
      },
      {
        id: 'social', name: 'Social Media', teamKey: 'other', color: SOCIAL,
        members: [
          { id: 'priya', name: 'Priya Nair', title: 'Social Media Coordinator', avatarUrl: null, positionLabel: 'Lead' },
          { id: 'chris', name: 'Chris Taylor', title: 'Head of Content', avatarUrl: null, positionLabel: 'Member' },
        ],
        tools: [],
      },
    ],
  }
}
