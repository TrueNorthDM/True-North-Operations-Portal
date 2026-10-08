/**
 * access/resolve.ts: what the signed-in person may reach, from the one access
 * rule (access/decide.ts, 7 October 2026).
 *
 *   loadAccess()       what to RENDER. In a View Stage preview, the previewed
 *                      level's answers (its first person alphabetically, with
 *                      their teams), so the preview shows that level honestly.
 *   loadRealAccess()   the person actually signed in, never a preview; null
 *                      answers while their two-step code is still owed.
 *   allowedTo(key)     the gate for a WRITE: the real person must be allowed,
 *                      and a preview may only take powers away, never add.
 *   requireSurface(k)  page guard: anyone without the item goes back Home.
 *
 * Keys are catalogue item keys (access/catalogue.ts). A few older keys still
 * used by pages are read as their new item (ALIAS).
 */

import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getRealPerson, getSessionUser } from '@/lib/auth/session'
import { getViewAs } from '@/lib/auth/view-as-server'
import { zoneDate } from '@/lib/notifications/schedule'
import { ALIAS, ITEM, TOOL_ITEMS, type AccessLevel } from './catalogue'
import { allowedKeys, type Decision, type Subject } from './decide'
import { loadRules, loadSubject, loadSubjects } from './store'

export interface Access {
  level: AccessLevel
  isSuperAdmin: boolean
  /** Super Admin or Admin. */
  isAdmin: boolean
  /** Lead of at least one team (what makes a Team Leader). */
  leadsAnyTeam: boolean
  personId: string | null
  /** Can this person open an item (see access/catalogue.ts for the keys)? */
  can: (key: string) => boolean
  /** Can this person open a tool (a tool's item key)? */
  canTool: (toolKey: string) => boolean
  /** Tool keys they can open, for filtering menus. */
  toolKeys: ReadonlySet<string>
}


const NOBODY: Subject = { level: 'user', teams: new Map(), exceptions: [] }

function accessFrom(subject: Subject, keys: ReadonlySet<string>, personId: string | null): Access {
  const can = (key: string) => keys.has(ALIAS[key] ?? key)
  const toolKeys = new Set(TOOL_ITEMS.map(t => t.key).filter(k => keys.has(k)))
  return {
    level: subject.level,
    isSuperAdmin: subject.level === 'super_admin',
    isAdmin: subject.level === 'super_admin' || subject.level === 'admin',
    leadsAnyTeam: [...subject.teams.values()].some(Boolean),
    personId,
    can,
    canTool: (key: string) => toolKeys.has(key),
    toolKeys,
  }
}

const today = () => zoneDate(new Date())

const loadRulesCached = cache(async () => loadRules(createAdminClient()))

/** The subject a View Stage preview shows: the first active person of that level. */
const previewSubject = cache(async (level: AccessLevel): Promise<{ subject: Subject; personId: string | null }> => {
  const people = await loadSubjects(createAdminClient())
  const p = people.find(x => x.level === level)
  return p ? { subject: p, personId: p.id } : { subject: { ...NOBODY, level }, personId: null }
})

export const loadRealAccess = cache(async function loadRealAccess(): Promise<Access> {
  const [user, me, rules] = await Promise.all([getSessionUser(), getRealPerson(), loadRulesCached()])
  if (!user) return accessFrom(NOBODY, new Set(), null)
  const subject = (me ? await loadSubject(createAdminClient(), me.id) : null) ?? NOBODY
  // The founding account keeps everything even before it is linked to a person.
  const founding = user.email?.toLowerCase() === 'arnaldo.oliveira@me.com'
  const s: Subject = founding ? { ...subject, level: 'super_admin' } : subject
  return accessFrom(s, allowedKeys(s, rules, { today: today() }), me?.id ?? null)
})

// Memoised per request: the layout resolves access to build the rail and each
// guarded page resolves it again.
export const loadAccess = cache(async function loadAccess(): Promise<Access> {
  const vs = await getViewAs()
  if (!vs) return loadRealAccess()
  const [rules, { subject, personId }] = await Promise.all([loadRulesCached(), previewSubject(vs.role)])
  return accessFrom(subject, allowedKeys(subject, rules, { today: today() }), personId)
})

/** Why the signed-in person can or cannot open an item (for the pages that explain themselves). */
export async function whyFor(key: string): Promise<Decision | null> {
  const [me, rules] = await Promise.all([getRealPerson(), loadRulesCached()])
  if (!me) return null
  const subject = await loadSubject(createAdminClient(), me.id)
  if (!subject) return null
  const { decide } = await import('./decide')
  return decide(subject, ALIAS[key] ?? key, rules, { today: today() })
}

/**
 * The gate for a write. The real person must be allowed; during a View Stage
 * preview the previewed level must be too (a preview only takes powers away).
 */
export async function allowedTo(key: string): Promise<boolean> {
  // A write is authorised against the Auth server, not the cached token, and
  // not before the second step of two-step sign-in was given this session.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return false
  const [real, vs] = await Promise.all([loadRealAccess(), getViewAs()])
  if (!real.can(key)) return false
  if (!vs) return true
  return (await loadAccess()).can(key)
}

/**
 * For a write that decides with several items at once (a person's page decides
 * by tab and by relation): the access of the person really signed in, after the
 * same checks allowedTo makes. Null while a View Stage preview is on, since a
 * preview never writes, or when the checks fail.
 */
export async function writerAccess(): Promise<Access | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return null
  if (await getViewAs()) return null
  return loadRealAccess()
}

/** Super Admin, really (the Access page, View Stage, the change log). */
export async function isSuperAdmin(): Promise<boolean> {
  return allowedTo('access-levels')
}

/**
 * Page guard: send anyone without the item back Home. Returns the resolved
 * access so the page can keep using it without loading it twice.
 */
export async function requireSurface(key: string): Promise<Access> {
  const access = await loadAccess()
  if (!access.can(key)) redirect('/')
  return access
}

/** Whether an item key exists in the catalogue (or as an older alias). */
export const knownKey = (key: string): boolean => ITEM.has(ALIAS[key] ?? key)
