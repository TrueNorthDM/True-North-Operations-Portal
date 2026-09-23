/**
 * The notification catalogue: every notification the portal knows about, in
 * the blocks of the Notification settings page.
 *
 * Decided on 22 September 2026. The list is built in full as far as the portal
 * allows; anything it cannot do yet stays in the list, faded, with the reason,
 * so the list is the plan as well as the settings. When a faded one becomes
 * possible, it is switched on here and the user is told (standing rule).
 *
 * Each notification has three settings: on or off, when (as it happens or in
 * the daily summary) and where (in the portal, by email, or both). An admin
 * sets the rule for everyone: a default for each setting, and whether people
 * may change it or it is fixed. A person changes what the rule leaves open.
 * Email delivery is not built yet, so "where" is a placeholder for now.
 *
 * Pure module: the settings page, the drawers and the generators read it.
 */

import type { NavIconKey } from '@/lib/nav/nav-icons'

export type NotificationTab = 'tools' | 'system' | 'chat' | 'email'
export type BlockKey = NotificationTab
export type Timing = 'instant' | 'daily'
export type Channel = 'app' | 'email' | 'both'

/** Where a notification can go. Email waits for email delivery to be built. */
export const CHANNELS: readonly { key: Channel; label: string; available: boolean }[] = [
  { key: 'app', label: 'In app', available: true },
  { key: 'email', label: 'Email', available: false },
  { key: 'both', label: 'Both', available: false },
]
export const EMAIL_BLOCKED = 'Email delivery is not built yet. For now everything arrives in the portal.'

/** Who a notification can go to. The settings page shows a person only the ones that can reach them. */
export type Audience =
  | { kind: 'everyone' }
  | { kind: 'admins' }
  | { kind: 'leaders' }
  | { kind: 'tool'; tool: string }

export interface NotificationType {
  key: string
  block: BlockKey
  title: string
  description: string
  /** "You", "Your team", "Admins": who receives it, in the words the page uses. */
  who: string
  audience: Audience
  /** The small uppercase origin line in the drawer: "My Work", "Monday sync". */
  src: string
  icon: NavIconKey
  defaultTiming: Timing
  /** False while the portal cannot produce it yet: listed, faded, with `blockedBy`. */
  available: boolean
  blockedBy?: string
  /** Where the admin rule starts, when it differs from "on, default timing, in app, people may change all three". */
  rule?: Partial<Rule>
}

/** The admin's rule for one notification, for everyone it reaches. */
export interface Rule {
  enabled: boolean
  timing: Timing
  channel: Channel
  /** Fixed: people see the admin's value, locked, and cannot change it. */
  fixEnabled: boolean
  fixTiming: boolean
  fixChannel: boolean
}

/** A person's own choices. A missing field follows the rule's default. */
export interface Pref {
  enabled?: boolean
  timing?: Timing
  channel?: Channel
}

