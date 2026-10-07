// A prominent red banner shown to admins (only) when a monitored integration is
// down, so a silent outage like the Monday webhook that stopped delivering can't
// go unnoticed. Renders nothing when everything is healthy, for non-admins, or
// if health data isn't available yet. Self-contained server component: drop it
// at the top of any page.

import Link from 'next/link'
import { allowedTo } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { latestHealth, HEALTH_LABEL } from '@/lib/health/checks'

export async function SystemHealthBanner() {
  // Gather data inside the try (JSX must not be constructed in a try/catch);
  // any failure just yields an empty list, so the banner renders nothing.
  let down: string[] = []
  try {
    if (!(await allowedTo('home-health'))) return null
    const health = await latestHealth(createAdminClient())
    down = Object.values(health)
      .filter(h => !h.ok && h.status === 'down')
      .map(h => HEALTH_LABEL[h.service] ?? h.service)
  } catch {
    return null
  }
  if (down.length === 0) return null

  return (
    <Link
      href="/admin/automations"
      className="flex items-center gap-3 rounded-[14px] border border-[#d7392f]/30 bg-[#fdecea] px-5 py-3.5 transition-colors hover:bg-[#fbe1de]"
    >
      <span className="shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-[10px] bg-[#d7392f]/12 text-[#b3271f]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-(family-name:--font-display) font-extrabold text-[13.5px] text-[#8f1f18]">
          {down.length === 1 ? `${down[0]} is down` : `${down.length} integrations are down`}
        </div>
        <div className="text-[12.5px] text-[#a3352d]">{down.join(', ')}. Sync may be broken. Open Automations to see details.</div>
      </div>
      <span className="shrink-0 text-[12.5px] font-bold text-[#b3271f]">View &rarr;</span>
    </Link>
  )
}
