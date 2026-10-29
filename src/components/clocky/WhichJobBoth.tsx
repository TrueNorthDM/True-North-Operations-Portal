'use client'

/**
 * "Which job?" while TSheets and North Time run side by side (owner, 29
 * October 2026: TSheets keeps its old list until it is switched off). Two
 * guides behind one choice: the 2026 structure for people on North Time, the
 * TSheets list for people still clocking there.
 */

import { useState } from 'react'
import type { ActivityRow, GuideGroup } from '@/lib/timeclock/job-catalogue'
import { WhichJobView } from './WhichJobView'
import { WhichJob2026View, type ProjectRow } from './WhichJob2026View'

type Guide = 'north' | 'tsheets'

export function WhichJobBoth({ projects, activities, groups, codes }: { projects: ProjectRow[]; activities: ActivityRow[]; groups: GuideGroup[]; codes: string[] }) {
  const [guide, setGuide] = useState<Guide>('north')
  const switcher = (
    <div className="mt-3 grid gap-1.5">
      <div className="flex bg-white border border-[var(--panel-border)] rounded-[10px] p-[3px] gap-0.5 w-fit max-w-full flex-wrap" role="group" aria-label="Which list">
        {([['north', 'North Time: the 2026 structure'], ['tsheets', 'TSheets: the old list']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={guide === k} onClick={() => setGuide(k)}
            className={`border-0 cursor-pointer rounded-[8px] px-3 py-1.5 font-(family-name:--font-display) font-bold text-[12.5px] leading-[normal] ${guide === k ? 'bg-tn-primary text-[#ffffff]' : 'bg-transparent text-foreground'}`}>{l}</button>
        ))}
      </div>
      <p className="m-0 text-[12.5px] text-muted [text-wrap:pretty]">People on North Time pick from the 2026 structure. People still on TSheets keep its old list until they move; the portal translates their entries.</p>
    </div>
  )
  return guide === 'north'
    ? <WhichJob2026View projects={projects} activities={activities} switcher={switcher} />
    : <WhichJobView groups={groups} codes={codes} switcher={switcher} />
}