export const BLOCKS: readonly { key: BlockKey; title: string; drawer: string; description: string; available: boolean; blockedBy?: string }[] = [
  { key: 'tools', title: 'Tools', drawer: 'Notifications', description: 'Your work, and the dashboards and reports you can reach.', available: true },
  { key: 'system', title: 'System', drawer: 'Notifications', description: 'The portal itself: integrations, syncs and access.', available: true },
  { key: 'chat', title: 'Chat', drawer: 'Messages', description: 'Channels and direct messages.', available: false, blockedBy: 'Arrives with Chat, which is not built yet.' },
  { key: 'email', title: 'Email', drawer: 'Messages', description: 'The mailboxes you hold.', available: false, blockedBy: 'Arrives with Emails, which is not built yet.' },
]

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  // ── Tools ────────────────────────────────────────────────────────────────
  {
    key: 'step-assigned', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'instant', available: true,
    title: 'A new step was assigned to you',
    description: 'A step in Monday is yours now. Several at once arrive as one notification.',
    who: 'You', audience: { kind: 'everyone' },
  },
  {
    key: 'step-due-tomorrow', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'daily', available: true,
    title: 'A step of yours is due tomorrow',
    description: 'Open steps whose deadline is tomorrow.',
    who: 'You', audience: { kind: 'everyone' },
  },
  {
    key: 'step-late', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'daily', available: true,
    title: 'A step of yours became late',
    description: 'An open step passed its deadline.',
    who: 'You', audience: { kind: 'everyone' },
  },
  {
    key: 'team-order-changed', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'daily', available: true,
    title: "Your team's priority order changed",
    description: "A team leader saved a new order for your team's steps.",
    who: 'Your team', audience: { kind: 'everyone' },
  },
  {
    key: 'step-released', src: 'My Work', block: 'tools', icon: 'my-work', defaultTiming: 'instant', available: false,
    title: 'A step waiting on you was released',
    description: 'The step before yours was finished, so yours can start.',
    who: 'You', audience: { kind: 'everyone' },
    blockedBy: 'Needs "waiting on the previous step" in My Work, which is not built yet.',
  },
  {
    key: 'publishing-behind', src: 'Publishing Goals', block: 'tools', icon: 'publishing-goals', defaultTiming: 'daily', available: true,
    title: 'Publishing Goals behind pace',
    description: "A client's week is behind its publishing target for the days that have gone.",
    who: 'Who can open Publishing Goals', audience: { kind: 'tool', tool: 'publishing' },
  },
  {
    key: 'i7-budget', src: 'i7 report', block: 'tools', icon: 'client-reports', defaultTiming: 'daily', available: true,
    title: 'i7 budget crossed 75% or 90%',
    description: "This month's i7 budget passed three quarters, then nine tenths.",
    who: 'Who can open the i7 report', audience: { kind: 'tool', tool: 'i7-budget' },
  },
  {
    key: 'team-late-pile', src: 'My Team', block: 'tools', icon: 'my-team', defaultTiming: 'daily', available: true,
    title: 'Late steps piling up on your team',
    description: 'People on a team you lead with 5 or more late steps. Once a week, one notification per team.',
    who: 'Team leaders', audience: { kind: 'leaders' },
  },

  // ── System ───────────────────────────────────────────────────────────────
  {
    key: 'integration-failed', src: 'Integrations', block: 'system', icon: 'automations', defaultTiming: 'instant', available: true, rule: { fixEnabled: true },
    title: 'An integration failed',
    description: 'Monday, its webhooks or QuickBooks Time stopped answering.',
    who: 'Admins', audience: { kind: 'admins' },
  },
  {
    key: 'sync-incomplete', src: 'Monday sync', block: 'system', icon: 'automations', defaultTiming: 'daily', available: true,
    title: "A sync didn't finish",
    description: 'A Monday sync stopped before reading every board.',
    who: 'Admins', audience: { kind: 'admins' },
  },
  {
    key: 'first-login', src: 'Access', block: 'system', icon: 'admin', defaultTiming: 'daily', available: true,
    title: 'Someone signed in for the first time',
    description: 'A new person reached the portal, and the level they landed on.',
    who: 'Admins', audience: { kind: 'admins' },
  },
  {
    key: 'level-changed', src: 'Access', block: 'system', icon: 'admin', defaultTiming: 'daily', available: true,
    title: 'An access level was changed',
    description: "Someone's access level changed. The person is told too.",
    who: 'Admins, and the person', audience: { kind: 'everyone' },
  },
  {
    key: 'monday-account-unlinked', src: 'Monday accounts', block: 'system', icon: 'monday-accounts', defaultTiming: 'daily', available: true,
    title: 'A new Monday account with no person',
    description: 'Monday has an account the Directory does not know, so its work shows under Unknown user.',
    who: 'Admins', audience: { kind: 'admins' },
  },
]

