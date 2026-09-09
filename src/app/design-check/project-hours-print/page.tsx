// Design check: the printed sheet, both versions, without a login.
//
// The PDF route drives a headless browser at the real print page, which needs
// auth and live data. This renders the same layout from the same fixture the
// on-screen design check uses, so the paper version can be looked at.

import { ProjectHoursPrint } from '@/components/tsheets/ProjectHoursPrint'
import { DATA } from '../project-hours/fixture'

export default function ProjectHoursPrintDesignCheck() {
  return (
    <div className="min-h-screen bg-[#efedE8] px-6 py-10 space-y-8">
      {(['client', 'internal'] as const).map(type => (
        <div key={type} className="max-w-[1100px] mx-auto">
          <p className="text-[11px] font-(family-name:--font-display) font-extrabold uppercase tracking-[.14em] text-tn-teal mb-2">
            Design check · {type}
          </p>
          <div className="bg-white rounded-[10px] shadow-sm overflow-hidden">
            <ProjectHoursPrint
              data={DATA}
              type={type}
              periodLabel="September 2026"
              generatedOn="8 September 2026"
            />
          </div>
        </div>
      ))}
    </div>
  )
}
