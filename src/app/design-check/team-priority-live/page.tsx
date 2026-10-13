// Design check: team priority as built, the real components on sample rows.
//
// /design-check/team-priority holds the mockups that were approved; this page
// renders what was built from them, so the two can be put side by side.
// ?screen=editor (the default) is a team leader's editor, ?screen=leader the
// leader's own list, ?screen=member a team member's list. ?levels=1 opens the
// editor with a workspace and board order already saved. Development only, and
// nothing here is saved.

import { notFound } from 'next/navigation'
import { WorkList } from '@/components/monday/WorkList'
import { TeamPriorityEditor } from '@/components/monday/TeamPriorityEditor'
import type { WorkRow, Worklist } from '@/lib/monday/worklist/data'
import { moveTo, pinsFor, stepKey, type TeamOrderView } from '@/lib/monday/worklist/team-priority'
import { rankTeam, withTeamRanks } from '@/lib/monday/worklist/team-priority-data'

export const dynamic = 'force-dynamic'

const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

const PEOPLE: Record<string, number> = { 'Jeannette Owens': 11, 'Stephanie Aguirre': 12, 'Kathleen Aguilar': 13, 'Kevin Ames': 14, 'Arnaldo Oliveira': 15 }

/** Each board its own id and workspace, so the Workspace and Board levels have something to order. */
const BOARDS: Record<string, [number, string]> = {
  'BM - General Audits': [101, 'i7 Projects'],
  'AAAF - Publishing': [201, 'AAAF'],
  'AAAF - Photo Curation Audits': [202, 'AAAF'],
  'AAAF - SEO & Writing': [203, 'AAAF'],
  'WM - Schema Audits': [301, 'Wagner Meters'],
  'WM - Content Audits': [302, 'Wagner Meters'],
  "SOP's for the SEO's": [401, 'Operations'],
  'Graphics Requests - All Projects': [501, 'Graphics'],
}

let id = 0
const row = (o: Partial<WorkRow> & { who: string }): WorkRow => {
  id++
  const [boardId, workspaceName] = BOARDS[o.boardName ?? 'BM - General Audits']
  return {
    id, boardId, boardName: 'BM - General Audits', workspaceName, itemId: 5000 + id,
    itemName: 'Item', parentItemName: null, language: null, groupTitle: null, stepName: 'Audit',
    statusText: 'Working on it', statusDone: false, statusColor: '#FDAB3D', dueDate: null, dueSuspect: false,
    dueLabel: 'Audit By', url: 'https://truenorthdigitalmarketing.monday.com/boards/1/pulses/1',
    assigneeKnown: true, priority: 'medium', mondayUserId: PEOPLE[o.who] ?? 99, itemUpdatedAt: null,
    peopleCol: 'person', ...o,
  }
}

const TEAM: WorkRow[] = [
  row({ itemName: 'B82: best moisture meter for water restoration', stepName: 'SEO Review', who: 'Jeannette Owens', priority: 'high', dueDate: day(-18), statusText: 'Stuck', statusColor: '#E2445C' }),
  row({ itemName: 'Lead Magnet - How to Use Bessemeter Pro', who: 'Stephanie Aguirre', priority: 'high', dueDate: day(9), statusText: "Hasn't Started Yet", statusColor: '#C4C4C4' }),
  row({ itemName: '128 - How do Adventists view the concept of the end of the world?', language: 'English', boardName: 'AAAF - Publishing', stepName: 'Href Link', who: 'Arnaldo Oliveira', priority: 'high', dueDate: day(-9), statusText: 'Stuck', statusColor: '#E2445C' }),
  row({ itemName: 'PP09/21 - Was Ellen White a prophet', language: 'Spanish', boardName: 'AAAF - Publishing', stepName: 'Href Link', who: 'Arnaldo Oliveira', priority: 'high', dueDate: day(-2), statusText: 'Stuck', statusColor: '#E2445C' }),
  row({ itemName: 'Wagner Meters Wood Flooring Newsletter', boardName: 'WM - Schema Audits', who: 'Jeannette Owens', dueDate: day(-4), statusText: 'Stuck', statusColor: '#E2445C' }),
  row({ itemName: 'How Do Adventists Do Baby Dedications?', boardName: 'AAAF - Photo Curation Audits', stepName: 'Photo Curation Audit', who: 'Stephanie Aguirre', dueDate: day(1) }),
  row({ itemName: "Moisture meter buyer's guide", boardName: 'WM - Content Audits', stepName: 'Full-page Audit', who: 'Kathleen Aguilar', dueDate: day(6) }),
  row({ itemName: '02 - Good Vs. Evil (Salvation)', boardName: 'AAAF - SEO & Writing', stepName: 'Brief Draft SEO', who: 'Stephanie Aguirre', dueDate: day(14), statusText: "Hasn't Started Yet", statusColor: '#C4C4C4' }),
  row({ itemName: 'Monthly Reporting Steps - adventist.org', boardName: "SOP's for the SEO's", stepName: 'Status', who: 'Jeannette Owens', priority: 'low', dueDate: day(2) }),
  row({ itemName: 'Fundamental Beliefs infographic', boardName: 'Graphics Requests - All Projects', stepName: 'Finalization', who: 'Kathleen Aguilar', priority: 'low', dueDate: day(23), statusText: "Hasn't Started Yet", statusColor: '#C4C4C4' }),
  row({ itemName: 'Keyword map for the moisture meter hub', boardName: 'WM - Content Audits', stepName: 'Keyword research', who: 'Kevin Ames', dueDate: day(11) }),
  row({ itemName: 'Schema for product pages', boardName: 'WM - Schema Audits', who: 'Kevin Ames', priority: 'low', dueDate: day(30) }),
]
/** Arrived after the order was saved: shown as new. */
const NEW = row({ itemName: '137 - How does the Holy Spirit work?', language: 'English', boardName: 'AAAF - Publishing', stepName: 'On-Page SEO', who: 'Stephanie Aguirre', priority: 'high', dueDate: day(14), statusText: "Hasn't Started Yet", statusColor: '#C4C4C4' })
const OPEN = [...TEAM, NEW]

