/**
 * The line above a client report: where its numbers come from, how fresh they
 * are, and the way to the guide.
 *
 * The badge and the round "i" are right-aligned so they land over the report's
 * own toolbar, the Add hours / Team Update / Export group in the row below.
 * They used to sit hard against the end of the sentence, which put them in the
 * middle of a wide screen with nothing under them. Freshness belongs beside the
 * buttons that export what it describes.
 *
 * Reading order inside the group is the order the questions come in: how old
 * is this, then where do I read more. The "i" goes last for the same reason it
 * goes last everywhere else in the portal, it is the way out of the page.
 */

import Link from 'next/link'
import { SyncStatus } from './settings/SyncStatus'

export function ReportMeta(
  { sourceLine, guideHref, syncedAt, failed = false }: {
    /** Where the hours came from, in the report's own words. */
    sourceLine: string
    /** Null when the guide (i7-guide) is not open to the viewer. */
    guideHref: string | null
    syncedAt: string | null
    failed?: boolean
  },
) {
  return (
    <div className="flex items-center gap-x-4 gap-y-2.5 flex-wrap">
      <p className="text-sm text-muted leading-relaxed m-0">{sourceLine}</p>
      {/* ml-auto rather than justify-between: when the sentence is long enough
          to take the whole line, the group wraps underneath and stays right. */}
      <div className="ml-auto shrink-0 flex items-center gap-2.5">
        <SyncStatus syncedAt={syncedAt} failed={failed} />
        {guideHref && <Link
          href={guideHref}
          title="How the report works"
          aria-label="How the report works"
          className="shrink-0 w-9 h-9 rounded-full bg-tn-primary text-white flex items-center justify-center shadow-[0_8px_18px_-8px_rgba(1,35,88,.6)] transition-transform hover:-translate-y-0.5"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F2C40A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
        </Link>}
      </div>
    </div>
  )
}
