/**
 * Each Href Links site's own look on its pages: the heading's colour and font,
 * the progress bar, and the name to fall back on. The two sites share one set
 * of pages (SiteListPage, SitePageDetail) and differ only here.
 */

import type { SiteCode } from '@/lib/href-links/rules'

export const SITE_BRAND: Record<SiteCode, { label: string; fallbackName: string; heading: string; bar: string }> = {
  aaaf: {
    label: 'AAAF',
    fallbackName: 'Ask An Adventist Friend',
    heading: 'text-aaaf-primary font-(family-name:--font-aaaf-display)',
    bar: 'bg-aaaf-primary',
  },
  hfa: {
    label: 'HFA',
    fallbackName: 'Hope For Africa',
    // Same heading treatment as AAAF (Nunito, 3xl, extrabold, mixed case),
    // only the colour is HFA's orange.
    heading: 'text-hfa-primary font-(family-name:--font-aaaf-display)',
    bar: 'bg-hfa-primary',
  },
}