/**
 * The saved order: the lead magnet and the baby dedication pulled up, the late
 * SEO review pushed down. With levels, Wagner Meters first and its schema
 * audits before its content audits.
 */
function savedOrder(withLevels: boolean) {
  const levels = withLevels ? { workspaces: ['Wagner Meters'], boards: [301] } : null
  const { open } = rankTeam(TEAM, levels ? { order: [], pinned: [], levels } : null)
  const keys = open.map(stepKey)
  const lead = stepKey(TEAM[1]), baby = stepKey(TEAM[5]), review = stepKey(TEAM[0])
  let list = moveTo(keys, lead, 0)
  let pins = pinsFor(list, keys, { moved: lead })
  list = moveTo(list, baby, 1)
  pins = pinsFor(list, keys, { keep: pins, moved: baby })
  list = moveTo(list, review, 5)
  pins = pinsFor(list, keys, { keep: pins, moved: review })
  return { order: list, pinned: pins, levels }
}

export default async function TeamPriorityLive(
  { searchParams }: { searchParams: Promise<{ screen?: string; levels?: string }> },
) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { screen = 'editor', levels } = await searchParams
  const saved = savedOrder(levels === '1')
  const savedAt = hoursAgo(2)
  const { open, ranking, trueNorth } = rankTeam(OPEN, saved)

  const listFor = (who: string | null): Worklist => {
    const done = row({ itemName: 'Content audit: flooring glossary', who: who ?? 'Jeannette Owens', statusText: 'Done', statusColor: '#00C875', statusDone: true, dueDate: day(-30) })
    const mine = OPEN.filter(r => !who || r.who === who)
    const rows = withTeamRanks([...mine, done], ranking, trueNorth)
    return { rows, open: mine.length, total: rows.length, unlinked: 0, unlinkedAssignments: 0, truncated: false, matching: rows.length, oldestSyncAt: hoursAgo(2) }
  }
  const order = (o: Partial<TeamOrderView>): TeamOrderView => ({
    teamId: 'seo', teamName: 'SEO', placed: ranking.pinned.size, levels: !!saved.levels, updatedAt: savedAt, updatedBy: 'Jeannette Owens',
    updatedBySelf: false, canEdit: false, choices: [], ...o,
  })

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-[1320px] mx-auto space-y-6">
        <div className="pb-[18px] border-b border-[var(--panel-border)]">
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal m-0">Design check · as built</p>
          <h2 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">
            {screen === 'editor' ? 'Team priority: the editor' : screen === 'leader' ? "Team priority: the leader's own list" : "Team priority: a member's list"}
          </h2>
        </div>

        {screen === 'editor' && (
          <TeamPriorityEditor
            team={{ id: 'seo', name: 'SEO' }}
            teams={[{ value: 'seo', label: 'SEO' }, { value: 'graphics', label: 'Graphics' }]}
            steps={open.map(r => ({
              key: stepKey(r), itemName: r.itemName, language: r.language, parentItemName: r.parentItemName,
              boardName: r.boardName, boardId: r.boardId, workspaceName: r.workspaceName, stepName: r.stepName, who: r.who, priority: r.priority,
              dueDate: r.dueDate, dueSuspect: r.dueSuspect, url: r.url,
            }))}
            saved={saved}
            savedAt={savedAt}
            savedBy="Jeannette Owens"
            savedBySelf
            preview
            stickyTop={0}
          />
        )}

        {screen === 'leader' && (
          <WorkList
            data={listFor('Jeannette Owens')}
            people={[]}
            teams={[]}
            selfPersonId="jeannette"
            preview={{}}
            stickyTop={0}
            teamOrder={order({ updatedBySelf: true, canEdit: true })}
            canSetPriority
          />
        )}

        {screen === 'member' && (
          <WorkList
            data={listFor('Stephanie Aguirre')}
            people={[]}
            teams={[]}
            selfPersonId="stephanie"
            preview={{}}
            stickyTop={0}
            teamOrder={order({ choices: [{ id: 'graphics', name: 'Graphics' }, { id: 'seo', name: 'SEO' }] })}
          />
        )}
      </div>
    </div>
  )
}
