/**
 * access/tools.ts: the catalogue of tools/dashboards a team can be granted
 * access to (Teams tab → "Tool access").
 *
 * Curated static list (same reasoning as favorites/catalog.ts): the `key` is a
 * stable identifier stored in team_tool_grants.tool_key, so it must never change
 * once shipped, rename the label freely, but keep the key. `href` is where the
 * tool lives (used for the row link + Part 4's nav gating); `group` buckets the
 * rows in the card; `sensitive` flags surfaces that expose money/PII (the i7
 * budget) so the UI can mark them.
 *
 * This is the DATA layer only. Enforcing these grants in the nav is Part 4,
 * until then every team effectively sees everything.
 */

export type ToolAudience = 'lead' | 'all'

export interface ToolDef {
  key: string
  label: string
  href: string
  group: 'Dashboards' | 'Tools'
  sensitive?: boolean
}

export const TOOLS: ToolDef[] = [
  { key: 'publishing', label: 'Publishing Goals', href: '/dashboards/publishing', group: 'Dashboards' },
  { key: 'workload', label: 'Workload', href: '/boards-beta', group: 'Dashboards' },
  { key: 'href-links', label: 'Href Link Management', href: '/projects', group: 'Tools' },
  { key: 'i7-budget', label: 'Clients Reports', href: '/tools/time-report', group: 'Tools', sensitive: true },
  { key: 'my-work', label: 'My Work', href: '/my-work', group: 'Tools' },
]

/** Valid tool keys, the server action validates writes against this. */
export const TOOL_KEYS: ReadonlySet<string> = new Set(TOOLS.map(t => t.key))

export const AUDIENCE_LABEL: Record<ToolAudience, string> = {
  lead: 'Lead only',
  all: 'Whole team',
}
