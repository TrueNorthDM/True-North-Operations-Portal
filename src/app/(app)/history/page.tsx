// People > History: how things came to be at True North, told with dates.
// Everyone signed in can read it, like Organization. The first tab is the
// portal's own story (components/history/PortalHistory.tsx, content in
// lib/history/portal.ts); other histories, True North's first, join as tabs.

import { Breadcrumb } from '@/components/ui/Breadcrumb'
import { PortalHistory } from '@/components/history/PortalHistory'

export const metadata = { title: 'History' }

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <Breadcrumb self="/history" />
          <h1 className="font-(family-name:--font-display) font-extrabold text-[26px] tracking-[-.01em] text-tn-ink m-0">History</h1>
          <p className="text-[14px] text-muted mt-1 m-0">How things came to be at True North, told with dates. The portal&apos;s story comes first; more histories will join it here.</p>
        </div>
        <nav aria-label="Histories" className="flex items-center gap-0.5 border-b border-[var(--panel-border)]">
          <span aria-current="page" className="px-4 py-2.5 text-[13.5px] font-semibold -mb-px border-b-2 text-tn-ink border-tn-teal">The portal</span>
          <span aria-disabled="true" className="px-4 py-2.5 text-[13.5px] font-semibold -mb-px border-b-2 border-transparent text-[#b3bcc8]">True North <span className="text-[11px] ml-1">later</span></span>
        </nav>
      </div>
      <PortalHistory />
    </div>
  )
}
