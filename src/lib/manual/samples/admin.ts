/**
 * The System manual's Admin pictures (owner, 4 November 2026: the guides show
 * the real screens with made-up data): Company settings, Access levels,
 * Notification rules and Monday accounts. Everyone here is invented; the teams
 * are True North's. No token, key or secret appears: where a screen shows the
 * end of one, the characters are made up too. Seen by Chris Taylor, a Super
 * Admin, on Tue, Nov 10, 2026.
 */

import type { AccessPageData } from '@/components/access/AccessLevels'
import type { HrSettingsData } from '@/components/review/HrSettings'
import type { IntegrationsData } from '@/lib/timeclock/company-settings'
import type { LinkBoard } from '@/lib/monday/worklist/links'
import type { WorklistSources } from '@/lib/monday/worklist/sources'
import { allowedKeys, levelOf } from '@/lib/access/decide'
import { NO_RULES } from '@/lib/access/simulate'
import { NOTIFICATION_TYPES, defaultRule, type Rule } from '@/lib/notifications/catalogue'

const TODAY = '2026-11-10'
const TN = 'truenorthdigitalmarketing.com'

// ── People and teams ────────────────────────────────────────────────────────

const TEAMS = [
  { id: 't-graphics', name: 'Graphics', color: '#C026D3' },
  { id: 't-lead', name: 'Leadership', color: '#1E40AF' },
  { id: 't-seo', name: 'SEO', color: '#F4C24A' },
  { id: 't-social', name: 'Social Media', color: '#DC2626' },
  { id: 't-translation', name: 'Translation', color: '#14B8A6' },
  { id: 't-web', name: 'Web', color: '#A99BD4' },
  { id: 't-writers', name: 'Writers', color: '#86C06A' },
]

/** Who they are: the level given (Super Admin, Admin) or none, and their teams (true: Lead). */
const PEOPLE: { id: string; name: string; given: 'super_admin' | 'admin' | null; teams: [string, boolean][] }[] = [
  { id: 'p-chris', name: 'Chris Taylor', given: 'super_admin', teams: [['t-lead', true]] },
  { id: 'p-priya', name: 'Priya Nair', given: 'super_admin', teams: [['t-lead', true], ['t-translation', true]] },
  { id: 'p-maria', name: 'Maria Gomez', given: 'admin', teams: [['t-social', true]] },
  { id: 'p-alex', name: 'Alex Rivera', given: null, teams: [['t-writers', true]] },
  { id: 'p-jordan', name: 'Jordan Lee', given: null, teams: [['t-web', true], ['t-seo', false]] },
  { id: 'p-sam', name: 'Sam Patel', given: null, teams: [['t-seo', false]] },
  { id: 'p-ben', name: 'Ben Carter', given: null, teams: [['t-graphics', false], ['t-writers', false]] },
]

const nameOf = (id: string) => PEOPLE.find(p => p.id === id)?.name ?? 'Someone'

// ── Company settings ────────────────────────────────────────────────────────

/** Human Resources for the 2026 review: roles picked, one person with two reviewers, last year's files half imported. */
export function hrSettingsSample(): HrSettingsData {
  return {
    year: 2026,
    roles: { vpId: 'p-chris', cisoId: 'p-priya', hrId: 'p-maria' },
    people: PEOPLE.map(p => ({ value: p.id, label: p.name })),
    employees: 6,
    extra: [{ id: 'p-ben', name: 'Ben Carter' }],
    datesLine: 'The 2026 reviews have not started. The VP of Operations is reminded on the second Monday of November.',
    started: null,
    second: [{ personId: 'p-sam', name: 'Sam Patel', first: 'Chris Taylor', firstArea: 'SEO', reviewer: 'Jordan Lee', area: 'Writers', how: 'rule' }],
    drive: { name: 'Approved reviews', ready: true, why: null, account: `office@${TN}` },
    imports: [
      { id: 1, file: '2025.11 - Alex Rivera.docx', personId: 'p-alex', person: 'Alex Rivera', match: 'matched', imported: true, leftOn: null, found: { read: true, job: 4 }, goals: [{ id: 11, what: 'Lead the December editorial calendar', byMonth: '2026-12-01' }] },
      { id: 2, file: '2025.11 - Jordan Lee.pdf', personId: 'p-jordan', person: 'Jordan Lee', match: 'matched', imported: true, leftOn: null, found: { read: true, job: 3 }, goals: [] },
      { id: 3, file: '2025.11 - Sam Patel.docx', personId: 'p-sam', person: 'Sam Patel', match: 'matched', imported: false, leftOn: null, found: null, goals: [] },
      { id: 4, file: '2025.11 - B Carter.pdf', personId: 'p-ben', person: 'Ben Carter', match: 'check', imported: false, leftOn: null, found: null, goals: [] },
    ],
  }
}

