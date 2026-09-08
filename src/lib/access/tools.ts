/**
 * access/tools.ts: the cards on Tools & Dashboards, which are exactly the rows
 * a team can be granted (Directory → Teams → "Tool access").
 *
 * ONE list, on purpose. The Tools & Dashboards page renders from it and the
 * Teams tab grants from it, so a tool cannot exist in one place and be missing
 * from the other: add an entry here and it appears in both.
 *
 * The corollary matters just as much: anything NOT in this list is not a tool,
 * and is governed solely by the access-level matrix (access/surfaces.ts). My
 * Work used to sit here despite never being a card on Tools & Dashboards, which
 * meant it needed a team grant nobody had thought to give.
 *
 * `key` is stored in team_tool_grants.tool_key, so it must never change once
 * shipped, rename the label freely but keep the key. `sensitive` flags cards
 * that expose money or PII so the UI can mark them.
 */

export type ToolAudience = 'lead' | 'all'

export interface ToolDef {
  key: string
  label: string
  href: string
  group: 'Dashboards' | 'Tools'
  description: string
  sensitive?: boolean
  /** Renders the card as a preview, not yet openable. */
  soon?: boolean
}

export const TOOLS: ToolDef[] = [
  {
    key: 'publishing',
    label: 'Publishing Goals',
    href: '/dashboards/publishing',
    group: 'Dashboards',
    description: 'Weekly publishing pace vs target, the live dashboard.',
  },
  {
    key: 'workload',
    label: 'Workload',
    href: '/boards-beta',
    group: 'Dashboards',
    description: 'Native rewrite (Goals, Translation, Targets). Work in progress.',
    soon: true,
  },
  {
    key: 'href-links',
    label: 'Href Link Management',
    href: '/projects',
    group: 'Tools',
    description: "Manage hreflang tags for a project's WordPress pages. Open a project (AAAF or HFA) to use it.",
  },
  // One entry per client, not one entry for "reports". Each client's numbers
  // are a separate thing to trust someone with, so each is a separate grant on
  // the Directory's Teams tab.
  //
  // The i7 key stays 'i7-budget'. It is internal, nobody sees it, and every
  // existing team grant is stored under it: renaming it would silently revoke
  // access for whoever already has it, because the resolver drops grants whose
  // key has left this catalogue.
  {
    key: 'i7-budget',
    label: 'Client Report - i7',
    href: '/tools/time-report',
    group: 'Tools',
    description: 'Hours, cost and budget usage for i7 Marketing, from QuickBooks Time.',
    sensitive: true,
  },
  {
    key: 'grant-pass-report',
    label: 'Client Report - Project Hours & Others',
    href: '/tools/time-report/grant-pass',
    group: 'Tools',
    description: 'Hours, costs and donations for AskAnAdventistFriend, Grants Pass and Hope for Africa.',
    sensitive: true,
  },
]

/** Valid tool keys, the server action validates writes against this. */
export const TOOL_KEYS: ReadonlySet<string> = new Set(TOOLS.map(t => t.key))

export const AUDIENCE_LABEL: Record<ToolAudience, string> = {
  lead: 'Lead only',
  all: 'Whole team',
}
