// What each manual page shows (lib/manual/registry.ts lists the pages). The
// pages kept from the one-page manual render its sections (SystemManual's
// ManualSection) until each is rewritten as a guide; new guides are their own
// components (components/manual/guides).

import { ManualSection } from '@/components/SystemManual'
import { HowItRuns } from './HowItRuns'
import { AgendaGuide, AgendaSettingsGuide } from './guides/AgendaGuide'

/** The one-page manual's section each kept page shows, by slug. */
export const SECTION_OF: Record<string, string> = {
  'getting-around': 'navigation',
  'home': 'home',
  'where-do-i-find': 'where',
  'north-time': 'north-time',
  'north-time-quick-start': 'quick-start',
  'annual-review': 'annual-review',
  'overview': 'overview',
  'pages-and-sections': 'pages',
  'access-model': 'access',
  'how-monday-feeds-it': 'monday',
  'data-sources': 'sources',
  'moving-from-tsheets': 'transition',
}

export function ManualContent({ slug, superOnly }: { slug: string; superOnly: readonly string[] }) {
  if (slug === 'agenda') return <AgendaGuide />
  if (slug === 'agenda-settings') return <AgendaSettingsGuide />
  if (slug === 'how-it-runs') return <HowItRuns />
  const id = SECTION_OF[slug]
  return id ? <ManualSection id={id} superOnly={superOnly} /> : null
}