/** Integrations as a Super Admin sees them: the team calendar on office@, Rippling not connected yet. */
export function integrationsSample(): IntegrationsData {
  return {
    rippling: {
      tokenSaved: false, tokenEnd: null,
      who: 'Not connected. Paste the company API token to connect it.',
      facts: [
        { k: 'Sends', v: 'Approved PTO, and approved employee hours by day' },
        { k: 'Reads', v: 'PTO balances (Vacation, Sick, Holiday)' },
        { k: 'Waiting to send', v: 'Nothing' },
      ],
      errors: [],
    },
    google: {
      connected: true, saved: false, viaOffice: true, account: `office@${TN}`, teamCalendarId: '',
      who: `office@${TN}, connected by Chris Taylor, Oct 30, 2026 in Agenda settings. Approved time off and team events go to its Google Calendar.`,
      facts: [
        { k: 'Last sync', v: 'Nov 10, 9:12 AM: 2 PTO events written today' },
        { k: 'Writes', v: 'Approved PTO ("Name: Time off") and events marked for the team calendar' },
      ],
      errors: [
        { id: 1, when: 'Nov 9, 4:05 PM', what: 'Calendar', text: 'Jordan Lee, Nov 12 to Nov 13: "The calendar did not answer in time."', failed: false, doneText: 'Sent Nov 9, 4:20 PM' },
      ],
    },
    googleApp: {
      saved: true, clientId: '000000000000-example.apps.googleusercontent.com', secretEnd: 'x1y2', pickerEnd: 'a9b8',
      who: 'Saved by Chris Taylor, Oct 29, 2026. People connect their Google accounts in Agenda settings.',
    },
    drive: {
      ready: true, why: null, folder: 'Docs from the Portal',
      who: `Writes into "Docs from the Portal" by Chris Taylor, Oct 31, 2026, through office@${TN}.`,
      rootIsDocs: true,
      copies: { from: 'Nov 1, 2026', counts: { done: 14, waiting: 1, failed: 0 }, failed: [], folderLink: null },
    },
  }
}

// ── Access levels ───────────────────────────────────────────────────────────

/** Access levels with the catalogue's starting ticks, two tool team lists, one exception and a short log. */
export function accessLevelsSample(tab: AccessPageData['initialTab'] = 'permissions', who: string | null = null): AccessPageData {
  const people = PEOPLE.map(p => ({
    id: p.id, name: p.name, avatarUrl: null, given: p.given,
    level: levelOf(p.given, p.teams.some(([, lead]) => lead)), teams: p.teams,
    exceptions: p.id === 'p-sam' ? [{ key: 'report', effect: 'grant' as const, until: '2026-11-30' }] : [],
  }))
  return {
    today: TODAY, meId: 'p-chris', initialTab: tab, initialWho: who,
    rules: {
      levels: [],
      tools: [
        ['href-links', { every: false, teams: [['t-seo', 'team'], ['t-writers', 'lead']] }],
        ['publishing', { every: true, teams: [] }],
        ['i7-budget', { every: false, teams: [['t-lead', 'lead']] }],
      ],
    },
    people,
    teams: TEAMS,
    exceptions: [
      { id: 'e1', personId: 'p-sam', person: 'Sam Patel', key: 'report', effect: 'grant', until: '2026-11-30', reason: 'Covering the weekly report while Jordan is out.', by: 'Chris Taylor', at: '2026-11-09T14:20:00Z' },
    ],
    log: [
      { id: 3, at: '2026-11-09T14:20:00Z', actor: 'Chris Taylor', kind: 'exception', summary: 'Sam Patel: Report until Nov 30', reason: 'Covering the weekly report while Jordan is out.', changes: [{ kind: 'exception-add', person: 'Sam Patel', label: 'Report', effect: 'grant', until: '2026-11-30' }], impact: [{ person: 'Sam Patel', gained: ['report'], lost: [] }], undoes: null, undoneBy: null },
      { id: 2, at: '2026-11-06T18:05:00Z', actor: 'Priya Nair', kind: 'tool-teams', summary: 'Teams for Href Links', reason: "Writers' Leads check the published links of their own articles.", changes: [{ kind: 'tool', key: 'href-links', label: 'Href Links', before: { every: false, teams: { 't-seo': 'team' } }, after: { every: false, teams: { 't-seo': 'team', 't-writers': 'lead' } } }], impact: [{ person: 'Alex Rivera', gained: ['href-links'], lost: [] }], undoes: null, undoneBy: null },
      { id: 1, at: '2026-11-03T13:40:00Z', actor: 'Chris Taylor', kind: 'rules', summary: 'Team Leader: Workload on', reason: 'Team Leaders plan the week with it.', changes: [{ kind: 'rule', level: 'team_leader', key: 'report-workload', label: 'Workload', before: null, beforeEffective: false, after: true }], impact: [{ person: 'Alex Rivera', gained: ['report-workload'], lost: [] }, { person: 'Jordan Lee', gained: ['report-workload'], lost: [] }], undoes: null, undoneBy: null },
    ],
    priority: {
      data: {
        grantsAvailable: true,
        teams: TEAMS.map(t => ({ id: t.id, name: t.name })),
        memberships: Object.fromEntries(people.map(p => [p.id, p.teams.map(([teamId, lead]) => ({ teamId, teamName: TEAMS.find(t => t.id === teamId)!.name, isPrimary: false, position: lead ? 'team_leader' : 'collaborator' }))])),
        grants: [],
      },
      people: people.map(p => {
        const open = allowedKeys({ level: p.level, teams: new Map(p.teams) }, NO_RULES, { today: TODAY })
        return { id: p.id, name: p.name, avatarUrl: null, level: p.level, isSuperAdmin: p.level === 'super_admin', own: open.has('priority-own'), all: open.has('priority-all') }
      }),
    },
  }
}

