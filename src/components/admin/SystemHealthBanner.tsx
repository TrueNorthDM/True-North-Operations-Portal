// The health banner on Home, for whoever holds 'home-health': red when a
// service is down, amber when one only has a warning, and a failure of its own
// when the checks have stopped running. Renders nothing when everything is
// healthy or when the results cannot be read (the Automations page says so).
//
// Audit, 10 October 2026:
//   - it reads access with loadAccess(), not allowedTo(): showing a banner is
//     a read. allowedTo is the gate for a write, so it refused every View Stage
//     preview (the banner vanished from a preview of a level that has it) and
//     made a full session check against the Auth server on every Home render;
//   - it rolls up healthSummary(), the same sum the Automations header shows:
//     every service, warnings too, and stale results as "checks have not run".

import Link from 'next/link'
import { loadAccess } from '@/lib/access/resolve'
import { createAdminClient } from '@/lib/supabase/admin'
import { latestHealth } from '@/lib/health/checks'
import { healthSummary, type HealthSummary } from '@/lib/health/summary'
import { formatEt } from '@/lib/format/et'

export async function SystemHealthBanner() {
  // Gather data inside the try (JSX must not be constructed in a try/catch);
  // any failure yields nothing, and the banner renders nothing.
  let summary: HealthSummary | null = null
  try {
    if (!(await loadAccess()).can('home-health')) return null
    const { results, readError } = await latestHealth(createAdminClient())
    if (readError) return null
    summary = healthSummary(results)
  } catch {
    return null
  }
  if (!summary || summary.status === 'ok') return null
  return <HealthBannerView summary={summary} />
}

/** The banner itself, apart from the data so a test can render it. */
export function HealthBannerView({ summary }: { summary: HealthSummary }) {
  const down = summary.status === 'down'
  const problems = summary.problems
  const downList = problems.filter(p => p.status === 'down')
  const title = summary.stale
    ? 'Health checks have not run'
    : down
      ? (downList.length === 1 ? `${downList[0].label} is down` : `${downList.length} services are down`)
      : (problems.length === 1 ? `${problems[0].label} has a warning` : `${problems.length} services have warnings`)

  // Light theme: dark red / dark amber words on a pale ground, both above 7:1.
  const tone = down
    ? { box: 'border-[#d7392f]/35 bg-[#fdecea] hover:bg-[#fbe1de]', chip: 'bg-[#d7392f]/12 text-[#b3271f]', title: 'text-[#8f1f18]', text: 'text-[#7d1d17]' }
    : { box: 'border-[#d99409]/40 bg-[#fff7e6] hover:bg-[#fff0d1]', chip: 'bg-[#d99409]/15 text-[#8a5a00]', title: 'text-[#6b4500]', text: 'text-[#5c3b00]' }

  return (
    // The live region wraps the link rather than sitting on it: a role on the
    // <a> itself would replace its link role for screen readers.
    <div role={down ? 'alert' : 'status'} className={`rounded-[14px] border transition-colors ${tone.box}`}>
      <Link href="/admin/automations" className="flex items-start gap-3 px-5 py-3.5">
        <span className={`shrink-0 inline-flex w-8 h-8 items-center justify-center rounded-[10px] ${tone.chip}`}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className={`font-(family-name:--font-display) font-extrabold text-[13.5px] ${tone.title}`}>{title}</div>
          <ul className={`mt-1 space-y-0.5 text-[12.5px] list-none ${tone.text}`}>
            {problems.map(p => (
              <li key={p.service}>
                <b>{p.label}</b>{p.status === 'warn' && down ? ' (warning)' : ''}: {p.service === 'health_runs' && summary.lastChecked
                  ? `the checks have not run since ${formatEt(summary.lastChecked)}, so the other results may be out of date.`
                  : p.detail}
              </li>
            ))}
          </ul>
        </div>
        <span className={`shrink-0 text-[12.5px] font-bold ${tone.title}`}>Open Automations &rarr;</span>
      </Link>
    </div>
  )
}