export const TYPE_BY_KEY: ReadonlyMap<string, NotificationType> = new Map(NOTIFICATION_TYPES.map(t => [t.key, t]))

/** The tab of the drawer a type lands in. */
export const tabOf = (t: NotificationType): NotificationTab => t.block

/** The rule a notification starts with, before any admin has changed it. */
export function defaultRule(t: NotificationType): Rule {
  return {
    enabled: true, timing: t.defaultTiming, channel: 'app',
    fixEnabled: false, fixTiming: false, fixChannel: false,
    ...t.rule,
  }
}

/**
 * What a person actually gets. A fixed setting is the admin's value whatever
 * the person chose; an open one is the person's choice, or the admin's default
 * when they never chose. The person's choice is kept while a setting is fixed,
 * so it comes back if the admin opens the setting again.
 */
export function effective(rule: Rule, pref: Pref | undefined): { enabled: boolean; timing: Timing; channel: Channel } {
  return {
    enabled: rule.fixEnabled ? rule.enabled : pref?.enabled ?? rule.enabled,
    timing: rule.fixTiming ? rule.timing : pref?.timing ?? rule.timing,
    channel: rule.fixChannel ? rule.channel : pref?.channel ?? rule.channel,
  }
}

/** How much of a rule people can change: the tag on the admin's row. */
export function ruleScope(r: Rule): 'full' | 'partial' | 'fixed' {
  const fixed = [r.fixEnabled, r.fixTiming, r.fixChannel].filter(Boolean).length
  return fixed === 0 ? 'full' : fixed === 3 ? 'fixed' : 'partial'
}

/** Can this type ever reach this person? The settings page lists only those. */
export function reaches(t: NotificationType, who: { isAdmin: boolean; leads: boolean; canTool: (k: string) => boolean }): boolean {
  switch (t.audience.kind) {
    case 'everyone': return true
    case 'admins': return who.isAdmin
    case 'leaders': return who.leads || who.isAdmin
    case 'tool': return who.canTool(t.audience.tool)
  }
}

/** The hour the daily summary is delivered, in the company's timezone (Clocky's rules). */
export const DAILY_HOUR = 8
export const DAILY_ZONE = 'America/New_York'

/** Read notifications go after 30 days, unread after 90. */
export const KEEP_READ_DAYS = 30
export const KEEP_UNREAD_DAYS = 90

const TIMINGS: readonly Timing[] = ['instant', 'daily']
const CHANNEL_KEYS: readonly Channel[] = ['app', 'email', 'both']
const bool = (v: unknown): v is boolean => typeof v === 'boolean'

/**
 * What a browser sent as a person's choice, checked: only known values, and
 * only channels that exist. Null when it cannot be read at all.
 */
export function cleanPref(v: unknown): Pref | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const out: Pref = {}
  if (o.enabled !== undefined) { if (!bool(o.enabled)) return null; out.enabled = o.enabled }
  if (o.timing !== undefined) { if (!TIMINGS.includes(o.timing as Timing)) return null; out.timing = o.timing as Timing }
  if (o.channel !== undefined) {
    if (!CHANNEL_KEYS.includes(o.channel as Channel)) return null
    if (!CHANNELS.find(c => c.key === o.channel)?.available) return null
    out.channel = o.channel as Channel
  }
  return out
}

/** The same for an admin's rule, which must be complete. */
export function cleanRule(v: unknown): Rule | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  if (!bool(o.enabled) || !bool(o.fixEnabled) || !bool(o.fixTiming) || !bool(o.fixChannel)) return null
  if (!TIMINGS.includes(o.timing as Timing) || !CHANNEL_KEYS.includes(o.channel as Channel)) return null
  if (!CHANNELS.find(c => c.key === o.channel)?.available) return null
  return {
    enabled: o.enabled, timing: o.timing as Timing, channel: o.channel as Channel,
    fixEnabled: o.fixEnabled, fixTiming: o.fixTiming, fixChannel: o.fixChannel,
  }
}