// ── Notification rules ──────────────────────────────────────────────────────

/** Every notification at its starting rule, with one fixed on purpose, and invented "turned off" counts. */
export function notificationRulesSample(): { rules: Record<string, Rule>; offCounts: Record<string, { off: number; reach: number }> } {
  const LOCKS: Record<string, Partial<Rule>> = { 'step-assigned': { fixEnabled: true } }
  const OFF = [1, 3, 0, 2, 0, 1, 4, 0, 2, 0, 1, 0, 3]
  return {
    rules: Object.fromEntries(NOTIFICATION_TYPES.map(t => [t.key, { ...defaultRule(t), ...LOCKS[t.key] }])),
    offCounts: Object.fromEntries(NOTIFICATION_TYPES.map((t, i) => [t.key, { off: OFF[i % OFF.length], reach: t.audience.kind === 'everyone' ? 31 : 8 }])),
  }
}

// ── Monday ──────────────────────────────────────────────────────────────────

/** Monday accounts: one owned by nobody, two waiting (one with a suggestion), one outside, two linked. */
export function mondayLinksSample(): { board: LinkBoard; people: { value: string; label: string }[] } {
  return {
    board: {
      onWorkUnresolved: [
        { mondayUserId: 501, name: 'Design Freelancer', email: null, assignments: 46, known: true },
      ],
      pending: [
        { mondayUserId: 502, name: 'Sam Patel', email: `sam.patel@${TN}`, enabled: true, isGuest: false, isExternal: false, assignments: 128, suggestion: { personId: 'p-sam', personName: 'Sam Patel', why: 'first and last name match' } },
        { mondayUserId: 503, name: 'Content Desk', email: `content@${TN}`, enabled: true, isGuest: false, isExternal: false, assignments: 12, suggestion: null },
      ],
      external: [
        { mondayUserId: 504, name: 'Client Reviewer', email: 'reviewer@sampleclient.org', enabled: true, isGuest: true, isExternal: true, assignments: 9, suggestion: null },
      ],
      linked: [
        { mondayUserId: 505, name: 'Alex Rivera', personId: 'p-alex', personName: 'Alex Rivera', linkedBy: 'email', assignments: 312 },
        { mondayUserId: 506, name: 'J. Lee', personId: 'p-jordan', personName: 'Jordan Lee', linkedBy: 'manual', assignments: 204 },
      ],
    },
    people: PEOPLE.map(p => ({ value: p.id, label: nameOf(p.id) })),
  }
}

/** My Work sources: two workspaces, one quiet for years, and the activity rule on. */
export function worklistSourcesSample(): WorklistSources {
  return {
    workspaces: [
      { name: 'Client Delivery', included: 3, assignments: 1840, lastActivityAt: '2026-11-10T13:00:00Z', boards: [
        { id: 1, name: 'Sample Client Articles', included: true, priority: 'high', isSubitemBoard: false, assignments: 920, lastActivityAt: '2026-11-10T13:00:00Z' },
        { id: 2, name: 'Sample Client Translations', included: true, priority: 'medium', isSubitemBoard: false, assignments: 610, lastActivityAt: '2026-11-09T16:00:00Z' },
        { id: 3, name: 'Web Requests', included: true, priority: 'medium', isSubitemBoard: false, assignments: 310, lastActivityAt: '2026-11-06T12:00:00Z' },
      ] },
      { name: 'Old Experiments', included: 0, assignments: 74, lastActivityAt: '2023-05-02T12:00:00Z', boards: [
        { id: 4, name: 'Test board', included: false, priority: 'low', isSubitemBoard: false, assignments: 74, lastActivityAt: '2023-05-02T12:00:00Z' },
      ] },
    ],
    users: [],
    stale: { on: true, wouldHide: 0, wouldShow: 0 },
  }
}
