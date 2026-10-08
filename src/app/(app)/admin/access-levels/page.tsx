// Admin > Access levels (7 October 2026): who can open what, in one place.
// Super Admin only. Five tabs: Permissions (every module, page, tool, tab and
// action, ticked per level, with each tool's team list), People and levels,
// Check a person, Exceptions, and the Change log. The rule behind every tick is
// lib/access/decide.ts; the design is docs/access/01-design.md.

import { Breadcrumb, adminCrumb } from '@/components/ui/Breadcrumb'
import { AccessLevels, type AccessPageData } from '@/components/access/AccessLevels'
import { requireSurface } from '@/lib/access/resolve'
import { getRealPerson } from '@/lib/auth/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { allowedKeys } from '@/lib/access/decide'
import { loadRules, loadSubjects } from '@/lib/access/store'
import { zoneDate } from '@/lib/notifications/schedule'
import { loadPriorityGrants } from '@/lib/monday/worklist/team-priority-data'
import type { Membership } from '@/lib/monday/worklist/team-priority'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Access levels' }

type Tab = AccessPageData['initialTab']
const TABS: readonly Tab[] = ['permissions', 'people', 'why', 'exceptions', 'log']

export default async function AccessLevelsPage({ searchParams }: { searchParams: Promise<{ tab?: string; who?: string }> }) {
  const access = await requireSurface('access-levels')
  const { tab, who } = await searchParams
  const db = createAdminClient()
  const today = zoneDate(new Date())

  const [rules, subjects, me, { data: teamRows }, { data: memberRows }, { data: peopleRows }, { data: excRows }, { data: logRows }, grants] = await Promise.all([
    loadRules(db),
    loadSubjects(db),
    getRealPerson(),
    db.from('teams').select('id, name, color').order('name'),
    db.from('team_members').select('team_id, person_id, position'),
    db.from('people').select('id, full_name, avatar_url').or('status.is.null,status.eq.active'),
    // The ones still in force: an exception past its date applies to nobody
    // (decide.ts), so it is not listed or counted as active either.
    db.from('access_exceptions').select('id, person_id, item_key, effect, until, reason, created_by, created_at').is('ended_at', null).or(`until.is.null,until.gte.${today}`).order('created_at', { ascending: false }),
    db.from('access_changes').select('id, at, actor_id, kind, summary, reason, changes, impact, undoes, undone_by').order('at', { ascending: false }).limit(200),
    loadPriorityGrants(db),
  ])

  const nameOf = new Map(((peopleRows ?? []) as { id: string; full_name: string }[]).map(p => [p.id, p.full_name]))
  const avatarOf = new Map(((peopleRows ?? []) as { id: string; avatar_url: string | null }[]).map(p => [p.id, p.avatar_url]))
  // Names of whoever acted, active or not.
  const actorIds = [...new Set([
    ...((logRows ?? []) as { actor_id: string | null }[]).map(r => r.actor_id),
    ...((excRows ?? []) as { created_by: string | null }[]).map(r => r.created_by),
  ].filter((x): x is string => !!x && !nameOf.has(x)))]
  if (actorIds.length) {
    const { data } = await db.from('people').select('id, full_name').in('id', actorIds)
    for (const p of (data ?? []) as { id: string; full_name: string }[]) nameOf.set(p.id, p.full_name)
  }

  const teams = ((teamRows ?? []) as { id: string; name: string; color: string | null }[])
  const teamName = new Map(teams.map(t => [t.id, t.name]))
  const memberships: Record<string, Membership[]> = {}
  for (const m of (memberRows ?? []) as { team_id: string; person_id: string; position: string | null }[]) {
    ;(memberships[m.person_id] ??= []).push({ teamId: m.team_id, teamName: teamName.get(m.team_id) ?? 'Team', isPrimary: false, position: m.position })
  }

  const data: AccessPageData = {
    today,
    meId: me?.id ?? null,
    initialTab: TABS.includes(tab as Tab) ? (tab as Tab) : 'permissions',
    initialWho: who ?? null,
    rules: {
      levels: [...rules.levels],
      tools: [...rules.tools].map(([k, s]) => [k, { every: s.every, teams: [...s.teams] }]),
    },
    people: subjects.map(s => ({
      id: s.id, name: s.name, avatarUrl: avatarOf.get(s.id) ?? null, level: s.level, given: s.given,
      teams: [...s.teams], exceptions: [...(s.exceptions ?? [])],
    })),
    teams: teams.map(t => ({ id: t.id, name: t.name, color: t.color })),
    exceptions: ((excRows ?? []) as { id: string; person_id: string; item_key: string; effect: 'grant' | 'deny'; until: string | null; reason: string; created_by: string | null; created_at: string }[])
      .map(e => ({ id: e.id, personId: e.person_id, person: nameOf.get(e.person_id) ?? 'Someone', key: e.item_key, effect: e.effect, until: e.until, reason: e.reason, by: e.created_by ? nameOf.get(e.created_by) ?? null : null, at: e.created_at })),
    log: ((logRows ?? []) as { id: number; at: string; actor_id: string | null; kind: string; summary: string; reason: string; changes: unknown; impact: unknown; undoes: number | null; undone_by: number | null }[])
      .map(r => ({ id: r.id, at: r.at, actor: r.actor_id ? nameOf.get(r.actor_id) ?? 'Someone' : 'The portal', kind: r.kind, summary: r.summary, reason: r.reason, changes: r.changes, impact: r.impact, undoes: r.undoes, undoneBy: r.undone_by })),
    priority: {
      data: { grantsAvailable: grants.available, teams: teams.map(t => ({ id: t.id, name: t.name })), memberships, grants: grants.grants },
      people: subjects.map(s => {
        const open = allowedKeys(s, rules, { today })
        return { id: s.id, name: s.name, avatarUrl: avatarOf.get(s.id) ?? null, level: s.level, isSuperAdmin: s.level === 'super_admin', own: open.has('priority-own'), all: open.has('priority-all') }
      }),
    },
  }

  return (
    <div className="space-y-5">
      <div>
        <Breadcrumb parents={[adminCrumb(access.can('admin'))]} now="Access levels" />
        <h1 className="font-(family-name:--font-display) font-extrabold text-[27px] tracking-tight text-tn-ink m-0">Access levels</h1>
        <p className="mt-1.5 text-muted leading-relaxed m-0">
          Who can open what, in one place. Four levels, one list of every module, page, tool, tab and action, and for tools, which teams may use them. Only Super Admins see this page.
        </p>
      </div>
      <AccessLevels data={data} />
    </div>
  )
}
