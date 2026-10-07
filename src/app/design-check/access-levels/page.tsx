// Design check: Admin > Access levels (7 October 2026), the real component with
// invented people and teams and the catalogue's starting answers. Nothing is
// saved (the actions refuse: no Super Admin is signed in). ?tab=permissions |
// people | why | exceptions | log. Development only.

import { notFound } from 'next/navigation'
import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { AccessLevels, type AccessPageData } from '@/components/access/AccessLevels'
import { allowedKeys, levelOf } from '@/lib/access/decide'
import { NO_RULES } from '@/lib/access/simulate'

export const dynamic = 'force-dynamic'

const TEAMS = [
  { id: 't-seo', name: 'SEO', color: '#e8b70a' },
  { id: 't-writers', name: 'Writers', color: '#1E9E6A' },
  { id: 't-design', name: 'Design', color: '#b43fc4' },
  { id: 't-lead', name: 'Leadership', color: '#2a44b8' },
  { id: 't-ops', name: 'Operations', color: '#8a3b12' },
]
const PEOPLE: { name: string; given: 'super_admin' | 'admin' | null; teams: [string, boolean][] }[] = [
  { name: 'Alex Morgan', given: 'super_admin', teams: [['t-lead', true], ['t-ops', true]] },
  { name: 'Blake Rivera', given: 'super_admin', teams: [['t-lead', true]] },
  { name: 'Casey Park', given: 'admin', teams: [['t-ops', false]] },
  { name: 'Drew Santos', given: 'admin', teams: [['t-seo', true]] },
  { name: 'Emery Lane', given: null, teams: [['t-writers', true]] },
  { name: 'Finley Cho', given: null, teams: [['t-design', true], ['t-seo', false]] },
  { name: 'Gray Okafor', given: null, teams: [['t-writers', false]] },
  { name: 'Harper Quinn', given: null, teams: [['t-seo', false]] },
  { name: 'Indy Nakamura', given: null, teams: [['t-design', false], ['t-writers', false]] },
]

export default async function AccessLevelsCheck({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound()
  const { tab } = await searchParams
  const today = '2026-10-07'
  const rules = {
    levels: [] as [string, boolean][],
    tools: [
      ['href-links', { every: false, teams: [['t-seo', 'team'], ['t-lead', 'lead']] }],
      ['publishing', { every: true, teams: [] }],
      ['i7-budget', { every: false, teams: TEAMS.map(t => [t.id, 'lead']) }],
      ['grant-pass-report', { every: false, teams: [['t-lead', 'lead']] }],
    ] as AccessPageData['rules']['tools'],
  }
  const people = PEOPLE.map((p, i) => ({
    id: `p${i}`, name: p.name, avatarUrl: null, given: p.given,
    level: levelOf(p.given, p.teams.some(([, l]) => l)), teams: p.teams,
    exceptions: i === 6 ? [{ key: 'report', effect: 'grant' as const, until: '2026-10-31' }] : [],
  }))
  const data: AccessPageData = {
    today, meId: 'p0',
    initialTab: (['permissions', 'people', 'why', 'exceptions', 'log'].includes(tab ?? '') ? tab : 'permissions') as AccessPageData['initialTab'],
    initialWho: null,
    rules,
    people,
    teams: TEAMS,
    exceptions: [{ id: 'e1', personId: 'p6', person: 'Gray Okafor', key: 'report', effect: 'grant', until: '2026-10-31', reason: 'Covering the weekly report while Emery is away.', by: 'Alex Morgan', at: '2026-10-07T14:20:00Z' }],
    log: [
      { id: 3, at: '2026-10-07T18:20:00Z', actor: 'Alex Morgan', kind: 'rules', summary: 'Team Leader: Workload on', reason: 'Team Leaders plan the week with it.', changes: [{ kind: 'rule', level: 'team_leader', key: 'report-workload', label: 'Workload', before: null, beforeEffective: false, after: true }], impact: [{ person: 'Emery Lane', gained: ['report-workload'], lost: [] }], undoes: null, undoneBy: null },
      { id: 2, at: '2026-10-06T20:05:00Z', actor: 'Blake Rivera', kind: 'tool-teams', summary: 'Teams for Href Links', reason: "Writers' Leads check the published links of their own articles.", changes: [{ kind: 'tool', key: 'href-links', label: 'Href Links', before: { every: false, teams: { 't-seo': 'team' } }, after: { every: false, teams: { 't-seo': 'team', 't-writers': 'lead' } } }], impact: [{ person: 'Emery Lane', gained: ['href-links'], lost: [] }], undoes: null, undoneBy: null },
      { id: 1, at: '2026-10-05T13:40:00Z', actor: 'The portal', kind: 'level', summary: 'The new access model', reason: "Owner's decision: four levels, one list of every page, tab and action, and team lists per tool.", changes: {}, impact: null, undoes: null, undoneBy: null },
    ],
    priority: {
      data: { grantsAvailable: true, teams: TEAMS.map(t => ({ id: t.id, name: t.name })), memberships: Object.fromEntries(people.map(p => [p.id, p.teams.map(([teamId, lead]) => ({ teamId, teamName: TEAMS.find(t => t.id === teamId)!.name, isPrimary: false, position: lead ? 'lead' : 'member' }))])), grants: [] },
      people: people.map(p => {
        const open = allowedKeys({ level: p.level, teams: new Map(p.teams) }, NO_RULES, { today })
        return { id: p.id, name: p.name, avatarUrl: null, level: p.level, isSuperAdmin: p.level === 'super_admin', own: open.has('priority-own'), all: open.has('priority-all') }
      }),
    },
  }
  return (
    <div className="min-h-screen bg-background p-8 space-y-5">
      <div>
        <Breadcrumb parents={['/admin']} now="Access levels" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Access levels</h1>
        <p className="mt-1.5 text-muted leading-relaxed m-0">Who can open what, in one place. Four levels, one list of every module, page, tool, tab and action, and for tools, which teams may use them. Only Super Admins see this page.</p>
      </div>
      <AccessLevels data={data} />
    </div>
  )
}
